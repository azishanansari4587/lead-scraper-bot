/**
 * Work Wallet API Router
 *
 * Endpoints for:
 * - Live state, timer, and settlement breakdown
 * - Session start, stop, heartbeat, manual session
 * - Break toggle and allowance tracking
 * - Leave logging and pause toggle
 * - Ledger history with pagination and filters
 * - CSV export with formula injection defense
 * - Analytics & 30-day summaries
 * - Work schedules & windows CRUD (with health guardrails)
 * - Rewards catalog, redemption, and refunds
 * - Policy management (immediate tightening, next-day queued loosening)
 * - Suggested work acceptance / dismissal
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const walletService = require('../../services/wallet/walletService');
const walletSettlementService = require('../../services/wallet/walletSettlementService');
const walletIntervalMath = require('../../services/wallet/walletIntervalMath');
const walletWellbeingService = require('../../services/wallet/walletWellbeingService');
const {
  WalletPolicy,
  WalletState,
  WorkSchedule,
  WorkWindow,
  WorkSession,
  WalletBreak,
  WalletLeave,
  WalletLedgerEntry,
  WalletReward,
  RoutinePolicy,
  RoutineBlock,
  AuditLog
} = require('../../models');

const router = express.Router();

/**
 * Dev-only fast-clock helper: advances simulated clock for testing.
 * Strictly disabled in production.
 */
function getEffectiveNow(req) {
  if (process.env.NODE_ENV === 'production') {
    return new Date();
  }
  if (req.headers['x-fast-clock-timestamp']) {
    const ts = new Date(req.headers['x-fast-clock-timestamp']);
    if (!isNaN(ts.getTime())) return ts;
  }
  if (req.query.fastClockTimestamp) {
    const ts = new Date(req.query.fastClockTimestamp);
    if (!isNaN(ts.getTime())) return ts;
  }
  const advanceMin = Number(req.headers['x-fast-clock-advance-minutes'] || req.query.fastClockAdvanceMinutes || 0);
  if (advanceMin > 0) {
    return new Date(Date.now() + advanceMin * 60000);
  }
  const multiplier = Number(req.headers['x-fast-clock-multiplier'] || req.query.fastClock || 1);
  if (multiplier > 1) {
    return new Date(Date.now() + (multiplier - 1) * 60000);
  }
  return new Date();
}

// ---------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ---------------------------------------------------------------------------

const startSessionSchema = z.object({
  source: z.string().max(30).optional().default('timer'),
  linkedTaskId: z.number().int().positive().optional().nullable(),
  linkedRoutineEntryId: z.number().int().positive().optional().nullable(),
  note: z.string().max(500).optional().nullable()
});

const stopSessionSchema = z.object({
  sessionId: z.number().int().positive().optional().nullable()
});

const heartbeatSchema = z.object({
  sessionId: z.number().int().positive(),
  isActive: z.boolean().optional().default(true)
});

const manualSessionSchema = z.object({
  startAt: z.string(),
  endAt: z.string(),
  note: z.string().max(500).optional().nullable(),
  linkedTaskId: z.number().int().positive().optional().nullable()
});

const toggleBreakSchema = z.object({
  action: z.enum(['toggle', 'start', 'stop']).optional().default('toggle')
});

const leaveSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  type: z.enum(['sick', 'travel', 'personal']).optional().default('sick'),
  reason: z.string().max(500).optional().nullable()
});

const pauseSchema = z.object({
  isPaused: z.boolean()
});

const scheduleSchema = z.object({
  name: z.string().min(1).max(100),
  assignedDays: z.array(z.number().int().min(0).max(6)).optional().default([]),
  isDefault: z.boolean().optional().default(false),
  travelStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  travelEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  windows: z.array(z.object({
    startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:MM'),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:MM'),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([])
  })).min(1, 'At least one work window is required.')
});

const rewardSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  pricePaise: z.number().int().positive('Price must be greater than 0'),
  icon: z.string().max(50).optional().default('Gift')
});

const policySchema = z.object({
  enabled: z.boolean().optional(),
  earnRatePaisePerMin: z.number().int().min(0).optional(),
  penaltyRatePaisePerMin: z.number().int().min(0).optional(),
  overtimeMode: z.enum(['none', 'half_rate', 'full_rate']).optional(),
  overtimeCapMinutes: z.number().int().min(0).optional(),
  dailyBreakAllowanceMinutes: z.number().int().min(0).optional(),
  monthlyLeaveAllowanceDays: z.number().int().min(0).optional(),
  weeklyRestDay: z.number().int().min(0).max(6).optional().nullable(),
  minDailySleepMinutes: z.number().int().min(0).optional(),
  minDailyMealMinutes: z.number().int().min(0).optional(),
  minDailyPersonalMinutes: z.number().int().min(0).optional(),
  allowNegative: z.boolean().optional(),
  floorEnabled: z.boolean().optional(),
  walletFloorPaise: z.number().int().optional(),
  dayCloseGraceHours: z.number().int().min(0).max(23).optional(),
  idleTimeoutMinutes: z.number().int().min(1).max(60).optional(),
  idleCheckEnabled: z.boolean().optional(),
  maxDailyManualMinutes: z.number().int().min(0).optional(),
  maxSessionLengthMinutes: z.number().int().min(10).max(1440).optional(),
  nudgeThresholdHighHours: z.number().int().min(1).max(24).optional()
});

// ---------------------------------------------------------------------------
// ROUTES
// ---------------------------------------------------------------------------

/**
 * GET /api/wallet/state - Live wallet state, balance, timers, and breakdown
 */
router.get('/state', async (req, res, next) => {
  try {
    const userId = req.userId;
    const nowUtc = getEffectiveNow(req);

    const result = await walletService.getWalletState(userId, { nowUtc });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/session/start - Start work session
 */
router.post('/session/start', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = startSessionSchema.parse(req.body);
    const session = await walletService.startSession(userId, body);

    await AuditLog.create({
      userId,
      action: 'wallet_session_started',
      entityType: 'WorkSession',
      entityId: session.id,
      details: {
        source: session.source,
        linkedTaskId: session.linkedTaskId,
        linkedRoutineEntryId: session.linkedRoutineEntryId
      }
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/session/stop - Stop work session
 */
router.post('/session/stop', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = stopSessionSchema.parse(req.body);
    const session = await walletService.stopSession(userId, body);

    if (session) {
      await AuditLog.create({
        userId,
        action: 'wallet_session_stopped',
        entityType: 'WorkSession',
        entityId: session.id,
        details: {
          sessionId: session.id,
          source: session.source
        }
      });
    }

    res.json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/session/heartbeat - Ping heartbeat every 60s
 */
router.post('/session/heartbeat', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = heartbeatSchema.parse(req.body);
    const result = await walletService.recordHeartbeat(userId, body);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/session/manual - Add manual work session
 */
router.post('/session/manual', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = manualSessionSchema.parse(req.body);
    const session = await walletService.addManualSession(userId, body);

    await AuditLog.create({
      userId,
      action: 'wallet_manual_session_logged',
      entityType: 'WorkSession',
      entityId: session.id,
      details: {
        linkedTaskId: session.linkedTaskId,
        source: 'manual'
      }
    });

    res.status(201).json({ success: true, session });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/break/toggle - Toggle or start/stop break
 */
router.post('/break/toggle', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = toggleBreakSchema.parse(req.body);
    const result = await walletService.toggleBreak(userId, body);

    await AuditLog.create({
      userId,
      action: 'wallet_break_toggled',
      entityType: 'WalletBreak',
      entityId: result.break?.id || 0,
      details: {
        isBreakActive: result.isBreakActive
      }
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/leave - Log sick, travel, or personal leave
 */
router.post('/leave', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = leaveSchema.parse(req.body);
    const leave = await walletService.logLeave(userId, body);

    await AuditLog.create({
      userId,
      action: 'wallet_leave_logged',
      entityType: 'WalletLeave',
      entityId: leave.id,
      details: {
        date: leave.date,
        type: leave.type,
        isExceedingAllowance: leave.isExceedingAllowance
      }
    });

    res.status(201).json({ success: true, leave });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/wallet/pause - Toggle wallet pause mode
 */
router.post('/pause', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = pauseSchema.parse(req.body);
    const result = await walletService.togglePause(userId, body);

    await AuditLog.create({
      userId,
      action: 'wallet_pause_toggled',
      entityType: 'WalletState',
      entityId: 0,
      details: {
        isPaused: result.isPaused
      }
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/wallet/ledger - Paginated ledger transactions
 */
router.get('/ledger', async (req, res, next) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 25));
    const offset = (page - 1) * limit;

    const where = { userId };
    if (req.query.date) where.date = req.query.date;
    if (req.query.type) where.type = req.query.type;

    const { count, rows } = await WalletLedgerEntry.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });

    const state = await WalletState.findOne({ where: { userId } });

    res.json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      balancePaise: state?.balancePaise || 0,
      entries: rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/wallet/analytics - Summary over last 7 and 30 days
 */
router.get('/analytics', async (req, res, next) => {
  try {
    const userId = req.userId;
    const entries = await WalletLedgerEntry.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });

    let totalEarnedPaise = 0;
    let totalPenalizedPaise = 0;
    let totalWorkedMinutes = 0;

    for (const e of entries) {
      if (e.amountPaise > 0) {
        totalEarnedPaise += e.amountPaise;
      } else if (e.type === 'penalty') {
        totalPenalizedPaise += Math.abs(e.amountPaise);
      }
      if (e.type === 'earn') {
        totalWorkedMinutes += e.minutes || 0;
      }
    }

    res.json({
      success: true,
      totalEarnedPaise,
      totalPenalizedPaise,
      totalWorkedMinutes,
      totalWorkedHours: (totalWorkedMinutes / 60).toFixed(1),
      netPaise: totalEarnedPaise - totalPenalizedPaise,
      disclaimer: 'Virtual self-motivation currency (points). Not real money.'
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/wallet/export - UTF-8 BOM CSV export with formula injection protection
 */
router.get('/export', async (req, res, next) => {
  try {
    const userId = req.userId;
    const entries = await WalletLedgerEntry.findAll({
      where: { userId },
      order: [['createdAt', 'ASC']]
    });

    // Security: sanitize cells starting with '=', '+', '-', '@' with a leading apostrophe
    const sanitizeCsvCell = (val) => {
      if (val === null || val === undefined) return '""';
      let str = String(val).replace(/"/g, '""');
      if (/^[=+\-@]/.test(str)) {
        str = `'${str}`;
      }
      return `"${str}"`;
    };

    const headers = ['ID', 'Date', 'Type', 'Amount (Paise)', 'Amount (INR)', 'Minutes', 'Reason', 'Provisional', 'Created At'];
    const rows = entries.map((e) => [
      e.id,
      e.date,
      e.type,
      e.amountPaise,
      (e.amountPaise / 100).toFixed(2),
      e.minutes,
      e.reason,
      e.isProvisional ? 'Yes' : 'No',
      e.createdAt ? new Date(e.createdAt).toISOString() : ''
    ].map(sanitizeCsvCell).join(','));

    // UTF-8 BOM prefix \uFEFF ensures proper excel rendering
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="work_wallet_ledger_${Date.now()}.csv"`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

/**
 * WORK SCHEDULES CRUD
 */

router.get('/schedules', async (req, res, next) => {
  try {
    const userId = req.userId;
    const schedules = await WorkSchedule.findAll({
      where: { userId },
      include: [{ model: WorkWindow, as: 'windows' }],
      order: [['createdAt', 'ASC']]
    });
    res.json({ success: true, schedules });
  } catch (err) {
    next(err);
  }
});

router.post('/schedules', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = scheduleSchema.parse(req.body);

    const { policy } = await walletService.getOrCreateUserWallet(userId);

    // Validate health constraints (min sleep 6.5h, meal 1h, personal 2h, quiet hours, protected blocks)
    const routinePolicy = await RoutinePolicy.findOne({ where: { userId } });
    const protectedBlocks = await RoutineBlock.findAll({
      where: { userId, isProtected: true, isActive: true }
    });

    const validation = walletIntervalMath.validateScheduleConstraints({
      windows: body.windows,
      minDailySleepMinutes: policy.minDailySleepMinutes,
      minDailyMealMinutes: policy.minDailyMealMinutes,
      minDailyPersonalMinutes: policy.minDailyPersonalMinutes !== undefined ? policy.minDailyPersonalMinutes : 120,
      quietHours: routinePolicy ? {
        enabled: routinePolicy.quietHoursEnabled,
        start: routinePolicy.quietHoursStart,
        end: routinePolicy.quietHoursEnd
      } : null,
      protectedBlocks
    });

    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors, warnings: validation.warnings });
    }

    const schedule = await WorkSchedule.create({
      userId,
      name: body.name,
      assignedDays: JSON.stringify(body.assignedDays || []),
      isDefault: Boolean(body.isDefault),
      travelStartDate: body.travelStartDate,
      travelEndDate: body.travelEndDate,
      isActive: true
    });

    for (const win of body.windows) {
      const [sh, sm] = win.startTime.split(':').map(Number);
      const [eh, em] = win.endTime.split(':').map(Number);
      const isOvernight = (eh < sh) || (eh === sh && em < sm);

      await WorkWindow.create({
        scheduleId: schedule.id,
        userId,
        startTime: win.startTime,
        endTime: win.endTime,
        isOvernight,
        daysOfWeek: JSON.stringify(win.daysOfWeek || []),
        isActive: true
      });
    }

    const created = await WorkSchedule.findOne({
      where: { id: schedule.id, userId },
      include: [{ model: WorkWindow, as: 'windows' }]
    });

    await AuditLog.create({
      userId,
      action: 'wallet_schedule_created',
      entityType: 'WorkSchedule',
      entityId: schedule.id,
      details: { scheduleId: schedule.id, windowCount: body.windows.length }
    });

    res.status(201).json({ success: true, schedule: created, warnings: validation.warnings });
  } catch (err) {
    next(err);
  }
});

router.put('/schedules/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const scheduleId = parseInt(req.params.id, 10);
    const body = scheduleSchema.parse(req.body);

    const schedule = await WorkSchedule.findOne({ where: { id: scheduleId, userId } });
    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    const { policy } = await walletService.getOrCreateUserWallet(userId);
    const routinePolicy = await RoutinePolicy.findOne({ where: { userId } });
    const protectedBlocks = await RoutineBlock.findAll({
      where: { userId, isProtected: true, isActive: true }
    });

    const validation = walletIntervalMath.validateScheduleConstraints({
      windows: body.windows,
      minDailySleepMinutes: policy.minDailySleepMinutes,
      minDailyMealMinutes: policy.minDailyMealMinutes,
      minDailyPersonalMinutes: policy.minDailyPersonalMinutes !== undefined ? policy.minDailyPersonalMinutes : 120,
      quietHours: routinePolicy ? {
        enabled: routinePolicy.quietHoursEnabled,
        start: routinePolicy.quietHoursStart,
        end: routinePolicy.quietHoursEnd
      } : null,
      protectedBlocks
    });

    if (!validation.isValid) {
      return res.status(400).json({ success: false, errors: validation.errors, warnings: validation.warnings });
    }

    await schedule.update({
      name: body.name,
      assignedDays: JSON.stringify(body.assignedDays || []),
      isDefault: Boolean(body.isDefault),
      travelStartDate: body.travelStartDate,
      travelEndDate: body.travelEndDate
    });

    await WorkWindow.destroy({ where: { scheduleId: schedule.id, userId } });
    for (const win of body.windows) {
      const [sh, sm] = win.startTime.split(':').map(Number);
      const [eh, em] = win.endTime.split(':').map(Number);
      const isOvernight = (eh < sh) || (eh === sh && em < sm);

      await WorkWindow.create({
        scheduleId: schedule.id,
        userId,
        startTime: win.startTime,
        endTime: win.endTime,
        isOvernight,
        daysOfWeek: JSON.stringify(win.daysOfWeek || []),
        isActive: true
      });
    }

    const updated = await WorkSchedule.findOne({
      where: { id: schedule.id, userId },
      include: [{ model: WorkWindow, as: 'windows' }]
    });

    await AuditLog.create({
      userId,
      action: 'wallet_schedule_updated',
      entityType: 'WorkSchedule',
      entityId: schedule.id,
      details: { scheduleId: schedule.id, windowCount: body.windows.length }
    });

    res.json({ success: true, schedule: updated, warnings: validation.warnings });
  } catch (err) {
    next(err);
  }
});

router.delete('/schedules/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const scheduleId = parseInt(req.params.id, 10);
    const schedule = await WorkSchedule.findOne({ where: { id: scheduleId, userId } });

    if (!schedule) {
      return res.status(404).json({ success: false, error: 'Schedule not found' });
    }

    await schedule.destroy();

    await AuditLog.create({
      userId,
      action: 'wallet_schedule_deleted',
      entityType: 'WorkSchedule',
      entityId: scheduleId,
      details: { scheduleId }
    });

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

/**
 * REWARDS CATALOG & REDEMPTION
 */

router.get('/rewards', async (req, res, next) => {
  try {
    const userId = req.userId;
    const rewards = await WalletReward.findAll({
      where: { userId },
      order: [['pricePaise', 'ASC']]
    });
    res.json({ success: true, rewards });
  } catch (err) {
    next(err);
  }
});

router.post('/rewards', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = rewardSchema.parse(req.body);
    const reward = await WalletReward.create({
      userId,
      ...body,
      isActive: true
    });

    await AuditLog.create({
      userId,
      action: 'wallet_reward_created',
      entityType: 'WalletReward',
      entityId: reward.id,
      details: { rewardId: reward.id, pricePaise: reward.pricePaise }
    });

    res.status(201).json({ success: true, reward });
  } catch (err) {
    next(err);
  }
});

router.post('/rewards/:id/redeem', async (req, res, next) => {
  try {
    const userId = req.userId;
    const rewardId = parseInt(req.params.id, 10);
    const result = await walletService.redeemReward(userId, rewardId);

    await AuditLog.create({
      userId,
      action: 'wallet_reward_redeemed',
      entityType: 'WalletReward',
      entityId: rewardId,
      details: { rewardId, ledgerEntryId: result.entry.id }
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/rewards/redeem/:ledgerEntryId/refund', async (req, res, next) => {
  try {
    const userId = req.userId;
    const ledgerEntryId = parseInt(req.params.ledgerEntryId, 10);
    const refundEntry = await walletService.refundReward(userId, ledgerEntryId);

    await AuditLog.create({
      userId,
      action: 'wallet_reward_refunded',
      entityType: 'WalletLedgerEntry',
      entityId: refundEntry.id,
      details: { originalEntryId: ledgerEntryId, refundEntryId: refundEntry.id }
    });

    res.json({ success: true, refundEntry });
  } catch (err) {
    next(err);
  }
});

/**
 * POLICY MANAGEMENT
 */

router.get('/policy', async (req, res, next) => {
  try {
    const userId = req.userId;
    const { policy } = await walletService.getOrCreateUserWallet(userId);
    res.json({ success: true, policy });
  } catch (err) {
    next(err);
  }
});

router.patch('/policy', async (req, res, next) => {
  try {
    const userId = req.userId;
    const body = policySchema.parse(req.body);
    const policy = await walletService.updatePolicy(userId, body);

    await AuditLog.create({
      userId,
      action: 'wallet_policy_updated',
      entityType: 'WalletPolicy',
      entityId: policy.id,
      details: {
        updatedFields: Object.keys(body)
      }
    });

    res.json({ success: true, policy });
  } catch (err) {
    next(err);
  }
});

/**
 * WELLBEING ALERTS & UNREALISTIC SCHEDULE INSIGHTS
 */

router.get('/insights', async (req, res, next) => {
  try {
    const userId = req.userId;
    const nowUtc = getEffectiveNow(req);
    const insight = await walletWellbeingService.evaluateUnrealisticSchedule(userId, nowUtc);
    res.json({ success: true, insight });
  } catch (err) {
    next(err);
  }
});

router.get('/wellbeing-check', async (req, res, next) => {
  try {
    const userId = req.userId;
    const nowUtc = getEffectiveNow(req);
    const dryRun = req.query.dryRun === 'true';
    const result = await walletWellbeingService.checkWellbeingAlerts(userId, { nowUtc, dryRun });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * SUGGESTED WORK ACCEPTANCE / DISMISSAL
 * Note: Never changes settings automatically. Records founder decision and logs audit.
 */

router.post('/suggested-work/accept', async (req, res, next) => {
  try {
    const userId = req.userId;
    await AuditLog.create({
      userId,
      action: 'wallet_suggested_work_accepted',
      entityType: 'WalletInsight',
      details: { proposalId: req.body?.proposalId || 'unrealistic_schedule' }
    });

    res.json({
      success: true,
      message: 'Proposal accepted. Please review and adjust your work windows in Settings to match your natural pace.'
    });
  } catch (err) {
    next(err);
  }
});

router.post('/suggested-work/dismiss', async (req, res, next) => {
  try {
    const userId = req.userId;
    await AuditLog.create({
      userId,
      action: 'wallet_suggested_work_dismissed',
      entityType: 'WalletInsight',
      details: { proposalId: req.body?.proposalId || 'unrealistic_schedule' }
    });

    res.json({ success: true, dismissed: true, message: 'Proposal dismissed.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
