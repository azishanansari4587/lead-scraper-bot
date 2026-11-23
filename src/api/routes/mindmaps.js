/**
 * Mindmaps Router
 * Enterprise Goal Planning & Strategic Visual Mindmap Module for Knotiq Rugs
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const Mindmap = require('../../models/Mindmap');
const MindmapNode = require('../../models/MindmapNode');
const Task = require('../../models/Task');
const Lead = require('../../models/Lead');
const Campaign = require('../../models/Campaign');
const AuditLog = require('../../models/AuditLog');
const UserSettings = require('../../models/UserSettings');
const mindmapService = require('../../services/mindmap/mindmapService');
const logger = require('../../config/logger');

const router = express.Router();

// Validation Schemas
const createMindmapSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional().nullable(),
  goalText: z.string().optional().nullable(),
  targetValue: z.number().optional().nullable(),
  targetUnit: z.string().max(50).optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional().nullable()),
  layoutPref: z.enum(['radial', 'horizontal', 'vertical']).default('radial'),
  isSkeleton: z.boolean().default(false)
});

const updateMindmapSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional().nullable(),
  goalText: z.string().optional().nullable(),
  targetValue: z.number().optional().nullable(),
  targetUnit: z.string().max(50).optional().nullable(),
  deadline: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional().nullable()),
  layoutPref: z.enum(['radial', 'horizontal', 'vertical']).optional(),
  status: z.enum(['active', 'archived']).optional()
});

const createNodeSchema = z.object({
  parentId: z.number().int().positive().optional().nullable(),
  title: z.string().min(1, 'Title is required').max(255),
  summary: z.string().optional().nullable(),
  why: z.string().optional().nullable(),
  how: z.string().optional().nullable(),
  startDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional().nullable()),
  dueDate: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional().nullable()),
  owner: z.string().max(100).optional().nullable(),
  kpiLabel: z.string().max(100).optional().nullable(),
  kpiTarget: z.number().optional().nullable(),
  kpiCurrent: z.number().optional().nullable(),
  priority: z.enum(['now', 'next', 'later']).default('now'),
  status: z.enum(['todo', 'doing', 'done']).default('todo'),
  color: z.string().max(50).optional().nullable(),
  icon: z.string().max(50).optional().nullable(),
  tags: z.array(z.string()).default([]),
  collapsed: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  linkedTaskId: z.number().int().positive().optional().nullable(),
  linkedCampaignId: z.number().int().positive().optional().nullable(),
  linkedLeadId: z.number().int().positive().optional().nullable()
});

const updateNodeSchema = createNodeSchema.partial().extend({
  expectedUpdatedAt: z.string().optional() // For Last-Write-Wins conflict detection
});

/**
 * GET /api/mindmaps - List all mindmaps for the user
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { status = 'active' } = req.query;

    const where = { userId };
    if (status !== 'all') {
      where.status = status;
    }

    const mindmaps = await Mindmap.findAll({
      where,
      order: [['updatedAt', 'DESC']],
      include: [
        {
          model: MindmapNode,
          as: 'nodes',
          attributes: ['id', 'status', 'parentId']
        }
      ]
    });

    const results = mindmaps.map((m) => {
      const json = m.toJSON();
      const nodes = json.nodes || [];
      const totalNodes = nodes.length;
      const leafNodes = nodes.filter((n) => !nodes.some((other) => other.parentId === n.id));
      const doneLeaves = leafNodes.filter((n) => n.status === 'done').length;
      const progressPct = leafNodes.length > 0 ? Math.round((doneLeaves / leafNodes.length) * 100) : 0;

      delete json.nodes;
      return {
        ...json,
        totalNodes,
        leafCount: leafNodes.length,
        doneCount: doneLeaves,
        progressPct
      };
    });

    res.json({ success: true, mindmaps: results });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps - Create a new mindmap
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const data = createMindmapSchema.parse(req.body);

    const mindmap = await mindmapService.createMindmap(userId, data);

    await AuditLog.create({
      userId,
      action: 'mindmap_create',
      entity: 'Mindmap',
      entityId: mindmap.id,
      details: { title: mindmap.title, isSkeleton: data.isSkeleton }
    }).catch(() => {});

    res.status(201).json({ success: true, mindmap });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/mindmaps/:id - Get full mindmap details with hierarchy & layout
 */
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const mindmap = await Mindmap.findOne({
      where: { id, userId }
    });

    if (!mindmap) {
      return res.status(404).json({ error: 'NotFound', message: 'Mindmap not found' });
    }

    // Get user timezone for overdue calculations
    const userSettings = await UserSettings.findOne({ where: { userId } });
    const userTimezone = userSettings?.timezone || 'Asia/Dubai';

    // Fetch all nodes with linked task status
    const nodes = await MindmapNode.findAll({
      where: { mindmapId: id, userId },
      include: [
        {
          model: Task,
          as: 'task',
          required: false,
          attributes: ['id', 'title', 'status', 'dueAt', 'priority', 'category']
        },
        {
          model: Lead,
          as: 'lead',
          required: false,
          attributes: ['id', 'businessName', 'city', 'phone', 'status']
        },
        {
          model: Campaign,
          as: 'campaign',
          required: false,
          attributes: ['id', 'name', 'status']
        }
      ],
      order: [['sortOrder', 'ASC'], ['id', 'ASC']]
    });

    // Build hierarchy with roll-up calculations
    const hierarchy = mindmapService.buildTreeHierarchy(nodes, userTimezone);

    // Compute collision-free coordinates
    const layout = mindmap.layoutPref || 'radial';
    const coordsMap = mindmapService.calculateNodeCoordinates(hierarchy, layout);

    // Attach coordinates to nodes
    const positionedNodes = nodes.map((n) => {
      const json = n.toJSON();
      const c = coordsMap.get(n.id) || { x: 0, y: 0, width: 220, height: 80 };
      const treeNode = hierarchy.nodeMap.get(n.id);

      return {
        ...json,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
        angle: c.angle,
        isOverdue: Boolean(treeNode?.isOverdue),
        depth: treeNode?.depth || 1,
        isLeaf: Boolean(treeNode?.isLeaf),
        leafCount: treeNode?.leafCount || 1,
        doneLeafCount: treeNode?.doneLeafCount || 0,
        progressPct: treeNode?.progressPct || 0,
        derivedStatus: treeNode?.derivedStatus || json.status
      };
    });

    res.json({
      success: true,
      mindmap: {
        ...mindmap.toJSON(),
        overallProgressPct: hierarchy.overallProgressPct,
        totalLeaves: hierarchy.totalLeaves,
        doneLeaves: hierarchy.doneLeaves
      },
      hierarchy: hierarchy.roots,
      nodes: positionedNodes
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/mindmaps/:id - Update mindmap metadata
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const data = updateMindmapSchema.parse(req.body);

    const mindmap = await Mindmap.findOne({ where: { id, userId } });
    if (!mindmap) {
      return res.status(404).json({ error: 'NotFound', message: 'Mindmap not found' });
    }

    await mindmap.update(data);

    await AuditLog.create({
      userId,
      action: 'mindmap_update',
      entity: 'Mindmap',
      entityId: mindmap.id,
      details: data
    }).catch(() => {});

    res.json({ success: true, mindmap });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/mindmaps/:id - Archive or delete mindmap (safeguards linked tasks)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const mindmap = await Mindmap.findOne({ where: { id, userId } });
    if (!mindmap) {
      return res.status(404).json({ error: 'NotFound', message: 'Mindmap not found' });
    }

    // Check if any node has an active linked task
    const linkedTasksCount = await Task.count({
      where: {
        userId,
        relatedMindmapNodeId: { [Op.ne]: null }
      },
      include: [
        {
          model: MindmapNode,
          as: 'mindmapNode',
          required: true,
          where: { mindmapId: id }
        }
      ]
    });

    if (linkedTasksCount > 0) {
      // Archive instead of hard delete to protect task references
      await mindmap.update({ status: 'archived' });
      return res.json({
        success: true,
        archived: true,
        message: `Mindmap has ${linkedTasksCount} linked tasks in the Command Center. It has been safely archived instead of deleted.`
      });
    }

    // Hard delete if zero linked tasks
    await mindmap.destroy();

    await AuditLog.create({
      userId,
      action: 'mindmap_delete',
      entity: 'Mindmap',
      entityId: id,
      details: { title: mindmap.title }
    }).catch(() => {});

    res.json({ success: true, deleted: true });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps/:id/duplicate - Duplicate entire mindmap
 */
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const newMap = await mindmapService.duplicateMindmap(userId, id);

    await AuditLog.create({
      userId,
      action: 'mindmap_duplicate',
      entity: 'Mindmap',
      entityId: newMap.id,
      details: { originalId: id }
    }).catch(() => {});

    res.status(201).json({ success: true, mindmap: newMap });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps/:id/nodes - Add a node to the mindmap
 */
router.post('/:id/nodes', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const data = createNodeSchema.parse(req.body);

    const mindmap = await Mindmap.findOne({ where: { id, userId } });
    if (!mindmap) {
      return res.status(404).json({ error: 'NotFound', message: 'Mindmap not found' });
    }

    // Enforce 500-node limit
    const totalNodes = await MindmapNode.count({ where: { mindmapId: id, userId } });
    if (totalNodes >= 500) {
      return res.status(400).json({ error: 'LimitExceeded', message: 'Mindmap has reached maximum limit of 500 nodes' });
    }

    // Tenancy verification on link fields (Amendment 1)
    await mindmapService.verifyLinkTenancy(userId, data);

    // Validate depth limit
    if (data.parentId) {
      await mindmapService.validateMoveOrParent(userId, id, -1, data.parentId);
    }

    const node = await MindmapNode.create({
      userId,
      mindmapId: id,
      ...data
    });

    // Touch mindmap updatedAt
    await mindmap.changed('updatedAt', true);
    await mindmap.save();

    res.status(201).json({ success: true, node });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/mindmaps/:id/nodes/:nodeId - Update a node with Last-Write-Wins check
 */
router.patch('/:id/nodes/:nodeId', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id, nodeId } = req.params;
    const data = updateNodeSchema.parse(req.body);

    const node = await MindmapNode.findOne({ where: { id: nodeId, mindmapId: id, userId } });
    if (!node) {
      return res.status(404).json({ error: 'NotFound', message: 'Node not found' });
    }

    // Last-Write-Wins Protection (Amendment 9)
    if (data.expectedUpdatedAt) {
      const clientTime = new Date(data.expectedUpdatedAt).getTime();
      const serverTime = new Date(node.updatedAt).getTime();
      if (Math.abs(serverTime - clientTime) > 1000) {
        return res.status(409).json({
          error: 'Conflict',
          message: 'This node was modified elsewhere. Please refresh to load latest changes.',
          serverNode: node
        });
      }
    }

    // Tenancy verification on link updates (Amendment 1)
    await mindmapService.verifyLinkTenancy(userId, data);

    const cleanData = { ...data };
    delete cleanData.expectedUpdatedAt;

    await node.update(cleanData);

    // Touch parent mindmap
    await Mindmap.update({ updatedAt: new Date() }, { where: { id, userId } });

    res.json({ success: true, node });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps/:id/nodes/:nodeId/move - Move or reparent a node
 */
router.post('/:id/nodes/:nodeId/move', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id, nodeId } = req.params;
    const { newParentId, newSortOrder } = req.body;

    const node = await MindmapNode.findOne({ where: { id: nodeId, mindmapId: id, userId } });
    if (!node) {
      return res.status(404).json({ error: 'NotFound', message: 'Node not found' });
    }

    // Cycle & depth validation
    await mindmapService.validateMoveOrParent(userId, id, nodeId, newParentId);

    await node.update({
      parentId: newParentId !== undefined ? newParentId : node.parentId,
      sortOrder: newSortOrder !== undefined ? newSortOrder : node.sortOrder
    });

    await Mindmap.update({ updatedAt: new Date() }, { where: { id, userId } });

    res.json({ success: true, node });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/mindmaps/:id/nodes/:nodeId - Delete a subtree
 */
router.delete('/:id/nodes/:nodeId', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id, nodeId } = req.params;

    const result = await mindmapService.deleteSubtree(userId, id, nodeId);

    await Mindmap.update({ updatedAt: new Date() }, { where: { id, userId } });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps/:id/nodes/:nodeId/duplicate - Duplicate a subtree
 */
router.post('/:id/nodes/:nodeId/duplicate', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id, nodeId } = req.params;

    const result = await mindmapService.duplicateSubtree(userId, id, nodeId);

    await Mindmap.update({ updatedAt: new Date() }, { where: { id, userId } });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps/:id/nodes/:nodeId/complete-all - Complete parent and all descendants
 */
router.post('/:id/nodes/:nodeId/complete-all', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id, nodeId } = req.params;

    const result = await mindmapService.completeDescendants(userId, id, nodeId);

    await Mindmap.update({ updatedAt: new Date() }, { where: { id, userId } });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps/:id/nodes/:nodeId/create-task - Idempotent Task Creation (Amendment 4)
 */
router.post('/:id/nodes/:nodeId/create-task', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id, nodeId } = req.params;

    const node = await MindmapNode.findOne({ where: { id: nodeId, mindmapId: id, userId } });
    if (!node) {
      return res.status(404).json({ error: 'NotFound', message: 'Node not found' });
    }

    // Check if task already linked to this node
    let task = await Task.findOne({ where: { relatedMindmapNodeId: node.id, userId } });
    if (task) {
      return res.json({ success: true, task, alreadyExisted: true });
    }

    // Map priority
    const priorityMap = { now: 'high', next: 'medium', later: 'low' };
    const taskPriority = priorityMap[node.priority] || 'medium';

    task = await Task.create({
      userId,
      title: node.title,
      description: node.summary || node.why || '',
      category: 'sales',
      priority: taskPriority,
      dueAt: node.dueDate || null,
      status: node.status === 'done' ? 'done' : 'todo',
      isMIT: node.priority === 'now',
      relatedMindmapNodeId: node.id
    });

    // Update node reference
    await node.update({ linkedTaskId: task.id });

    await AuditLog.create({
      userId,
      action: 'task_create_from_mindmap',
      entity: 'Task',
      entityId: task.id,
      details: { mindmapId: id, nodeId: node.id }
    }).catch(() => {});

    res.status(201).json({ success: true, task, alreadyExisted: false });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/mindmaps/:id/export - Export as JSON or Markdown outline
 */
router.get('/:id/export', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { format = 'json' } = req.query;

    const mindmap = await Mindmap.findOne({ where: { id, userId } });
    if (!mindmap) {
      return res.status(404).json({ error: 'NotFound', message: 'Mindmap not found' });
    }

    const nodes = await MindmapNode.findAll({
      where: { mindmapId: id, userId },
      order: [['sortOrder', 'ASC']]
    });

    const hierarchy = mindmapService.buildTreeHierarchy(nodes);

    if (format === 'markdown') {
      const markdown = mindmapService.exportToMarkdown(mindmap, hierarchy);
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${mindmap.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_mindmap.md"`);
      return res.send(markdown);
    }

    // Clean JSON export
    const exportPayload = {
      title: mindmap.title,
      description: mindmap.description,
      goalText: mindmap.goalText,
      targetValue: mindmap.targetValue,
      targetUnit: mindmap.targetUnit,
      deadline: mindmap.deadline,
      layoutPref: mindmap.layoutPref,
      exportedAt: new Date().toISOString(),
      nodes: nodes.map((n) => ({
        id: n.id,
        parentId: n.parentId,
        title: n.title,
        summary: n.summary,
        why: n.why,
        how: n.how,
        startDate: n.startDate,
        dueDate: n.dueDate,
        owner: n.owner,
        kpiLabel: n.kpiLabel,
        kpiTarget: n.kpiTarget,
        kpiCurrent: n.kpiCurrent,
        priority: n.priority,
        status: n.status,
        color: n.color,
        icon: n.icon,
        tags: n.tags,
        sortOrder: n.sortOrder
      }))
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${mindmap.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_mindmap.json"`);
    res.json(exportPayload);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/mindmaps/import - Hardened Import with XSS sanitization (Amendment 2)
 */
router.post('/import', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { preview = false } = req.query;

    const rawData = req.body;
    if (!rawData || !rawData.title) {
      return res.status(400).json({ error: 'ValidationError', message: 'Mindmap data must include a title' });
    }

    if (preview === 'true') {
      // Return safe preview without writing to database
      const rawNodes = Array.isArray(rawData.nodes) ? rawData.nodes : [];
      return res.json({
        success: true,
        preview: true,
        title: rawData.title,
        totalNodes: rawNodes.length,
        goalText: rawData.goalText || null,
        targetValue: rawData.targetValue || null,
        targetUnit: rawData.targetUnit || null
      });
    }

    const imported = await mindmapService.importMindmap(userId, rawData);

    await AuditLog.create({
      userId,
      action: 'mindmap_import',
      entity: 'Mindmap',
      entityId: imported.id,
      details: { title: imported.title, nodeCount: (rawData.nodes || []).length }
    }).catch(() => {});

    res.status(201).json({ success: true, mindmap: imported });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
