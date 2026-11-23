/**
 * Notes Router (Polymorphic Notebook System)
 * Endpoints for searching, tagging, pinning, creating, updating, and deleting notes.
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const Note = require('../../models/Note');
const MindmapNode = require('../../models/MindmapNode');
const AuditLog = require('../../models/AuditLog');

const router = express.Router();

const noteSchema = z.object({
  ownerType: z.enum(['lead', 'call', 'task', 'campaign', 'general', 'event', 'mindmap_node']).default('lead'),
  ownerId: z.string().optional().nullable(),
  title: z.string().max(255).optional().nullable(),
  body: z.string().min(1, 'Note content cannot be empty'),
  tags: z.array(z.string()).optional().default([]),
  pinned: z.boolean().optional().default(false)
});

/**
 * GET /api/notes - List notes with search, tag filtering, and pinned prioritization
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const where = { userId };
    if (req.query.ownerType) where.ownerType = req.query.ownerType;
    if (req.query.ownerId) where.ownerId = String(req.query.ownerId);
    if (req.query.pinned === 'true') where.pinned = true;

    if (req.query.search) {
      const q = `%${req.query.search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.like]: q } },
        { body: { [Op.like]: q } }
      ];
    }

    const { count, rows } = await Note.findAndCountAll({
      where,
      limit,
      offset,
      order: [
        ['pinned', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    res.json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      notes: rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/notes/tags - Distinct tags list
 */
router.get('/tags', async (req, res, next) => {
  try {
    const userId = req.userId;
    const notes = await Note.findAll({
      where: { userId },
      attributes: ['tags'],
      raw: true
    });

    const tagSet = new Set();
    notes.forEach((n) => {
      if (Array.isArray(n.tags)) {
        n.tags.forEach((t) => tagSet.add(t));
      }
    });

    res.json({ success: true, tags: Array.from(tagSet).sort() });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/notes - Create a note
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = noteSchema.parse(req.body);
    const userId = req.userId;

    // Tenancy verification for mindmap node notes
    if (parsed.ownerType === 'mindmap_node' && parsed.ownerId) {
      const node = await MindmapNode.findOne({ where: { id: parsed.ownerId, userId } });
      if (!node) {
        return res.status(403).json({ error: 'Forbidden', message: 'Target mindmap node not found or belongs to another user' });
      }
    }

    const note = await Note.create({
      userId,
      ownerType: parsed.ownerType,
      ownerId: parsed.ownerId ? String(parsed.ownerId) : null,
      title: parsed.title,
      body: parsed.body,
      tags: parsed.tags,
      pinned: parsed.pinned
    });

    await AuditLog.create({
      userId,
      action: 'NOTE_CREATED',
      entityType: 'Note',
      entityId: String(note.id),
      details: { title: note.title, ownerType: note.ownerType, ownerId: note.ownerId }
    });

    res.status(201).json({ success: true, note });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'ValidationError', issues: err.issues });
    }
    next(err);
  }
});

/**
 * PATCH /api/notes/:id - Update note or toggle pinned
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const note = await Note.findOne({ where: { id: req.params.id, userId } });
    if (!note) {
      return res.status(404).json({ error: 'NotFound', message: 'Note not found.' });
    }

    const { title, body, tags, pinned } = req.body;
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (body !== undefined) updates.body = body;
    if (tags !== undefined) updates.tags = tags;
    if (pinned !== undefined) updates.pinned = !!pinned;

    await note.update(updates);

    res.json({ success: true, note });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/notes/:id/pin - Toggle pinned status
 */
router.patch('/:id/pin', async (req, res, next) => {
  try {
    const userId = req.userId;
    const note = await Note.findOne({ where: { id: req.params.id, userId } });
    if (!note) {
      return res.status(404).json({ error: 'NotFound', message: 'Note not found.' });
    }

    await note.update({ pinned: !note.pinned });

    res.json({ success: true, note });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/notes/:id - Delete note
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const note = await Note.findOne({ where: { id: req.params.id, userId } });
    if (!note) {
      return res.status(404).json({ error: 'NotFound', message: 'Note not found.' });
    }

    await note.destroy();

    res.json({ success: true, message: 'Note deleted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
