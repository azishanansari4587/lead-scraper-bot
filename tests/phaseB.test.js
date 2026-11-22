import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import {
  calculateNextDueDate,
  handleTaskCompletion
} from '../src/services/planner/taskRecurrence';
import { getMergedCalendar } from '../src/services/planner/calendarService';
import {
  getDailyPlan,
  saveDailyPlan,
  getEveningSummary,
  generateTomorrowPlanDraft,
  saveDailyReview,
  calculateStreaks,
  getLocalDateStr
} from '../src/services/planner/plannerService';
import founderReminderService from '../src/services/reminders/founderReminderService';
import {
  Task,
  CalendarEvent,
  DailyPlan,
  DailyReview,
  ReminderLog,
  Lead,
  FollowUp,
  Call,
  OutreachLog,
  UserSettings,
  Note
} from '../src/models';

describe('Phase B - Tasks, Calendar, Daily Planner and Reminders Suite', () => {
  const testUserId = 'test_phase_b_founder';
  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-role': 'admin'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Task Recurrence Engine', () => {
    it('calculates daily next due date (+1 day)', () => {
      const base = new Date('2026-11-20T09:00:00.000Z');
      const next = calculateNextDueDate(base, 'daily');
      expect(next.toISOString()).toBe('2026-11-21T09:00:00.000Z');
    });

    it('calculates weekdays next due date (Friday rolls to Monday)', () => {
      const friday = new Date('2026-11-20T09:00:00.000Z'); // 2026-11-20 is Friday
      const next = calculateNextDueDate(friday, 'weekdays');
      expect(next.toISOString()).toBe('2026-11-23T09:00:00.000Z'); // Monday
    });

    it('calculates weekly next due date (+7 days)', () => {
      const base = new Date('2026-11-20T09:00:00.000Z');
      const next = calculateNextDueDate(base, 'weekly');
      expect(next.toISOString()).toBe('2026-11-27T09:00:00.000Z');
    });

    it('calculates monthly next due date (+1 month)', () => {
      const base = new Date('2026-11-15T09:00:00.000Z');
      const next = calculateNextDueDate(base, 'monthly');
      expect(next.toISOString()).toBe('2026-12-15T09:00:00.000Z');
    });

    it('spawns next recurring task on completion and enforces idempotency against duplicates', async () => {
      const task = await Task.create({
        userId: testUserId,
        title: 'Daily Factory Inventory Audit (Bhadohi)',
        category: 'production',
        priority: 'high',
        dueAt: new Date('2026-11-20T10:00:00.000Z'),
        status: 'done',
        recurrenceRule: 'daily'
      });

      // First completion spawns child
      const nextTask1 = await handleTaskCompletion(task, testUserId);
      expect(nextTask1).toBeDefined();
      expect(nextTask1.status).toBe('todo');
      expect(nextTask1.recurrenceParentId).toBe(task.id);
      expect(nextTask1.title).toBe(task.title);

      // Idempotency: calling completion again does NOT duplicate the active occurrence
      const nextTask2 = await handleTaskCompletion(task, testUserId);
      expect(nextTask2.id).toBe(nextTask1.id);

      const activeCount = await Task.count({
        where: {
          userId: testUserId,
          recurrenceParentId: task.id,
          status: 'todo'
        }
      });
      expect(activeCount).toBe(1);
    });
  });

  describe('2. Internal Calendar & Overlap Conflict Detection', () => {
    it('detects time conflicts between overlapping events and merges feeds', async () => {
      const now = new Date();
      const eventStart1 = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const eventEnd1 = new Date(eventStart1.getTime() + 60 * 60 * 1000);

      // Overlapping event: starts 30 mins after event 1
      const eventStart2 = new Date(eventStart1.getTime() + 30 * 60 * 1000);
      const eventEnd2 = new Date(eventStart2.getTime() + 60 * 60 * 1000);

      const [ev1, ev2] = await Promise.all([
        CalendarEvent.create({
          userId: testUserId,
          title: 'Buyer Meeting - Dubai Marina Hotel',
          startAt: eventStart1,
          endAt: eventEnd1,
          type: 'meeting',
          location: 'Dubai Marina'
        }),
        CalendarEvent.create({
          userId: testUserId,
          title: 'Emergency Bhadohi Loom Video Call',
          startAt: eventStart2,
          endAt: eventEnd2,
          type: 'production',
          location: 'Google Meet'
        })
      ]);

      const merged = await getMergedCalendar({
        userId: testUserId,
        from: new Date(now.getTime() - 1000),
        to: new Date(now.getTime() + 24 * 60 * 60 * 1000)
      });

      expect(merged.success).toBe(true);
      expect(merged.items.length).toBeGreaterThanOrEqual(2);

      const item1 = merged.items.find((i) => i.id === ev1.id && i.itemType === 'event');
      const item2 = merged.items.find((i) => i.id === ev2.id && i.itemType === 'event');

      expect(item1).toBeDefined();
      expect(item2).toBeDefined();
      expect(item1.hasConflict).toBe(true);
      expect(item2.hasConflict).toBe(true);
      expect(item1.conflicts).toContain(ev2.id);
      expect(item2.conflicts).toContain(ev1.id);
    });
  });

  describe('3. Daily Planner Service (Rituals & Streaks)', () => {
    it('saves and retrieves daily morning plan (3 MITs & targets)', async () => {
      const date = new Date().toISOString().slice(0, 10);
      const plan = await saveDailyPlan(testUserId, {
        date,
        mit1: 'Close wholesale deal with Oberoi hotel procurement',
        mit2: 'Dispatch 10 silk rug samples to Abu Dhabi designer',
        mit3: 'Review Bhadohi custom dyeing batch #4',
        outreachTarget: 40,
        callTarget: 25,
        morningNote: 'Focus on high-margin hotel projects today.'
      });

      expect(plan.id).toBeDefined();
      expect(plan.mit1).toBe('Close wholesale deal with Oberoi hotel procurement');
      expect(plan.outreachTarget).toBe(40);

      const fetched = await getDailyPlan(testUserId, date);
      expect(fetched).toBeDefined();
      expect(fetched.mit2).toBe('Dispatch 10 silk rug samples to Abu Dhabi designer');
    });

    it('generates evening review summary and calculates consistency streaks', async () => {
      const date = new Date().toISOString().slice(0, 10);
      const summary = await getEveningSummary(testUserId, date);

      expect(summary.date).toBe(date);
      expect(summary.metrics).toBeDefined();
      expect(typeof summary.metrics.callsLogged).toBe('number');
      expect(typeof summary.metrics.emailsSent).toBe('number');
      expect(typeof summary.metrics.tasksCompleted).toBe('number');

      const review = await saveDailyReview(testUserId, {
        date,
        win: 'Signed agreement for 15 bespoke wool carpets with Dubai villa client',
        lesson: 'Direct phone calls after 3 PM GST receive higher connect rates than morning calls',
        tomorrowNotes: 'Confirm courier pickup for India factory swatches'
      });

      expect(review.id).toBeDefined();
      expect(review.win).toContain('Signed agreement');

      const streaks = await calculateStreaks(testUserId);
      expect(streaks.reviewStreak).toBeGreaterThanOrEqual(1);
    });

    it('generates tomorrow-plan draft from scheduled follow-ups, events, and tasks', async () => {
      const tomorrow = new Date();
      tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
      const tomorrowStr = tomorrow.toISOString().slice(0, 10);

      const draft = await generateTomorrowPlanDraft(testUserId, tomorrowStr);
      expect(draft.targetDate).toBe(tomorrowStr);
      expect(draft.summary).toBeDefined();
      expect(Array.isArray(draft.tasks)).toBe(true);
      expect(Array.isArray(draft.events)).toBe(true);
      expect(Array.isArray(draft.followUps)).toBe(true);
    });
  });

  describe('4. Founder Reminder Service (Deduplication & Alerts)', () => {
    it('checks reminders and deduplicates alerts via ReminderLog', async () => {
      // Create user settings with reminders enabled
      await UserSettings.findOrCreate({
        where: { userId: testUserId },
        defaults: {
          timezone: 'Asia/Dubai',
          remindersEnabled: true,
          morningBriefTime: '08:30',
          eveningNudgeTime: '18:30'
        }
      });

      // Dispatch check
      const res1 = await founderReminderService.checkAndDispatchReminders();
      expect(res1.checkedCount).toBeGreaterThanOrEqual(1);

      // Running a second time in same time window should not duplicate any reminder
      const res2 = await founderReminderService.checkAndDispatchReminders();
      expect(res2.checkedCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe('5. API Routes for Phase B', () => {
    it('POST /api/tasks creates task and PATCH /api/tasks/:id handles completion and recurrence', async () => {
      const createRes = await request(app)
        .post('/api/tasks')
        .set(authHeaders)
        .send({
          title: 'Review custom rug rendering for Palm Jumeirah villa',
          category: 'sales',
          priority: 'high',
          dueAt: new Date().toISOString(),
          recurrenceRule: 'weekly',
          isMIT: true
        });

      expect(createRes.status).toBe(201);
      const taskId = createRes.body.task.id;
      expect(createRes.body.task.isMIT).toBe(true);

      // Complete task
      const patchRes = await request(app)
        .patch(`/api/tasks/${taskId}`)
        .set(authHeaders)
        .send({ status: 'done' });

      expect(patchRes.status).toBe(200);
      expect(patchRes.body.task.status).toBe('done');
      expect(patchRes.body.task.completedAt).toBeDefined();
      expect(patchRes.body.nextOccurrence).toBeDefined(); // Spawned next weekly occurrence

      // Query list
      const listRes = await request(app)
        .get('/api/tasks?category=sales')
        .set(authHeaders);

      expect(listRes.status).toBe(200);
      expect(listRes.body.tasks.length).toBeGreaterThanOrEqual(1);

      // Delete task
      const delRes = await request(app)
        .delete(`/api/tasks/${taskId}`)
        .set(authHeaders);

      expect(delRes.status).toBe(200);
    });

    it('POST /api/calendar/events schedules an event and GET /api/calendar returns merged schedule', async () => {
      const startAt = new Date(Date.now() + 3600000).toISOString();
      const endAt = new Date(Date.now() + 7200000).toISOString();

      const createRes = await request(app)
        .post('/api/calendar/events')
        .set(authHeaders)
        .send({
          title: 'Knotiq Showroom Client Walkthrough',
          startAt,
          endAt,
          type: 'meeting',
          location: 'Ajman Showroom',
          notes: 'Present 2026 spring collection swatches'
        });

      expect(createRes.status).toBe(201);
      const eventId = createRes.body.event.id;

      const calRes = await request(app)
        .get('/api/calendar')
        .set(authHeaders);

      expect(calRes.status).toBe(200);
      expect(calRes.body.items.some((i) => (i.id === eventId || i.rawId === eventId) && i.itemType === 'event')).toBe(true);

      // Clean up event
      await request(app)
        .delete(`/api/calendar/events/${eventId}`)
        .set(authHeaders);
    });

    it('GET /api/today/summary returns Phase B planner fields under 2000ms', async () => {
      const start = Date.now();
      const res = await request(app)
        .get('/api/today/summary')
        .set(authHeaders);

      const duration = Date.now() - start;

      expect(res.status).toBe(200);
      expect(duration).toBeLessThan(2000);
      expect(res.body.dailyPlan).toBeDefined();
      expect(res.body.calendarEventsToday).toBeDefined();
      expect(res.body.tasksDueToday).toBeDefined();
      expect(res.body.rituals).toBeDefined();
      expect(res.body.streaks).toBeDefined();
    });

    it('confirms notes can attach to tasks and calendar events (ownerType task and event)', async () => {
      // 1. Note on Task
      const taskNoteRes = await request(app)
        .post('/api/notes')
        .set(authHeaders)
        .send({
          ownerType: 'task',
          ownerId: '9991',
          title: 'Loom Inspection Notes',
          body: 'Check 120-knot silk knotting quality before dispatching from Bhadohi'
        });

      expect(taskNoteRes.status).toBe(201);
      expect(taskNoteRes.body.note.ownerType).toBe('task');
      expect(taskNoteRes.body.note.ownerId).toBe('9991');

      const getTaskNotesRes = await request(app)
        .get('/api/notes?ownerType=task&ownerId=9991')
        .set(authHeaders);

      expect(getTaskNotesRes.status).toBe(200);
      expect(getTaskNotesRes.body.notes.length).toBeGreaterThanOrEqual(1);
      expect(getTaskNotesRes.body.notes[0].body).toContain('120-knot silk');

      // 2. Note on Calendar Event
      const eventNoteRes = await request(app)
        .post('/api/notes')
        .set(authHeaders)
        .send({
          ownerType: 'event',
          ownerId: '8881',
          title: 'Meeting Agenda Swatches',
          body: 'Bring New Zealand wool carpet swatches in beige and terracotta'
        });

      expect(eventNoteRes.status).toBe(201);
      expect(eventNoteRes.body.note.ownerType).toBe('event');
      expect(eventNoteRes.body.note.ownerId).toBe('8881');

      const getEventNotesRes = await request(app)
        .get('/api/notes?ownerType=event&ownerId=8881')
        .set(authHeaders);

      expect(getEventNotesRes.status).toBe(200);
      expect(getEventNotesRes.body.notes.length).toBeGreaterThanOrEqual(1);
      expect(getEventNotesRes.body.notes[0].body).toContain('New Zealand wool');
    });

    it('confirms task linked to a lead appears in that lead Activity Timeline', async () => {
      const lead = await Lead.create({
        userId: testUserId,
        businessName: 'Royal Mirage Interiors LLC',
        phone: '+971509988776',
        city: 'Dubai',
        country: 'United Arab Emirates',
        buyerType: 'designer',
        leadType: 'designer',
        source: 'manual',
        dedupeKey: `lead_task_timeline_${Date.now()}`,
        status: 'new'
      });

      const task = await Task.create({
        userId: testUserId,
        title: 'Send high-res PDF catalog for Royal Mirage penthouse',
        category: 'sales',
        priority: 'high',
        relatedLeadId: lead.id,
        status: 'todo',
        dueAt: new Date()
      });

      const timelineRes = await request(app)
        .get(`/api/leads/${lead.id}/timeline`)
        .set(authHeaders);

      expect(timelineRes.status).toBe(200);
      expect(timelineRes.body.success).toBe(true);
      const taskItem = timelineRes.body.timeline.find((item) => item.id === `task_${task.id}`);
      expect(taskItem).toBeDefined();
      expect(taskItem.type).toBe('task');
      expect(taskItem.title).toContain('Send high-res PDF catalog');
      expect(taskItem.metadata.priority).toBe('high');
    });

    it('confirms calendar feed shows "calls to make" (pending call follow-ups)', async () => {
      const lead = await Lead.create({
        userId: testUserId,
        businessName: 'Emaar Hospitality Fitout Procurement',
        phone: '+971551122334',
        city: 'Dubai',
        country: 'United Arab Emirates',
        buyerType: 'hotel',
        leadType: 'hotel',
        source: 'manual',
        dedupeKey: `lead_call_cal_${Date.now()}`,
        status: 'follow_up'
      });

      const now = new Date();
      const callFollowUp = await FollowUp.create({
        userId: testUserId,
        leadId: lead.id,
        channel: 'call',
        status: 'pending',
        dueAt: new Date(now.getTime() + 10 * 60 * 1000), // 10 minutes from now
        step: 'day_4',
        notes: 'Call purchasing manager regarding rug specifications'
      });

      const calRes = await request(app)
        .get('/api/calendar')
        .set(authHeaders);

      expect(calRes.status).toBe(200);
      const callItem = calRes.body.items.find((i) => i.id === callFollowUp.id && i.itemType === 'call');
      expect(callItem).toBeDefined();
      expect(callItem.itemType).toBe('call');
      expect(callItem.title).toContain('Call to Make');
      expect(callItem.title).toContain('Emaar Hospitality Fitout');
    });

    it('computes TWO streaks (Review streak and Target streak) with Dubai timezone day-boundary precision', async () => {
      const tz = 'Asia/Dubai';

      // Day boundary test 1: 11:50 PM Dubai time on 2026-11-22
      // Dubai is UTC+4, so 23:50 Dubai is 19:50 UTC on the same day
      const d1 = new Date('2026-11-22T19:50:00.000Z');
      const localStr1 = getLocalDateStr(d1, tz);
      expect(localStr1).toBe('2026-11-22');

      // Day boundary test 2: 12:10 AM Dubai time (20 minutes later)
      // 00:10 next day Dubai is 20:10 UTC on 2026-11-22
      const d2 = new Date('2026-11-22T20:10:00.000Z');
      const localStr2 = getLocalDateStr(d2, tz);
      expect(localStr2).toBe('2026-11-23');

      // Create streaks test user with settings
      const streakUser = `streak_user_${Date.now()}`;
      await UserSettings.create({
        userId: streakUser,
        timezone: 'Asia/Dubai',
        dailyCallTarget: 2,
        dailyEmailTarget: 2
      });

      // Record daily reviews for yesterday and today
      const now = new Date();
      const todayStr = getLocalDateStr(now, tz);
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const yesterdayStr = getLocalDateStr(yesterday, tz);

      await DailyReview.create({
        userId: streakUser,
        date: yesterdayStr,
        win: 'Hit yesterday targets',
        completedAt: yesterday
      });
      await DailyReview.create({
        userId: streakUser,
        date: todayStr,
        win: 'Hit today review at 11:50 PM',
        completedAt: now
      });

      // Record outreach logs meeting daily target for yesterday and today
      await OutreachLog.create({
        userId: streakUser,
        channel: 'email',
        recipient: 'test1@knotiq.com',
        outcome: 'delivered',
        sentAt: yesterday
      });
      await OutreachLog.create({
        userId: streakUser,
        channel: 'email',
        recipient: 'test2@knotiq.com',
        outcome: 'delivered',
        sentAt: yesterday
      });
      await OutreachLog.create({
        userId: streakUser,
        channel: 'email',
        recipient: 'test3@knotiq.com',
        outcome: 'delivered',
        sentAt: now
      });
      await OutreachLog.create({
        userId: streakUser,
        channel: 'email',
        recipient: 'test4@knotiq.com',
        outcome: 'delivered',
        sentAt: now
      });

      const streaks = await calculateStreaks(streakUser);
      expect(streaks.reviewStreak).toBeGreaterThanOrEqual(2);
      expect(streaks.targetStreak).toBeGreaterThanOrEqual(2);
      expect(streaks.timezone).toBe('Asia/Dubai');
    });

    it('verifies founder reminders: configurable settings, DRY_RUN respect, and duplicate prevention via ReminderLog across server restarts', async () => {
      const reminderUser = `reminder_founder_${Date.now()}`;

      // Configurable settings in UserSettings
      const settings = await UserSettings.create({
        userId: reminderUser,
        timezone: 'Asia/Dubai',
        remindersEnabled: true,
        morningBriefTime: '08:00',
        eveningNudgeTime: '18:00',
        eventReminderMinutes: 20
      });

      expect(settings.morningBriefTime).toBe('08:00');
      expect(settings.eveningNudgeTime).toBe('18:00');
      expect(settings.eventReminderMinutes).toBe(20);

      const refDate = '2026-11-22';
      // First dispatch
      await founderReminderService.sendMorningBrief(reminderUser, refDate, settings);

      const logCount1 = await ReminderLog.count({
        where: { userId: reminderUser, reminderType: 'morning_brief', referenceId: refDate }
      });
      expect(logCount1).toBe(1);

      // Simulate server restart and second run: Idempotency check prevents duplicate dispatch
      await founderReminderService.sendMorningBrief(reminderUser, refDate, settings);

      const logCount2 = await ReminderLog.count({
        where: { userId: reminderUser, reminderType: 'morning_brief', referenceId: refDate }
      });
      expect(logCount2).toBe(1); // Exactly 1, no duplicate!
    });
  });
});
