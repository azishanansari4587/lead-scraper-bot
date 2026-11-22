/**
 * Calls Router
 * Manages call logging, call history, buyer-specific call scripts, and call stats.
 * Enforces OptOut suppression and multi-tenant isolation.
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const Call = require('../../models/Call');
const CallScript = require('../../models/CallScript');
const Lead = require('../../models/Lead');
const FollowUp = require('../../models/FollowUp');
const OptOut = require('../../models/OptOut');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../config/logger');

const router = express.Router();

const logCallSchema = z.object({
  leadId: z.number().int().positive(),
  direction: z.enum(['outbound', 'inbound']).default('outbound'),
  calledAt: z.string().optional(),
  durationSec: z.number().int().min(0).default(0),
  outcome: z.enum([
    'connected',
    'no_answer',
    'voicemail',
    'busy',
    'wrong_number',
    'callback_requested',
    'interested',
    'not_interested'
  ]),
  summary: z.string().optional(),
  nextAction: z.string().optional(),
  nextFollowUpAt: z.string().optional().nullable()
});

/**
 * GET /api/calls - List paginated calls
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const where = { userId };
    if (req.query.leadId) where.leadId = parseInt(req.query.leadId, 10);
    if (req.query.outcome) where.outcome = req.query.outcome;
    if (req.query.direction) where.direction = req.query.direction;

    const { count, rows } = await Call.findAndCountAll({
      where,
      limit,
      offset,
      order: [['calledAt', 'DESC']],
      include: [
        {
          model: Lead,
          as: 'lead',
          attributes: ['id', 'businessName', 'phone', 'whatsapp', 'city', 'country', 'buyerType', 'status']
        }
      ]
    });

    res.json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      calls: rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/calls/today - Calls logged today & call follow-ups due today
 */
router.get('/today', async (req, res, next) => {
  try {
    const userId = req.userId;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    const [callsLoggedToday, followUpsToCall] = await Promise.all([
      Call.findAll({
        where: {
          userId,
          calledAt: { [Op.gte]: startOfDay }
        },
        order: [['calledAt', 'DESC']],
        include: [{ model: Lead, as: 'lead' }]
      }),
      FollowUp.findAll({
        where: {
          userId,
          channel: 'call',
          status: 'pending',
          dueAt: { [Op.lte]: endOfDay }
        },
        order: [['dueAt', 'ASC']],
        include: [{ model: Lead, as: 'lead' }]
      })
    ]);

    res.json({
      success: true,
      callsLoggedToday,
      followUpsToCall
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/calls/stats - Call metrics (today, this week, connect rate, outcome breakdown)
 */
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.userId;
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 7);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);

    const [callsToday, callsWeek] = await Promise.all([
      Call.findAll({
        where: { userId, calledAt: { [Op.gte]: startOfDay } },
        raw: true
      }),
      Call.findAll({
        where: { userId, calledAt: { [Op.gte]: sevenDaysAgo } },
        raw: true
      })
    ]);

    const connectedOutcomes = ['connected', 'callback_requested', 'interested'];
    const connectedWeek = callsWeek.filter((c) => connectedOutcomes.includes(c.outcome)).length;
    const connectRateWeek = callsWeek.length > 0 ? Math.round((connectedWeek / callsWeek.length) * 100) : 0;

    const outcomeBreakdown = {};
    callsWeek.forEach((c) => {
      outcomeBreakdown[c.outcome] = (outcomeBreakdown[c.outcome] || 0) + 1;
    });

    res.json({
      success: true,
      callsTodayCount: callsToday.length,
      callsWeekCount: callsWeek.length,
      connectRateWeek,
      outcomeBreakdown
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/calls/scripts - List buyer-specific call scripts
 */
router.get('/scripts', async (req, res, next) => {
  try {
    const scripts = await CallScript.findAll({
      order: [['buyerType', 'ASC'], ['isDefault', 'DESC']]
    });
    res.json({ success: true, scripts });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/calls - Log a phone call
 */
router.post('/', async (req, res, next) => {
  try {
    const parsed = logCallSchema.parse(req.body);
    const userId = req.userId;

    const lead = await Lead.findOne({ where: { id: parsed.leadId, userId } });
    if (!lead) {
      return res.status(404).json({ error: 'NotFound', message: 'Lead not found.' });
    }

    // 1. OptOut Check: Block calling opted-out numbers/leads
    const phoneClean = (lead.phone || '').replace(/[^0-9]/g, '');
    const checks = [];
    if (lead.email) checks.push({ type: 'email', value: lead.email.toLowerCase().trim() });
    if (phoneClean) checks.push({ type: 'phone', value: phoneClean });

    if (checks.length > 0) {
      const optedOut = await OptOut.findOne({
        where: { [Op.or]: checks }
      });
      if (optedOut || lead.optedOut) {
        return res.status(403).json({
          error: 'OptOutViolation',
          message: `Cannot place call. This recipient has opted out (${optedOut?.reason || 'Do-Not-Contact list'}).`
        });
      }
    }

    // 2. Create Call Record
    const calledAt = parsed.calledAt ? new Date(parsed.calledAt) : new Date();
    const call = await Call.create({
      userId,
      leadId: parsed.leadId,
      direction: parsed.direction,
      calledAt,
      durationSec: parsed.durationSec,
      outcome: parsed.outcome,
      summary: parsed.summary,
      nextAction: parsed.nextAction,
      nextFollowUpAt: parsed.nextFollowUpAt ? new Date(parsed.nextFollowUpAt) : null,
      createdBy: req.auth?.userId || 'founder'
    });

    // 3. Update Lead Status and Last Contacted
    const leadUpdates = {
      lastContactedAt: calledAt
    };

    if (parsed.nextFollowUpAt) {
      leadUpdates.nextFollowUpAt = new Date(parsed.nextFollowUpAt);
    }

    if (parsed.outcome === 'interested') {
      leadUpdates.status = 'negotiation';
    } else if (parsed.outcome === 'not_interested' || parsed.outcome === 'wrong_number') {
      leadUpdates.status = 'lost';
    } else if (lead.status === 'new') {
      leadUpdates.status = 'contacted';
    }

    await lead.update(leadUpdates);

    // 4. Create FollowUp record if requested
    if (parsed.nextFollowUpAt) {
      await FollowUp.create({
        userId,
        leadId: parsed.leadId,
        dueAt: new Date(parsed.nextFollowUpAt),
        channel: 'call',
        step: 'custom',
        status: 'pending',
        notes: parsed.nextAction ? `Call follow-up: ${parsed.nextAction}` : 'Scheduled call follow-up'
      });
    }

    // 5. Audit Log
    await AuditLog.create({
      userId,
      action: 'CALL_LOGGED',
      entityType: 'Call',
      entityId: String(call.id),
      details: {
        leadId: lead.id,
        outcome: parsed.outcome,
        durationSec: parsed.durationSec
      }
    });

    res.status(201).json({
      success: true,
      call,
      updatedLeadStatus: lead.status
    });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'ValidationError', issues: err.issues });
    }
    next(err);
  }
});

module.exports = router;
