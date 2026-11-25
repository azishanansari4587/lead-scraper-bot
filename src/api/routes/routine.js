/**
 * CEO Routine Engine API Router
 * Endpoints for templates, blocks, daily routine entries, check-ins,
 * weekly analytics, enforcement policy, emergency exits, and partner flow.
 */

const express = require('express');
const { z } = require('zod');
const routineService = require('../../services/routine/routineService');
const routineAnalyticsService = require('../../services/routine/routineAnalyticsService');
const routineEnforcementService = require('../../services/routine/routineEnforcementService');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../config/logger');

const router = express.Router();

// ---------------------------------------------------------------------------
// VALIDATION SCHEMAS
// ---------------------------------------------------------------------------

const templateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(255).optional().nullable(),
  isDefault: z.boolean().optional(),
  assignedDays: z.array(z.number().int().min(0).max(6)).optional(),
  travelStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  travelEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable()
});

const blockSchema = z.object({
  templateId: z.number().int().positive(),
  title: z.string().min(1).max(255),
  category: z.string().max(50).default('deep_work'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'startTime must be HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'endTime must be HH:MM'),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().default([]),
  isMustDo: z.boolean().optional().default(false),
  isProtected: z.boolean().optional().default(false),
  linkedTaskId: z.number().int().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  sortOrder: z.number().int().optional().default(0)
});

const checkInSchema = z.object({
  action: z.enum(['start', 'done', 'partial', 'skip']),
  completeLinkedTask: z.boolean().optional().default(false),
  skipReason: z.string().optional().nullable(),
  note: z.string().optional().nullable()
});

const unplannedSchema = z.object({
  title: z.string().min(1).max(255),
  category: z.string().max(50).default('deep_work'),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  isMustDo: z.boolean().optional().default(false),
  note: z.string().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

const snoozeSchema = z.object({
  snoozeMinutes: z.number().int().positive().default(15),
  reason: z.string().optional().nullable()
});

const carryDecisionSchema = z.object({
  action: z.enum(['break_tasks', 'change_priority', 'delete']),
  subtasks: z.array(z.string().min(1)).optional(),
  reason: z.string().optional()
});

const policySchema = z.object({
  enabled: z.boolean().optional(),
  escalationEnabled: z.boolean().optional(),
  l1NudgeMinutes: z.number().int().min(0).optional(),
  l2TelegramMinutes: z.number().int().min(1).optional(),
  l3EmailMinutes: z.number().int().min(1).optional(),
  l4FocusLockMinutes: z.number().int().min(1).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  maxNudgesPerHour: z.number().int().min(1).max(10).optional(),
  maxSnoozesPerDay: z.number().int().min(0).max(10).optional(),
  focusLockEnabled: z.boolean().optional(),
  minDailyRestHours: z.number().min(4).max(12).optional(),
  weeklyRestDay: z.number().int().min(0).max(6).optional().nullable(),
  supportedStakes: z.array(z.enum(['restrict_non_essential_pages', 'pledge_reminder', 'partner_alert'])).optional(),
  pledgeText: z.string().optional().nullable()
});

// ---------------------------------------------------------------------------
// TEMPLATES & BLOCKS ENDPOINTS
// ---------------------------------------------------------------------------

router.get('/templates', async (req, res, next) => {
  try {
    const templates = await routineService.listTemplates(req.userId);
    res.json({ success: true, templates });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', async (req, res, next) => {
  try {
    const parsed = templateSchema.parse(req.body);
    const template = await routineService.createTemplate(req.userId, parsed);

    // AuditLog records field names and ids only (Amendment 12)
    await AuditLog.create({
      userId: req.userId,
      action: 'create_routine_template',
      entityType: 'RoutineTemplate',
      entityId: String(template.id),
      details: { fields: Object.keys(parsed) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, template });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'ValidationError', details: err.errors });
    next(err);
  }
});

router.patch('/templates/:id', async (req, res, next) => {
  try {
    const template = await routineService.updateTemplate(req.userId, Number(req.params.id), req.body);

    await AuditLog.create({
      userId: req.userId,
      action: 'update_routine_template',
      entityType: 'RoutineTemplate',
      entityId: String(template.id),
      details: { fields: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
});

router.delete('/templates/:id', async (req, res, next) => {
  try {
    await routineService.deleteTemplate(req.userId, Number(req.params.id));

    await AuditLog.create({
      userId: req.userId,
      action: 'delete_routine_template',
      entityType: 'RoutineTemplate',
      entityId: String(req.params.id),
      details: { deleted: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Template deactivated successfully' });
  } catch (err) {
    next(err);
  }
});

router.post('/blocks', async (req, res, next) => {
  try {
    const parsed = blockSchema.parse(req.body);
    const result = await routineService.addBlock(req.userId, parsed);

    await AuditLog.create({
      userId: req.userId,
      action: 'create_routine_block',
      entityType: 'RoutineBlock',
      entityId: String(result.block.id),
      details: { fields: Object.keys(parsed) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, ...result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'ValidationError', details: err.errors });
    next(err);
  }
});

router.patch('/blocks/:id', async (req, res, next) => {
  try {
    const result = await routineService.updateBlock(req.userId, Number(req.params.id), req.body);

    await AuditLog.create({
      userId: req.userId,
      action: 'update_routine_block',
      entityType: 'RoutineBlock',
      entityId: String(req.params.id),
      details: { fields: Object.keys(req.body) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.delete('/blocks/:id', async (req, res, next) => {
  try {
    await routineService.deleteBlock(req.userId, Number(req.params.id));

    await AuditLog.create({
      userId: req.userId,
      action: 'delete_routine_block',
      entityType: 'RoutineBlock',
      entityId: String(req.params.id),
      details: { deleted: true },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, message: 'Block removed' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// TODAY & ENTRIES OPERATIONS
// ---------------------------------------------------------------------------

router.get('/today', async (req, res, next) => {
  try {
    const tz = await routineService.getUserTimezone(req.userId);
    const dateStr = req.query.date || routineService.getLocalDateStr(new Date(), tz);

    const [entries, nowNext, timelineData, policy] = await Promise.all([
      routineService.generateDayEntries(req.userId, dateStr),
      routineService.getNowAndNext(req.userId, dateStr),
      routineService.getDayTimelineWithEvidence(req.userId, dateStr),
      routineEnforcementService.getOrCreatePolicy(req.userId)
    ]);

    const dayOfWeek = new Date(`${dateStr}T12:00:00Z`).getDay();
    const dailyScore = routineAnalyticsService.calculateDailyScore(entries, policy, dayOfWeek);

    res.json({
      success: true,
      date: dateStr,
      timezone: tz,
      entries: timelineData.entries,
      nowNext,
      dailyScore,
      policy: {
        focusLockEnabled: policy.focusLockEnabled,
        escalationEnabled: policy.escalationEnabled,
        supportedStakes: policy.supportedStakes ? JSON.parse(policy.supportedStakes) : [],
        pledgeText: policy.pledgeText
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/entries', async (req, res, next) => {
  try {
    const tz = await routineService.getUserTimezone(req.userId);
    const dateStr = req.query.date || routineService.getLocalDateStr(new Date(), tz);
    const timeline = await routineService.getDayTimelineWithEvidence(req.userId, dateStr);
    res.json({ success: true, ...timeline });
  } catch (err) {
    next(err);
  }
});

router.post('/entries/:id/check-in', async (req, res, next) => {
  try {
    const parsed = checkInSchema.parse(req.body);
    const entryId = Number(req.params.id);

    let updatedEntry;
    if (parsed.action === 'start') {
      updatedEntry = await routineService.startEntry(req.userId, entryId);
    } else if (parsed.action === 'done') {
      updatedEntry = await routineService.doneEntry(req.userId, entryId, {
        completeLinkedTask: parsed.completeLinkedTask,
        note: parsed.note
      });
    } else if (parsed.action === 'partial') {
      updatedEntry = await routineService.partialEntry(req.userId, entryId, parsed.note);
    } else if (parsed.action === 'skip') {
      updatedEntry = await routineService.skipEntry(req.userId, entryId, parsed.skipReason);
    }

    // AuditLog records action and IDs only, never skipReason or note text (Amendment 12)
    await AuditLog.create({
      userId: req.userId,
      action: `routine_check_in_${parsed.action}`,
      entityType: 'RoutineEntry',
      entityId: String(entryId),
      details: { action: parsed.action, completeLinkedTask: parsed.completeLinkedTask },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, entry: updatedEntry });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'ValidationError', details: err.errors });
    next(err);
  }
});

router.post('/entries/unplanned', async (req, res, next) => {
  try {
    const parsed = unplannedSchema.parse(req.body);
    const entry = await routineService.addUnplannedEntry(req.userId, parsed);

    await AuditLog.create({
      userId: req.userId,
      action: 'add_unplanned_routine_entry',
      entityType: 'RoutineEntry',
      entityId: String(entry.id),
      details: { fields: Object.keys(parsed) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.status(201).json({ success: true, entry });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'ValidationError', details: err.errors });
    next(err);
  }
});

router.post('/entries/:id/snooze', async (req, res, next) => {
  try {
    const parsed = snoozeSchema.parse(req.body);
    const entry = await routineService.snoozeEntry(req.userId, Number(req.params.id), parsed.snoozeMinutes, parsed.reason);

    await AuditLog.create({
      userId: req.userId,
      action: 'snooze_routine_entry',
      entityType: 'RoutineEntry',
      entityId: String(entry.id),
      details: { snoozeMinutes: parsed.snoozeMinutes },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, entry });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'ValidationError', details: err.errors });
    next(err);
  }
});

router.post('/entries/:id/decision', async (req, res, next) => {
  try {
    const parsed = carryDecisionSchema.parse(req.body);
    const result = await routineService.resolveCarryDecision(req.userId, Number(req.params.id), parsed.action, parsed);

    await AuditLog.create({
      userId: req.userId,
      action: `routine_carry_decision_${parsed.action}`,
      entityType: 'RoutineEntry',
      entityId: String(req.params.id),
      details: { action: parsed.action },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, ...result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'ValidationError', details: err.errors });
    next(err);
  }
});

// ---------------------------------------------------------------------------
// ANALYTICS & SUGGESTIONS
// ---------------------------------------------------------------------------

router.get('/analytics/weekly', async (req, res, next) => {
  try {
    const report = await routineAnalyticsService.generateWeeklyReport(req.userId);

    let aiSummary = { available: false, narrative: '' };
    if (req.query.includeAi === 'true') {
      aiSummary = await routineAnalyticsService.generateAiNarrativeSummary(req.userId, report, []);
    }

    res.json({ success: true, report, aiSummary });
  } catch (err) {
    next(err);
  }
});

router.post('/suggestions/accept', async (req, res, next) => {
  try {
    const { suggestionId, targetTemplateId, modifications } = req.body;
    // Apply template adjustment if provided
    if (targetTemplateId && modifications) {
      await routineService.updateTemplate(req.userId, Number(targetTemplateId), modifications);
    }
    res.json({ success: true, message: 'Suggestion accepted and template updated.' });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POLICY, EMERGENCY EXIT & PARTNER FLOW
// ---------------------------------------------------------------------------

router.get('/policy', async (req, res, next) => {
  try {
    const policy = await routineEnforcementService.getOrCreatePolicy(req.userId);
    res.json({ success: true, policy });
  } catch (err) {
    next(err);
  }
});

router.patch('/policy', async (req, res, next) => {
  try {
    const parsed = policySchema.parse(req.body);
    const result = await routineEnforcementService.updatePolicy(req.userId, parsed);

    await AuditLog.create({
      userId: req.userId,
      action: 'update_routine_policy',
      entityType: 'RoutinePolicy',
      entityId: String(result.policy.id),
      details: { fields: Object.keys(parsed) },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, ...result });
  } catch (err) {
    if (err.name === 'ZodError') return res.status(400).json({ error: 'ValidationError', details: err.errors });
    next(err);
  }
});

router.post('/policy/emergency-exit', async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await routineEnforcementService.useEmergencyExit(req.userId, reason);

    await AuditLog.create({
      userId: req.userId,
      action: 'routine_emergency_exit_used',
      entityType: 'RoutinePolicy',
      entityId: String(req.userId),
      details: { timestamp: new Date() },
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

router.post('/partner/invite', async (req, res, next) => {
  try {
    const { username } = req.body;
    const invite = await routineEnforcementService.createPartnerInvite(req.userId, username);
    res.json({ success: true, ...invite });
  } catch (err) {
    next(err);
  }
});

router.post('/partner/stop', async (req, res, next) => {
  try {
    const result = await routineEnforcementService.revokePartner(req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// Partner Claim Endpoint (Called by webhook or Telegram bot runner with token & chatId)
router.post('/partner/claim', async (req, res, next) => {
  try {
    const { token, chatId } = req.body;
    const result = await routineEnforcementService.confirmPartnerOptIn(token, chatId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: 'PartnerClaimError', message: err.message });
  }
});

module.exports = router;
