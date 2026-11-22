/**
 * Follow-ups Router
 * Manages due and overdue follow-up tasks, status toggling, and custom follow-up scheduling.
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const FollowUp = require('../../models/FollowUp');
const Lead = require('../../models/Lead');
const AuditLog = require('../../models/AuditLog');

const router = express.Router();

/**
 * GET /api/follow-ups/today - Lists follow-ups due today and overdue
 */
router.get('/today', async (req, res, next) => {
  try {
    const userId = req.userId;
    const now = new Date();
    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [overdue, dueToday] = await Promise.all([
      FollowUp.findAll({
        where: {
          userId,
          status: 'pending',
          dueAt: { [Op.lt]: now }
        },
        order: [['dueAt', 'ASC']],
        include: [{ model: Lead, as: 'lead' }]
      }),
      FollowUp.findAll({
        where: {
          userId,
          status: 'pending',
          dueAt: {
            [Op.gte]: now,
            [Op.lte]: endOfDay
          }
        },
        order: [['dueAt', 'ASC']],
        include: [{ model: Lead, as: 'lead' }]
      })
    ]);

    res.json({
      success: true,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      overdue,
      dueToday
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/follow-ups - Create custom follow-up
 */
router.post('/', async (req, res, next) => {
  try {
    const schema = z.object({
      leadId: z.number().int().positive(),
      dueAt: z.string(),
      channel: z.enum(['email', 'whatsapp', 'call']).default('call'),
      step: z.string().optional().default('custom'),
      notes: z.string().optional()
    });

    const parsed = schema.parse(req.body);
    const userId = req.userId;

    const lead = await Lead.findOne({ where: { id: parsed.leadId, userId } });
    if (!lead) {
      return res.status(404).json({ error: 'NotFound', message: 'Lead not found.' });
    }

    const dueAt = new Date(parsed.dueAt);
    const followUp = await FollowUp.create({
      userId,
      leadId: parsed.leadId,
      dueAt,
      channel: parsed.channel,
      step: parsed.step,
      status: 'pending',
      notes: parsed.notes
    });

    // Update lead's nextFollowUpAt if this is sooner than current
    if (!lead.nextFollowUpAt || dueAt < new Date(lead.nextFollowUpAt)) {
      await lead.update({ nextFollowUpAt: dueAt });
    }

    res.status(201).json({ success: true, followUp });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'ValidationError', issues: err.issues });
    }
    next(err);
  }
});

/**
 * PATCH /api/follow-ups/:id/status - Update follow-up status (done, skipped, cancelled)
 */
router.patch('/:id/status', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { status, notes } = req.body;

    const validStatuses = ['done', 'skipped', 'cancelled', 'pending'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'ValidationError', message: `status must be one of: ${validStatuses.join(', ')}` });
    }

    const followUp = await FollowUp.findOne({ where: { id: req.params.id, userId } });
    if (!followUp) {
      return res.status(404).json({ error: 'NotFound', message: 'Follow-up not found.' });
    }

    await followUp.update({
      status,
      notes: notes !== undefined ? notes : followUp.notes
    });

    // Recalculate lead's nextFollowUpAt
    const nextPending = await FollowUp.findOne({
      where: { userId, leadId: followUp.leadId, status: 'pending' },
      order: [['dueAt', 'ASC']]
    });

    await Lead.update(
      { nextFollowUpAt: nextPending ? nextPending.dueAt : null },
      { where: { id: followUp.leadId, userId } }
    );

    res.json({ success: true, followUp });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
