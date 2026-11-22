/**
 * Daily Planner Router
 * Manages founder daily rituals:
 * - Morning Plan (pick 3 MITs, confirm targets, morning intention)
 * - Evening Review (auto-summarized achievements, wins, lessons, streaks, tomorrow draft)
 */

const express = require('express');
const { z } = require('zod');
const AuditLog = require('../../models/AuditLog');
const {
  getDailyPlan,
  saveDailyPlan,
  getEveningSummary,
  generateTomorrowPlanDraft,
  saveDailyReview,
  calculateStreaks
} = require('../../services/planner/plannerService');

const router = express.Router();

const dailyPlanSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  mit1: z.string().optional().nullable(),
  mit2: z.string().optional().nullable(),
  mit3: z.string().optional().nullable(),
  mit1TaskId: z.number().int().positive().optional().nullable(),
  mit2TaskId: z.number().int().positive().optional().nullable(),
  mit3TaskId: z.number().int().positive().optional().nullable(),
  outreachTarget: z.number().int().min(0).optional().nullable(),
  callTarget: z.number().int().min(0).optional().nullable(),
  morningNote: z.string().optional().nullable()
});

const dailyReviewSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  doneSummary: z.string().optional().nullable(),
  win: z.string().optional().nullable(),
  lesson: z.string().optional().nullable(),
  tomorrowNotes: z.string().optional().nullable()
});

/**
 * GET /api/planner/daily-plan - Get plan for a date
 */
router.get('/daily-plan', async (req, res, next) => {
  try {
    const userId = req.userId;
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const plan = await getDailyPlan(userId, date);
    res.json({ success: true, date, plan });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/planner/daily-plan - Save or update morning plan
 */
router.post('/daily-plan', async (req, res, next) => {
  try {
    const userId = req.userId;
    const parsed = dailyPlanSchema.parse(req.body);

    const plan = await saveDailyPlan(userId, parsed);

    await AuditLog.create({
      userId,
      action: 'save_daily_plan',
      entityType: 'DailyPlan',
      entityId: String(plan.id),
      details: { date: plan.date, mit1: plan.mit1, mit2: plan.mit2, mit3: plan.mit3 },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, plan });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    next(err);
  }
});

/**
 * GET /api/planner/daily-review/summary - Generate auto-summary for evening review
 */
router.get('/daily-review/summary', async (req, res, next) => {
  try {
    const userId = req.userId;
    const date = req.query.date || new Date().toISOString().slice(0, 10);
    const summary = await getEveningSummary(userId, date);
    res.json({ success: true, ...summary });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/planner/daily-review - Save evening review
 */
router.post('/daily-review', async (req, res, next) => {
  try {
    const userId = req.userId;
    const parsed = dailyReviewSchema.parse(req.body);

    const review = await saveDailyReview(userId, parsed);

    await AuditLog.create({
      userId,
      action: 'save_daily_review',
      entityType: 'DailyReview',
      entityId: String(review.id),
      details: { date: review.date, win: review.win },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, review });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'ValidationError', details: err.errors });
    }
    next(err);
  }
});

/**
 * GET /api/planner/tomorrow-draft - Generate tomorrow plan draft
 */
router.get('/tomorrow-draft', async (req, res, next) => {
  try {
    const userId = req.userId;
    let targetDate = req.query.date;
    if (!targetDate) {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      targetDate = tomorrow.toISOString().slice(0, 10);
    }
    const draft = await generateTomorrowPlanDraft(userId, targetDate);
    res.json({ success: true, targetDate, draft });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/planner/streaks - Get founder consistency streaks
 */
router.get('/streaks', async (req, res, next) => {
  try {
    const userId = req.userId;
    const streaks = await calculateStreaks(userId);
    res.json({ success: true, ...streaks });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
