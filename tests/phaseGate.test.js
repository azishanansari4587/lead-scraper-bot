import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import {
  MindsetQuote,
  MindsetGateLog,
  UserSettings
} from '../src/models';
import gateService from '../src/services/gateService';
import plannerService from '../src/services/planner/plannerService';

describe('Phase Mindset Gate — Daily Principle Recitation Suite', () => {
  const testUserId = 'test_gate_founder';
  const intruderUserId = 'test_gate_intruder';

  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-role': 'admin'
  };

  const intruderAuthHeaders = {
    'x-test-user-id': intruderUserId,
    'x-test-role': 'admin'
  };

  beforeEach(async () => {
    // Clear test data
    await MindsetGateLog.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await MindsetQuote.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await UserSettings.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
  });

  describe('1. Multi-Tenant Quote Isolation & Tenancy (Amendment 5)', () => {
    it('prevents a user from accessing, modifying, or deleting another user\'s quotes', async () => {
      // 1. Intruder creates a quote
      const intruderQuote = await MindsetQuote.create({
        userId: intruderUserId,
        text: 'Intruder private secret quote',
        author: 'Intruder',
        language: 'en-US',
        sortOrder: 0,
        isActive: true
      });

      // 2. Founder tries to list quotes - should NOT see intruder's quote
      const listRes = await request(app)
        .get('/api/gate/quotes')
        .set(authHeaders);

      expect(listRes.status).toBe(200);
      expect(listRes.body.quotes).toHaveLength(0);

      // 3. Founder tries to edit intruder's quote - should return 404
      const editRes = await request(app)
        .patch(`/api/gate/quotes/${intruderQuote.id}`)
        .set(authHeaders)
        .send({ text: 'Hijacked quote text' });

      expect(editRes.status).toBe(404);

      // 4. Founder tries to delete intruder's quote - should return 404
      const deleteRes = await request(app)
        .delete(`/api/gate/quotes/${intruderQuote.id}`)
        .set(authHeaders);

      expect(deleteRes.status).toBe(404);

      // Verify quote is untouched
      const freshQuote = await MindsetQuote.findByPk(intruderQuote.id);
      expect(freshQuote.text).toBe('Intruder private secret quote');
    });
  });

  describe('2. Max 5 Active Quotes Enforcement & Setup Requirement (Amendment 5)', () => {
    it('enforces maximum 5 active quotes and flags setupRequired when fewer than 5 exist', async () => {
      // Initially 0 quotes -> status should be setupRequired: true
      const initialStatusRes = await request(app)
        .get('/api/gate/status')
        .set(authHeaders);

      expect(initialStatusRes.status).toBe(200);
      expect(initialStatusRes.body.required).toBe(true);
      expect(initialStatusRes.body.setupRequired).toBe(true);
      expect(initialStatusRes.body.activeQuotesCount).toBe(0);

      // Create 5 active quotes
      for (let i = 1; i <= 5; i++) {
        const createRes = await request(app)
          .post('/api/gate/quotes')
          .set(authHeaders)
          .send({
            text: `Knotiq Founder Principle number ${i} for bespoke handmade rugs`,
            author: 'Knotiq Founder',
            language: 'en-IN',
            sortOrder: i - 1
          });

        expect(createRes.status).toBe(201);
      }

      // Verify 5 active quotes exist
      const status5Res = await request(app)
        .get('/api/gate/status')
        .set(authHeaders);

      expect(status5Res.status).toBe(200);
      expect(status5Res.body.setupRequired).toBe(false);
      expect(status5Res.body.activeQuotesCount).toBe(5);

      // Attempting to create a 6th active quote MUST return 400
      const extraRes = await request(app)
        .post('/api/gate/quotes')
        .set(authHeaders)
        .send({
          text: 'Attempted sixth active quote beyond limit',
          author: 'Knotiq Founder'
        });

      expect(extraRes.status).toBe(400);
      expect(extraRes.body.message || extraRes.body.error).toMatch(/Maximum of 5 active quotes allowed/i);

      // Deleting 1 quote drops count to 4, re-triggering setupRequired
      const allQuotes = await MindsetQuote.findAll({ where: { userId: testUserId } });
      const deleteRes = await request(app)
        .delete(`/api/gate/quotes/${allQuotes[0].id}`)
        .set(authHeaders);

      expect(deleteRes.status).toBe(200);

      const statusAfterDelete = await request(app)
        .get('/api/gate/status')
        .set(authHeaders);

      expect(statusAfterDelete.body.setupRequired).toBe(true);
      expect(statusAfterDelete.body.activeQuotesCount).toBe(4);
    });
  });

  describe('3. Atomic Quote Replacement (Setup Step & PUT /api/gate/quotes/replace)', () => {
    it('atomically replaces quotes when 5 valid quotes are provided, rejecting invalid counts', async () => {
      // Create initial 2 dummy quotes
      await MindsetQuote.create({ userId: testUserId, text: 'Old quote 1', sortOrder: 0 });
      await MindsetQuote.create({ userId: testUserId, text: 'Old quote 2', sortOrder: 1 });

      // Attempting replace with only 3 quotes -> 400 error
      const badReplaceRes = await request(app)
        .put('/api/gate/quotes/replace')
        .set(authHeaders)
        .send({
          quotes: [
            { text: 'Quote A' },
            { text: 'Quote B' },
            { text: 'Quote C' }
          ]
        });

      expect(badReplaceRes.status).toBe(400);
      expect(badReplaceRes.body.message || badReplaceRes.body.error).toMatch(/5 quotes must be provided/i);

      // Replacing with valid 5 quotes
      const validQuotes = [
        { text: 'Artisanal perfection on every loom in Bhadohi', author: 'Craft', language: 'en-IN' },
        { text: 'Every interior design project deserves bespoke care', author: 'Service', language: 'en-IN' },
        { text: 'Follow up consistently on Day 1, Day 4, and Day 7', author: 'Sales', language: 'en-IN' },
        { text: 'Deliver unmatched value to trade partners across the UAE', author: 'Trade', language: 'en-IN' },
        { text: 'Integrity and craft form the foundation of Knotiq Rugs', author: 'Vision', language: 'en-IN' }
      ];

      const replaceRes = await request(app)
        .put('/api/gate/quotes/replace')
        .set(authHeaders)
        .send({ quotes: validQuotes });

      expect(replaceRes.status).toBe(200);
      expect(replaceRes.body.quotes).toHaveLength(5);
      expect(replaceRes.body.quotes[0].text).toBe(validQuotes[0].text);
      expect(replaceRes.body.quotes[4].text).toBe(validQuotes[4].text);

      // Verify old quotes were deactivated/replaced
      const activeInDb = await MindsetQuote.findAll({ where: { userId: testUserId, isActive: true } });
      expect(activeInDb).toHaveLength(5);
    });
  });

  describe('4. Gate Enforcement Modes (off, every_session, once_daily)', () => {
    beforeEach(async () => {
      // Seed 5 quotes for testUserId
      for (let i = 1; i <= 5; i++) {
        await MindsetQuote.create({
          userId: testUserId,
          text: `Daily founder principle ${i} for excellence`,
          sortOrder: i - 1,
          isActive: true
        });
      }
    });

    it('handles every_session mode by requiring gate on each check', async () => {
      await UserSettings.create({
        userId: testUserId,
        gateMode: 'every_session'
      });

      const res = await request(app)
        .get('/api/gate/status')
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.required).toBe(true);
      expect(res.body.mode).toBe('every_session');
    });

    it('handles off mode by bypassing gate requirement', async () => {
      await UserSettings.create({
        userId: testUserId,
        gateMode: 'off'
      });

      const res = await request(app)
        .get('/api/gate/status')
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.required).toBe(false);
      expect(res.body.mode).toBe('off');
    });

    it('handles once_daily mode: requires gate until completed today, then unlocks', async () => {
      await UserSettings.create({
        userId: testUserId,
        gateMode: 'once_daily',
        timezone: 'Asia/Dubai',
        gateResetHour: 0
      });

      // 1. Before completion -> required: true
      const beforeRes = await request(app)
        .get('/api/gate/status')
        .set(authHeaders);

      expect(beforeRes.status).toBe(200);
      expect(beforeRes.body.required).toBe(true);

      const effectiveDate = beforeRes.body.effectiveDate;

      // 2. Complete gate for today
      await MindsetGateLog.create({
        userId: testUserId,
        gateDate: effectiveDate,
        method: 'voice',
        startedAt: new Date(),
        completedAt: new Date()
      });

      // 3. After completion -> required: false, alreadyCompletedToday: true
      const afterRes = await request(app)
        .get('/api/gate/status')
        .set(authHeaders);

      expect(afterRes.status).toBe(200);
      expect(afterRes.body.required).toBe(false);
      expect(afterRes.body.alreadyCompletedToday).toBe(true);
    });
  });

  describe('5. In-Progress Log Creation & Idempotent Reuse (Amendment 3)', () => {
    it('creates in-progress log and reuses existing in-progress log idempotently on /gate/start', async () => {
      // 1. First call to start gate
      const start1 = await request(app)
        .post('/api/gate/start')
        .set(authHeaders);

      expect(start1.status).toBe(200);
      expect(start1.body.log).toBeDefined();
      expect(start1.body.log.completedAt).toBeNull();
      const firstLogId = start1.body.log.id;

      // 2. Second call to start gate on the same session/day
      const start2 = await request(app)
        .post('/api/gate/start')
        .set(authHeaders);

      expect(start2.status).toBe(200);
      // MUST return the exact same in-progress log ID
      expect(start2.body.log.id).toBe(firstLogId);

      // Verify database only contains 1 log row
      const logsInDb = await MindsetGateLog.findAll({ where: { userId: testUserId } });
      expect(logsInDb).toHaveLength(1);
    });
  });

  describe('6. Gate Log Completion & Method Recording (Amendment 3 & 6)', () => {
    it('verifies ownership, validates completion payload, and prevents double-complete', async () => {
      // 1. Create in-progress log for founder
      const startRes = await request(app)
        .post('/api/gate/start')
        .set(authHeaders);
      const logId = startRes.body.log.id;

      // 2. Intruder tries to complete founder\'s log -> 404
      const intruderRes = await request(app)
        .post('/api/gate/complete')
        .set(intruderAuthHeaders)
        .send({
          logId,
          method: 'voice',
          attemptsTotal: 5,
          quotesCompleted: 5
        });

      expect(intruderRes.status).toBe(404);

      // 3. Founder completes with mixed method (3 voice, 2 typed)
      const completeRes = await request(app)
        .post('/api/gate/complete')
        .set(authHeaders)
        .send({
          logId,
          method: 'mixed',
          attemptsTotal: 7,
          quotesCompleted: 5,
          quotesTyped: 2
        });

      expect(completeRes.status).toBe(200);
      expect(completeRes.body.log.method).toBe('mixed');
      expect(completeRes.body.log.quotesTyped).toBe(2);
      expect(completeRes.body.log.completedAt).not.toBeNull();

      // 4. Attempting to complete the same log again MUST return 400
      const repeatRes = await request(app)
        .post('/api/gate/complete')
        .set(authHeaders)
        .send({
          logId,
          method: 'voice',
          quotesCompleted: 5
        });

      expect(repeatRes.status).toBe(400);
      expect(repeatRes.body.message || repeatRes.body.error).toMatch(/already.*completed/i);
    });
  });

  describe('7. Next-Day Strictness Relaxation Protection (Amendment 12)', () => {
    it('postpones gateMode relaxation or threshold reduction to the next local day', async () => {
      await UserSettings.create({
        userId: testUserId,
        gateMode: 'every_session',
        gateMatchThreshold: 0.8,
        timezone: 'Asia/Dubai',
        gateStrictnessEffectiveNextDay: true
      });

      // 1. Founder tries to turn off the gate today
      const relaxRes = await request(app)
        .patch('/api/gate/settings')
        .set(authHeaders)
        .send({ gateMode: 'off' });

      expect(relaxRes.status).toBe(200);
      // Active mode must REMAIN every_session for today
      expect(relaxRes.body.settings.gateMode).toBe('every_session');
      // Relaxation is queued for tomorrow
      expect(relaxRes.body.settings.pendingGateMode).toBe('off');
      expect(relaxRes.body.settings.pendingEffectiveDate).toBeDefined();

      // 2. Founder tries to lower match threshold to 0.7
      const thresholdRes = await request(app)
        .patch('/api/gate/settings')
        .set(authHeaders)
        .send({ gateMatchThreshold: 0.7 });

      expect(thresholdRes.status).toBe(200);
      expect(thresholdRes.body.settings.gateMatchThreshold).toBe(0.8);
      expect(thresholdRes.body.settings.pendingGateMatchThreshold).toBe(0.7);

      // 3. Stricter settings (e.g. raising threshold to 0.9) apply IMMEDIATELY
      const strictRes = await request(app)
        .patch('/api/gate/settings')
        .set(authHeaders)
        .send({ gateMatchThreshold: 0.9 });

      expect(strictRes.status).toBe(200);
      expect(strictRes.body.settings.gateMatchThreshold).toBe(0.9);
      expect(strictRes.body.settings.pendingGateMatchThreshold).toBeNull();
    });

    it('reconciles pending settings once effective date arrives', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);

      const settings = await UserSettings.create({
        userId: testUserId,
        gateMode: 'every_session',
        gateMatchThreshold: 0.8,
        pendingGateMode: 'off',
        pendingGateMatchThreshold: 0.7,
        pendingEffectiveDate: yesterdayStr // Arrived yesterday
      });

      const reconciled = await gateService.reconcilePendingSettings(settings);
      expect(reconciled.gateMode).toBe('off');
      expect(reconciled.gateMatchThreshold).toBe(0.7);
      expect(reconciled.pendingGateMode).toBeNull();
      expect(reconciled.pendingEffectiveDate).toBeNull();
    });
  });

  describe('8. Mindset Streak Calculation Across Day Boundaries (Amendment 10)', () => {
    it('calculates consecutive day streak correctly and maintains streak if today is pending', async () => {
      const today = new Date();
      const todayStr = gateService.getEffectiveDate(today, 'Asia/Dubai', 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = gateService.getEffectiveDate(yesterday, 'Asia/Dubai', 0);

      const dayBefore = new Date(today);
      dayBefore.setDate(dayBefore.getDate() - 2);
      const dayBeforeStr = gateService.getEffectiveDate(dayBefore, 'Asia/Dubai', 0);

      // Seed 2 completed days in the past (yesterday and dayBefore)
      await MindsetGateLog.create({
        userId: testUserId,
        gateDate: dayBeforeStr,
        method: 'voice',
        startedAt: new Date(dayBefore),
        completedAt: new Date(dayBefore)
      });

      await MindsetGateLog.create({
        userId: testUserId,
        gateDate: yesterdayStr,
        method: 'voice',
        startedAt: new Date(yesterday),
        completedAt: new Date(yesterday)
      });

      // Case A: Today not yet completed -> streak should be 2 (counting up to yesterday)
      const streakResBefore = await gateService.calculateGateStreak(testUserId);
      expect(streakResBefore.gateStreak).toBe(2);
      expect(streakResBefore.isCompletedToday).toBe(false);

      // Case B: Today completed -> streak increments to 3
      await MindsetGateLog.create({
        userId: testUserId,
        gateDate: todayStr,
        method: 'voice',
        startedAt: new Date(),
        completedAt: new Date()
      });

      const streakResAfter = await gateService.calculateGateStreak(testUserId);
      expect(streakResAfter.gateStreak).toBe(3);
      expect(streakResAfter.isCompletedToday).toBe(true);
    });
  });

  describe('9. Planner & Today Command Center Integration', () => {
    it('embeds mindset streak in planner calculateStreaks and Today summary payload', async () => {
      const todayStr = gateService.getEffectiveDate(new Date(), 'Asia/Dubai', 0);

      // Complete gate for today
      await MindsetGateLog.create({
        userId: testUserId,
        gateDate: todayStr,
        method: 'voice',
        startedAt: new Date(),
        completedAt: new Date()
      });

      // 1. Test plannerService.calculateStreaks
      const streaks = await plannerService.calculateStreaks(testUserId);
      expect(streaks.gateStreak).toBe(1);
      expect(streaks.isGateCompletedToday).toBe(true);

      // 2. Test plannerService.getEveningSummary
      const eveningSummary = await plannerService.getEveningSummary(testUserId, todayStr);
      expect(eveningSummary.metrics.gateCompleted).toBe(true);
      expect(eveningSummary.metrics.gateMethod).toBe('voice');

      // 3. Test GET /api/today/summary endpoint
      const todayRes = await request(app)
        .get('/api/today/summary')
        .set(authHeaders);

      expect(todayRes.status).toBe(200);
      expect(todayRes.body.streaks).toBeDefined();
      expect(todayRes.body.streaks.gateStreak).toBe(1);
      expect(todayRes.body.streaks.isGateCompletedToday).toBe(true);
    });
  });
});
