/**
 * Mindset Gate API Router
 *
 * Endpoints:
 * - GET /api/gate/status: Get current gate requirement, active quotes count, settings
 * - POST /api/gate/start: Create or reuse in-progress gate log (idempotent)
 * - POST /api/gate/complete: Complete gate log, verify ownership and prevent double-complete
 * - GET /api/gate/quotes: List founder quotes
 * - POST /api/gate/quotes: Add quote (enforces max 5 active quotes)
 * - PATCH /api/gate/quotes/:id: Edit quote
 * - PUT /api/gate/quotes/replace: Replace all 5 quotes atomically (setup step)
 * - POST /api/gate/quotes/reorder: Reorder quote sort orders
 * - DELETE /api/gate/quotes/:id: Delete quote
 * - GET /api/gate/streak: Mindset gate streak
 * - PATCH /api/gate/settings: Update gate settings (mode, threshold, resetHour) with next-day relaxation protection
 */

const express = require('express');
const { z } = require('zod');
const gateService = require('../../services/gateService');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * GET /api/gate/status
 */
router.get('/status', async (req, res, next) => {
  try {
    const status = await gateService.getGateStatus(req.userId);
    res.json({ success: true, userId: req.userId, ...status });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gate/start
 */
router.post('/start', async (req, res, next) => {
  try {
    const log = await gateService.startGate(req.userId);
    res.json({ success: true, log });
  } catch (err) {
    next(err);
  }
});

const completeGateSchema = z.object({
  logId: z.number().int().positive(),
  method: z.enum(['voice', 'typed_fallback', 'mixed']).optional(),
  attemptsTotal: z.number().int().nonnegative().optional(),
  quotesCompleted: z.number().int().positive().optional(),
  quotesTyped: z.number().int().nonnegative().optional()
});

/**
 * POST /api/gate/complete
 */
router.post('/complete', async (req, res, next) => {
  try {
    const parsed = completeGateSchema.parse(req.body);
    const log = await gateService.completeGate(req.userId, parsed);
    res.json({ success: true, log });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    next(err);
  }
});

/**
 * GET /api/gate/quotes
 */
router.get('/quotes', async (req, res, next) => {
  try {
    const quotes = await gateService.getQuotes(req.userId);
    res.json({ success: true, quotes });
  } catch (err) {
    next(err);
  }
});

const createQuoteSchema = z.object({
  text: z.string().min(1).max(300),
  author: z.string().max(100).optional().nullable(),
  language: z.enum(['en-IN', 'hi-IN', 'en-US', 'en-GB']).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional()
});

/**
 * POST /api/gate/quotes
 */
router.post('/quotes', async (req, res, next) => {
  try {
    const parsed = createQuoteSchema.parse(req.body);
    const quote = await gateService.createQuote(req.userId, parsed);
    res.status(201).json({ success: true, quote });
  } catch (err) {
    if (err.name === 'ZodError') {
      return res.status(400).json({ error: 'Validation Error', details: err.errors });
    }
    next(err);
  }
});

/**
 * PATCH /api/gate/quotes/:id
 */
router.patch('/quotes/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const quote = await gateService.updateQuote(req.userId, id, req.body);
    res.json({ success: true, quote });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/gate/quotes/replace - Replace full set of 5 quotes
 */
router.put('/quotes/replace', async (req, res, next) => {
  try {
    const { quotes } = req.body;
    const replaced = await gateService.replaceQuotes(req.userId, quotes);
    res.json({ success: true, quotes: replaced });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/gate/quotes/reorder
 */
router.post('/quotes/reorder', async (req, res, next) => {
  try {
    const { quoteIds } = req.body;
    const quotes = await gateService.reorderQuotes(req.userId, quoteIds);
    res.json({ success: true, quotes });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/gate/quotes/:id
 */
router.delete('/quotes/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await gateService.deleteQuote(req.userId, id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/gate/streak
 */
router.get('/streak', async (req, res, next) => {
  try {
    const streakData = await gateService.calculateGateStreak(req.userId);
    res.json({ success: true, ...streakData });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/gate/settings - Update gate configuration with next-day policy
 */
router.patch('/settings', async (req, res, next) => {
  try {
    const settings = await gateService.updateGateSettings(req.userId, req.body);
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
