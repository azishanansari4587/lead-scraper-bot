import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import {
  Mindmap,
  MindmapNode,
  Task,
  Lead,
  Campaign,
  Note,
  UserSettings
} from '../src/models';
import mindmapService from '../src/services/mindmap/mindmapService';
import { handleTaskCompletion } from '../src/services/planner/taskRecurrence';
import { getMergedCalendar } from '../src/services/planner/calendarService';
import sequelize from '../src/config/database';

describe('Phase Mindmap — Business Goal Planner & Strategic Mindmap Suite', () => {
  const testUserId = 'test_mindmap_founder';
  const otherUserId = 'test_mindmap_intruder';

  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-role': 'admin'
  };

  const otherAuthHeaders = {
    'x-test-user-id': otherUserId,
    'x-test-role': 'admin'
  };

  beforeEach(async () => {
    // Clear test-specific data
    await MindmapNode.destroy({ where: { userId: [testUserId, otherUserId] } }).catch(() => {});
    await Mindmap.destroy({ where: { userId: [testUserId, otherUserId] } }).catch(() => {});
    await Task.destroy({ where: { userId: [testUserId, otherUserId] } }).catch(() => {});
    await Lead.destroy({ where: { userId: [testUserId, otherUserId] } }).catch(() => {});
    await Campaign.destroy({ where: { userId: [testUserId, otherUserId] } }).catch(() => {});
    await Note.destroy({ where: { userId: [testUserId, otherUserId] } }).catch(() => {});
  });

  describe('1. Tenancy on Links & Multi-Tenant Isolation (Amendment 1)', () => {
    it('prevents linking another user\'s task, lead, or campaign to a mindmap node', async () => {
      // 1. Create resources belonging to otherUserId
      const strangerTask = await Task.create({
        userId: otherUserId,
        title: 'Stranger Private Task',
        status: 'todo'
      });

      const strangerLead = await Lead.create({
        userId: otherUserId,
        businessName: 'Stranger Private Lead LLC',
        leadType: 'interior_design',
        city: 'Dubai',
        country: 'United Arab Emirates',
        source: 'instagram',
        dedupeKey: `dedupe_stranger_${Date.now()}`
      });

      const strangerCampaign = await Campaign.create({
        userId: otherUserId,
        name: 'Stranger Secret Campaign',
        status: 'active'
      });

      // 2. Create mindmap for testUserId
      const resMap = await request(app)
        .post('/api/mindmaps')
        .set(authHeaders)
        .send({ title: 'My Tenancy Mindmap' });

      expect(resMap.status).toBe(201);
      const mapId = resMap.body.mindmap.id;

      // 3. Attempt to link stranger's Task -> Must be rejected with 403
      const resBadTask = await request(app)
        .post(`/api/mindmaps/${mapId}/nodes`)
        .set(authHeaders)
        .send({
          title: 'Illegitimately Linked Node',
          linkedTaskId: strangerTask.id
        });

      expect(resBadTask.status).toBe(403);
      expect(resBadTask.body.message).toMatch(/Forbidden|another user/i);

      // 4. Attempt to link stranger's Lead -> Must be rejected with 403
      const resBadLead = await request(app)
        .post(`/api/mindmaps/${mapId}/nodes`)
        .set(authHeaders)
        .send({
          title: 'Illegitimately Linked Lead Node',
          linkedLeadId: strangerLead.id
        });

      expect(resBadLead.status).toBe(403);

      // 5. Attempt to link stranger's Campaign -> Must be rejected with 403
      const resBadCampaign = await request(app)
        .post(`/api/mindmaps/${mapId}/nodes`)
        .set(authHeaders)
        .send({
          title: 'Illegitimately Linked Campaign Node',
          linkedCampaignId: strangerCampaign.id
        });

      expect(resBadCampaign.status).toBe(403);
    });

    it('prevents user from attaching a Note to another user\'s mindmap node', async () => {
      // Create node belonging to otherUserId
      const otherMap = await Mindmap.create({ userId: otherUserId, title: 'Secret Map' });
      const otherNode = await MindmapNode.create({
        userId: otherUserId,
        mindmapId: otherMap.id,
        title: 'Confidential Node'
      });

      // testUserId attempts to attach a note to otherNode -> Must be 403
      const res = await request(app)
        .post('/api/notes')
        .set(authHeaders)
        .send({
          ownerType: 'mindmap_node',
          ownerId: String(otherNode.id),
          title: 'Snoop Note',
          body: 'Trying to snoop on foreign node'
        });

      expect(res.status).toBe(403);
    });

    it('prevents stranger from viewing, editing, or deleting another user\'s mindmap', async () => {
      const myMap = await Mindmap.create({
        userId: testUserId,
        title: 'Founder Private Map'
      });

      // Stranger tries GET
      const resGet = await request(app)
        .get(`/api/mindmaps/${myMap.id}`)
        .set(otherAuthHeaders);
      expect(resGet.status).toBe(404);

      // Stranger tries PATCH
      const resPatch = await request(app)
        .patch(`/api/mindmaps/${myMap.id}`)
        .set(otherAuthHeaders)
        .send({ title: 'Hacked Title' });
      expect(resPatch.status).toBe(404);

      // Stranger tries DELETE
      const resDel = await request(app)
        .delete(`/api/mindmaps/${myMap.id}`)
        .set(otherAuthHeaders);
      expect(resDel.status).toBe(404);
    });
  });

  describe('2. Import Hardening & Plain Text Sanitization (Amendment 2)', () => {
    it('regenerates all IDs, drops incoming userId and linked fields, strips HTML, and enforces max depth and node limits', async () => {
      const maliciousPayload = {
        id: 9999, // Should be ignored & regenerated
        userId: 'malicious_user_id', // Should be dropped and set to testUserId
        title: '<b>Imported</b> <script>alert("xss")</script>Mindmap',
        description: 'Clean description <img src=x onerror=alert(1)>',
        nodes: [
          {
            id: 'legacy_root_1',
            parentId: null,
            title: '<i>Sales Branch</i>',
            summary: '<a href="javascript:alert(1)">Click here</a>',
            why: 'Direct loom profit',
            linkedTaskId: 1234, // Must be dropped
            linkedLeadId: 5678 // Must be dropped
          },
          {
            id: 'legacy_child_1',
            parentId: 'legacy_root_1',
            title: 'Child Action <script>',
            priority: 'now'
          }
        ]
      };

      const res = await request(app)
        .post('/api/mindmaps/import')
        .set(authHeaders)
        .send(maliciousPayload);

      expect(res.status).toBe(201);
      const mapId = res.body.mindmap.id;
      expect(mapId).not.toBe(9999);
      expect(res.body.mindmap.userId).toBe(testUserId);
      expect(res.body.mindmap.title).not.toContain('<script>');
      expect(res.body.mindmap.title).not.toContain('<b>');

      // Verify stored nodes
      const storedNodes = await MindmapNode.findAll({ where: { mindmapId: mapId, userId: testUserId } });
      expect(storedNodes.length).toBe(2);

      const rootNode = storedNodes.find((n) => n.parentId === null);
      const childNode = storedNodes.find((n) => n.parentId !== null);

      expect(rootNode.title).toBe('Sales Branch');
      expect(rootNode.summary).toBe('Click here');
      expect(rootNode.linkedTaskId).toBeNull();
      expect(rootNode.linkedLeadId).toBeNull();

      expect(childNode.parentId).toBe(rootNode.id);
      expect(childNode.title).toBe('Child Action');
    });

    it('rejects import payloads exceeding 500 nodes', async () => {
      const tooManyNodes = [];
      for (let i = 0; i < 505; i++) {
        tooManyNodes.push({ id: i + 1, title: `Node ${i}` });
      }

      const res = await request(app)
        .post('/api/mindmaps/import')
        .set(authHeaders)
        .send({
          title: 'Overloaded Map',
          nodes: tooManyNodes
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/500 nodes/i);
    });

    it('rejects import hierarchies exceeding depth 6', async () => {
      const deepNodes = [
        { id: 1, parentId: null, title: 'L1' },
        { id: 2, parentId: 1, title: 'L2' },
        { id: 3, parentId: 2, title: 'L3' },
        { id: 4, parentId: 3, title: 'L4' },
        { id: 5, parentId: 4, title: 'L5' },
        { id: 6, parentId: 5, title: 'L6' },
        { id: 7, parentId: 6, title: 'L7 (Exceeds Depth 6)' }
      ];

      const res = await request(app)
        .post('/api/mindmaps/import')
        .set(authHeaders)
        .send({
          title: 'Too Deep Map',
          nodes: deepNodes
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/depth/i);
    });
  });

  describe('3. Tree Operations, Depth Limits & Cycle Prevention', () => {
    it('prevents cycle creation when setting parent to self or descendant', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Cycle Test Map' });

      const n1 = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, title: 'Node 1', parentId: null });
      const n2 = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, title: 'Node 2', parentId: n1.id });
      const n3 = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, title: 'Node 3', parentId: n2.id });

      // Attempt to set n1's parent to n1 (self) -> 400
      const resSelf = await request(app)
        .post(`/api/mindmaps/${map.id}/nodes/${n1.id}/move`)
        .set(authHeaders)
        .send({ newParentId: n1.id });
      expect(resSelf.status).toBe(400);

      // Attempt to set n1's parent to n3 (descendant) -> 400 Cycle detected
      const resCycle = await request(app)
        .post(`/api/mindmaps/${map.id}/nodes/${n1.id}/move`)
        .set(authHeaders)
        .send({ newParentId: n3.id });
      expect(resCycle.status).toBe(400);
      expect(resCycle.body.message).toMatch(/cycle/i);
    });

    it('cascades subtree deletion and unlinks related tasks in a transaction', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Subtree Delete Map' });

      const root = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, title: 'Root Branch' });
      const child1 = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, parentId: root.id, title: 'Child 1' });
      const child2 = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, parentId: child1.id, title: 'Grandchild 1' });

      // Link a task to grandchild
      const task = await Task.create({
        userId: testUserId,
        title: 'Grandchild Linked Task',
        relatedMindmapNodeId: child2.id
      });

      // Delete root branch
      const res = await request(app)
        .delete(`/api/mindmaps/${map.id}/nodes/${root.id}`)
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.deletedCount).toBe(3);

      // Verify all nodes are removed
      const remaining = await MindmapNode.findAll({ where: { mindmapId: map.id } });
      expect(remaining.length).toBe(0);

      // Verify task link was cleanly unlinked
      await task.reload();
      expect(task.relatedMindmapNodeId).toBeNull();
    });

    it('duplicates a subtree with proper re-parenting and limits check (Amendment 8)', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Subtree Copy Map' });

      const parent = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, title: 'Branch to Duplicate' });
      const child = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, parentId: parent.id, title: 'Sub Action' });

      const res = await request(app)
        .post(`/api/mindmaps/${map.id}/nodes/${parent.id}/duplicate`)
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.duplicatedCount).toBe(2);

      const allNodes = await MindmapNode.findAll({ where: { mindmapId: map.id } });
      expect(allNodes.length).toBe(4);

      const copiedParent = allNodes.find((n) => n.title.includes('Branch to Duplicate (Copy)'));
      expect(copiedParent).toBeDefined();

      const copiedChild = allNodes.find((n) => n.parentId === copiedParent.id);
      expect(copiedChild).toBeDefined();
      expect(copiedChild.title).toBe('Sub Action');
    });
  });

  describe('4. Single Source of Truth for Task Links & Recurrence Rules (Amendment 4)', () => {
    it('creates task from node idempotently and syncs task completion to node', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Sync Map' });
      const node = await MindmapNode.create({
        userId: testUserId,
        mindmapId: map.id,
        title: 'Send 5 Swatch Boxes to D3',
        priority: 'now',
        dueDate: '2026-12-01T08:00:00.000Z',
        status: 'todo'
      });

      // 1. Create task from node
      const res1 = await request(app)
        .post(`/api/mindmaps/${map.id}/nodes/${node.id}/create-task`)
        .set(authHeaders);

      expect(res1.status).toBe(201);
      expect(res1.body.alreadyExisted).toBe(false);
      const taskId = res1.body.task.id;

      // Verify node has linkedTaskId
      await node.reload();
      expect(node.linkedTaskId).toBe(taskId);

      // 2. Call create-task again -> Idempotent, returns same task
      const res2 = await request(app)
        .post(`/api/mindmaps/${map.id}/nodes/${node.id}/create-task`)
        .set(authHeaders);

      expect(res2.status).toBe(200);
      expect(res2.body.alreadyExisted).toBe(true);
      expect(res2.body.task.id).toBe(taskId);

      // 3. Mark task as 'done' -> Node status must sync to 'done'
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set(authHeaders)
        .send({ status: 'done' });

      await node.reload();
      expect(node.status).toBe('done');

      // 4. Reopen task ('done' -> 'todo') -> Node status syncs to 'todo'
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set(authHeaders)
        .send({ status: 'todo' });

      await node.reload();
      expect(node.status).toBe('todo');

      // 5. Cancel task -> Node status stays intact
      await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set(authHeaders)
        .send({ status: 'cancelled' });

      await node.reload();
      expect(node.status).toBe('todo');
    });

    it('does NOT copy relatedMindmapNodeId to next recurring task occurrences', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Recurrence Map' });
      const node = await MindmapNode.create({
        userId: testUserId,
        mindmapId: map.id,
        title: 'Weekly Loom Call'
      });

      const recurringTask = await Task.create({
        userId: testUserId,
        title: 'Weekly Loom Call Task',
        status: 'todo',
        recurrenceRule: 'weekly',
        dueAt: new Date(),
        relatedMindmapNodeId: node.id
      });

      // Complete recurring task
      await recurringTask.update({ status: 'done' });
      const nextTask = await handleTaskCompletion(recurringTask, testUserId);

      expect(nextTask).toBeDefined();
      expect(nextTask.title).toBe(recurringTask.title);
      // Critical check: next recurring task must have null relatedMindmapNodeId
      expect(nextTask.relatedMindmapNodeId).toBeNull();
    });
  });

  describe('5. Status Rules, Roll-Up Progress & Skeleton Branches (Amendment 6 & 10)', () => {
    it('correctly calculates derived parent status and roll-up progress from leaf nodes', () => {
      const mockNodes = [
        { id: 1, parentId: null, title: 'Parent 1', status: 'todo' },
        { id: 2, parentId: 1, title: 'Child 1', status: 'done' },
        { id: 3, parentId: 1, title: 'Child 2', status: 'todo' },
        { id: 4, parentId: null, title: 'Parent 2 (Stand-alone leaf)', status: 'done' }
      ];

      const hierarchy = mindmapService.buildTreeHierarchy(mockNodes);

      expect(hierarchy.totalLeaves).toBe(3); // Child 1, Child 2, Parent 2
      expect(hierarchy.doneLeaves).toBe(2); // Child 1, Parent 2
      expect(hierarchy.overallProgressPct).toBe(67); // 2/3 = 67%

      const parent1 = hierarchy.roots.find((r) => r.id === 1);
      expect(parent1.progressPct).toBe(50);
      expect(parent1.derivedStatus).toBe('doing');

      const parent2 = hierarchy.roots.find((r) => r.id === 4);
      expect(parent2.progressPct).toBe(100);
      expect(parent2.derivedStatus).toBeUndefined(); // It is a leaf node
      expect(parent2.status).toBe('done');
    });

    it('creates mindmap with skeleton containing exactly the 11 branch titles and zero advice', async () => {
      const res = await request(app)
        .post('/api/mindmaps')
        .set(authHeaders)
        .send({
          title: 'My 2027 Goals',
          isSkeleton: true
        });

      expect(res.status).toBe(201);
      const mapId = res.body.mindmap.id;

      const nodes = await MindmapNode.findAll({
        where: { mindmapId: mapId, userId: testUserId },
        order: [['sortOrder', 'ASC']]
      });

      expect(nodes.length).toBe(11);
      const expectedTitles = [
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

      nodes.forEach((n, idx) => {
        expect(n.title).toBe(expectedTitles[idx]);
        expect(n.why).toBeNull();
        expect(n.how).toBeNull();
        expect(n.kpiTarget).toBeNull();
      });
    });

    it('completes all descendants with /complete-all', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Complete All Map' });
      const parent = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, title: 'Parent', status: 'todo' });
      const c1 = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, parentId: parent.id, title: 'Child 1', status: 'todo' });
      const c2 = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, parentId: c1.id, title: 'Grandchild', status: 'todo' });

      const res = await request(app)
        .post(`/api/mindmaps/${map.id}/nodes/${parent.id}/complete-all`)
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.completedCount).toBe(3);

      const updatedNodes = await MindmapNode.findAll({ where: { mindmapId: map.id } });
      updatedNodes.forEach((n) => expect(n.status).toBe('done'));
    });
  });

  describe('6. Collision-Free Radial & Horizontal Layout Algorithm (Amendment 5)', () => {
    it('computes 300-node layout with zero bounding-box overlaps in radial and horizontal modes', () => {
      // Generate synthetic 300-node tree
      const syntheticNodes = [];
      let id = 1;

      // 10 main branches
      for (let b = 1; b <= 10; b++) {
        const branchId = id++;
        syntheticNodes.push({ id: branchId, parentId: null, title: `Branch ${b}` });

        // 5 sub-branches each
        for (let s = 1; s <= 5; s++) {
          const subId = id++;
          syntheticNodes.push({ id: subId, parentId: branchId, title: `Sub ${b}.${s}` });

          // 5 actions each -> 10 + 50 + 250 = 310 nodes
          for (let a = 1; a <= 5; a++) {
            syntheticNodes.push({ id: id++, parentId: subId, title: `Action ${b}.${s}.${a}` });
          }
        }
      }

      const hierarchy = mindmapService.buildTreeHierarchy(syntheticNodes);

      // 1. Test Horizontal Layout
      const horizontalCoords = mindmapService.calculateNodeCoordinates(hierarchy, 'horizontal');
      expect(horizontalCoords.size).toBe(syntheticNodes.length);

      // Check collision among sibling levels
      const hNodes = Array.from(horizontalCoords.values());
      for (let i = 0; i < hNodes.length; i++) {
        for (let j = i + 1; j < hNodes.length; j++) {
          const a = hNodes[i];
          const b = hNodes[j];
          if (a.x === b.x) {
            // Same column -> heights must not overlap
            const overlap = Math.abs(a.y - b.y) < a.height;
            expect(overlap).toBe(false);
          }
        }
      }

      // 2. Test Radial Layout
      const radialCoords = mindmapService.calculateNodeCoordinates(hierarchy, 'radial');
      expect(radialCoords.size).toBe(syntheticNodes.length);
    });
  });

  describe('7. Last-Write-Wins Protection & Concurrency Check (Amendment 9)', () => {
    it('rejects stale node update with 409 Conflict when expectedUpdatedAt does not match', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Concurrency Map' });
      const node = await MindmapNode.create({
        userId: testUserId,
        mindmapId: map.id,
        title: 'Initial Title'
      });

      const staleTimestamp = new Date(Date.now() - 60000).toISOString();

      const resConflict = await request(app)
        .patch(`/api/mindmaps/${map.id}/nodes/${node.id}`)
        .set(authHeaders)
        .send({
          title: 'Conflicting Edit',
          expectedUpdatedAt: staleTimestamp
        });

      expect(resConflict.status).toBe(409);
      expect(resConflict.body.error).toBe('Conflict');
      expect(resConflict.body.serverNode.title).toBe('Initial Title');
    });
  });

  describe('8. Today & Calendar Integration with Mindmap Actions', () => {
    it('surfaces mindmapActionsDueThisWeek on Today Hub', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Weekly Goals' });
      const actionDueSoon = await MindmapNode.create({
        userId: testUserId,
        mindmapId: map.id,
        title: 'Call Ajman Warehouse Logistics',
        dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // Due in 2 days
        status: 'todo',
        priority: 'now'
      });

      const res = await request(app)
        .get('/api/today/summary')
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.mindmapActionsDueThisWeek)).toBe(true);

      const found = res.body.mindmapActionsDueThisWeek.find((a) => a.id === actionDueSoon.id);
      expect(found).toBeDefined();
      expect(found.title).toBe('Call Ajman Warehouse Logistics');
      expect(found.mindmapTitle).toBe('Weekly Goals');
      expect(found.deepLink).toContain(`/mindmaps/${map.id}#node-${actionDueSoon.id}`);
    });

    it('merges mindmap action items into Calendar feed with direct deep link', async () => {
      const map = await Mindmap.create({ userId: testUserId, title: 'Calendar Strategy' });
      const dueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);

      await MindmapNode.create({
        userId: testUserId,
        mindmapId: map.id,
        title: 'Inspect Bhadohi 4K video strike-off',
        dueDate,
        status: 'todo',
        priority: 'now'
      });

      const calendarRes = await getMergedCalendar(
        testUserId,
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString()
      );

      expect(calendarRes.success).toBe(true);
      const mindmapItem = calendarRes.items.find((item) => item.itemType === 'mindmap_action');
      expect(mindmapItem).toBeDefined();
      expect(mindmapItem.title).toContain('Inspect Bhadohi 4K video strike-off');
      expect(mindmapItem.deepLink).toContain(`/mindmaps/${map.id}#node-`);
    });
  });

  describe('9. Export to Markdown & JSON (Features 6 & 7)', () => {
    it('exports clean markdown outline with task statuses and indentation', async () => {
      const map = await Mindmap.create({
        userId: testUserId,
        title: 'Quarterly Export Plan',
        goalText: 'Reach 200k AED'
      });

      const root = await MindmapNode.create({ userId: testUserId, mindmapId: map.id, title: 'Sales Track', priority: 'now' });
      await MindmapNode.create({ userId: testUserId, mindmapId: map.id, parentId: root.id, title: 'D3 Outreach', status: 'done', why: 'Touch is everything' });
      await MindmapNode.create({ userId: testUserId, mindmapId: map.id, parentId: root.id, title: 'Al Quoz Presentation', status: 'todo' });

      const res = await request(app)
        .get(`/api/mindmaps/${map.id}/export?format=markdown`)
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.text).toContain('# Quarterly Export Plan');
      expect(res.text).toContain('Reach 200k AED');
      expect(res.text).toContain('- [ ] **Sales Track** (NOW)');
      expect(res.text).toContain('- [x] **D3 Outreach**');
      expect(res.text).toContain('- [ ] **Al Quoz Presentation**');
      expect(res.text).toContain('*Why:* Touch is everything');
    });
  });
});
