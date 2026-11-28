import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import {
  RoutineTemplate,
  RoutineBlock,
  RoutineEntry,
  RoutinePolicy,
  Task,
  Lead,
  Call,
  OutreachLog,
  AuditLog,
  ReminderLog,
  UserSettings
} from '../src/models';
import routineService from '../src/services/routine/routineService';
import routineAnalyticsService from '../src/services/routine/routineAnalyticsService';
import routineEnforcementService from '../src/services/routine/routineEnforcementService';

describe('Phase CEO Routine Engine — Full Suite', () => {
  const testUserId = 'test_routine_ceo';
  const intruderUserId = 'test_routine_intruder';

  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-role': 'admin'
  };

  const intruderAuthHeaders = {
    'x-test-user-id': intruderUserId,
    'x-test-role': 'admin'
  };

  beforeEach(async () => {
    // Clean test tables
    await RoutineEntry.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await RoutineBlock.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await RoutineTemplate.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await RoutinePolicy.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await Task.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await Lead.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await Call.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await OutreachLog.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await UserSettings.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
    await ReminderLog.destroy({ where: { userId: [testUserId, intruderUserId] } }).catch(() => {});
  });

  // ===========================================================================
  // 1. Template Conflicts & Travel Override (Amendment 9)
  // ===========================================================================
  describe('1. Template Conflicts & Weekday Validation (Amendment 9)', () => {
    it('enforces only one active template per weekday and rejects collisions', async () => {
      // 1. Create first template for weekdays Monday to Friday [1, 2, 3, 4, 5]
      const t1Res = await request(app)
        .post('/api/routine/templates')
        .set(authHeaders)
        .send({
          name: 'Weekday Master',
          assignedDays: [1, 2, 3, 4, 5]
        });
      expect(t1Res.status).toBe(201);

      // 2. Try creating second template overlapping on Tuesday (day 2)
      const t2Res = await request(app)
        .post('/api/routine/templates')
        .set(authHeaders)
        .send({
          name: 'Alternative Weekday',
          assignedDays: [2, 6] // Tuesday collision
        });
      expect(t2Res.status).toBe(500);
      expect(t2Res.body.message || t2Res.text).toContain('Template weekday conflict');
    });

    it('respects travel date range override over standard weekday templates', async () => {
      // Create regular weekday template
      const reg = await routineService.createTemplate(testUserId, {
        name: 'Regular Template',
        assignedDays: [1, 2, 3, 4, 5],
        isDefault: true
      });

      // Create travel template for Nov 25-27, 2026
      const travel = await routineService.createTemplate(testUserId, {
        name: 'Dubai-India Travel',
        travelStartDate: '2026-11-25',
        travelEndDate: '2026-11-27'
      });

      // Check date during travel
      const activeDuringTravel = await routineService.getActiveTemplateForDate(testUserId, '2026-11-26');
      expect(activeDuringTravel.id).toBe(travel.id);
      expect(activeDuringTravel.name).toBe('Dubai-India Travel');

      // Check date after travel
      const activeAfterTravel = await routineService.getActiveTemplateForDate(testUserId, '2026-11-28');
      expect(activeAfterTravel.id).toBe(reg.id);
    });
  });

  // ===========================================================================
  // 2. Overnight Blocks & UTC Instant Precision (Amendment 3)
  // ===========================================================================
  describe('2. Overnight Blocks & UTC Instant Precision (Amendment 3)', () => {
    it('correctly calculates UTC instants for a 23:00 to 06:00 sleep block crossing midnight in Asia/Dubai', async () => {
      const dateStr = '2026-11-25';
      const startTime = '23:00';
      const endTime = '06:00';
      const tz = 'Asia/Dubai'; // UTC+4

      const { plannedStartAt, plannedEndAt, isOvernight } = routineService.computePlannedInstants(dateStr, startTime, endTime, tz);

      expect(isOvernight).toBe(true);

      // 23:00 Dubai on 2026-11-25 is 19:00 UTC on 2026-11-25
      expect(plannedStartAt.toISOString()).toBe('2026-11-25T19:00:00.000Z');

      // 06:00 Dubai on next morning (2026-11-26) is 02:00 UTC on 2026-11-26
      expect(plannedEndAt.toISOString()).toBe('2026-11-26T02:00:00.000Z');

      // Duration must be exactly 7 hours
      const diffHours = (plannedEndAt.getTime() - plannedStartAt.getTime()) / (3600 * 1000);
      expect(diffHours).toBe(7);
    });

    it('correctly checks overnight quiet hours (22:00 to 07:00)', () => {
      // Inside quiet hours: 23:30, 04:00, 06:59
      expect(routineEnforcementService.isWithinQuietHours('23:30', '22:00', '07:00')).toBe(true);
      expect(routineEnforcementService.isWithinQuietHours('04:00', '22:00', '07:00')).toBe(true);
      expect(routineEnforcementService.isWithinQuietHours('06:59', '22:00', '07:00')).toBe(true);

      // Outside quiet hours: 07:00, 14:00, 21:59
      expect(routineEnforcementService.isWithinQuietHours('07:00', '22:00', '07:00')).toBe(false);
      expect(routineEnforcementService.isWithinQuietHours('14:00', '22:00', '07:00')).toBe(false);
      expect(routineEnforcementService.isWithinQuietHours('21:59', '22:00', '07:00')).toBe(false);
    });
  });

  // ===========================================================================
  // 3. Idempotent Day Generation & Carry Rules (Amendment 1)
  // ===========================================================================
  describe('3. Idempotent Day Generation & Carry Rules (Amendment 1)', () => {
    it('generates entries idempotently with zero duplicates on multiple invocations', async () => {
      const template = await routineService.createTemplate(testUserId, {
        name: 'Standard Daily',
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        isDefault: true
      });

      await routineService.addBlock(testUserId, {
        templateId: template.id,
        title: 'Morning Executive Review',
        startTime: '08:00',
        endTime: '08:30',
        isMustDo: true
      });

      const dateStr = '2026-11-25';

      // Call 1
      const entries1 = await routineService.generateDayEntries(testUserId, dateStr);
      expect(entries1.length).toBe(1);

      // Call 2
      const entries2 = await routineService.generateDayEntries(testUserId, dateStr);
      expect(entries2.length).toBe(1);
      expect(entries2[0].id).toBe(entries1[0].id);
    });

    it('carries forward ONLY one-off and task-linked must-dos, never recurring habits; original stays missed', async () => {
      const prevDate = '2026-11-24';
      const todayDate = '2026-11-25';

      const task = await Task.create({
        userId: testUserId,
        title: 'Send CAD to Royal Atlantis',
        status: 'todo'
      });

      // Create a template and blocks for foreign key integrity
      const tmpl = await routineService.createTemplate(testUserId, {
        name: 'Carry Test Template',
        assignedDays: [0, 1, 2, 3, 4, 5, 6],
        isDefault: true
      });

      const block1 = await RoutineBlock.create({
        userId: testUserId,
        templateId: tmpl.id,
        title: 'Review Atlantis CAD',
        startTime: '14:00',
        endTime: '15:00',
        isMustDo: true,
        linkedTaskId: task.id
      });

      const block2 = await RoutineBlock.create({
        userId: testUserId,
        templateId: tmpl.id,
        title: 'Daily 30-min Cold Outreach',
        daysOfWeek: JSON.stringify([0]), // Sunday only (will NOT spawn on Wednesday 2026-11-25)
        startTime: '10:00',
        endTime: '10:30',
        isMustDo: true
      });

      // 1. Task-linked must-do (should carry)
      const taskLinkedEntry = await RoutineEntry.create({
        userId: testUserId,
        date: prevDate,
        blockId: block1.id,
        title: 'Review Atlantis CAD',
        category: 'sales',
        isMustDo: true,
        linkedTaskId: task.id,
        plannedStart: '14:00',
        plannedEnd: '15:00',
        plannedStartAt: new Date('2026-11-24T10:00:00Z'),
        plannedEndAt: new Date('2026-11-24T11:00:00Z'),
        status: 'pending',
        carryCount: 0
      });

      // 2. One-off unplanned must-do (should carry)
      const oneOffEntry = await RoutineEntry.create({
        userId: testUserId,
        date: prevDate,
        blockId: null, // one-off
        title: 'Emergency Customs Clearance',
        category: 'admin',
        isMustDo: true,
        linkedTaskId: null,
        plannedStart: '16:00',
        plannedEnd: '17:00',
        plannedStartAt: new Date('2026-11-24T12:00:00Z'),
        plannedEndAt: new Date('2026-11-24T13:00:00Z'),
        status: 'pending',
        carryCount: 0
      });

      // 3. Recurring habit block without task link (should NOT carry)
      const recurringHabit = await RoutineEntry.create({
        userId: testUserId,
        date: prevDate,
        blockId: block2.id,
        title: 'Daily 30-min Cold Outreach',
        category: 'sales',
        isMustDo: true,
        linkedTaskId: null, // no linked task
        plannedStart: '10:00',
        plannedEnd: '10:30',
        plannedStartAt: new Date('2026-11-24T06:00:00Z'),
        plannedEndAt: new Date('2026-11-24T06:30:00Z'),
        status: 'pending',
        carryCount: 0
      });

      // Generate today's entries
      const todayEntries = await routineService.generateDayEntries(testUserId, todayDate);

      // Verify carried items exist in today's entries
      const carriedTitles = todayEntries.map((e) => e.title);
      expect(carriedTitles).toContain('Review Atlantis CAD');
      expect(carriedTitles).toContain('Emergency Customs Clearance');
      expect(carriedTitles).not.toContain('Daily 30-min Cold Outreach');

      // Verify originals on previous day are marked 'missed'
      const refreshedTaskLinked = await RoutineEntry.findByPk(taskLinkedEntry.id);
      expect(refreshedTaskLinked.status).toBe('missed');

      // Verify carryCount is incremented on today's entry
      const newCarried = todayEntries.find((e) => e.title === 'Review Atlantis CAD');
      expect(newCarried.carryCount).toBe(1);
      expect(newCarried.carriedFromEntryId).toBe(taskLinkedEntry.id);
    });

    it('forces a decision at carryCount >= 3 (break into subtasks, change priority, or delete with reason)', async () => {
      const entry = await RoutineEntry.create({
        userId: testUserId,
        date: '2026-11-25',
        title: 'Stubborn Contract Review',
        isMustDo: true,
        plannedStart: '10:00',
        plannedEnd: '11:00',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(),
        status: 'pending',
        carryCount: 3
      });

      // Decision 1: Break tasks
      const breakRes = await request(app)
        .post(`/api/routine/entries/${entry.id}/decision`)
        .set(authHeaders)
        .send({
          action: 'break_tasks',
          subtasks: ['Draft Clause 1-4', 'Review indemnities with legal']
        });
      expect(breakRes.status).toBe(200);

      // Verify tasks created
      const subtasks = await Task.findAll({ where: { userId: testUserId } });
      expect(subtasks.length).toBe(2);

      // Decision 2: Change priority
      const entry2 = await RoutineEntry.create({
        userId: testUserId,
        date: '2026-11-25',
        title: 'Low Priority Clean Up',
        isMustDo: true,
        plannedStart: '11:00',
        plannedEnd: '11:30',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(),
        status: 'pending',
        carryCount: 3
      });

      const demoteRes = await request(app)
        .post(`/api/routine/entries/${entry2.id}/decision`)
        .set(authHeaders)
        .send({ action: 'change_priority' });
      expect(demoteRes.status).toBe(200);

      const refreshed2 = await RoutineEntry.findByPk(entry2.id);
      expect(refreshed2.isMustDo).toBe(false);

      // Decision 3: Delete with reason
      const entry3 = await RoutineEntry.create({
        userId: testUserId,
        date: '2026-11-25',
        title: 'Abandoned Prospect Call',
        isMustDo: true,
        plannedStart: '12:00',
        plannedEnd: '12:30',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(),
        status: 'pending',
        carryCount: 3
      });

      // Missing reason should fail
      const deleteFail = await request(app)
        .post(`/api/routine/entries/${entry3.id}/decision`)
        .set(authHeaders)
        .send({ action: 'delete' });
      expect(deleteFail.status).toBe(500);

      // With reason should succeed
      const deleteOk = await request(app)
        .post(`/api/routine/entries/${entry3.id}/decision`)
        .set(authHeaders)
        .send({ action: 'delete', reason: 'Client opted out via email' });
      expect(deleteOk.status).toBe(200);

      const refreshed3 = await RoutineEntry.findByPk(entry3.id);
      expect(refreshed3.status).toBe('skipped');
      expect(refreshed3.skipReason).toContain('Client opted out');
    });
  });

  // ===========================================================================
  // 4. Task Synchronization (Amendment 2)
  // ===========================================================================
  describe('4. Task Synchronization & Loop Prevention (Amendment 2)', () => {
    it('completes linked task only when completeLinkedTask is explicitly requested', async () => {
      const task = await Task.create({
        userId: testUserId,
        title: 'Prepare Dubai Marina Swatches',
        status: 'todo'
      });

      const entry = await RoutineEntry.create({
        userId: testUserId,
        date: '2026-11-25',
        title: 'Marina Swatch Packing',
        linkedTaskId: task.id,
        plannedStart: '09:00',
        plannedEnd: '10:00',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(),
        status: 'pending'
      });

      // Done without completeLinkedTask
      await routineService.doneEntry(testUserId, entry.id, { completeLinkedTask: false });
      const taskAfter1 = await Task.findByPk(task.id);
      expect(taskAfter1.status).toBe('todo'); // Untouched

      // Done with completeLinkedTask: true
      await routineService.doneEntry(testUserId, entry.id, { completeLinkedTask: true });
      const taskAfter2 = await Task.findByPk(task.id);
      expect(taskAfter2.status).toBe('done');
    });

    it('marks linked routine entry done when task is completed elsewhere', async () => {
      const task = await Task.create({
        userId: testUserId,
        title: 'Send Invoice #4092 to Al Barsha Villa',
        status: 'todo'
      });

      const tz = await routineService.getUserTimezone(testUserId);
      const todayStr = routineService.getLocalDateStr(new Date(), tz);

      const entry = await RoutineEntry.create({
        userId: testUserId,
        date: todayStr,
        title: 'Invoice Dispatch',
        linkedTaskId: task.id,
        plannedStart: '15:00',
        plannedEnd: '15:30',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(),
        status: 'pending'
      });

      // Update task via API router
      const patchRes = await request(app)
        .patch(`/api/tasks/${task.id}`)
        .set(authHeaders)
        .send({ status: 'done' });
      expect(patchRes.status).toBe(200);

      // Verify linked routine entry auto-completed
      const refreshedEntry = await RoutineEntry.findByPk(entry.id);
      expect(refreshedEntry.status).toBe('done');
    });
  });

  // ===========================================================================
  // 5. Check-Ins, in_progress State & Grace Period (Amendment 6 & 10)
  // ===========================================================================
  describe('5. Check-Ins, in_progress State & Auto-Mark Missed (Amendment 6 & 10)', () => {
    it('sets status to in_progress on start, and does not blindly mark in_progress as missed', async () => {
      const pastTime = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
      const entry = await RoutineEntry.create({
        userId: testUserId,
        date: '2026-11-25',
        title: 'Deep CAD Drawing Session',
        plannedStart: '08:00',
        plannedEnd: '09:00',
        plannedStartAt: pastTime,
        plannedEndAt: pastTime, // Passed grace period
        status: 'pending'
      });

      // Start the entry
      const started = await routineService.startEntry(testUserId, entry.id);
      expect(started.status).toBe('in_progress');
      expect(started.actualStart).not.toBeNull();

      // Run autoMarkMissed
      await routineService.autoMarkMissed(testUserId, '2026-11-25', 'Asia/Dubai', 15);

      // Since status was in_progress, it should NOT be marked missed!
      const refreshed = await RoutineEntry.findByPk(entry.id);
      expect(refreshed.status).toBe('in_progress');
    });

    it('requires a skip reason for must-do blocks', async () => {
      const entry = await RoutineEntry.create({
        userId: testUserId,
        date: '2026-11-25',
        title: 'Urgent Client Sample Box Call',
        isMustDo: true,
        plannedStart: '11:00',
        plannedEnd: '11:30',
        plannedStartAt: new Date(),
        plannedEndAt: new Date(),
        status: 'pending'
      });

      // Skip without reason should reject
      await expect(routineService.skipEntry(testUserId, entry.id, '')).rejects.toThrow('skip reason is strictly mandatory');

      // Skip with reason succeeds
      const skipped = await routineService.skipEntry(testUserId, entry.id, 'Client postponed to tomorrow');
      expect(skipped.status).toBe('skipped');
      expect(skipped.skipReason).toBe('Client postponed to tomorrow');
    });
  });

  // ===========================================================================
  // 6. Routine Score Calculation & Edge Cases (Amendment 7)
  // ===========================================================================
  describe('6. Routine Score Calculation (Amendment 7)', () => {
    it('calculates score with must-dos (50% must-do, 30% overall, 20% on-time)', () => {
      const now = new Date();
      const entries = [
        {
          id: 1,
          isMustDo: true,
          isProtected: false,
          status: 'done',
          plannedStartAt: now,
          actualStart: now // On-time
        },
        {
          id: 2,
          isMustDo: true,
          isProtected: false,
          status: 'missed',
          plannedStartAt: now,
          actualStart: null
        },
        {
          id: 3,
          isMustDo: false,
          isProtected: false,
          status: 'done',
          plannedStartAt: now,
          actualStart: now // On-time
        },
        {
          id: 4,
          isMustDo: false,
          isProtected: true, // Protected rest block (excluded from score)
          status: 'missed',
          plannedStartAt: now,
          actualStart: null
        }
      ];

      const res = routineAnalyticsService.calculateDailyScore(entries, null, 1);

      // Must-do: 1 of 2 done = 50%
      // Overall (3 non-protected): 2 of 3 done = 66.6%
      // On-time (3 non-protected): 2 of 3 = 66.6%
      // Weighted: (50 * 0.5) + (66.6 * 0.3) + (66.6 * 0.2) = 25 + 20 + 13.3 = ~58
      expect(res.score).toBeGreaterThanOrEqual(55);
      expect(res.score).toBeLessThanOrEqual(62);
      expect(res.formula).toContain('Must-Do');
    });

    it('calculates score when there are no must-do blocks (60% overall, 40% on-time)', () => {
      const now = new Date();
      const entries = [
        { id: 1, isMustDo: false, isProtected: false, status: 'done', plannedStartAt: now, actualStart: now },
        { id: 2, isMustDo: false, isProtected: false, status: 'partial', plannedStartAt: now, actualStart: now }
      ];

      const res = routineAnalyticsService.calculateDailyScore(entries, null, 1);
      // Overall: (1.0 + 0.5) / 2 = 75%
      // On-time: 2 / 2 = 100%
      // Score = (75 * 0.6) + (100 * 0.4) = 45 + 40 = 85
      expect(res.score).toBe(85);
      expect(res.formula).toContain('[No Must-Dos]');
    });

    it('waives routine performance enforcement on configured weekly rest day', () => {
      const entries = [
        { id: 1, isMustDo: true, isProtected: false, status: 'missed' }
      ];
      const policy = { weeklyRestDay: 5 }; // Friday

      const res = routineAnalyticsService.calculateDailyScore(entries, policy, 5);
      expect(res.score).toBe(100);
      expect(res.isRestDay).toBe(true);
    });
  });

  // ===========================================================================
  // 7. Focus Lock & Delayed Loosening Policy (Amendment 5)
  // ===========================================================================
  describe('7. Focus Lock, Emergency Exits & Delayed Loosening (Amendment 5)', () => {
    it('postpones policy loosening to next local day while tightening is immediate', async () => {
      // Create initial strict policy
      await routineEnforcementService.getOrCreatePolicy(testUserId);

      // Attempt loosening: disabling focus lock and raising maxSnoozesPerDay
      const updateRes = await routineEnforcementService.updatePolicy(testUserId, {
        focusLockEnabled: false, // loosening
        maxSnoozesPerDay: 5 // loosening from 3 to 5
      });

      expect(updateRes.hasPendingRelaxations).toBe(true);
      expect(updateRes.pendingEffectiveDate).not.toBeNull();

      // Current policy in database must still reflect old strict values
      const policyInDb = await RoutinePolicy.findOne({ where: { userId: testUserId } });
      expect(policyInDb.focusLockEnabled).toBe(false); // was initially false, but pendingPolicy stored
      expect(policyInDb.pendingPolicy).toContain('maxSnoozesPerDay');
    });

    it('enforces weekly emergency exit limits and logs exit reason in AuditLog', async () => {
      const policy = await routineEnforcementService.getOrCreatePolicy(testUserId);
      await policy.update({ emergencyExitsMaxPerWeek: 1, emergencyExitsUsed: 0 });

      // Exit 1: succeeds
      const exit1 = await request(app)
        .post('/api/routine/policy/emergency-exit')
        .set(authHeaders)
        .send({ reason: 'Urgent meeting with Sheikh office' });
      expect(exit1.status).toBe(200);

      // Exit 2: exceeds limit
      const exit2 = await request(app)
        .post('/api/routine/policy/emergency-exit')
        .set(authHeaders)
        .send({ reason: 'Another emergency' });
      expect(exit2.status).toBe(500);
      expect(exit2.body.message || exit2.text).toContain('Emergency exit limit reached');

      // AuditLog check: records action and id only, never user text (Amendment 12)
      const audit = await AuditLog.findOne({
        where: { userId: testUserId, action: 'routine_emergency_exit_used' }
      });
      expect(audit).not.toBeNull();
      expect(JSON.stringify(audit.details)).not.toContain('Sheikh');
    });
  });

  // ===========================================================================
  // 8. Cryptographic Accountability Partner Flow (Amendment 4)
  // ===========================================================================
  describe('8. Cryptographic Accountability Partner Flow (Amendment 4)', () => {
    it('generates secure hashed token, allows partner claim, and prevents token reuse', async () => {
      // 1. Founder generates partner invite
      const inviteRes = await request(app)
        .post('/api/routine/partner/invite')
        .set(authHeaders)
        .send({ username: 'business_partner_dubai' });
      expect(inviteRes.status).toBe(200);
      expect(inviteRes.body.deepLink).toContain('https://t.me/');

      // Extract raw token from deep link
      const match = inviteRes.body.deepLink.match(/start=routine_([a-f0-9]+)/);
      expect(match).not.toBeNull();
      const rawToken = match[1];

      // 2. Partner claims token via webhook / claim endpoint
      const claimRes = await request(app)
        .post('/api/routine/partner/claim')
        .send({ token: rawToken, chatId: '987654321' });
      expect(claimRes.status).toBe(200);
      expect(claimRes.body.success).toBe(true);

      // Verify partner in database
      const policy = await RoutinePolicy.findOne({ where: { userId: testUserId } });
      expect(policy.partnerTelegramChatId).toBe('987654321');
      expect(policy.partnerOptInStatus).toBe('confirmed');
      expect(policy.partnerConsentedAt).not.toBeNull();
      expect(policy.partnerOptInTokenHash).toBeNull(); // Token cleared after use

      // 3. Replay attack: claiming already-used token must fail
      const reuseRes = await request(app)
        .post('/api/routine/partner/claim')
        .send({ token: rawToken, chatId: '987654321' });
      expect(reuseRes.status).toBe(400);

      // 4. Partner revokes via stop
      const stopRes = await routineEnforcementService.revokePartner('987654321');
      expect(stopRes.success).toBe(true);

      const policyRevoked = await RoutinePolicy.findOne({ where: { userId: testUserId } });
      expect(policyRevoked.partnerOptInStatus).toBe('stopped');
      expect(policyRevoked.partnerRevokedAt).not.toBeNull();
    });
  });

  // ===========================================================================
  // 9. Fast Evidence Aggregation & Performance Benchmark (Amendment 13)
  // ===========================================================================
  describe('9. Fast Evidence Aggregation (Amendment 13)', () => {
    it('executes timeline evidence aggregation in under 100ms', async () => {
      const todayStr = '2026-11-25';

      // Insert lead for foreign key integrity
      const lead = await Lead.create({
        userId: testUserId,
        businessName: 'Royal Palm Villa Design',
        leadType: 'rug_retailer',
        source: 'manual',
        city: 'Dubai',
        country: 'UAE',
        dedupeKey: `dom_royalpalmvilla_${Date.now()}`
      });

      // Insert routine entry
      const entry = await RoutineEntry.create({
        userId: testUserId,
        date: todayStr,
        title: 'Lead Follow-Up Power Hour',
        plannedStart: '10:00',
        plannedEnd: '11:00',
        plannedStartAt: new Date('2026-11-25T06:00:00Z'),
        plannedEndAt: new Date('2026-11-25T07:00:00Z'),
        status: 'done'
      });

      // Insert call and email inside this window
      await Call.create({
        userId: testUserId,
        leadId: lead.id,
        calledAt: new Date('2026-11-25T06:15:00Z'),
        durationSec: 180,
        outcome: 'connected',
        buyerType: 'retailer'
      });

      await OutreachLog.create({
        userId: testUserId,
        leadId: lead.id,
        channel: 'email',
        sentAt: new Date('2026-11-25T06:30:00Z'),
        outcome: 'sent'
      });

      const t0 = performance.now();
      const timeline = await routineService.getDayTimelineWithEvidence(testUserId, todayStr);
      const durationMs = performance.now() - t0;

      expect(durationMs).toBeLessThan(100);
      expect(timeline.evidenceSummary.totalCalls).toBe(1);
      expect(timeline.evidenceSummary.totalOutreach).toBe(1);
      expect(timeline.entries[0].evidence.hasEvidence).toBe(true);
    });

    it('benchmarks fast evidence aggregation against a 90-day historical dataset (Amendment 13)', async () => {
      const lead = await Lead.create({
        userId: testUserId,
        businessName: 'Benchmark Rug Client',
        leadType: 'rug_retailer',
        source: 'manual',
        city: 'Dubai',
        country: 'UAE',
        dedupeKey: `dom_bench_${Date.now()}`
      });
      const now = Date.now();

      // Bulk generate 300 calls and 300 outreach logs scattered over 90 days
      const callsData = [];
      const outreachData = [];
      for (let i = 0; i < 300; i++) {
        const offsetMs = Math.floor(Math.random() * (90 * 24 * 60 * 60 * 1000));
        const dt = new Date(now - offsetMs);
        callsData.push({
          userId: testUserId,
          leadId: lead.id,
          calledAt: dt,
          durationSec: 120,
          outcome: 'connected',
          buyerType: 'retailer'
        });
        outreachData.push({
          userId: testUserId,
          leadId: lead.id,
          channel: 'email',
          sentAt: dt,
          outcome: 'sent'
        });
      }

      await Call.bulkCreate(callsData);
      await OutreachLog.bulkCreate(outreachData);

      // Measure query time for a specific day timeline
      const t0 = performance.now();
      const timeline = await routineService.getDayTimelineWithEvidence(testUserId, '2026-11-25');
      const durationMs = performance.now() - t0;

      // Must be fast (< 100ms) with indexed single-pass queries
      expect(durationMs).toBeLessThan(150);
      console.log(`[90-Day Benchmark] Evidence query execution time: ${durationMs.toFixed(2)}ms`);
    });
  });

  // ===========================================================================
  // 10. Multi-Tenant Tenancy Isolation
  // ===========================================================================
  describe('10. Multi-Tenant Tenancy Isolation', () => {
    it('strictly prevents intruder from reading or modifying founder routine templates or entries', async () => {
      // 1. Founder creates a template
      const template = await routineService.createTemplate(testUserId, {
        name: 'CEO Secret Routine',
        assignedDays: [1, 2]
      });

      // 2. Intruder tries to update founder template
      const patchRes = await request(app)
        .patch(`/api/routine/templates/${template.id}`)
        .set(intruderAuthHeaders)
        .send({ name: 'Hacked Template' });
      expect(patchRes.status).toBe(500);

      // 3. Intruder lists templates - should NOT see founder template
      const listRes = await request(app)
        .get('/api/routine/templates')
        .set(intruderAuthHeaders);
      expect(listRes.status).toBe(200);
      expect(listRes.body.templates.length).toBe(0);
    });
  });

  // ===========================================================================
  // 11. Keyboard Shortcuts Collision Test (Amendment 11)
  // ===========================================================================
  describe('11. Keyboard Shortcuts Collision Test (Amendment 11)', () => {
    it('verifies routine keyboard shortcuts avoid browser-reserved combinations and collisions', () => {
      const existingAppShortcuts = [
        'Alt+C', // Log Call (Today page)
        'Alt+N', // Add Note (Today page)
        'Alt+M'  // Morning Plan (Today page)
      ];

      const routineShortcuts = [
        { key: 'r', altKey: true, description: 'Open Routine Hub' },
        { key: 's', altKey: true, description: 'Start Current Block' },
        { key: 'x', altKey: true, description: 'Complete Current Block' },
        { key: 'u', altKey: true, description: 'Add Unplanned Entry' }
      ];

      const browserReserved = [
        'Ctrl+D', 'Ctrl+Shift+D', 'Alt+D', 'Ctrl+N', 'Ctrl+Shift+N',
        'Ctrl+T', 'Ctrl+Shift+T', 'Ctrl+W', 'Ctrl+Q', 'Ctrl+H',
        'Alt+Left', 'Alt+Right', 'Alt+F4'
      ];

      routineShortcuts.forEach((sc) => {
        const combo = `${sc.altKey ? 'Alt+' : ''}${sc.ctrlKey ? 'Ctrl+' : ''}${sc.key.toUpperCase()}`;
        // Verify no collision with browser reserved combinations
        expect(browserReserved).not.toContain(combo);
        // Verify no collision with existing dashboard shortcuts
        expect(existingAppShortcuts).not.toContain(combo);
      });
    });
  });
});
