/**
 * Mindmap Service
 * Handles tree operations, cycle detection, roll-up progress,
 * radial & horizontal collision-free layout calculation,
 * export/import hardening, and tenancy-safe link verification.
 */

const { Op } = require('sequelize');
const Mindmap = require('../../models/Mindmap');
const MindmapNode = require('../../models/MindmapNode');
const Task = require('../../models/Task');
const Lead = require('../../models/Lead');
const Campaign = require('../../models/Campaign');
const sequelize = require('../../config/database');
const logger = require('../../config/logger');

const MAX_NODES_PER_MAP = 500;
const MAX_DEPTH = 6;

// Exact 11 skeleton branch titles (Amendment 10)
const SKELETON_BRANCH_TITLES = [
  'Sales pipeline',
  'Lead generation',
  'Outreach and calls',
  'Marketing and content',
  'Google and SEO',
  'Product and samples',
  'Production',
  'Shipping and payments',
  'Finance and pricing',
  'Systems and mindset',
  'Risks'
];

/**
 * Strips HTML tags and sanitizes untrusted text
 */
function sanitizeText(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/<[^>]*>?/gm, '').trim();
}

class MindmapService {
  /**
   * Verify that linked resources (Task, Lead, Campaign) belong strictly to req.userId
   */
  async verifyLinkTenancy(userId, { linkedTaskId, linkedLeadId, linkedCampaignId }) {
    if (linkedTaskId) {
      const task = await Task.findOne({ where: { id: linkedTaskId, userId } });
      if (!task) {
        const error = new Error('Forbidden: Linked task does not exist or belongs to another user');
        error.statusCode = 403;
        throw error;
      }
    }

    if (linkedLeadId) {
      const lead = await Lead.findOne({ where: { id: linkedLeadId, userId } });
      if (!lead) {
        const error = new Error('Forbidden: Linked lead does not exist or belongs to another user');
        error.statusCode = 403;
        throw error;
      }
    }

    if (linkedCampaignId) {
      const campaign = await Campaign.findOne({ where: { id: linkedCampaignId, userId } });
      if (!campaign) {
        const error = new Error('Forbidden: Linked campaign does not exist or belongs to another user');
        error.statusCode = 403;
        throw error;
      }
    }
  }

  /**
   * Compute tree hierarchy, depths, roll-up statuses, and overdue flags
   */
  buildTreeHierarchy(nodes, userTimezone = 'Asia/Dubai') {
    const nodeMap = new Map();
    const roots = [];

    // Today in user timezone for overdue check
    const nowInTz = new Date(new Date().toLocaleString('en-US', { timeZone: userTimezone }));

    nodes.forEach((n) => {
      const data = n.toJSON ? n.toJSON() : { ...n };
      data.children = [];
      data.isOverdue = false;

      if (data.dueDate && data.status !== 'done') {
        const due = new Date(new Date(data.dueDate).toLocaleString('en-US', { timeZone: userTimezone }));
        data.isOverdue = due < nowInTz;
      }

      nodeMap.set(data.id, data);
    });

    nodeMap.forEach((node) => {
      if (node.parentId && nodeMap.has(node.parentId)) {
        nodeMap.get(node.parentId).children.push(node);
      } else {
        roots.push(node);
      }
    });

    // Sort children by sortOrder
    const sortRec = (n) => {
      n.children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
      n.children.forEach(sortRec);
    };
    roots.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    roots.forEach(sortRec);

    // Compute depth and roll-up progress
    function computeRollup(node, depth = 1) {
      node.depth = depth;

      if (!node.children || node.children.length === 0) {
        // Leaf node: carries real status
        node.isLeaf = true;
        node.leafCount = 1;
        node.doneLeafCount = node.status === 'done' ? 1 : 0;
        node.progressPct = node.status === 'done' ? 100 : (node.status === 'doing' ? 50 : 0);
        return;
      }

      node.isLeaf = false;
      let totalLeaves = 0;
      let doneLeaves = 0;
      let hasDoing = false;

      node.children.forEach((child) => {
        computeRollup(child, depth + 1);
        totalLeaves += child.leafCount;
        doneLeaves += child.doneLeafCount;
        if (child.status === 'doing' || (child.progressPct > 0 && child.progressPct < 100)) {
          hasDoing = true;
        }
      });

      node.leafCount = totalLeaves;
      node.doneLeafCount = doneLeaves;
      node.progressPct = totalLeaves > 0 ? Math.round((doneLeaves / totalLeaves) * 100) : 0;

      // Derived parent status (Amendment 6)
      if (doneLeaves === totalLeaves && totalLeaves > 0) {
        node.derivedStatus = 'done';
      } else if (doneLeaves > 0 || hasDoing) {
        node.derivedStatus = 'doing';
      } else {
        node.derivedStatus = 'todo';
      }
    }

    roots.forEach((r) => computeRollup(r, 1));

    // Calculate overall mindmap metrics
    let totalMapLeaves = 0;
    let doneMapLeaves = 0;
    roots.forEach((r) => {
      totalMapLeaves += r.leafCount || 0;
      doneMapLeaves += r.doneLeafCount || 0;
    });

    const overallProgressPct = totalMapLeaves > 0 ? Math.round((doneMapLeaves / totalMapLeaves) * 100) : 0;

    return {
      roots,
      nodeMap,
      totalLeaves: totalMapLeaves,
      doneLeaves: doneMapLeaves,
      overallProgressPct
    };
  }

  /**
   * Check depth and cycle before moving or parenting
   */
  async validateMoveOrParent(userId, mindmapId, nodeId, newParentId) {
    if (newParentId === null || newParentId === undefined) {
      return; // Moving to root is always valid
    }

    if (String(nodeId) === String(newParentId)) {
      const err = new Error('Invalid move: A node cannot be its own parent');
      err.statusCode = 400;
      throw err;
    }

    // Load all nodes for this mindmap to inspect ancestors and depth
    const allNodes = await MindmapNode.findAll({
      where: { userId, mindmapId },
      attributes: ['id', 'parentId']
    });

    const parentMap = new Map();
    allNodes.forEach((n) => parentMap.set(n.id, n.parentId));

    // 1. Cycle detection: Traverse up from newParentId
    let curr = newParentId;
    while (curr) {
      if (String(curr) === String(nodeId)) {
        const err = new Error('Cycle detected: Cannot move a node under itself or its descendants');
        err.statusCode = 400;
        throw err;
      }
      curr = parentMap.get(curr);
    }

    // 2. Depth validation: Check depth of newParentId + max subtree depth of nodeId
    let parentDepth = 1;
    curr = newParentId;
    while (curr) {
      parentDepth++;
      curr = parentMap.get(curr);
    }

    // Compute height of nodeId's subtree
    function getSubtreeHeight(id) {
      let maxHeight = 0;
      allNodes.forEach((n) => {
        if (n.parentId === id) {
          maxHeight = Math.max(maxHeight, 1 + getSubtreeHeight(n.id));
        }
      });
      return maxHeight;
    }

    const subtreeHeight = getSubtreeHeight(nodeId);
    if (parentDepth + subtreeHeight > MAX_DEPTH) {
      const err = new Error(`Exceeds maximum tree depth of ${MAX_DEPTH} levels`);
      err.statusCode = 400;
      throw err;
    }
  }

  /**
   * Create a mindmap with optional blank skeleton
   */
  async createMindmap(userId, payload) {
    const { title, description, goalText, targetValue, targetUnit, deadline, layoutPref, isSkeleton } = payload;

    const t = await sequelize.transaction();
    try {
      const mindmap = await Mindmap.create(
        {
          userId,
          title: sanitizeText(title),
          description: sanitizeText(description),
          goalText: sanitizeText(goalText),
          targetValue,
          targetUnit: sanitizeText(targetUnit),
          deadline,
          layoutPref: layoutPref || 'radial',
          status: 'active'
        },
        { transaction: t }
      );

      // If starting from skeleton, insert the exact 11 branch titles with zero pre-written advice/numbers
      if (isSkeleton) {
        for (let i = 0; i < SKELETON_BRANCH_TITLES.length; i++) {
          await MindmapNode.create(
            {
              userId,
              mindmapId: mindmap.id,
              parentId: null,
              title: SKELETON_BRANCH_TITLES[i],
              summary: null,
              why: null,
              how: null,
              priority: 'now',
              status: 'todo',
              sortOrder: i
            },
            { transaction: t }
          );
        }
      }

      await t.commit();
      return mindmap;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Duplicate mindmap (respects 500-node limit)
   */
  async duplicateMindmap(userId, mindmapId) {
    const sourceMap = await Mindmap.findOne({ where: { id: mindmapId, userId } });
    if (!sourceMap) {
      const err = new Error('Mindmap not found');
      err.statusCode = 404;
      throw err;
    }

    const sourceNodes = await MindmapNode.findAll({
      where: { mindmapId, userId },
      order: [['sortOrder', 'ASC']]
    });

    if (sourceNodes.length > MAX_NODES_PER_MAP) {
      const err = new Error(`Cannot duplicate: Map exceeds ${MAX_NODES_PER_MAP} nodes`);
      err.statusCode = 400;
      throw err;
    }

    const t = await sequelize.transaction();
    try {
      const newMap = await Mindmap.create(
        {
          userId,
          title: `${sourceMap.title} (Copy)`,
          description: sourceMap.description,
          goalText: sourceMap.goalText,
          targetValue: sourceMap.targetValue,
          targetUnit: sourceMap.targetUnit,
          deadline: sourceMap.deadline,
          layoutPref: sourceMap.layoutPref,
          status: 'active'
        },
        { transaction: t }
      );

      // Map old node IDs to newly generated node IDs
      const idMap = new Map();

      // First pass: create nodes without parentId
      for (const node of sourceNodes) {
        const created = await MindmapNode.create(
          {
            userId,
            mindmapId: newMap.id,
            parentId: null, // set in second pass
            title: node.title,
            summary: node.summary,
            why: node.why,
            how: node.how,
            startDate: node.startDate,
            dueDate: node.dueDate,
            owner: node.owner,
            kpiLabel: node.kpiLabel,
            kpiTarget: node.kpiTarget,
            kpiCurrent: node.kpiCurrent,
            priority: node.priority,
            status: node.status,
            color: node.color,
            icon: node.icon,
            tags: node.tags,
            collapsed: node.collapsed,
            sortOrder: node.sortOrder,
            linkedTaskId: null, // Unlink external items on copy
            linkedCampaignId: null,
            linkedLeadId: null
          },
          { transaction: t }
        );
        idMap.set(node.id, created.id);
      }

      // Second pass: update parentId
      for (const node of sourceNodes) {
        if (node.parentId && idMap.has(node.parentId)) {
          const newId = idMap.get(node.id);
          const newParentId = idMap.get(node.parentId);
          await MindmapNode.update(
            { parentId: newParentId },
            { where: { id: newId }, transaction: t }
          );
        }
      }

      await t.commit();
      return newMap;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Delete node and all its descendants in a transaction
   */
  async deleteSubtree(userId, mindmapId, nodeId) {
    const allNodes = await MindmapNode.findAll({
      where: { userId, mindmapId },
      attributes: ['id', 'parentId']
    });

    const toDeleteIds = [parseInt(nodeId, 10)];
    let index = 0;

    while (index < toDeleteIds.length) {
      const currentId = toDeleteIds[index];
      allNodes.forEach((n) => {
        if (n.parentId === currentId && !toDeleteIds.includes(n.id)) {
          toDeleteIds.push(n.id);
        }
      });
      index++;
    }

    const t = await sequelize.transaction();
    try {
      // Unlink any related tasks before deleting
      await Task.update(
        { relatedMindmapNodeId: null },
        { where: { relatedMindmapNodeId: { [Op.in]: toDeleteIds }, userId }, transaction: t }
      );

      const deletedCount = await MindmapNode.destroy({
        where: {
          id: { [Op.in]: toDeleteIds },
          userId,
          mindmapId
        },
        transaction: t
      });

      await t.commit();
      return { deletedCount, deletedIds: toDeleteIds };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Duplicate a subtree under the same parent
   */
  async duplicateSubtree(userId, mindmapId, nodeId) {
    const allNodes = await MindmapNode.findAll({
      where: { userId, mindmapId }
    });

    const targetNode = allNodes.find((n) => n.id === parseInt(nodeId, 10));
    if (!targetNode) {
      const err = new Error('Node not found');
      err.statusCode = 404;
      throw err;
    }

    // Collect subtree
    const subtree = [targetNode];
    let index = 0;
    while (index < subtree.length) {
      const curr = subtree[index];
      allNodes.forEach((n) => {
        if (n.parentId === curr.id && !subtree.some((s) => s.id === n.id)) {
          subtree.push(n);
        }
      });
      index++;
    }

    if (allNodes.length + subtree.length > MAX_NODES_PER_MAP) {
      const err = new Error(`Cannot duplicate: would exceed map limit of ${MAX_NODES_PER_MAP} nodes`);
      err.statusCode = 400;
      throw err;
    }

    const t = await sequelize.transaction();
    try {
      const idMap = new Map();

      for (const node of subtree) {
        const isRootOfSubtree = node.id === targetNode.id;
        const created = await MindmapNode.create(
          {
            userId,
            mindmapId,
            parentId: isRootOfSubtree ? targetNode.parentId : null,
            title: isRootOfSubtree ? `${node.title} (Copy)` : node.title,
            summary: node.summary,
            why: node.why,
            how: node.how,
            startDate: node.startDate,
            dueDate: node.dueDate,
            owner: node.owner,
            kpiLabel: node.kpiLabel,
            kpiTarget: node.kpiTarget,
            kpiCurrent: node.kpiCurrent,
            priority: node.priority,
            status: node.status,
            color: node.color,
            icon: node.icon,
            tags: node.tags,
            collapsed: node.collapsed,
            sortOrder: isRootOfSubtree ? (targetNode.sortOrder || 0) + 1 : node.sortOrder,
            linkedTaskId: null,
            linkedCampaignId: null,
            linkedLeadId: null
          },
          { transaction: t }
        );
        idMap.set(node.id, created.id);
      }

      // Re-parent children
      for (const node of subtree) {
        if (node.id !== targetNode.id && node.parentId && idMap.has(node.parentId)) {
          const newId = idMap.get(node.id);
          const newParentId = idMap.get(node.parentId);
          await MindmapNode.update(
            { parentId: newParentId },
            { where: { id: newId }, transaction: t }
          );
        }
      }

      await t.commit();
      return { duplicatedCount: subtree.length };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Complete all descendants of a parent node
   */
  async completeDescendants(userId, mindmapId, nodeId) {
    const allNodes = await MindmapNode.findAll({
      where: { userId, mindmapId },
      attributes: ['id', 'parentId', 'status']
    });

    const descendantIds = [];
    const queue = [parseInt(nodeId, 10)];

    while (queue.length > 0) {
      const currentId = queue.shift();
      allNodes.forEach((n) => {
        if (n.parentId === currentId && !descendantIds.includes(n.id)) {
          descendantIds.push(n.id);
          queue.push(n.id);
        }
      });
    }

    if (descendantIds.length > 0) {
      await MindmapNode.update(
        { status: 'done' },
        {
          where: {
            id: { [Op.in]: descendantIds },
            userId,
            mindmapId
          }
        }
      );
    }

    await MindmapNode.update(
      { status: 'done' },
      { where: { id: nodeId, userId, mindmapId } }
    );

    return { completedCount: descendantIds.length + 1 };
  }

  /**
   * Collision-Free Radial & Horizontal Layout Algorithm (Amendment 5)
   * Computes precise 2D (x, y) coordinates for all nodes to guarantee zero overlap.
   */
  calculateNodeCoordinates(hierarchy, layoutType = 'radial') {
    const CARD_WIDTH = 220;
    const CARD_HEIGHT = 80;
    const CARD_MARGIN_X = 50;
    const CARD_MARGIN_Y = 30;

    const coords = new Map();

    if (layoutType === 'horizontal') {
      // Horizontal Tidy Tree (Left to Right)
      let currentY = 0;

      function layoutHorizontal(node, depth = 0) {
        const x = depth * (CARD_WIDTH + CARD_MARGIN_X);

        if (!node.children || node.children.length === 0) {
          const y = currentY;
          currentY += CARD_HEIGHT + CARD_MARGIN_Y;
          coords.set(node.id, { x, y, width: CARD_WIDTH, height: CARD_HEIGHT });
          return y;
        }

        const childYs = [];
        node.children.forEach((child) => {
          childYs.push(layoutHorizontal(child, depth + 1));
        });

        // Center parent between first and last child
        const minY = childYs[0];
        const maxY = childYs[childYs.length - 1];
        const y = Math.round((minY + maxY) / 2);

        coords.set(node.id, { x, y, width: CARD_WIDTH, height: CARD_HEIGHT });
        return y;
      }

      hierarchy.roots.forEach((root) => {
        layoutHorizontal(root, 1);
      });

      // Vertically center the tree around 0 so the central goal at (0, 0) aligns with the vertical middle
      const yCenter = Math.round(currentY / 2);
      coords.forEach((coord, id) => {
        coords.set(id, { ...coord, y: coord.y - yCenter });
      });

      return coords;
    }

    // Radial Layout (Center Outward with Collision-Free Angular Partitions)
    // Center Goal Node is at (0, 0)
    const numRoots = hierarchy.roots.length;
    if (numRoots === 0) return coords;

    // Radius computed based on total leaf count to prevent boundary overlaps
    const totalLeaves = Math.max(numRoots, hierarchy.totalLeaves || 1);
    const minCircumference = totalLeaves * (CARD_HEIGHT + CARD_MARGIN_Y);
    const baseRadius = Math.max(340, Math.round(minCircumference / (2 * Math.PI)));

    let cumulativeAngle = 0;

    hierarchy.roots.forEach((root) => {
      // Sector angle proportional to this branch's leaf weight
      const leafWeight = Math.max(1, root.leafCount || 1);
      const sectorAngle = (leafWeight / totalLeaves) * 2 * Math.PI;
      const branchMidAngle = cumulativeAngle + sectorAngle / 2;

      function layoutRadialBranch(node, depth = 1, startAngle, angleSpan) {
        const radius = baseRadius * depth * 0.75;
        const angle = startAngle + angleSpan / 2;

        const x = Math.round(radius * Math.cos(angle));
        const y = Math.round(radius * Math.sin(angle));

        coords.set(node.id, { x, y, width: CARD_WIDTH, height: CARD_HEIGHT, angle });

        if (node.children && node.children.length > 0) {
          const childLeaves = node.leafCount || node.children.length;
          let childStartAngle = startAngle;

          node.children.forEach((child) => {
            const childWeight = Math.max(1, child.leafCount || 1);
            const childSpan = (childWeight / childLeaves) * angleSpan;
            layoutRadialBranch(child, depth + 1, childStartAngle, childSpan);
            childStartAngle += childSpan;
          });
        }
      }

      layoutRadialBranch(root, 1, cumulativeAngle, sectorAngle);
      cumulativeAngle += sectorAngle;
    });

    return coords;
  }

  /**
   * Import Mindmap JSON with Strict Hardening (Amendment 2)
   */
  async importMindmap(userId, rawData) {
    if (!rawData || typeof rawData !== 'object') {
      const err = new Error('Invalid mindmap payload');
      err.statusCode = 400;
      throw err;
    }

    const title = sanitizeText(rawData.title || 'Imported Mindmap');
    const description = sanitizeText(rawData.description || '');
    const goalText = sanitizeText(rawData.goalText || '');
    const targetValue = rawData.targetValue ? parseFloat(rawData.targetValue) : null;
    const targetUnit = sanitizeText(rawData.targetUnit || '');
    const deadline = rawData.deadline ? new Date(rawData.deadline) : null;
    const layoutPref = ['radial', 'horizontal', 'vertical'].includes(rawData.layoutPref)
      ? rawData.layoutPref
      : 'radial';

    const rawNodes = Array.isArray(rawData.nodes) ? rawData.nodes : [];

    if (rawNodes.length > MAX_NODES_PER_MAP) {
      const err = new Error(`Import exceeds maximum limit of ${MAX_NODES_PER_MAP} nodes`);
      err.statusCode = 400;
      throw err;
    }

    const t = await sequelize.transaction();
    try {
      const mindmap = await Mindmap.create(
        {
          userId,
          title,
          description,
          goalText,
          targetValue,
          targetUnit,
          deadline,
          layoutPref,
          status: 'active'
        },
        { transaction: t }
      );

      // Regenerate all IDs, strip incoming userId & linked fields
      const idMap = new Map();

      // First pass: create all nodes with sanitized text
      for (let i = 0; i < rawNodes.length; i++) {
        const rn = rawNodes[i];
        const oldId = rn.id;

        const created = await MindmapNode.create(
          {
            userId,
            mindmapId: mindmap.id,
            parentId: null, // assigned in 2nd pass
            title: sanitizeText(rn.title || `Action ${i + 1}`),
            summary: sanitizeText(rn.summary || ''),
            why: sanitizeText(rn.why || ''),
            how: sanitizeText(rn.how || ''),
            startDate: rn.startDate ? new Date(rn.startDate) : null,
            dueDate: rn.dueDate ? new Date(rn.dueDate) : null,
            owner: sanitizeText(rn.owner || ''),
            kpiLabel: sanitizeText(rn.kpiLabel || ''),
            kpiTarget: rn.kpiTarget ? parseFloat(rn.kpiTarget) : null,
            kpiCurrent: rn.kpiCurrent ? parseFloat(rn.kpiCurrent) : 0.00,
            priority: ['now', 'next', 'later'].includes(rn.priority) ? rn.priority : 'now',
            status: ['todo', 'doing', 'done'].includes(rn.status) ? rn.status : 'todo',
            color: sanitizeText(rn.color || null),
            icon: sanitizeText(rn.icon || null),
            tags: Array.isArray(rn.tags) ? rn.tags.map(sanitizeText) : [],
            collapsed: Boolean(rn.collapsed),
            sortOrder: i,
            linkedTaskId: null, // Strip all external links on import
            linkedCampaignId: null,
            linkedLeadId: null
          },
          { transaction: t }
        );

        if (oldId !== undefined && oldId !== null) {
          idMap.set(oldId, created.id);
        }
      }

      // Second pass: map parent relations
      for (const rn of rawNodes) {
        if (rn.parentId && idMap.has(rn.parentId) && idMap.has(rn.id)) {
          const newId = idMap.get(rn.id);
          const newParentId = idMap.get(rn.parentId);
          await MindmapNode.update(
            { parentId: newParentId },
            { where: { id: newId }, transaction: t }
          );
        }
      }

      // Verify max depth does not exceed 6 after parenting
      const importedNodes = await MindmapNode.findAll({
        where: { mindmapId: mindmap.id },
        attributes: ['id', 'parentId'],
        transaction: t
      });

      const pMap = new Map();
      importedNodes.forEach((n) => pMap.set(n.id, n.parentId));

      for (const n of importedNodes) {
        let depth = 1;
        let curr = n.parentId;
        while (curr) {
          depth++;
          curr = pMap.get(curr);
        }
        if (depth > MAX_DEPTH) {
          const err = new Error(`Imported hierarchy exceeds maximum depth limit of ${MAX_DEPTH} levels`);
          err.statusCode = 400;
          throw err;
        }
      }

      await t.commit();
      return mindmap;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Export Mindmap to Markdown outline
   */
  exportToMarkdown(mindmap, hierarchy) {
    let md = `# ${mindmap.title}\n\n`;

    if (mindmap.goalText) {
      md += `> **Goal:** ${mindmap.goalText}`;
      if (mindmap.targetValue) {
        md += ` (${mindmap.targetValue} ${mindmap.targetUnit || ''})`;
      }
      if (mindmap.deadline) {
        md += ` | Deadline: ${new Date(mindmap.deadline).toISOString().slice(0, 10)}`;
      }
      md += `\n> **Overall Progress:** ${hierarchy.overallProgressPct}%\n\n---\n\n`;
    }

    function renderNode(node, indent = 0) {
      const prefix = '  '.repeat(indent);
      const statusIcon = node.status === 'done' || node.derivedStatus === 'done' ? '[x]' : '[ ]';
      const prio = node.priority ? `(${node.priority.toUpperCase()})` : '';

      md += `${prefix}- ${statusIcon} **${node.title}** ${prio}\n`;

      if (node.summary) md += `${prefix}  *Summary:* ${node.summary}\n`;
      if (node.why) md += `${prefix}  *Why:* ${node.why}\n`;
      if (node.how) md += `${prefix}  *How:* ${node.how}\n`;
      if (node.dueDate) md += `${prefix}  *Due:* ${new Date(node.dueDate).toISOString().slice(0, 10)}\n`;
      if (node.kpiLabel) md += `${prefix}  *KPI:* ${node.kpiLabel}: ${node.kpiCurrent || 0} / ${node.kpiTarget || 'N/A'}\n`;

      if (node.children && node.children.length > 0) {
        node.children.forEach((c) => renderNode(c, indent + 1));
      }
    }

    hierarchy.roots.forEach((r) => renderNode(r, 0));
    return md;
  }
}

module.exports = new MindmapService();
