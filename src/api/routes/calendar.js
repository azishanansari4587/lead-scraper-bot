/**
 * Calendar Router
 * Provides unified schedule views (Events, Tasks, Follow-ups, Calls) and event management.
 */

const express = require('express');
const { z } = require('zod');
const CalendarEvent = require('../../models/CalendarEvent');
const Lead = require('../../models/Lead');
const AuditLog = require('../../models/AuditLog');
const { getMergedCalendar } = require('../../services/planner/calendarService');

const router = express.Router();

const eventSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  startAt: z.string().min(1, 'Start date/time is required'),
  endAt: z.string().min(1, 'End date/time is required'),
  type: z.enum(['meeting', 'call_block', 'work_block', 'production', 'shipping', 'other']).default('meeting'),
  relatedLeadId: z.number().int().positive().optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  allDay: z.boolean().default(false)
}).refine((data) => {
  const start = new Date(data.startAt).getTime();
  const end = new Date(data.endAt).getTime();
  return !isNaN(start) && !isNaN(end) && end >= start;
}, {
  message: 'endAt must be equal to or later than startAt',
  path: ['endAt']
});

const eventUpdateSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  startAt: z.string().optional(),
  endAt: z.string().optional(),
  type: z.enum(['meeting', 'call_block', 'work_block', 'production', 'shipping', 'other']).optional(),
  relatedLeadId: z.number().int().positive().optional().nullable(),
  location: z.string().max(255).optional().nullable(),
  notes: z.string().optional().nullable(),
  allDay: z.boolean().optional()
}).refine((data) => {
  if (data.startAt && data.endAt) {
    const start = new Date(data.startAt).getTime();
    const end = new Date(data.endAt).getTime();
    return !isNaN(start) && !isNaN(end) && end >= start;
  }
  return true;
}, {
  message: 'endAt must be equal to or later than startAt',
  path: ['endAt']
});

/**
 * GET /api/calendar - Get unified calendar items with conflict detection
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { from, to } = req.query;

    const startDate = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const result = await getMergedCalendar({
      userId,
      from: startDate,
      to: endDate
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/calendar/events - Create a new calendar event
 */
router.post('/events', async (req, res, next) => {
  try {
    const userId = req.userId;
    const parsed = eventSchema.parse(req.body);

    const event = await CalendarEvent.create({
      userId,
      title: parsed.title,
      startAt: new Date(parsed.startAt),
      endAt: new Date(parsed.endAt),
      type: parsed.type,
      relatedLeadId: parsed.relatedLeadId || null,
      location: parsed.location || null,
      notes: parsed.notes || null,
      allDay: Boolean(parsed.allDay)
    });

    await AuditLog.create({
      userId,
      action: 'create',
      entityType: 'CalendarEvent',
      entityId: String(event.id),
      details: { title: event.title, startAt: event.startAt, endAt: event.endAt, type: event.type },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, event });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    next(err);
  }
});

/**
 * PATCH /api/calendar/events/:id - Update or reschedule an event
 */
router.patch('/events/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const eventId = parseInt(req.params.id, 10);
    const parsed = eventUpdateSchema.parse(req.body);

    const event = await CalendarEvent.findOne({ where: { id: eventId, userId } });
    if (!event) {
      return res.status(404).json({ error: 'NotFound', message: 'Calendar event not found' });
    }

    const updates = { ...parsed };
    if (parsed.startAt) updates.startAt = new Date(parsed.startAt);
    if (parsed.endAt) updates.endAt = new Date(parsed.endAt);

    await event.update(updates);

    await AuditLog.create({
      userId,
      action: 'update',
      entityType: 'CalendarEvent',
      entityId: String(event.id),
      details: { updates },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, event });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    next(err);
  }
});

/**
 * DELETE /api/calendar/events/:id - Delete an event
 */
router.delete('/events/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const eventId = parseInt(req.params.id, 10);

    const event = await CalendarEvent.findOne({ where: { id: eventId, userId } });
    if (!event) {
      return res.status(404).json({ error: 'NotFound', message: 'Calendar event not found' });
    }

    await event.destroy();

    await AuditLog.create({
      userId,
      action: 'delete',
      entityType: 'CalendarEvent',
      entityId: String(eventId),
      details: { title: event.title },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Calendar event deleted successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
