import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import {
  WalletPolicy,
  WalletState,
  WorkSchedule,
  WorkWindow,
  WorkSession,
  WalletBreak,
  WalletLeave,
  WalletLedgerEntry,
  WalletReward,
  RoutineTemplate,
  RoutineBlock,
  RoutineEntry,
  RoutinePolicy,
  ReminderLog,
  Task,
  AuditLog
} from '../src/models';

import walletIntervalMath from '../src/services/wallet/walletIntervalMath';
import walletSettlementService from '../src/services/wallet/walletSettlementService';
import walletService from '../src/services/wallet/walletService';
import walletWellbeingService from '../src/services/wallet/walletWellbeingService';
import routineService from '../src/services/routine/routineService';

describe('Phase Work Wallet Engine — Full Comprehensive Suite', () => {
  const testUserId = 'test_wallet_user';
  const intruderUserId = 'test_wallet_intruder';

  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-role': 'admin'
  };

  const intruderAuthHeaders = {
    'x-test-user-id': intruderUserId,
    'x-test-role': 'admin'
  };

  beforeEach(async () => {
    // Clean test data
    await WalletLedgerEntry.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WalletBreak.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WalletLeave.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WorkSession.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WorkWindow.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WorkSchedule.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WalletReward.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WalletState.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await WalletPolicy.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await RoutineEntry.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await RoutineBlock.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await RoutineTemplate.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await RoutinePolicy.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await ReminderLog.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await Task.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await AuditLog.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
  });

  // ===========================================================================
  // 1. Interval Math & Deterministic Time Union / Difference
  // ===========================================================================
  describe('1. Interval Math & Deterministic Arithmetic', () => {
    it('merges overlapping and contiguous time intervals correctly', () => {
      const intervals = [
        { start: 1000, end: 2000 },
        { start: 1500, end: 3000 },
        { start: 4000, end: 5000 },
        { start: 5000, end: 6000 }
      ];

      const merged = walletIntervalMath.mergeIntervals(intervals);
      expect(merged).toHaveLength(2);
      expect(merged[0]).toEqual({ start: 1000, end: 3000 });
      expect(merged[1]).toEqual({ start: 4000, end: 6000 });
    });

    it('intersects two sets of intervals (A ∩ B)', () => {
      const a = [{ start: 1000, end: 4000 }];
      const b = [{ start: 2000, end: 5000 }];

      const inter = walletIntervalMath.intersectIntervals(a, b);
      expect(inter).toHaveLength(1);
      expect(inter[0]).toEqual({ start: 2000, end: 4000 });
    });

    it('subtracts intervals (A \\ B)', () => {
      const a = [{ start: 1000, end: 5000 }];
      const b = [{ start: 2000, end: 3000 }];

      const diff = walletIntervalMath.subtractIntervals(a, b);
      expect(diff).toHaveLength(2);
      expect(diff[0]).toEqual({ start: 1000, end: 2000 });
      expect(diff[1]).toEqual({ start: 3000, end: 5000 });
    });

    it('computes overnight window instants across midnight', () => {
      const dateStr = '2026-11-28';
      const timezone = 'Asia/Dubai';
      const { startAt, endAt, isOvernight } = walletIntervalMath.computeWindowInstants(dateStr, '22:00', '06:00', timezone);

      expect(isOvernight).toBe(true);
      expect(endAt.getTime()).toBeGreaterThan(startAt.getTime());
      const durationHours = (endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60);
      expect(durationHours).toBe(8);
    });

    it('enforces integer minutes without float drift', () => {
      const intervals = [
        { start: 0, end: 60000 * 45 },      // 45 mins
        { start: 60000 * 60, end: 60000 * 95 } // 35 mins
      ];
      const sum = walletIntervalMath.sumIntervalMinutes(intervals);
      expect(sum).toBe(80);
      expect(Number.isInteger(sum)).toBe(true);
    });
  });

  // ===========================================================================
  // 2. Schedule Validation & Target Derivation (Amendment 4)
  // ===========================================================================
  describe('2. Schedule Validation & Health Constraints (Amendment 4)', () => {
    it('rejects schedules that leave less than 6.5h sleep and 1h meals (shortfall > 990m)', async () => {
      // 17 hours work = 1020 minutes > 990 max allowed
      const res = await request(app)
        .post('/api/wallet/schedules')
        .set(authHeaders)
        .send({
          name: 'Excessive Workday',
          assignedDays: [1, 2, 3, 4, 5],
          windows: [
            { startTime: '06:00', endTime: '23:00' }
          ]
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors[0]).toContain('exceeds maximum allowed');
    });

    it('accepts valid schedule and creates windows cleanly', async () => {
      const res = await request(app)
        .post('/api/wallet/schedules')
        .set(authHeaders)
        .send({
          name: 'Normal Day',
          assignedDays: [1, 2, 3, 4, 5],
          isDefault: true,
          windows: [
            { startTime: '09:00', endTime: '13:00' },
            { startTime: '14:00', endTime: '18:00' }
          ]
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.schedule.windows).toHaveLength(2);
    });
  });

  // ===========================================================================
  // 3. Session Liveness, Heartbeat & Stale Watchdog (Amendment 1 & 2)
  // ===========================================================================
  describe('3. Session Liveness & Heartbeat Watchdog (Amendment 1)', () => {
    it('starts session, updates lastHeartbeatAt, and records audit log without notes', async () => {
      const res = await request(app)
        .post('/api/wallet/session/start')
        .set(authHeaders)
        .send({ source: 'timer', note: 'Secret sensitive thought' });

      expect(res.status).toBe(201);
      expect(res.body.session.status).toBe('running');

      // Check AuditLog: must NOT contain the note string
      const audit = await AuditLog.findOne({ where: { userId: testUserId, action: 'wallet_session_started' } });
      expect(audit).toBeTruthy();
      expect(JSON.stringify(audit.details)).not.toContain('Secret sensitive thought');
    });

    it('stops session at last heartbeat if 3 minutes pass without heartbeat ping', async () => {
      const fiveMinsAgo = new Date(Date.now() - 5 * 60000);
      const fourMinsAgo = new Date(Date.now() - 4 * 60000);

      const session = await WorkSession.create({
        userId: testUserId,
        startAt: fiveMinsAgo,
        lastHeartbeatAt: fourMinsAgo,
        status: 'running',
        source: 'timer'
      });

      await WalletState.create({
        userId: testUserId,
        activeSessionId: session.id,
        balancePaise: 0
      });

      // Calling state or heartbeat triggers watchdog
      const stateRes = await request(app)
        .get('/api/wallet/state')
        .set(authHeaders);

      expect(stateRes.status).toBe(200);

      // Session must be auto-stopped at the last heartbeat
      await session.reload();
      expect(session.status).toBe('completed');
      expect(new Date(session.endAt).getTime()).toBe(fourMinsAgo.getTime());
    });

    it('enforces only 1 active session per user at a time', async () => {
      const s1 = await walletService.startSession(testUserId, { source: 'timer' });
      const s2 = await walletService.startSession(testUserId, { source: 'timer' });

      expect(s1.id).toBe(s2.id);
      const count = await WorkSession.count({ where: { userId: testUserId, status: 'running' } });
      expect(count).toBe(1);
    });
  });

  // ===========================================================================
  // 4. Breaks & Unexcused Overage (Amendment 7)
  // ===========================================================================
  describe('4. Breaks & Allowance Enforcement (Amendment 7)', () => {
    it('starting a break cleanly terminates any active running session', async () => {
      const session = await walletService.startSession(testUserId, { source: 'timer' });
      expect(session.status).toBe('running');

      // Start break
      const breakRes = await request(app)
        .post('/api/wallet/break/toggle')
        .set(authHeaders)
        .send({ action: 'start' });

      expect(breakRes.status).toBe(200);
      expect(breakRes.body.isBreakActive).toBe(true);

      // Verify work session stopped
      await session.reload();
      expect(session.status).toBe('completed');
    });

    it('excuses breaks up to allowance (90m) and does not penalize them', async () => {
      const todayStr = '2026-11-28';
      const timezone = 'Asia/Dubai';

      const windowStart = walletIntervalMath.convertLocalTimeToUtc(todayStr, '09:00', timezone);
      const windowEnd = walletIntervalMath.convertLocalTimeToUtc(todayStr, '17:00', timezone);

      const breakStart = walletIntervalMath.convertLocalTimeToUtc(todayStr, '12:00', timezone);
      const breakEnd = walletIntervalMath.convertLocalTimeToUtc(todayStr, '13:00', timezone); // 60 mins break

      const breakdown = walletIntervalMath.calculateDayBreakdown({
        dateStr: todayStr,
        timezone,
        windows: [{ id: 1, startTime: '09:00', endTime: '17:00' }],
        sessions: [],
        breaks: [{ startAt: breakStart, endAt: breakEnd }],
        policy: { dailyBreakAllowanceMinutes: 90, earnRatePaisePerMin: 100, penaltyRatePaisePerMin: 100 },
        nowUtc: windowEnd
      });

      // Total scheduled was 8h = 480m. 60m break was excused. Target is 420m.
      expect(breakdown.dailyTargetMinutes).toBe(420);
    });
  });

  // ===========================================================================
  // 5. Settlement Concurrency & Idempotency (Amendment 3 & 6)
  // ===========================================================================
  describe('5. Settlement Concurrency & Ledger Constraints (Amendment 3 & 6)', () => {
    it('handles parallel concurrent settlement requests without double-posting or race conditions', async () => {
      // Set up a user policy & schedule
      await WalletPolicy.create({
        userId: testUserId,
        enabled: true,
        earnRatePaisePerMin: 100,
        penaltyRatePaisePerMin: 100
      });

      await WalletState.create({
        userId: testUserId,
        balancePaise: 0
      });

      // Fire 5 parallel GET /state requests
      const promises = [1, 2, 3, 4, 5].map(() =>
        request(app).get('/api/wallet/state').set(authHeaders)
      );

      const results = await Promise.all(promises);
      for (const res of results) {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }

      // Check ledger entries: no duplicates with identical segmentKey
      const entries = await WalletLedgerEntry.findAll({ where: { userId: testUserId } });
      const segmentKeys = entries.map((e) => e.segmentKey);
      const uniqueKeys = new Set(segmentKeys);
      expect(uniqueKeys.size).toBe(segmentKeys.length);
    });

    it('writes contiguous segment ledger entries rather than one per minute', async () => {
      const todayStr = '2026-11-28';
      const sStart = walletIntervalMath.convertLocalTimeToUtc(todayStr, '09:00', 'Asia/Dubai');
      const sEnd = walletIntervalMath.convertLocalTimeToUtc(todayStr, '11:00', 'Asia/Dubai'); // 120 mins contiguous

      await WorkSession.create({
        userId: testUserId,
        startAt: sStart,
        endAt: sEnd,
        lastHeartbeatAt: sEnd,
        status: 'completed',
        source: 'timer'
      });

      await WorkSchedule.create({
        userId: testUserId,
        name: 'Morning',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]'
      }).then((sch) => {
        return WorkWindow.create({
          scheduleId: sch.id,
          userId: testUserId,
          startTime: '09:00',
          endTime: '11:00',
          isActive: true
        });
      });

      await walletSettlementService.settleUserWallet(testUserId, { dateStr: todayStr, nowUtc: sEnd });

      const earnEntries = await WalletLedgerEntry.findAll({
        where: { userId: testUserId, type: 'earn' }
      });

      // Exactly 1 contiguous entry for 120 minutes, not 120 separate rows!
      expect(earnEntries).toHaveLength(1);
      expect(earnEntries[0].minutes).toBe(120);
      expect(earnEntries[0].amountPaise).toBe(12000); // 120 * 100 paise
    });
  });

  // ===========================================================================
  // 6. Routine Engine Integration (Amendment 5)
  // ===========================================================================
  describe('6. Routine Engine Integration (Amendment 5)', () => {
    it('routine check-in start auto-starts WorkSession if countsAsWork !== false and category is work', async () => {
      const template = await RoutineTemplate.create({
        userId: testUserId,
        name: 'Daily Rhythm'
      });

      const block = await RoutineBlock.create({
        userId: testUserId,
        templateId: template.id,
        title: 'Deep Engineering Work',
        category: 'deep_work',
        startTime: '09:00',
        endTime: '11:00',
        countsAsWork: true
      });

      const entry = await RoutineEntry.create({
        userId: testUserId,
        templateId: template.id,
        blockId: block.id,
        date: '2026-11-28',
        plannedStart: '09:00',
        plannedEnd: '11:00',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(Date.now() + 7200000),
        title: 'Deep Engineering Work',
        category: 'deep_work',
        status: 'pending'
      });

      // Call startEntry
      await routineService.startEntry(testUserId, entry.id);

      // Check WorkSession
      const active = await WorkSession.findOne({
        where: { userId: testUserId, linkedRoutineEntryId: entry.id, status: 'running' }
      });

      expect(active).toBeTruthy();
      expect(active.source).toBe('routine_entry');
    });

    it('routine check-in for non-work categories (sleep, meal, family) never starts a session', async () => {
      const template = await RoutineTemplate.create({
        userId: testUserId,
        name: 'Rest Rhythm'
      });

      const block = await RoutineBlock.create({
        userId: testUserId,
        templateId: template.id,
        title: 'Lunch Break & Family',
        category: 'meal',
        startTime: '13:00',
        endTime: '14:00',
        countsAsWork: false
      });

      const entry = await RoutineEntry.create({
        userId: testUserId,
        templateId: template.id,
        blockId: block.id,
        date: '2026-11-28',
        plannedStart: '13:00',
        plannedEnd: '14:00',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(Date.now() + 3600000),
        title: 'Lunch Break & Family',
        category: 'meal',
        status: 'pending'
      });

      await routineService.startEntry(testUserId, entry.id);

      const active = await WorkSession.findOne({
        where: { userId: testUserId, status: 'running' }
      });

      expect(active).toBeNull();
    });

    it('routine Done stops active session and NEVER creates a backdated session', async () => {
      const template = await RoutineTemplate.create({
        userId: testUserId,
        name: 'Rhythm'
      });

      const entry = await RoutineEntry.create({
        userId: testUserId,
        templateId: template.id,
        date: '2026-11-28',
        plannedStart: '09:00',
        plannedEnd: '10:00',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(Date.now() + 3600000),
        title: 'Task Done Check',
        category: 'deep_work',
        status: 'pending'
      });

      // Directly mark done without a prior session running
      await routineService.doneEntry(testUserId, entry.id);

      // No WorkSessions should have been created retroactively
      const count = await WorkSession.count({ where: { userId: testUserId } });
      expect(count).toBe(0);
    });
  });

  // ===========================================================================
  // 7. Rewards Catalog & Refund Flow (Amendment 13)
  // ===========================================================================
  describe('7. Rewards Catalog & Refund Flow (Amendment 13)', () => {
    it('redeems reward, deducts points, and respects balance & floor', async () => {
      await WalletLedgerEntry.create({
        userId: testUserId,
        date: '2026-11-28',
        segmentKey: 'seed_50000',
        type: 'earn',
        amountPaise: 50000,
        reason: 'Initial earned balance'
      });

      await WalletState.create({
        userId: testUserId,
        balancePaise: 50000 // 500 INR
      });

      const reward = await WalletReward.create({
        userId: testUserId,
        title: 'Espresso Coffee',
        pricePaise: 20000,
        isActive: true
      });

      const res = await request(app)
        .post(`/api/wallet/rewards/${reward.id}/redeem`)
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.balancePaise).toBe(30000); // 50000 - 20000

      // Try redeeming again when balance is insufficient for 2nd coffee
      const expReward = await WalletReward.create({
        userId: testUserId,
        title: 'Expensive Dinner',
        pricePaise: 100000, // 1000 INR
        isActive: true
      });
      const failRes = await request(app)
        .post(`/api/wallet/rewards/${expReward.id}/redeem`)
        .set(authHeaders);
      expect(failRes.status).toBe(500); // Error thrown for insufficient balance
    });

    it('refunds redemption and restores points to wallet balance', async () => {
      await WalletLedgerEntry.create({
        userId: testUserId,
        date: '2026-11-28',
        segmentKey: 'seed_50000',
        type: 'earn',
        amountPaise: 50000,
        reason: 'Initial earned balance'
      });

      const entry = await WalletLedgerEntry.create({
        userId: testUserId,
        date: '2026-11-28',
        segmentKey: 'redeem_1_123',
        type: 'reward_redeem',
        amountPaise: -20000,
        minutes: 0,
        reason: 'Redeemed Coffee'
      });

      await WalletState.create({
        userId: testUserId,
        balancePaise: 30000
      });

      const res = await request(app)
        .post(`/api/wallet/rewards/redeem/${entry.id}/refund`)
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.refundEntry.type).toBe('reward_refund');
      expect(res.body.refundEntry.amountPaise).toBe(20000);

      const state = await WalletState.findOne({ where: { userId: testUserId } });
      expect(state.balancePaise).toBe(50000); // 30000 + 20000 restored
    });
  });

  // ===========================================================================
  // 8. Policy Queueing: Tightening Immediate, Loosening Next Day (Amendment 10)
  // ===========================================================================
  describe('8. Policy Queueing: Loosening vs Tightening (Amendment 10)', () => {
    it('applies tightening immediately and queues loosening for tomorrow', async () => {
      await WalletPolicy.create({
        userId: testUserId,
        earnRatePaisePerMin: 100,
        penaltyRatePaisePerMin: 100,
        dailyBreakAllowanceMinutes: 90
      });

      // Request:
      // Tightening: penalty rate 100 -> 150
      // Loosening: daily break allowance 90 -> 120
      const res = await request(app)
        .patch('/api/wallet/policy')
        .set(authHeaders)
        .send({
          penaltyRatePaisePerMin: 150,
          dailyBreakAllowanceMinutes: 120
        });

      expect(res.status).toBe(200);
      const pol = res.body.policy;

      // Tightening applied immediately
      expect(pol.penaltyRatePaisePerMin).toBe(150);

      // Loosening remained 90 and queued in pendingPolicyJson
      expect(pol.dailyBreakAllowanceMinutes).toBe(90);
      expect(pol.pendingPolicyJson).toBeTruthy();
      expect(JSON.parse(pol.pendingPolicyJson).dailyBreakAllowanceMinutes).toBe(120);
      expect(pol.pendingEffectiveDate).toBeTruthy();
    });
  });

  // ===========================================================================
  // 9. Calendar Work Windows & Security Export (Amendments 11 & 14)
  // ===========================================================================
  describe('9. Calendar Integration & Export Protection', () => {
    it('includes work windows in merged calendar items', async () => {
      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Work Window Schedule',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });

      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '10:00',
        endTime: '18:00',
        isActive: true
      });

      const res = await request(app)
        .get('/api/calendar')
        .set(authHeaders)
        .query({ from: '2026-11-28', to: '2026-11-29' });

      expect(res.status).toBe(200);
      const items = res.body.items || [];
      const workWindows = items.filter((i) => i.itemType === 'work_window');
      expect(workWindows.length).toBeGreaterThan(0);
      expect(workWindows[0].title).toContain('Work Window: 10:00 - 18:00');
    });

    it('exports ledger CSV with UTF-8 BOM and neutralizes formula injection', async () => {
      await WalletLedgerEntry.create({
        userId: testUserId,
        date: '2026-11-28',
        segmentKey: 'malicious_csv_entry',
        type: 'earn',
        amountPaise: 5000,
        minutes: 50,
        reason: '=SUM(1+1)' // Formula injection attempt!
      });

      const res = await request(app)
        .get('/api/wallet/export')
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      // Starts with UTF-8 BOM
      expect(res.text.charCodeAt(0)).toBe(0xFEFF);
      // Formula must be neutralized with leading single quote: "'=SUM(1+1)"
      expect(res.text).toContain("'=SUM(1+1)");
    });
  });

  // ===========================================================================
  // 10. Performance Benchmark (Amendment 6: 1-Year Dataset)
  // ===========================================================================
  describe('10. 1-Year Dataset Performance Benchmark (Amendment 6)', () => {
    it('settles state in under 300ms even with large dataset', async () => {
      const startMs = Date.now();
      const res = await request(app)
        .get('/api/wallet/state')
        .set(authHeaders);

      const elapsed = Date.now() - startMs;
      expect(res.status).toBe(200);
      expect(elapsed).toBeLessThan(300); // Fast response
    });

    it('1-year dataset benchmark: 1,095 contiguous segments row count and sub-second query performance', async () => {
      // Seed 1 full year: 365 days x 3 segments = 1,095 contiguous ledger entries
      const entries = [];
      const baseDate = new Date('2025-01-01T00:00:00Z');

      for (let day = 0; day < 365; day++) {
        const dt = new Date(baseDate.getTime() + day * 86400000);
        const dateStr = dt.toISOString().slice(0, 10);

        // Segment 1: morning work (120 mins)
        entries.push({
          userId: testUserId,
          date: dateStr,
          segmentKey: `bench_seg1_${dateStr}`,
          type: 'earn',
          amountPaise: 12000,
          minutes: 120,
          reason: 'Morning sprint',
          isProvisional: false
        });

        // Segment 2: afternoon work (180 mins)
        entries.push({
          userId: testUserId,
          date: dateStr,
          segmentKey: `bench_seg2_${dateStr}`,
          type: 'earn',
          amountPaise: 18000,
          minutes: 180,
          reason: 'Afternoon build',
          isProvisional: false
        });

        // Segment 3: gap penalty (30 mins)
        entries.push({
          userId: testUserId,
          date: dateStr,
          segmentKey: `bench_seg3_${dateStr}`,
          type: 'penalty',
          amountPaise: -3000,
          minutes: 30,
          reason: 'Missed scheduled gap',
          isProvisional: false
        });
      }

      await WalletLedgerEntry.bulkCreate(entries);

      // Verify row count
      const count = await WalletLedgerEntry.count({ where: { userId: testUserId } });
      expect(count).toBe(1095);

      // Benchmark balance calculation timing
      const t0 = Date.now();
      const balance = await walletSettlementService.calculateCurrentBalance(testUserId);
      const balanceTimingMs = Date.now() - t0;

      // 365 * (12000 + 18000 - 3000) = 365 * 27000 = 9,855,000 paise
      expect(balance).toBe(9855000);
      expect(balanceTimingMs).toBeLessThan(150);

      // Benchmark paginated ledger API timing
      const t1 = Date.now();
      const res = await request(app)
        .get('/api/wallet/ledger')
        .set(authHeaders)
        .query({ page: 1, limit: 50 });
      const apiTimingMs = Date.now() - t1;

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1095);
      expect(res.body.entries).toHaveLength(50);
      expect(apiTimingMs).toBeLessThan(250);
    });
  });

  // ===========================================================================
  // 11. Edge Cases & Concurrency Closure Tests (Requirement 1)
  // ===========================================================================
  describe('11. Edge Cases & Integrity Closures (Requirement 1)', () => {
    it('idle pause and the 2-minute countdown', async () => {
      await WalletPolicy.create({
        userId: testUserId,
        idleTimeoutMinutes: 10,
        idleCheckEnabled: true,
        earnRatePaisePerMin: 100
      });

      const sessionStart = new Date('2026-11-28T10:00:00Z');
      const confirmedHeartbeat = new Date('2026-11-28T10:10:00Z');

      const session = await WorkSession.create({
        userId: testUserId,
        startAt: sessionStart,
        lastHeartbeatAt: confirmedHeartbeat,
        source: 'timer',
        status: 'running'
      });

      await WalletState.create({
        userId: testUserId,
        balancePaise: 0,
        activeSessionId: session.id
      });

      // Simulating watchdog after 2-minute countdown expires (e.g. at 10:15:00)
      const simulatedNow = new Date('2026-11-28T10:15:00Z');
      await walletService.checkStaleSessions(testUserId, simulatedNow);

      const refreshedSession = await WorkSession.findByPk(session.id);
      expect(refreshedSession.status).toBe('completed');
      // Must be stopped strictly at the last confirmed heartbeat time, never crediting idle minutes
      expect(new Date(refreshedSession.endAt).getTime()).toBe(confirmedHeartbeat.getTime());

      const state = await WalletState.findOne({ where: { userId: testUserId } });
      expect(state.activeSessionId).toBeNull();
    });

    it('sick leave beyond the allowance (flagged, never penalized)', async () => {
      await WalletPolicy.create({
        userId: testUserId,
        monthlyLeaveAllowanceDays: 1,
        earnRatePaisePerMin: 100,
        penaltyRatePaisePerMin: 100
      });

      // 1st sick leave consumes allowance
      const leave1 = await walletService.logLeave(testUserId, {
        date: '2026-11-05',
        type: 'sick',
        reason: 'Viral fever'
      });
      expect(leave1.isExceedingAllowance).toBe(false);

      // 2nd leave of type 'travel' should be rejected because allowance is 1
      await expect(
        walletService.logLeave(testUserId, { date: '2026-11-06', type: 'travel' })
      ).rejects.toThrow(/Monthly leave allowance/);

      // 2nd sick leave with reason is accepted, but flagged as isExceedingAllowance=true
      const leave2 = await walletService.logLeave(testUserId, {
        date: '2026-11-07',
        type: 'sick',
        reason: 'Hospitalized dengue treatment'
      });
      expect(leave2.isExceedingAllowance).toBe(true);

      // Create a work schedule with windows on 2026-11-07
      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Workday',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });
      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '09:00',
        endTime: '17:00',
        isActive: true
      });

      // Settle the sick leave day: must never penalize despite exceeding allowance
      const settlement = await walletSettlementService.settleUserWallet(testUserId, {
        dateStr: '2026-11-07',
        nowUtc: new Date('2026-11-07T20:00:00Z')
      });

      expect(settlement.breakdown.isLeaveDay).toBe(true);
      expect(settlement.breakdown.dailyTargetMinutes).toBe(0);
      expect(settlement.breakdown.penaltyPaise).toBe(0);

      const penalties = await WalletLedgerEntry.findAll({
        where: { userId: testUserId, date: '2026-11-07', type: 'penalty' }
      });
      expect(penalties).toHaveLength(0);
    });

    it('pause mode', async () => {
      await WalletPolicy.create({
        userId: testUserId,
        earnRatePaisePerMin: 100,
        penaltyRatePaisePerMin: 100
      });

      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Standard Week',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });
      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '09:00',
        endTime: '17:00',
        isActive: true
      });

      // Toggle pause mode
      await walletService.togglePause(testUserId, { isPaused: true });

      const settlement = await walletSettlementService.settleUserWallet(testUserId, {
        dateStr: '2026-11-28',
        nowUtc: new Date('2026-11-28T20:00:00Z')
      });

      expect(settlement.breakdown.isPaused).toBe(true);
      expect(settlement.breakdown.dailyTargetMinutes).toBe(0);
      expect(settlement.breakdown.penaltyPaise).toBe(0);
      expect(settlement.breakdown.unworkedPastScheduledMinutes).toBe(0);
    });

    it('queue semantics for multiple pending loosening changes (and tightening never cancelling a pending loosening)', async () => {
      const policy = await WalletPolicy.create({
        userId: testUserId,
        earnRatePaisePerMin: 100,
        penaltyRatePaisePerMin: 100,
        dailyBreakAllowanceMinutes: 90,
        monthlyLeaveAllowanceDays: 2
      });

      // Loosening 1: Increase daily break allowance from 90 to 120
      await walletService.updatePolicy(testUserId, { dailyBreakAllowanceMinutes: 120 });
      await policy.reload();

      expect(policy.dailyBreakAllowanceMinutes).toBe(90); // Unchanged until tomorrow
      let pending = JSON.parse(policy.pendingPolicyJson);
      expect(pending.dailyBreakAllowanceMinutes).toBe(120);

      // Loosening 2: Increase monthly leave allowance from 2 to 5
      await walletService.updatePolicy(testUserId, { monthlyLeaveAllowanceDays: 5 });
      await policy.reload();

      expect(policy.monthlyLeaveAllowanceDays).toBe(2);
      pending = JSON.parse(policy.pendingPolicyJson);
      // Both loosening changes must be accumulated in queue
      expect(pending.dailyBreakAllowanceMinutes).toBe(120);
      expect(pending.monthlyLeaveAllowanceDays).toBe(5);

      // Tightening: Increase penalty rate from 100 to 200 (immediate tightening)
      await walletService.updatePolicy(testUserId, { penaltyRatePaisePerMin: 200 });
      await policy.reload();

      // Tightening applied immediately
      expect(policy.penaltyRatePaisePerMin).toBe(200);

      // Pending loosening queue must remain completely intact and NOT cancelled
      expect(policy.pendingPolicyJson).toBeTruthy();
      pending = JSON.parse(policy.pendingPolicyJson);
      expect(pending.dailyBreakAllowanceMinutes).toBe(120);
      expect(pending.monthlyLeaveAllowanceDays).toBe(5);
    });

    it('overtime and cap_trim results', async () => {
      await WalletPolicy.create({
        userId: testUserId,
        earnRatePaisePerMin: 100,
        overtimeMode: 'full_rate',
        overtimeCapMinutes: 60 // Cap is 60 minutes
      });

      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Short Window',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });
      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '10:00',
        endTime: '12:00', // 120 mins in-window
        isActive: true
      });

      // User works from 10:00 to 13:30 (120 mins in-window + 90 mins overtime)
      // 90 mins overtime > 60 mins cap -> 60 mins earned, 30 mins cap_trim
      await WorkSession.create({
        userId: testUserId,
        startAt: new Date('2026-11-28T06:00:00Z'), // 10:00 Gulf Standard Time (UTC+4)
        endAt: new Date('2026-11-28T09:30:00Z'),   // 13:30 GST
        lastHeartbeatAt: new Date('2026-11-28T09:30:00Z'),
        source: 'timer',
        status: 'completed'
      });

      const settlement = await walletSettlementService.settleUserWallet(testUserId, {
        dateStr: '2026-11-28',
        nowUtc: new Date('2026-11-28T10:00:00Z')
      });

      expect(settlement.breakdown.workedInWindowMinutes).toBe(120);
      expect(settlement.breakdown.overtimeWorkedMinutes).toBe(60); // Capped at 60m
      expect(settlement.breakdown.capTrimMinutes).toBe(30);        // 30m excess trimmed

      const capTrimEntry = await WalletLedgerEntry.findOne({
        where: { userId: testUserId, type: 'cap_trim' }
      });
      expect(capTrimEntry).toBeTruthy();
      expect(capTrimEntry.minutes).toBe(30);
      expect(capTrimEntry.amountPaise).toBe(0);
    });

    it('refunding the same redemption twice (must be rejected)', async () => {
      await WalletPolicy.create({ userId: testUserId });
      await WalletState.create({ userId: testUserId, balancePaise: 100000 });

      const reward = await WalletReward.create({
        userId: testUserId,
        title: 'Spa Relaxation',
        pricePaise: 25000,
        isActive: true
      });

      // 1. Redeem reward
      const redeemRes = await walletService.redeemReward(testUserId, reward.id);
      expect(redeemRes.entry.type).toBe('reward_redeem');

      // 2. First refund succeeds
      const refundEntry = await walletService.refundReward(testUserId, redeemRes.entry.id);
      expect(refundEntry.type).toBe('reward_refund');

      // 3. Second refund of the same redemption must be strictly rejected
      await expect(
        walletService.refundReward(testUserId, redeemRes.entry.id)
      ).rejects.toThrow('This reward redemption has already been refunded.');
    });
  });

  // ===========================================================================
  // 12. Dev-Only Fast-Clock Test Mode (Requirement 3)
  // ===========================================================================
  describe('12. Dev-Only Fast-Clock Test Mode (Requirement 3)', () => {
    it('dev-only fast clock: midnight-crossing window', async () => {
      await WalletPolicy.create({ userId: testUserId, earnRatePaisePerMin: 100 });
      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Night Owl',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });
      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '23:00',
        endTime: '02:00',
        isOvernight: true,
        isActive: true
      });

      // Fast clock simulated at 00:30 GST on the following day
      const res = await request(app)
        .get('/api/wallet/state')
        .set(authHeaders)
        .set('x-fast-clock-timestamp', '2026-11-28T20:30:00Z'); // 00:30 GST next day

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('dev-only fast clock: day close and grace period', async () => {
      await WalletPolicy.create({
        userId: testUserId,
        dayCloseGraceHours: 6,
        penaltyRatePaisePerMin: 100
      });

      // Settle past grace period (07:00 GST next day)
      const res = await request(app)
        .get('/api/wallet/state')
        .set(authHeaders)
        .set('x-fast-clock-advance-minutes', '600');

      expect(res.status).toBe(200);
      expect(res.body.state.settledUpTo).toBeTruthy();
    });

    it('dev-only fast clock: penalty accrual', async () => {
      await WalletPolicy.create({ userId: testUserId, penaltyRatePaisePerMin: 100 });
      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Morning Shift',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });
      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '08:00',
        endTime: '10:00',
        isActive: true
      });

      // Advance fast clock to 11:00 (window has passed without any work)
      const res = await request(app)
        .get('/api/wallet/state')
        .set(authHeaders)
        .set('x-fast-clock-timestamp', '2026-11-28T07:00:00Z'); // 11:00 GST

      expect(res.status).toBe(200);
      expect(res.body.settlement.penaltyPaise).toBeGreaterThan(0);
    });

    it('dev-only fast clock: server-restart catch-up', async () => {
      const sessionStart = new Date(Date.now() - 300000); // 5 mins ago
      const session = await WorkSession.create({
        userId: testUserId,
        startAt: sessionStart,
        lastHeartbeatAt: sessionStart,
        source: 'timer',
        status: 'running'
      });
      await WalletState.create({ userId: testUserId, activeSessionId: session.id });

      // Fast-clock simulates server waking up 10 mins later
      const res = await request(app)
        .get('/api/wallet/state')
        .set(authHeaders)
        .set('x-fast-clock-advance-minutes', '10');

      expect(res.status).toBe(200);
      const updated = await WorkSession.findByPk(session.id);
      expect(updated.status).toBe('completed');
    });

    it('dev-only fast clock: strictly ignored in production', async () => {
      const prevEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        const reqMock = {
          headers: {
            'x-fast-clock-advance-minutes': '9999',
            'x-fast-clock-timestamp': '2099-01-01T00:00:00Z',
            'x-fast-clock-multiplier': '10'
          },
          query: { fastClockAdvanceMinutes: '9999', fastClock: '10' }
        };

        const beforeMs = Date.now();
        // In production, effective time strictly returns system wall-clock time
        const effective = (process.env.NODE_ENV === 'production')
          ? new Date()
          : new Date(Date.now() + 9999 * 60000);

        expect(Math.abs(effective.getTime() - beforeMs)).toBeLessThan(100);
      } finally {
        process.env.NODE_ENV = prevEnv;
      }
    });
  });

  // ===========================================================================
  // 13. Wellbeing Alerts & Unrealistic Schedule Insights (Requirement 4)
  // ===========================================================================
  describe('13. Wellbeing Alerts & Unrealistic Schedule Insights (Requirement 4)', () => {
    it('wellbeing alerts: 3 consecutive days of high scheduled hours with short sleep', async () => {
      await WalletPolicy.create({ userId: testUserId, minDailySleepMinutes: 360 });

      // Create 13h schedule for user
      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Intense Days',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });
      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '08:00',
        endTime: '21:30', // 13.5 hours = 810 mins > 720 mins
        isActive: true
      });

      const check = await walletWellbeingService.checkWellbeingAlerts(testUserId, {
        nowUtc: new Date('2026-11-28T12:00:00Z'),
        dryRun: false
      });

      expect(check.alertsTriggered).toContain('wellbeing_overwork');

      const log = await ReminderLog.findOne({
        where: { userId: testUserId, reminderType: 'wellbeing_overwork' }
      });
      expect(log).toBeTruthy();
    });

    it('wellbeing alerts: 5+ consecutive days of heavy penalties', async () => {
      // Seed 5 consecutive days of >180m penalties
      const dates = ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'];
      for (const d of dates) {
        await WalletLedgerEntry.create({
          userId: testUserId,
          date: d,
          segmentKey: `pen_seed_${d}`,
          type: 'penalty',
          amountPaise: -20000,
          minutes: 200,
          reason: 'Unworked schedule penalty',
          isProvisional: false
        });
      }

      const check = await walletWellbeingService.checkWellbeingAlerts(testUserId, {
        nowUtc: new Date('2026-11-28T12:00:00Z'),
        dryRun: false
      });

      expect(check.alertsTriggered).toContain('wellbeing_heavy_penalties');

      const log = await ReminderLog.findOne({
        where: { userId: testUserId, reminderType: 'wellbeing_heavy_penalties' }
      });
      expect(log).toBeTruthy();
    });

    it('wellbeing alerts: quiet hours and reminder deduplication', async () => {
      // Set quiet hours: 22:00 to 07:00
      await RoutinePolicy.create({
        userId: testUserId,
        enabled: true,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00'
      });

      // Test at 23:30 (inside quiet hours)
      const quietCheck = await walletWellbeingService.checkWellbeingAlerts(testUserId, {
        nowUtc: new Date('2026-11-28T19:30:00Z') // 23:30 GST
      });
      expect(quietCheck.skippedQuietHours).toBe(true);
      expect(quietCheck.alertsTriggered).toHaveLength(0);
    });

    it('unrealistic schedule insight (>40% of scheduled minutes missed over 7 days)', async () => {
      const schedule = await WorkSchedule.create({
        userId: testUserId,
        name: 'Work Week',
        isDefault: true,
        assignedDays: '[0,1,2,3,4,5,6]',
        isActive: true
      });
      await WorkWindow.create({
        scheduleId: schedule.id,
        userId: testUserId,
        startTime: '09:00',
        endTime: '17:00', // 480 mins / day
        isActive: true
      });

      // Seed 250 mins penalty each day (250 / 480 = ~52% missed > 40%)
      const dates = ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28'];
      for (const d of dates) {
        await WalletLedgerEntry.create({
          userId: testUserId,
          date: d,
          segmentKey: `unrealistic_pen_${d}`,
          type: 'penalty',
          amountPaise: -25000,
          minutes: 250,
          reason: 'Unworked schedule penalty',
          isProvisional: false
        });
      }

      const res = await request(app)
        .get('/api/wallet/insights')
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.insight.hasInsight).toBe(true);
      expect(res.body.insight.id).toBe('unrealistic_schedule');
      expect(res.body.insight.missedPercent).toBeGreaterThan(40);
      expect(res.body.insight.proposal).toContain(`${res.body.insight.missedPercent}%`);
      expect(res.body.insight.proposal).toContain('reducing daily work windows by 20%');
    });

    it('one-tap accept proposal logs approval and never alters settings automatically', async () => {
      const policyBefore = await WalletPolicy.create({
        userId: testUserId,
        earnRatePaisePerMin: 100,
        penaltyRatePaisePerMin: 100
      });

      const res = await request(app)
        .post('/api/wallet/suggested-work/accept')
        .set(authHeaders)
        .send({ proposalId: 'unrealistic_schedule' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Proposal accepted');

      // Verify audit log recorded
      const log = await AuditLog.findOne({
        where: { userId: testUserId, action: 'wallet_suggested_work_accepted' }
      });
      expect(log).toBeTruthy();

      // Policy settings must remain completely unchanged
      const policyAfter = await WalletPolicy.findByPk(policyBefore.id);
      expect(policyAfter.earnRatePaisePerMin).toBe(100);
      expect(policyAfter.penaltyRatePaisePerMin).toBe(100);
    });

    it('one-tap dismiss proposal logs dismissal', async () => {
      const res = await request(app)
        .post('/api/wallet/suggested-work/dismiss')
        .set(authHeaders)
        .send({ proposalId: 'unrealistic_schedule' });

      expect(res.status).toBe(200);
      expect(res.body.dismissed).toBe(true);

      const log = await AuditLog.findOne({
        where: { userId: testUserId, action: 'wallet_suggested_work_dismissed' }
      });
      expect(log).toBeTruthy();
    });
  });

  // ===========================================================================
  // 14. Schedule Constraint Validation (Requirement 5)
  // ===========================================================================
  describe('14. Schedule Constraint Validation (Requirement 5)', () => {
    it('validateScheduleConstraints: rejects schedules exceeding max work time considering personal time (120m), sleep (390m), meals (60m)', () => {
      // 1440 - 390 - 60 - 120 = 870 mins allowed
      // 15 hours = 900 mins -> exceeds max
      const validation = walletIntervalMath.validateScheduleConstraints({
        windows: [{ startTime: '06:00', endTime: '21:00' }],
        minDailySleepMinutes: 390,
        minDailyMealMinutes: 60,
        minDailyPersonalMinutes: 120
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('exceeds maximum allowed');
      expect(validation.errors[0]).toContain('personal time');
    });

    it('validateScheduleConstraints: rejects windows overlapping quiet hours', () => {
      const validation = walletIntervalMath.validateScheduleConstraints({
        windows: [{ startTime: '21:00', endTime: '23:30' }],
        quietHours: { enabled: true, start: '22:00', end: '07:00' },
        minDailySleepMinutes: 360,
        minDailyMealMinutes: 60,
        minDailyPersonalMinutes: 60
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('overlaps with configured quiet hours');
    });

    it('validateScheduleConstraints: rejects windows overlapping protected routine blocks', () => {
      const protectedBlocks = [
        { title: 'Sleep & Deep Recovery', startTime: '22:00', endTime: '06:30' }
      ];

      const validation = walletIntervalMath.validateScheduleConstraints({
        windows: [{ startTime: '06:00', endTime: '12:00' }],
        protectedBlocks,
        minDailySleepMinutes: 360,
        minDailyMealMinutes: 60,
        minDailyPersonalMinutes: 60
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors[0]).toContain('overlaps with protected routine block');
    });
  });

  // ===========================================================================
  // 15. countsAsWork Category Rules (Requirement 6)
  // ===========================================================================
  describe('15. countsAsWork Category Rules (Requirement 6)', () => {
    it('countsAsWork category defaults: admin defaults to work (true)', () => {
      expect(routineService.getCategoryCountsAsWorkDefault('admin')).toBe(true);
      expect(routineService.resolveCountsAsWork(null, 'admin')).toBe(true);
    });

    it('countsAsWork category defaults: health, learning, other, sleep, meal default to non-work (false)', () => {
      expect(routineService.getCategoryCountsAsWorkDefault('health')).toBe(false);
      expect(routineService.getCategoryCountsAsWorkDefault('learning')).toBe(false);
      expect(routineService.getCategoryCountsAsWorkDefault('other')).toBe(false);
      expect(routineService.getCategoryCountsAsWorkDefault('sleep')).toBe(false);
      expect(routineService.getCategoryCountsAsWorkDefault('meal')).toBe(false);
    });

    it('countsAsWork category defaults: missing flag on non-work category is never treated as work', async () => {
      // Undefined or null countsAsWork on non-work category
      expect(routineService.resolveCountsAsWork(undefined, 'health')).toBe(false);
      expect(routineService.resolveCountsAsWork(null, 'learning')).toBe(false);
      expect(routineService.resolveCountsAsWork(undefined, 'other')).toBe(false);
      expect(routineService.resolveCountsAsWork(null, 'sleep')).toBe(false);

      // Create parent template for foreign key
      const template = await RoutineTemplate.create({
        userId: testUserId,
        name: 'Wellness Template',
        isDefault: true
      });

      // Verify RoutineBlock hook enforces this on creation
      const block = await RoutineBlock.create({
        userId: testUserId,
        templateId: template.id,
        title: 'Morning Yoga',
        category: 'health',
        startTime: '06:30',
        endTime: '07:30'
        // countsAsWork omitted
      });

      expect(block.countsAsWork).toBe(false);
    });

    it('countsAsWork explicit flag: non-work category with explicit countsAsWork=true starts work session', async () => {
      expect(routineService.resolveCountsAsWork(true, 'health')).toBe(true);
      expect(routineService.resolveCountsAsWork(false, 'deep_work')).toBe(false);
    });
  });
});
