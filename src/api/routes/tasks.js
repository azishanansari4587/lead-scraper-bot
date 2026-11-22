/**
 * Tasks Router
 * Manages founder tasks, recurring task lifecycle, kanban statuses, MITs, and lead links.
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const Task = require('../../models/Task');
const Lead = require('../../models/Lead');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../config/logger');
const { handleTaskCompletion } = require('../../services/planner/taskRecurrence');

const router = express.Router();

const taskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  description: z.string().optional().nullable(),
  category: z.enum(['sales', 'marketing', 'production', 'shipping', 'accounts', 'personal']).default('sales'),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
  dueAt: z.string().datetime({ offset: true }).optional().nullable().or(z.string().optional().nullable()),
  status: z.enum(['todo', 'doing', 'done', 'cancelled']).default('todo'),
  isMIT: z.boolean().default(false),
  relatedLeadId: z.number().int().positive().optional().nullable(),
  recurrenceRule: z.enum(['none', 'daily', 'weekly', 'monthly', 'weekdays']).default('none'),
  sortOrder: z.number().int().default(0)
});

const taskUpdateSchema = taskSchema.partial();

/**
 * GET /api/tasks - List tasks with filtering, pagination, and lead details
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { category, priority, status, relatedLeadId, isMIT, search, all } = req.query;

    const where = { userId };
    if (category) where.category = category;
    if (priority) where.priority = priority;
    if (status) {
      if (status.includes(',')) {
        where.status = { [Op.in]: status.split(',') };
      } else {
        where.status = status;
      }
    }
    if (relatedLeadId) where.relatedLeadId = parseInt(relatedLeadId, 10);
    if (isMIT !== undefined) where.isMIT = isMIT === 'true';

    if (search) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.like]: q } },
        { description: { [Op.like]: q } }
      ];
    }

    const order = [
      ['isMIT', 'DESC'],
      ['sortOrder', 'ASC'],
      ['dueAt', 'ASC'],
      ['createdAt', 'DESC']
    ];

    if (all === 'true') {
      const tasks = await Task.findAll({
        where,
        order,
        include: [{
          model: Lead,
          as: 'lead',
          attributes: ['id', 'businessName', 'city', 'country', 'buyerType', 'status']
        }]
      });
      return res.json({ success: true, tasks, total: tasks.length });
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (page - 1) * limit;

    const { count, rows } = await Task.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [{
        model: Lead,
        as: 'lead',
        attributes: ['id', 'businessName', 'city', 'country', 'buyerType', 'status']
      }]
    });

    res.json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      tasks: rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/tasks - Create a new task
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const parsed = taskSchema.parse(req.body);

    const task = await Task.create({
      userId,
      ...parsed,
      dueAt: parsed.dueAt ? new Date(parsed.dueAt) : null
    });

    await AuditLog.create({
      userId,
      action: 'create',
      entityType: 'Task',
      entityId: String(task.id),
      details: { title: task.title, category: task.category, priority: task.priority },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    next(err);
  }
});

/**
 * PATCH /api/tasks/:id - Update task (handles completion, recurrence, and status transitions)
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const taskId = parseInt(req.params.id, 10);
    const parsed = taskUpdateSchema.parse(req.body);

    const task = await Task.findOne({ where: { id: taskId, userId } });
    if (!task) {
      return res.status(404).json({ error: 'NotFound', message: 'Task not found' });
    }

    const previousStatus = task.status;
    const updates = { ...parsed };

    if (parsed.dueAt !== undefined) {
      updates.dueAt = parsed.dueAt ? new Date(parsed.dueAt) : null;
    }

    // Handle completion status transition
    if (parsed.status && parsed.status === 'done' && previousStatus !== 'done') {
      updates.completedAt = new Date();
    } else if (parsed.status && parsed.status !== 'done' && previousStatus === 'done') {
      updates.completedAt = null;
    }

    await task.update(updates);

    // If task was marked done and has a recurrence rule, spawn next occurrence
    let nextOccurrence = null;
    if (parsed.status === 'done' && previousStatus !== 'done' && task.recurrenceRule && task.recurrenceRule !== 'none') {
      nextOccurrence = await handleTaskCompletion(task, userId);
    }

    await AuditLog.create({
      userId,
      action: 'update',
      entityType: 'Task',
      entityId: String(task.id),
      details: { updates, spawnedNextTaskId: nextOccurrence?.id || null },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({
      success: true,
      task,
      nextOccurrence
    });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    next(err);
  }
});

/**
 * DELETE /api/tasks/:id - Delete a task
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const taskId = parseInt(req.params.id, 10);

    const task = await Task.findOne({ where: { id: taskId, userId } });
    if (!task) {
      return res.status(404).json({ error: 'NotFound', message: 'Task not found' });
    }

    await task.destroy();

    await AuditLog.create({
      userId,
      action: 'delete',
      entityType: 'Task',
      entityId: String(taskId),
      details: { title: task.title },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
