const request = require('supertest');
const app = require('../src/api/server');
const Lead = require('../src/models/Lead');
const Schedule = require('../src/models/Schedule');
const OptOut = require('../src/models/OptOut');
const notifier = require('../src/services/notifications/notifier');
const outreachHelper = require('../src/services/outreach/outreachHelper');
const schedulerEngine = require('../src/services/scheduler/schedulerEngine');
const scraperManager = require('../src/scrapers/ScraperManager');

describe('Phase 7 - Scheduler, Notifications & Outreach Helper', () => {
  const testUserId = 'test_phase7_user';
  let runScraperSpy;

  beforeAll(async () => {
    await Lead.destroy({ where: { userId: testUserId } });
    await Schedule.destroy({ where: { userId: testUserId } });

    runScraperSpy = vi.spyOn(scraperManager, 'runScraper').mockResolvedValue({
      runId: 101,
      platform: 'overpass',
      status: 'completed',
      foundCount: 5,
      newCount: 3,
      duplicateCount: 2,
      durationMs: 120
    });
  });

  afterAll(() => {
    schedulerEngine.stop();
    if (runScraperSpy) runScraperSpy.mockRestore();
  });

  describe('Notification Service (Telegram & SMTP)', () => {
    it('gracefully handles unconfigured Telegram and SMTP without throwing', async () => {
      const tgRes = await notifier.sendTelegramAlert('Test alert');
      expect(tgRes.sent).toBe(false);
      expect(tgRes.reason).toBe('unconfigured');

      const originalTransporter = notifier.mailTransporter;
      notifier.mailTransporter = null;
      try {
        const mailRes = await notifier.sendEmailDigest({
          to: 'buyer@interiors.ae',
          subject: 'Digest',
          html: '<p>Digest</p>'
        });
        expect(mailRes.sent).toBe(false);
        expect(mailRes.reason).toBe('unconfigured');
      } finally {
        notifier.mailTransporter = originalTransporter;
      }
    });

    it('formats scraper run summary for Telegram and email dispatch', async () => {
      const sampleRun = {
        city: 'Dubai',
        country: 'UAE',
        leadType: 'rug_retailer',
        platform: 'overpass',
        foundCount: 15,
        newCount: 8,
        duplicateCount: 7,
        durationMs: 4200
      };

      const notifyRes = await notifier.notifyScraperRunCompleted(sampleRun, {
        topLead: { businessName: 'Emirates Silk Carpets', score: 90 }
      });

      expect(notifyRes).toBeDefined();
      expect(notifyRes.telegram).toBeDefined();
      expect(notifyRes.email).toBeDefined();
    });
  });

  describe('Outreach Helper & Daily Send Caps', () => {
    let sampleLead;

    beforeAll(async () => {
      sampleLead = await Lead.create({
        userId: testUserId,
        businessName: 'Al Wasl Interior Studio',
        leadType: 'interior_designer',
        country: 'UAE',
        city: 'Dubai',
        phone: '+97143391234',
        email: 'procurement@alwaslstudio.ae',
        domain: 'alwaslstudio.ae',
        score: 80,
        source: 'manual',
        dedupeKey: 'dom_alwaslstudio.ae'
      });
    });

    it('generates customized cold email draft with variable replacement', async () => {
      const draft = await outreachHelper.generateOutreach({
        userId: testUserId,
        leadId: sampleLead.id,
        channel: 'email'
      });

      expect(draft.subject).toContain(sampleLead.businessName);
      expect(draft.body).toContain(sampleLead.businessName);
      expect(draft.body).toContain('Knotiq Rugs');
      expect(draft.recipient).toBe(sampleLead.email);
    });

    it('generates WhatsApp outreach text with phone recipient', async () => {
      const draft = await outreachHelper.generateOutreach({
        userId: testUserId,
        leadId: sampleLead.id,
        channel: 'whatsapp'
      });

      expect(draft.channel).toBe('whatsapp');
      expect(draft.body).toContain('Knotiq Rugs');
      expect(draft.recipient).toBe(sampleLead.phone);
    });

    it('enforces daily outreach send cap', async () => {
      const tempCap = outreachHelper.dailyCap;
      outreachHelper.dailyCap = 2; // set temporary low cap for testing

      // Reset count for test
      const key = outreachHelper.getTodayKey(testUserId);
      outreachHelper.incrementDailyCount(testUserId);
      outreachHelper.incrementDailyCount(testUserId);

      await expect(
        outreachHelper.generateOutreach({
          userId: testUserId,
          leadId: sampleLead.id,
          channel: 'email'
        })
      ).rejects.toThrow(/Daily outreach limit reached/);

      // Restore daily cap
      outreachHelper.dailyCap = tempCap;
    });

    it('blocks outreach if recipient or company is on OptOut suppression list', async () => {
      await OptOut.findOrCreate({
        where: { type: 'domain', value: 'alwaslstudio.ae' },
        defaults: { reason: 'Test OptOut' }
      });

      await expect(
        outreachHelper.generateOutreach({
          userId: testUserId,
          leadId: sampleLead.id,
          channel: 'email'
        })
      ).rejects.toThrow(/OptOut suppression list/);

      // Clean up opt-out
      await OptOut.destroy({ where: { value: 'alwaslstudio.ae' } });
    });

    it('records sent outreach and updates lead status to contacted', async () => {
      const res = await outreachHelper.recordOutreachSent(testUserId, sampleLead.id, 'email');
      expect(res.success).toBe(true);

      const updatedLead = await Lead.findByPk(sampleLead.id);
      expect(updatedLead.status).toBe('contacted');
      expect(updatedLead.lastContactedAt).toBeDefined();
    });
  });

  describe('Scheduler Engine & Concurrency Locks', () => {
    let testSchedule;

    beforeAll(async () => {
      testSchedule = await Schedule.create({
        userId: testUserId,
        name: 'Daily Dubai Rugs Run',
        cronExpression: '0 9 * * *',
        country: 'UAE',
        city: 'Dubai',
        leadTypes: ['rug_retailer'],
        enabled: true
      });
    });

    it('registers valid cron expressions and rejects invalid ones safely', () => {
      schedulerEngine.registerCronJob(testSchedule);
      expect(schedulerEngine.cronTasks.has(testSchedule.id)).toBe(true);

      const invalidSchedule = { id: 9999, name: 'Bad Cron', cronExpression: 'invalid-cron' };
      schedulerEngine.registerCronJob(invalidSchedule);
      expect(schedulerEngine.cronTasks.has(9999)).toBe(false);
    });

    it('prevents overlapping runs using active run locks', async () => {
      schedulerEngine.activeRunLocks.add(testSchedule.id);

      // Attempting execution while locked should return undefined and log warning without executing
      const res = await schedulerEngine.executeSchedule(testSchedule);
      expect(res).toBeUndefined();

      schedulerEngine.activeRunLocks.delete(testSchedule.id);
    });

    it('executes schedule, updates status in DB, and dispatches notification', async () => {
      const res = await schedulerEngine.executeSchedule(testSchedule);
      expect(res).toBeDefined();

      const updated = await Schedule.findByPk(testSchedule.id);
      expect(updated.lastRunAt).toBeDefined();
      expect(updated.lastStatus).toBe('completed');
    });
  });

  describe('Outreach & Schedules REST API Endpoints', () => {
    let lead;
    let schedule;

    beforeAll(async () => {
      lead = await Lead.create({
        userId: testUserId,
        businessName: 'Marina Design Emporium',
        country: 'UAE',
        city: 'Dubai',
        leadType: 'interior_designer',
        phone: '+97143399999',
        email: 'contact@marinadesign.ae',
        source: 'manual',
        dedupeKey: 'dom_marinadesign.ae'
      });

      schedule = await Schedule.create({
        userId: testUserId,
        name: 'Weekly Marina Scrape',
        cronExpression: '0 10 * * 1',
        country: 'UAE',
        city: 'Dubai',
        enabled: true
      });
    });

    it('GET /api/outreach/stats - returns daily outreach metrics', async () => {
      const res = await request(app)
        .get('/api/outreach/stats')
        .set('x-test-user-id', testUserId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.dailyCap).toBeDefined();
    });

    it('POST /api/outreach/draft - generates customized draft via API', async () => {
      const res = await request(app)
        .post('/api/outreach/draft')
        .set('x-test-user-id', testUserId)
        .send({
          leadId: lead.id,
          channel: 'email'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.draft.subject).toContain(lead.businessName);
    });

    it('POST /api/outreach/record-sent - records sent message and updates lead status', async () => {
      const res = await request(app)
        .post('/api/outreach/record-sent')
        .set('x-test-user-id', testUserId)
        .send({
          leadId: lead.id,
          channel: 'email'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedLead = await Lead.findByPk(lead.id);
      expect(updatedLead.status).toBe('contacted');
    });

    it('POST /api/schedules/:id/run-now - executes schedule on demand', async () => {
      const res = await request(app)
        .post(`/api/schedules/${schedule.id}/run-now`)
        .set('x-test-user-id', testUserId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.result).toBeDefined();
    });
  });
});
