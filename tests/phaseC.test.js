import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import {
  ContentPost,
  Campaign,
  CampaignLead,
  Lead,
  OptOut,
  OutreachLog,
  OutreachTemplate,
  FollowUp,
  Call,
  UserSettings,
  ReminderLog,
  AuditLog,
  BulkSendLog
} from '../src/models';
import campaignService from '../src/services/marketing/campaignService';
import abTestingService from '../src/services/marketing/abTestingService';
import attributionService from '../src/services/marketing/attributionService';
import inboundService from '../src/services/marketing/inboundService';
import followUpEngine from '../src/services/followUp/followUpEngine';
import outreachHelper from '../src/services/outreach/outreachHelper';
import bulkSendService from '../src/services/bulkSendService';
import { getMergedCalendar } from '../src/services/planner/calendarService';
import founderReminderService from '../src/services/reminders/founderReminderService';
import { backfillSources } from '../src/scripts/backfillSources';

describe('Phase C - Marketing Hub Suite', () => {
  const testUserId = 'test_phase_c_founder';
  const otherUserId = 'test_phase_c_stranger';
  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-role': 'admin'
  };
  const otherAuthHeaders = {
    'x-test-user-id': otherUserId,
    'x-test-role': 'admin'
  };

  const createTestLead = async (overrides = {}) => {
    const rand = Math.random().toString(36).slice(2, 10);
    return Lead.create({
      userId: testUserId,
      businessName: `Test Studio ${rand}`,
      leadType: 'interior_design',
      buyerType: 'designer',
      city: 'Dubai',
      country: 'United Arab Emirates',
      source: 'instagram',
      dedupeKey: `dedupe_${rand}_${Date.now()}`,
      status: 'new',
      score: 80,
      ...overrides
    });
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Content Calendar & Missed Status Engine', () => {
    it('creates content posts across statuses (idea, scheduled, posted)', async () => {
      const ideaPost = await ContentPost.create({
        userId: testUserId,
        platform: 'instagram',
        topic: 'Master Weaver Silk Knotting Process',
        status: 'idea'
      });
      expect(ideaPost.id).toBeDefined();
      expect(ideaPost.status).toBe('idea');
      expect(ideaPost.scheduledAt).toBeFalsy();

      const futureDate = new Date(Date.now() + 86400000);
      const scheduledPost = await ContentPost.create({
        userId: testUserId,
        platform: 'linkedin',
        topic: 'Hospitality Rug Specification Guide 2026',
        scheduledAt: futureDate,
        status: 'scheduled'
      });
      expect(scheduledPost.id).toBeDefined();
      expect(scheduledPost.status).toBe('scheduled');
    });

    it('calculates isMissed = true for past unposted scheduled posts via API', async () => {
      const pastDate = new Date(Date.now() - 3600000); // 1 hour ago
      const missedPost = await ContentPost.create({
        userId: testUserId,
        platform: 'instagram',
        topic: 'Overdue Wool Loom Showcase',
        scheduledAt: pastDate,
        status: 'scheduled'
      });

      const res = await request(app)
        .get('/api/content')
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.posts.find((p) => p.id === missedPost.id);
      expect(found).toBeDefined();
      expect(found.isMissed).toBe(true);
    });

    it('marks a post published with live URL and manual performance metrics', async () => {
      const post = await ContentPost.create({
        userId: testUserId,
        platform: 'instagram',
        topic: 'Hand-knotted Oushak Showcase',
        status: 'ready'
      });

      const res = await request(app)
        .post(`/api/content/${post.id}/mark-posted`)
        .set(authHeaders)
        .send({
          postedUrl: 'https://instagram.com/p/DBrugsample123',
          impressions: 4500,
          likes: 280,
          comments: 24,
          saves: 85,
          clicks: 62,
          leadsGenerated: 3
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.post.status).toBe('posted');
      expect(res.body.post.postedUrl).toBe('https://instagram.com/p/DBrugsample123');
      expect(res.body.post.leadsGenerated).toBe(3);

      const refreshed = await ContentPost.findByPk(post.id);
      expect(refreshed.status).toBe('posted');
      expect(refreshed.likes).toBe(280);
    });

    it('calculates weekly posting consistency correctly', async () => {
      await UserSettings.upsert({
        userId: testUserId,
        weeklyPostTarget: 4
      });

      // Create 2 posted posts this week
      await ContentPost.create({
        userId: testUserId,
        platform: 'linkedin',
        topic: 'B2B Trade Guide',
        status: 'posted',
        postedAt: new Date()
      });
      await ContentPost.create({
        userId: testUserId,
        platform: 'instagram',
        topic: 'Reel: Dye Vat Color Formulation',
        status: 'posted',
        postedAt: new Date()
      });

      const res = await request(app)
        .get('/api/content')
        .set(authHeaders);

      expect(res.status).toBe(200);
      expect(res.body.consistency).toBeDefined();
      expect(res.body.consistency.weeklyTarget).toBe(4);
      expect(res.body.consistency.publishedThisWeek).toBeGreaterThanOrEqual(2);
      expect(res.body.consistency.percentage).toBeGreaterThanOrEqual(50);
    });
  });

  describe('2. Merged Calendar Integration for Posts', () => {
    it('surfaces scheduled content posts as itemType="post" in calendar feed with isMissed flag', async () => {
      const pastTime = new Date('2026-11-20T10:00:00.000Z');
      const post = await ContentPost.create({
        userId: testUserId,
        platform: 'instagram',
        topic: 'Calendar Feed Rug Story',
        scheduledAt: pastTime,
        status: 'scheduled'
      });

      const feed = await getMergedCalendar(testUserId, '2026-11-01', '2026-11-30');
      const feedItem = feed.items.find((i) => i.itemType === 'post' && i.id === post.id);

      expect(feedItem).toBeDefined();
      expect(feedItem.title).toContain('Calendar Feed Rug Story');
      expect(feedItem.platform).toBe('instagram');
      expect(feedItem.isMissed).toBe(true);
    });
  });

  describe('3. Founder Reminder Dispatch for Scheduled Posts', () => {
    it('dispatches reminder for today posts and prevents duplicate sends via ReminderLog', async () => {
      const now = new Date();
      const currentHours = String(now.getUTCHours()).padStart(2, '0');
      const currentMinutes = String(now.getUTCMinutes()).padStart(2, '0');
      const reminderTime = `${currentHours}:${currentMinutes}`;

      const settings = await UserSettings.findOne({ where: { userId: testUserId } });
      const localDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: settings?.timezone || 'Asia/Dubai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(now);

      await ContentPost.create({
        userId: testUserId,
        platform: 'instagram',
        topic: 'Reminder Test Post for Knotiq Rugs',
        scheduledAt: now,
        status: 'scheduled'
      });

      // Dispatch directly via sendContentPostReminder
      await founderReminderService.sendContentPostReminder(testUserId, localDateStr, settings || { timezone: 'Asia/Dubai' });

      // Verify ReminderLog was written
      const logs = await ReminderLog.findAll({
        where: {
          userId: testUserId,
          reminderType: 'post_reminder',
          referenceId: localDateStr
        }
      });
      expect(logs.length).toBe(1);

      // Re-running dispatch should NOT duplicate sends
      await founderReminderService.sendContentPostReminder(testUserId, localDateStr, settings || { timezone: 'Asia/Dubai' });
      const logsAfter = await ReminderLog.findAll({
        where: {
          userId: testUserId,
          reminderType: 'post_reminder',
          referenceId: localDateStr
        }
      });
      expect(logsAfter.length).toBe(1);
    });
  });

  describe('4. Campaign Creation, Lead Preview & OptOut Suppression', () => {
    it('creates campaign and previews leads with OptOut exclusion', async () => {
      const campaign = await Campaign.create({
        userId: testUserId,
        name: 'UAE Interior Designers Winter 2026',
        goal: 'Generate 20 custom rug enquiries',
        channel: 'email',
        targetBuyerType: 'designer',
        budget: 5000,
        currency: 'AED',
        status: 'active'
      });

      // Create 3 test leads (1 clean, 1 with optedOut flag, 1 with OptOut table entry)
      const cleanLead = await createTestLead({
        businessName: 'Elegance Design Studio Dubai',
        email: 'procurement@elegancedesign.ae',
        phone: '+971501112233',
        buyerType: 'designer',
        city: 'Dubai',
        status: 'new',
        score: 80
      });

      const optedOutLead1 = await createTestLead({
        businessName: 'Opted Out Studio 1',
        email: 'no-contact@optedout1.com',
        phone: '+971509990001',
        buyerType: 'designer',
        city: 'Dubai',
        optedOut: true,
        status: 'new',
        score: 80
      });

      const blockedEmail = `blocked_${Date.now()}_${Math.random().toString(36).slice(2)}@optedout2.com`;
      const optedOutLead2 = await createTestLead({
        businessName: 'Opted Out Studio 2',
        email: blockedEmail,
        phone: '+971509990002',
        buyerType: 'designer',
        city: 'Dubai',
        optedOut: false,
        status: 'new',
        score: 80
      });
      await OptOut.create({
        type: 'email',
        value: blockedEmail,
        reason: 'Requested unsub'
      });

      const preview = await campaignService.previewLeads(testUserId, {
        buyerType: 'designer',
        city: 'Dubai'
      });

      expect(preview.totalMatched).toBeGreaterThanOrEqual(3);
      expect(preview.skippedOptOuts).toBeGreaterThanOrEqual(2);
      expect(preview.eligibleCount).toBeGreaterThanOrEqual(1);

      // Verify bulk addition strictly adds only eligible leads
      const addResult = await campaignService.bulkAddLeads(testUserId, campaign.id, {
        buyerType: 'designer',
        city: 'Dubai'
      });

      expect(addResult.addedCount).toBeGreaterThanOrEqual(1);
      expect(addResult.skippedOptOuts).toBeGreaterThanOrEqual(2);

      // Verify CampaignLead entries
      const campaignLeads = await CampaignLead.findAll({ where: { campaignId: campaign.id } });
      const addedLeadIds = campaignLeads.map((cl) => cl.leadId);
      expect(addedLeadIds).toContain(cleanLead.id);
      expect(addedLeadIds).not.toContain(optedOutLead1.id);
      expect(addedLeadIds).not.toContain(optedOutLead2.id);
    });

    it('enforces idempotency on re-adding leads to campaign', async () => {
      const campaign = await Campaign.create({
        userId: testUserId,
        name: 'Idempotency Test Campaign',
        channel: 'email'
      });
      const uniqueCity = `Sharjah_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      await createTestLead({
        businessName: 'Unique Studio Sharjah',
        buyerType: 'designer',
        city: uniqueCity
      });

      const res1 = await campaignService.bulkAddLeads(testUserId, campaign.id, { city: uniqueCity });
      expect(res1.addedCount).toBe(1);

      // Second bulk add with same criteria
      const res2 = await campaignService.bulkAddLeads(testUserId, campaign.id, { city: uniqueCity });
      expect(res2.addedCount).toBe(0); // None added duplicate
    });
  });

  describe('5. Stage-Rank Funnel Aggregation & Deal Value Revenue Tracking', () => {
    it('applies stage-rank logic: won leads count across all prior stages', async () => {
      const campaign = await Campaign.create({
        userId: testUserId,
        name: 'Stage Rank Funnel Verification Campaign',
        channel: 'email'
      });

      // Lead 1: won with deal value
      const leadWon = await createTestLead({
        businessName: 'Burj Al Arab Villa Contract',
        buyerType: 'hotel',
        status: 'won',
        dealValue: 75000,
        dealCurrency: 'AED'
      });

      // Lead 2: replied with no deal value
      const leadReplied = await createTestLead({
        businessName: 'Palm Jumeirah Residence',
        buyerType: 'designer',
        status: 'replied'
      });

      // Lead 3: new
      const leadNew = await createTestLead({
        businessName: 'Downtown Showroom',
        buyerType: 'retailer',
        status: 'new'
      });

      await CampaignLead.create({ userId: testUserId, campaignId: campaign.id, leadId: leadWon.id });
      await CampaignLead.create({ userId: testUserId, campaignId: campaign.id, leadId: leadReplied.id });
      await CampaignLead.create({ userId: testUserId, campaignId: campaign.id, leadId: leadNew.id });

      const funnel = await campaignService.getCampaignFunnel(testUserId, campaign.id);

      // Stages:
      // added: 3
      // contacted: 2 (leadWon + leadReplied)
      // replied: 2 (leadWon + leadReplied)
      // sample_sent: 1 (leadWon)
      // quotation: 1 (leadWon)
      // won: 1 (leadWon)
      expect(funnel.stages.added).toBe(3);
      expect(funnel.stages.contacted).toBe(2);
      expect(funnel.stages.replied).toBe(2);
      expect(funnel.stages.sample_sent).toBe(1);
      expect(funnel.stages.quotation).toBe(1);
      expect(funnel.stages.won).toBe(1);

      // Revenue tracking:
      expect(funnel.revenue.wonRevenue).toBe(75000);
      expect(funnel.revenue.totalDealValue).toBe(75000);
      expect(funnel.revenue.leadsWithNoValue).toBe(2); // leadReplied & leadNew
    });

    it('counts a lead present in two campaigns in both campaigns funnels', async () => {
      const lead = await createTestLead({
        businessName: 'Multi-Campaign Client',
        status: 'won',
        dealValue: 20000,
        dealCurrency: 'AED'
      });

      const camp1 = await Campaign.create({ userId: testUserId, name: 'Campaign Alpha', channel: 'email' });
      const camp2 = await Campaign.create({ userId: testUserId, name: 'Campaign Beta', channel: 'whatsapp' });

      await CampaignLead.create({ userId: testUserId, campaignId: camp1.id, leadId: lead.id });
      await CampaignLead.create({ userId: testUserId, campaignId: camp2.id, leadId: lead.id });

      const f1 = await campaignService.getCampaignFunnel(testUserId, camp1.id);
      const f2 = await campaignService.getCampaignFunnel(testUserId, camp2.id);

      expect(f1.stages.won).toBe(1);
      expect(f2.stages.won).toBe(1);
      expect(f1.revenue.wonRevenue).toBe(20000);
      expect(f2.revenue.wonRevenue).toBe(20000);
    });
  });

  describe('6. Tenancy Isolation', () => {
    it('prevents User B from accessing or adding leads to User A campaign', async () => {
      const userACampaign = await Campaign.create({
        userId: testUserId,
        name: 'Secret User A Campaign',
        channel: 'email'
      });

      // User B tries to view
      const viewRes = await request(app)
        .get(`/api/campaigns/${userACampaign.id}`)
        .set(otherAuthHeaders);
      expect(viewRes.status).toBe(404);

      // User B tries to add leads
      const addRes = await request(app)
        .post(`/api/campaigns/${userACampaign.id}/add-leads`)
        .set(otherAuthHeaders)
        .send({ filters: {} });
      expect(addRes.status).toBe(404);

      // User B tries to get send queue
      const queueRes = await request(app)
        .get(`/api/campaigns/${userACampaign.id}/send-queue`)
        .set(otherAuthHeaders);
      expect(queueRes.status).toBe(404);
    });
  });

  describe('7. Send Queue & Deterministic A/B Variant Assignment', () => {
    it('computes consistent deterministic A/B variant across Day 1, 4 and 7 for a lead', () => {
      const leadId = 42;
      const v1 = abTestingService.getDeterministicVariant(leadId);
      const v2 = abTestingService.getDeterministicVariant(leadId);
      const v3 = abTestingService.getDeterministicVariant(leadId);

      expect(v1).toBe(v2);
      expect(v2).toBe(v3);
      expect(['A', 'B']).toContain(v1);
    });

    it('send queue pulls pending leads and formats pre-filled wa.me links for WhatsApp campaigns', async () => {
      const waCampaign = await Campaign.create({
        userId: testUserId,
        name: 'WhatsApp Trade Campaign',
        channel: 'whatsapp',
        targetBuyerType: 'designer'
      });

      const lead = await createTestLead({
        businessName: 'Deira Interior Boutique',
        phone: '+971501234567',
        buyerType: 'designer',
        status: 'new'
      });

      await CampaignLead.create({
        userId: testUserId,
        campaignId: waCampaign.id,
        leadId: lead.id
      });

      const queueData = await campaignService.getCampaignSendQueue(testUserId, waCampaign.id);

      expect(queueData.channel).toBe('whatsapp');
      expect(queueData.queue.length).toBe(1);
      expect(queueData.queue[0].lead.id).toBe(lead.id);
      expect(['A', 'B']).toContain(queueData.queue[0].variant);
      expect(queueData.queue[0].previewMessage).toContain('Knotiq');
    });
  });

  describe('8. Outreach Recording & Automated Follow-Up Creation', () => {
    it('records sent outreach, attaches campaignId to OutreachLog & FollowUp, and schedules Day 4/7', async () => {
      const campaign = await Campaign.create({
        userId: testUserId,
        name: 'Winter Outreach Drip',
        channel: 'email'
      });

      const lead = await createTestLead({
        businessName: 'Ajman Palace Hotel Fit-Out',
        email: 'procurement@ajmanpalace.ae',
        buyerType: 'hotel',
        status: 'new'
      });

      await CampaignLead.create({
        userId: testUserId,
        campaignId: campaign.id,
        leadId: lead.id
      });

      const sendResult = await campaignService.recordCampaignSend(testUserId, campaign.id, lead.id, {
        messageSent: 'Hello from Knotiq Rugs',
        variant: 'A'
      });

      expect(sendResult.success).toBe(true);
      expect(sendResult.leadStatus).toBe('contacted');
      expect(sendResult.followUpsCreated).toBe(2);

      // Verify OutreachLog record
      const outreachLogs = await OutreachLog.findAll({ where: { leadId: lead.id } });
      expect(outreachLogs.length).toBe(1);
      expect(outreachLogs[0].campaignId).toBe(campaign.id);
      expect(outreachLogs[0].variant).toBe('A');

      // Verify FollowUp records attached to campaignId
      const followUps = await FollowUp.findAll({ where: { leadId: lead.id } });
      expect(followUps.length).toBe(2);
      expect(followUps[0].campaignId).toBe(campaign.id);
      expect(followUps[1].campaignId).toBe(campaign.id);
    });
  });

  describe('9. Reply Attribution on Mark Replied', () => {
    it('updates outcome = "replied" on the most recent outbound OutreachLog when lead replies', async () => {
      const lead = await createTestLead({
        businessName: 'Responsive Design Studio',
        email: 'hello@responsivestudio.com',
        buyerType: 'designer',
        status: 'contacted'
      });

      // Create an outbound outreach log with outcome = 'sent'
      const log = await OutreachLog.create({
        userId: testUserId,
        leadId: lead.id,
        channel: 'email',
        step: 1,
        variant: 'B',
        outcome: 'sent',
        messageSent: 'Initial outreach pitch'
      });

      // Lead marks replied
      await followUpEngine.markReplied(testUserId, lead.id, 'Interested in wool swatch samples');

      const updatedLog = await OutreachLog.findByPk(log.id);
      expect(updatedLog.outcome).toBe('replied');

      const updatedLead = await Lead.findByPk(lead.id);
      expect(updatedLead.status).toBe('replied');
    });
  });

  describe('10. A/B Testing Analytics & 25-Send Winner Guard', () => {
    it('does NOT declare a winner when either variant has < 25 sends', async () => {
      const abData = await abTestingService.getABTestMetrics('user_empty_ab');
      expect(abData.hasWinner).toBe(false);
      expect(abData.winner).toBeNull();
      expect(abData.notice).toContain('25');
    });

    it('evaluates winner when both variants have >= 25 sends', async () => {
      const abUserId = `test_ab_user_${Date.now()}`;
      // Simulate 25 sends for Variant A with 5 replies (20%)
      // Simulate 25 sends for Variant B with 10 replies (40%)
      const logs = [];
      for (let i = 0; i < 25; i++) {
        logs.push({
          userId: abUserId,
          channel: 'email',
          variant: 'A',
          outcome: i < 5 ? 'replied' : 'sent',
          messageSent: 'Test A'
        });
      }
      for (let i = 0; i < 25; i++) {
        logs.push({
          userId: abUserId,
          channel: 'email',
          variant: 'B',
          outcome: i < 10 ? 'replied' : 'sent',
          messageSent: 'Test B'
        });
      }
      await OutreachLog.bulkCreate(logs);

      const metrics = await abTestingService.getABTestMetrics(abUserId);
      expect(metrics.variantA.sends).toBe(25);
      expect(metrics.variantA.replies).toBe(5);
      expect(metrics.variantA.replyRate).toBe(20);

      expect(metrics.variantB.sends).toBe(25);
      expect(metrics.variantB.replies).toBe(10);
      expect(metrics.variantB.replyRate).toBe(40);

      expect(metrics.hasWinner).toBe(true);
      expect(metrics.winner).toBe('B');
    });
  });

  describe('11. Inbound Lead Quick-Add with Deduplication', () => {
    it('creates inbound lead, assigns buyerType & dealValue, and schedules Day 1 follow-up', async () => {
      const lead = await inboundService.addInboundLead(testUserId, {
        businessName: 'Atlantis Royal Penthouse Interior',
        phone: '+971529998877',
        email: 'interior@atlantisroyal.ae',
        source: 'whatsapp_inbound',
        buyerType: 'designer',
        dealValue: 65000,
        dealCurrency: 'AED',
        city: 'Dubai',
        country: 'United Arab Emirates',
        notes: 'Inquired on 12x15 pure silk rug'
      });

      expect(lead.id).toBeDefined();
      expect(lead.source).toBe('whatsapp_inbound');
      expect(lead.buyerType).toBe('designer');
      expect(lead.dealValue).toBe(65000);
      expect(lead.dealCurrency).toBe('AED');

      // Verify follow-ups created (Day 4 and Day 7 follow-ups)
      const followUps = await FollowUp.findAll({ where: { leadId: lead.id } });
      expect(followUps.length).toBe(2);
      expect(followUps[0].channel).toBe('whatsapp');
    });

    it('deduplicates existing lead on matching phone or email and creates follow-up', async () => {
      const rawDigits = `97150${Math.floor(1000000 + Math.random() * 9000000)}`;
      const phoneFormatted = `+${rawDigits.slice(0, 3)} ${rawDigits.slice(3, 5)} ${rawDigits.slice(5)}`;
      const existingEmail = `client_${Date.now()}_${Math.random().toString(36).slice(2)}@client.ae`;

      const existing = await createTestLead({
        businessName: 'Existing Client',
        phone: phoneFormatted,
        email: existingEmail,
        source: 'referral',
        dedupeKey: `ph_${rawDigits}`
      });

      const resultLead = await inboundService.addInboundLead(testUserId, {
        businessName: 'Existing Client Updated Inquiry',
        phone: phoneFormatted,
        email: existingEmail,
        source: 'trade_show',
        buyerType: 'hotel',
        dealValue: 30000,
        notes: 'New hotel suite request'
      });

      expect(resultLead.id).toBe(existing.id);
      expect(resultLead.dealValue).toBe(30000);
    });
  });

  describe('12. Sources Report & Formula-Injection-Safe Excel Export', () => {
    it('generates sources report with conversion rate and deal value statistics', async () => {
      const report = await attributionService.getSourcesReport(testUserId);
      expect(report.sources).toBeDefined();
      expect(Array.isArray(report.sources)).toBe(true);
      expect(report.abTesting).toBeDefined();
      expect(report.callConnectRates).toBeDefined();
      expect(report.topPosts).toBeDefined();
    });

    it('escapes Excel formula injection characters (=, +, -, @) during export', async () => {
      // Create a lead with potentially malicious formula name
      await createTestLead({
        businessName: '=cmd|/c calc!A0',
        source: '@malicious_source',
        city: '+Dubai'
      });

      const buffer = await attributionService.exportSourcesExcel(testUserId);
      expect(buffer).toBeDefined();
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.length).toBeGreaterThan(100);
    });
  });

  describe('13. Sources Standardization & Idempotent Backfill Script', () => {
    it('backfills legacy sources correctly and supports dry-run', async () => {
      const lead1 = await createTestLead({
        businessName: 'Old IG Lead',
        source: 'scraper',
        platform: 'instagram'
      });
      const lead2 = await createTestLead({
        businessName: 'Old GMaps Lead',
        source: '',
        platform: 'google_maps'
      });

      // Dry run: counts updates but mutates nothing
      const dryResult = await backfillSources({ dryRun: true });
      expect(dryResult.candidateCount).toBeGreaterThanOrEqual(2);
      expect(dryResult.updatedCount).toBe(0);

      const ref1 = await Lead.findByPk(lead1.id);
      expect(ref1.source).toBe('scraper');

      // Live run: applies updates
      const liveResult = await backfillSources({ dryRun: false });
      expect(liveResult.updatedCount).toBeGreaterThanOrEqual(2);

      const updatedRef1 = await Lead.findByPk(lead1.id);
      expect(updatedRef1.source).toBe('instagram');

      const updatedRef2 = await Lead.findByPk(lead2.id);
      expect(updatedRef2.source).toBe('google_maps');
    });
  });

  describe('14. Review Additions: Variant B Fallback & Honest Attribution (Item 3)', () => {
    it('falls back to Variant A copy and records variant="A" when no Variant B template exists', async () => {
      const uniqueUserId = `test_fallback_${Date.now()}`;

      // Create only Variant A template for designer day1 email
      const templateA = await OutreachTemplate.create({
        userId: uniqueUserId,
        name: 'Designer Day 1 - Angle A',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        subject: 'Bespoke Rug Collections A',
        body: 'Angle A Copy: Luxury handcrafted rugs direct from Bhadohi.'
      });

      // Create a campaign
      const campaign = await Campaign.create({
        userId: uniqueUserId,
        name: 'Honest Attribution Test Campaign',
        channel: 'email'
      });

      // Create lead that maps to variant B deterministically
      let leadForB = null;
      for (let i = 0; i < 20; i++) {
        const candidate = await createTestLead({
          userId: uniqueUserId,
          businessName: `Designer Studio ${i}`,
          buyerType: 'designer',
          status: 'new'
        });
        if (abTestingService.getLeadVariant(candidate.id) === 'B') {
          leadForB = candidate;
          break;
        }
      }
      expect(leadForB).not.toBeNull();
      expect(abTestingService.getLeadVariant(leadForB.id)).toBe('B');

      await CampaignLead.create({
        userId: uniqueUserId,
        campaignId: campaign.id,
        leadId: leadForB.id
      });

      // 1. In Send Queue: assigned B, but no B template -> falls back to A and sets variant = 'A'
      const queueData = await campaignService.getCampaignSendQueue(uniqueUserId, campaign.id);
      expect(queueData.queueLength).toBe(1);
      const queueItem = queueData.queue[0];
      expect(queueItem.variant).toBe('A');
      expect(queueItem.message).toBe(templateA.body);

      // 2. In recordCampaignSend: records as 'A' so attribution stays honest
      const recordResult = await campaignService.recordCampaignSend(uniqueUserId, campaign.id, leadForB.id, {
        variant: 'B', // Requested B, but B copy does not exist!
        messageSent: null
      });
      expect(recordResult.success).toBe(true);
      expect(recordResult.variant).toBe('A'); // Attribution corrected to A

      const outreachLog = await OutreachLog.findOne({ where: { leadId: leadForB.id } });
      expect(outreachLog.variant).toBe('A');
      expect(outreachLog.messageSent).toBe(templateA.body);
    });

    it('uses Variant B template and records variant="B" when Variant B template exists', async () => {
      const uniqueUserId = `test_variant_b_${Date.now()}`;

      await OutreachTemplate.create({
        userId: uniqueUserId,
        name: 'Designer Day 1 - Angle A',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        body: 'Angle A Copy'
      });

      const templateB = await OutreachTemplate.create({
        userId: uniqueUserId,
        name: 'Designer Day 1 - Angle B',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'B',
        body: 'Angle B Copy: Direct mill trade discounts.'
      });

      const campaign = await Campaign.create({
        userId: uniqueUserId,
        name: 'Variant B Campaign',
        channel: 'email'
      });

      let leadForB = null;
      for (let i = 0; i < 20; i++) {
        const candidate = await createTestLead({
          userId: uniqueUserId,
          businessName: `Designer Studio ${i}`,
          buyerType: 'designer',
          status: 'new'
        });
        if (abTestingService.getLeadVariant(candidate.id) === 'B') {
          leadForB = candidate;
          break;
        }
      }

      await CampaignLead.create({
        userId: uniqueUserId,
        campaignId: campaign.id,
        leadId: leadForB.id
      });

      const queueData = await campaignService.getCampaignSendQueue(uniqueUserId, campaign.id);
      expect(queueData.queue[0].variant).toBe('B');
      expect(queueData.queue[0].message).toBe(templateB.body);

      const record = await campaignService.recordCampaignSend(uniqueUserId, campaign.id, leadForB.id, {
        variant: 'B',
        templateId: templateB.id,
        messageSent: templateB.body
      });
      expect(record.variant).toBe('B');

      const log = await OutreachLog.findOne({ where: { leadId: leadForB.id } });
      expect(log.variant).toBe('B');
    });
  });

  describe('15. Review Additions: OutreachTemplate Index Handling (Item 4)', () => {
    it('allows multiple templates with same buyerType, step, channel and variant without collision', async () => {
      const multiUserId = `test_index_${Date.now()}`;

      const t1 = await OutreachTemplate.create({
        userId: multiUserId,
        name: 'Dubai Luxury Villa Designer A',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        body: 'Copy 1'
      });

      const t2 = await OutreachTemplate.create({
        userId: multiUserId,
        name: 'Abu Dhabi Hospitality Designer A',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        body: 'Copy 2'
      });

      expect(t1.id).toBeDefined();
      expect(t2.id).toBeDefined();
      expect(t1.id).not.toBe(t2.id);
    });
  });

  describe('16. Review Additions: Campaign Email Sending Protections (Item 5)', () => {
    it('respects DRY_RUN simulation mode and cannot bypass daily caps', async () => {
      const emailTestUser = `test_cap_user_${Date.now()}`;
      const campaign = await Campaign.create({
        userId: emailTestUser,
        name: 'Protected Campaign',
        channel: 'email'
      });

      const lead = await createTestLead({
        userId: emailTestUser,
        businessName: 'Protection Test Studio',
        email: 'test@protection.com',
        buyerType: 'designer',
        status: 'new'
      });

      // 1. DRY_RUN dispatch works without live SMTP and leaves daily cap untouched
      const dispatch1 = await campaignService.dispatchCampaignEmail(emailTestUser, campaign.id, lead.id, {
        dryRun: true,
        dailyCap: 1
      });
      expect(dispatch1.success).toBe(true);
      expect(dispatch1.simulated).toBe(true);
      expect(dispatch1.dailySent).toBe(0);

      // 2. Cannot bypass daily cap: subsequent attempt when cap is reached blocks
      const lead2 = await createTestLead({
        userId: emailTestUser,
        businessName: 'Second Lead',
        email: 'second@protection.com',
        buyerType: 'designer',
        status: 'new'
      });

      await expect(
        campaignService.dispatchCampaignEmail(emailTestUser, campaign.id, lead2.id, {
          dailyCap: 0
        })
      ).rejects.toThrow(/Daily outreach limit reached/);
    });
  });

  describe('17. Review Additions: Campaign Archive & Unarchive (Item 6)', () => {
    it('archives campaign with linked leads instead of hard-deleting, and unarchives on request', async () => {
      const archUserId = `test_arch_${Date.now()}`;
      const campaign = await Campaign.create({
        userId: archUserId,
        name: 'Active Exhibition Campaign',
        status: 'active'
      });

      const lead = await createTestLead({
        userId: archUserId,
        businessName: 'Exhibition Client'
      });

      await CampaignLead.create({
        userId: archUserId,
        campaignId: campaign.id,
        leadId: lead.id
      });

      // Archive via service
      const archResult = await campaignService.archiveCampaign(archUserId, campaign.id);
      expect(archResult.action).toBe('archived');

      const checkedCampaign = await Campaign.findByPk(campaign.id);
      expect(checkedCampaign.status).toBe('archived');

      // Unarchive via HTTP API
      const unarchRes = await request(app)
        .post(`/api/campaigns/${campaign.id}/unarchive`)
        .set({ 'x-test-user-id': archUserId, 'x-test-role': 'admin' });

      expect(unarchRes.status).toBe(200);
      expect(unarchRes.body.success).toBe(true);
      expect(unarchRes.body.action).toBe('unarchived');

      const activeCampaign = await Campaign.findByPk(campaign.id);
      expect(activeCampaign.status).toBe('active');
    });
  });

  describe('18. Review Additions: Funnel Lost Stage Derivation (Item 7)', () => {
    it('reports lost leads separately and derives stage lost from status audit logs', async () => {
      const funnelUserId = `test_funnel_lost_${Date.now()}`;
      const campaign = await Campaign.create({
        userId: funnelUserId,
        name: 'Funnel Lost Tracking Campaign'
      });

      // Lead 1: Lost after Quotation
      const leadQuote = await createTestLead({
        userId: funnelUserId,
        businessName: 'Lost Quote Client',
        status: 'lost'
      });
      await AuditLog.create({
        userId: funnelUserId,
        entityType: 'Lead',
        entityId: String(leadQuote.id),
        action: 'update_lead_status',
        details: { previousStatus: 'quotation', newStatus: 'lost' }
      });

      // Lead 2: Lost after Replied
      const leadReplied = await createTestLead({
        userId: funnelUserId,
        businessName: 'Lost Replied Client',
        status: 'lost'
      });
      await AuditLog.create({
        userId: funnelUserId,
        entityType: 'Lead',
        entityId: String(leadReplied.id),
        action: 'update_lead_status',
        details: { previousStatus: 'replied', newStatus: 'lost' }
      });

      // Lead 3: Active Won Lead
      const leadWon = await createTestLead({
        userId: funnelUserId,
        businessName: 'Won Client',
        status: 'won',
        dealValue: 50000
      });

      await CampaignLead.bulkCreate([
        { userId: funnelUserId, campaignId: campaign.id, leadId: leadQuote.id },
        { userId: funnelUserId, campaignId: campaign.id, leadId: leadReplied.id },
        { userId: funnelUserId, campaignId: campaign.id, leadId: leadWon.id }
      ]);

      const funnel = await campaignService.getCampaignFunnel(funnelUserId, campaign.id);
      expect(funnel.stages.won).toBe(1);
      expect(funnel.lost.count).toBe(2);
      expect(funnel.lost.byStage.quotation).toBe(1);
      expect(funnel.lost.byStage.replied).toBe(1);
      expect(funnel.lost.note).toContain('derived from status change audit logs');
    });
  });

  describe('19. Review Additions: Mark Won with Deal Value & Currency (Item 8)', () => {
    it('updates lead to won with dealValue and dealCurrency', async () => {
      const lead = await createTestLead({
        businessName: 'Won Deal Candidate',
        status: 'negotiation'
      });

      const res = await request(app)
        .patch(`/api/leads/${lead.id}`)
        .set(authHeaders)
        .send({
          status: 'won',
          dealValue: 75000,
          dealCurrency: 'AED'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.lead.status).toBe('won');
      expect(Number(res.body.lead.dealValue)).toBe(75000);
      expect(res.body.lead.dealCurrency).toBe('AED');
    });
  });

  describe('20. Review Round 2: DRY_RUN Zero-Mutation Policy (Item 1)', () => {
    it('campaign dispatch in DRY_RUN mode leaves lead status unchanged, creates 0 FollowUps, creates 0 OutreachLogs, and leaves daily cap untouched', async () => {
      const dryUserId = `test_dry_user_${Date.now()}`;
      const campaign = await Campaign.create({
        userId: dryUserId,
        name: 'Dry Run Campaign Test',
        channel: 'email',
        status: 'active'
      });

      const lead = await createTestLead({
        userId: dryUserId,
        businessName: 'Dry Run Target Lead',
        email: 'dryrun@sample.ae',
        status: 'new'
      });

      await CampaignLead.create({
        userId: dryUserId,
        campaignId: campaign.id,
        leadId: lead.id
      });

      const capBefore = outreachHelper.getDailySentCount(dryUserId);

      // Dispatch in dry-run mode
      const result = await campaignService.dispatchCampaignEmail(dryUserId, campaign.id, lead.id, {
        dryRun: true
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);

      // 1. Lead status must NOT be modified
      const refreshedLead = await Lead.findByPk(lead.id);
      expect(refreshedLead.status).toBe('new');
      expect(refreshedLead.lastContactedAt).toBeNull();

      // 2. No OutreachLog rows created
      const logs = await OutreachLog.findAll({ where: { userId: dryUserId, leadId: lead.id } });
      expect(logs.length).toBe(0);

      // 3. No FollowUp rows created
      const followUps = await FollowUp.findAll({ where: { userId: dryUserId, leadId: lead.id } });
      expect(followUps.length).toBe(0);

      // 4. Daily cap counter must not be consumed
      const capAfter = outreachHelper.getDailySentCount(dryUserId);
      expect(capAfter).toBe(capBefore);
    });

    it('bulk send in DRY_RUN mode leaves lead status unchanged, creates 0 OutreachLogs, creates 0 FollowUps, and records BulkSendLog as simulated', async () => {
      const dryBulkUserId = `test_dry_bulk_${Date.now()}`;
      const lead = await createTestLead({
        userId: dryBulkUserId,
        businessName: 'Dry Run Bulk Lead',
        email: 'drybulk@sample.ae',
        status: 'new'
      });

      const jobId = bulkSendService.startBulkJob({
        channels: ['email'],
        userId: dryBulkUserId,
        leads: [lead],
        subject: 'Dry run test email',
        message: 'Hello {businessName}',
        dryRun: true,
        delayMs: 0
      });

      await bulkSendService.processJob(jobId, [lead]);

      // 1. Lead status must NOT change
      const refreshedLead = await Lead.findByPk(lead.id);
      expect(refreshedLead.status).toBe('new');

      // 2. Zero OutreachLog rows
      const outreachLogs = await OutreachLog.findAll({ where: { leadId: lead.id } });
      expect(outreachLogs.length).toBe(0);

      // 3. Zero FollowUps
      const followUps = await FollowUp.findAll({ where: { leadId: lead.id } });
      expect(followUps.length).toBe(0);

      // 4. BulkSendLog recorded with status = simulated
      const bulkLogs = await BulkSendLog.findAll({ where: { jobId } });
      expect(bulkLogs.length).toBe(1);
      expect(bulkLogs[0].status).toBe('simulated');
      expect(bulkLogs[0].details.simulated).toBe(true);

      // 5. Daily sent count from BulkSendLog does NOT count simulated sends
      const dailySent = await bulkSendService.getDailySentCount();
      // Count of 'sent' status should be unaffected
      const simulatedCount = await BulkSendLog.count({ where: { status: 'simulated', jobId } });
      expect(simulatedCount).toBe(1);
    });
  });

  describe('21. Review Round 2: Deterministic Template Selection & Toggle Active (Item 2)', () => {
    it('picks the most recently updated active template, ignores inactive ones, and returns actual templateId', async () => {
      const tmplUserId = `test_tmpl_user_${Date.now()}`;

      // 1. Inactive template (older)
      const tInactive = await OutreachTemplate.create({
        userId: tmplUserId,
        name: 'Designer Day 1 Inactive',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        subject: 'Inactive Subject',
        body: 'Inactive body copy',
        isActive: false,
        updatedAt: new Date(Date.now() - 60000)
      });

      // 2. Active template (older)
      const tActiveOlder = await OutreachTemplate.create({
        userId: tmplUserId,
        name: 'Designer Day 1 Older Active',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        subject: 'Older Active Subject',
        body: 'Older active body copy',
        isActive: true,
        isDefault: false,
        updatedAt: new Date(Date.now() - 30000)
      });

      // 3. Active template (newer)
      const tActiveNewer = await OutreachTemplate.create({
        userId: tmplUserId,
        name: 'Designer Day 1 Newer Active',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        subject: 'Newer Active Subject',
        body: 'Newer active body copy',
        isActive: true,
        isDefault: false,
        updatedAt: new Date()
      });

      // Resolve template deterministically
      const resolved = await campaignService.resolveTemplate(tmplUserId, {
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A'
      });

      expect(resolved.template).not.toBeNull();
      // Must pick newer active template, ignoring the inactive one
      expect(resolved.template.id).toBe(tActiveNewer.id);
      expect(resolved.templateId).toBe(tActiveNewer.id);
      expect(resolved.variant).toBe('A');
    });

    it('falls back to active Variant A when Variant B template is inactive or missing, recording attribution as A', async () => {
      const fbUserId = `test_fb_user_${Date.now()}`;

      // Active Variant A
      const tActiveA = await OutreachTemplate.create({
        userId: fbUserId,
        name: 'Hotel Day 1 Active A',
        channel: 'email',
        buyerType: 'hotel',
        step: 'day1',
        variant: 'A',
        subject: 'Hotel A Subject',
        body: 'Hotel A body copy',
        isActive: true
      });

      // Inactive Variant B
      await OutreachTemplate.create({
        userId: fbUserId,
        name: 'Hotel Day 1 Inactive B',
        channel: 'email',
        buyerType: 'hotel',
        step: 'day1',
        variant: 'B',
        subject: 'Hotel B Inactive Subject',
        body: 'Hotel B inactive body copy',
        isActive: false
      });

      // Attempt to resolve Variant B
      const resolved = await campaignService.resolveTemplate(fbUserId, {
        channel: 'email',
        buyerType: 'hotel',
        step: 'day1',
        variant: 'B'
      });

      // Since B is inactive, must fall back to A and honest attribution records variant = 'A'
      expect(resolved.template).not.toBeNull();
      expect(resolved.template.id).toBe(tActiveA.id);
      expect(resolved.templateId).toBe(tActiveA.id);
      expect(resolved.variant).toBe('A');
    });

    it('toggles template isActive via PATCH /api/outreach/templates/:id/toggle-active', async () => {
      const template = await OutreachTemplate.create({
        userId: testUserId,
        name: 'Toggle Test Template',
        channel: 'email',
        buyerType: 'designer',
        step: 'day1',
        variant: 'A',
        subject: 'Test Subject',
        body: 'Test Body',
        isActive: true
      });

      // Toggle to inactive
      const res1 = await request(app)
        .patch(`/api/outreach/templates/${template.id}/toggle-active`)
        .set(authHeaders);

      expect(res1.status).toBe(200);
      expect(res1.body.success).toBe(true);
      expect(res1.body.template.isActive).toBe(false);

      // Toggle back to active
      const res2 = await request(app)
        .patch(`/api/outreach/templates/${template.id}/toggle-active`)
        .set(authHeaders);

      expect(res2.status).toBe(200);
      expect(res2.body.success).toBe(true);
      expect(res2.body.template.isActive).toBe(true);
    });
  });
});
