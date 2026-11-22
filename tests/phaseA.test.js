import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import { classifyByRules } from '../src/services/classification/buyerClassifier';
import followUpEngine from '../src/services/followUp/followUpEngine';
import { Lead, Call, Note, FollowUp, OutreachLog, OptOut, UserSettings } from '../src/models';

describe('Phase A - Business Management System Suite', () => {
  const testUserId = 'test_phase_a_founder';
  const authHeaders = {
    'x-test-user-id': testUserId,
    'x-test-role': 'admin'
  };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Buyer Type Rule-Based Classifier', () => {
    it('classifies interior design and architectural firms as "designer" with >= 0.85 confidence', () => {
      const result = classifyByRules({
        businessName: 'Studio Arch Design LLC',
        category: 'Interior Designer',
        bio: 'Bespoke residential architectural studio based in Dubai',
        website: 'https://studioarch.ae'
      });

      expect(result.buyerType).toBe('designer');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
      expect(result.reason).toContain('Rule match for designer:');
    });

    it('classifies luxury hospitality and resorts as "hotel"', () => {
      const result = classifyByRules({
        businessName: 'Royal Palm Resort & Hotel',
        category: 'Hospitality',
        bio: '5-star boutique resort in Ajman with 120 suites',
        website: 'https://royalpalmresort.ae'
      });

      expect(result.buyerType).toBe('hotel');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('classifies wholesale and trading distributors as "importer"', () => {
      const result = classifyByRules({
        businessName: 'Gulf Flooring Wholesale & Trading FZE',
        category: 'Flooring Distributor',
        bio: 'Direct container bulk import and distribution across GCC',
        website: 'https://gulfflooring.ae'
      });

      expect(result.buyerType).toBe('importer');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('classifies furniture showrooms as "retailer"', () => {
      const result = classifyByRules({
        businessName: 'Living Spaces Carpet Showroom',
        category: 'Home Decor Store',
        bio: 'Flagship furniture and luxury carpet showroom on Sheikh Zayed Rd'
      });

      expect(result.buyerType).toBe('retailer');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('classifies Amazon/Noon/Shopify links as "online_seller"', () => {
      const result = classifyByRules({
        businessName: 'RugsKart Online',
        sourceUrl: 'https://www.amazon.ae/sp?seller=A1234567',
        bio: 'Selling luxury rugs online on Noon and Amazon'
      });

      expect(result.buyerType).toBe('online_seller');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('classifies real estate developers as "developer"', () => {
      const result = classifyByRules({
        businessName: 'Emaar Properties Contracting',
        bio: 'Master developer of luxury residential towers and communities'
      });

      expect(result.buyerType).toBe('developer');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('classifies private capital/angel entities as "investor"', () => {
      const result = classifyByRules({
        businessName: 'Al Waha Venture Capital',
        bio: 'Private equity and angel investor firm'
      });

      expect(result.buyerType).toBe('investor');
      expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    });

    it('falls back to "unclassified" with low confidence for generic/unmatched signals', () => {
      const result = classifyByRules({
        businessName: 'Apex Advisory Services LLC',
        bio: 'Executive leadership coaching and organization consulting'
      });

      expect(result.buyerType).toBe('unclassified');
      expect(result.confidence).toBeLessThan(0.7);
    });
  });

  describe('2. Follow-Up Engine & Outreach Sequencing', () => {
    it('creates Day 4 (+3 days) and Day 7 (+6 days) follow-up tasks upon scheduling', async () => {
      const lead = await Lead.create({
        userId: testUserId,
        businessName: 'Test Hotel Sequence LLC',
        leadType: 'hospitality',
        source: 'manual',
        dedupeKey: `test_seq_hotel_${Date.now()}`,
        buyerType: 'hotel',
        country: 'UAE',
        city: 'Dubai',
        phone: '+971501112233',
        status: 'contacted'
      });

      await followUpEngine.scheduleInitialFollowUps(testUserId, lead.id, 'whatsapp');

      const followUps = await FollowUp.findAll({
        where: { userId: testUserId, leadId: lead.id }
      });

      expect(followUps.length).toBe(2);

      const day4 = followUps.find((f) => f.step === 'day4');
      const day7 = followUps.find((f) => f.step === 'day7');

      expect(day4).toBeDefined();
      expect(day4.channel).toBe('whatsapp');
      expect(day4.status).toBe('pending');

      expect(day7).toBeDefined();
      expect(day7.channel).toBe('whatsapp');
      expect(day7.status).toBe('pending');

      const now = Date.now();
      const day4DiffDays = (new Date(day4.dueAt).getTime() - now) / (1000 * 60 * 60 * 24);
      const day7DiffDays = (new Date(day7.dueAt).getTime() - now) / (1000 * 60 * 60 * 24);

      expect(day4DiffDays).toBeGreaterThan(2);
      expect(day4DiffDays).toBeLessThan(4);
      expect(day7DiffDays).toBeGreaterThan(5);
      expect(day7DiffDays).toBeLessThan(7);
    });

    it('markReplied cancels pending follow-ups and updates lead status to "replied"', async () => {
      const lead = await Lead.create({
        userId: testUserId,
        businessName: 'Sequence Reply Test Studio',
        leadType: 'interior_designer',
        source: 'manual',
        dedupeKey: `test_seq_reply_${Date.now()}`,
        buyerType: 'designer',
        country: 'UAE',
        city: 'Dubai',
        status: 'contacted'
      });

      await followUpEngine.scheduleInitialFollowUps(testUserId, lead.id, 'email');

      const pendingBefore = await FollowUp.count({
        where: { leadId: lead.id, status: 'pending' }
      });
      expect(pendingBefore).toBe(2);

      const result = await followUpEngine.markReplied(testUserId, lead.id, 'Client asked for 8x10 wool sample catalog');
      expect(result.success).toBe(true);
      expect(result.cancelledCount).toBe(2);

      await lead.reload();
      expect(lead.status).toBe('replied');

      const pendingAfter = await FollowUp.count({
        where: { leadId: lead.id, status: 'pending' }
      });
      expect(pendingAfter).toBe(0);

      const cancelledCount = await FollowUp.count({
        where: { leadId: lead.id, status: 'cancelled' }
      });
      expect(cancelledCount).toBe(2);
    });
  });

  describe('3. Call System & Opt-Out Enforcement', () => {
    it('blocks logging a call when the lead or phone has opted out (HTTP 403)', async () => {
      const optedOutPhone = `+97150999000${Date.now() % 1000}`;

      await OptOut.create({
        type: 'phone',
        value: optedOutPhone,
        reason: 'Requested Do Not Call'
      });

      const optedLead = await Lead.create({
        userId: testUserId,
        businessName: 'Suppressed Buyer LLC',
        leadType: 'rug_retailer',
        source: 'manual',
        dedupeKey: `test_suppressed_${Date.now()}`,
        phone: optedOutPhone,
        country: 'UAE',
        city: 'Dubai',
        optedOut: true
      });

      const res = await request(app)
        .post('/api/calls')
        .set(authHeaders)
        .send({
          leadId: optedLead.id,
          direction: 'outbound',
          outcome: 'connected',
          durationSec: 120,
          summary: 'Attempted outreach call'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('OptOutViolation');
    });

    it('successfully logs a call for an eligible lead and updates lastContactedAt', async () => {
      const lead = await Lead.create({
        userId: testUserId,
        businessName: 'Eligible Designer Studio',
        leadType: 'interior_designer',
        source: 'manual',
        dedupeKey: `test_eligible_call_${Date.now()}`,
        phone: '+971508887766',
        buyerType: 'designer',
        country: 'UAE',
        city: 'Dubai',
        status: 'new'
      });

      const res = await request(app)
        .post('/api/calls')
        .set(authHeaders)
        .send({
          leadId: lead.id,
          direction: 'outbound',
          outcome: 'interested',
          durationSec: 180,
          summary: 'Interested in bespoke wool carpets. Wants yarn swatches sent.',
          nextAction: 'Send sample box'
        });

      expect(res.status).toBe(201);
      expect(res.body.call).toBeDefined();
      expect(res.body.call.outcome).toBe('interested');

      await lead.reload();
      expect(lead.lastContactedAt).toBeDefined();
      expect(lead.status).toBe('negotiation');
    });
  });

  describe('4. Polymorphic Notebook API', () => {
    it('creates, tags, pins, and retrieves notes across contexts', async () => {
      const createRes = await request(app)
        .post('/api/notes')
        .set(authHeaders)
        .send({
          title: 'Dubai Trade Mission Takeaways',
          body: 'Met 12 interior designers at Index Dubai. High demand for 9x12 wool-silk custom rugs.',
          ownerType: 'general',
          tags: ['trade_fair', 'dubai', 'pricing'],
          pinned: true
        });

      expect(createRes.status).toBe(201);
      const noteId = createRes.body.note.id;
      expect(createRes.body.note.pinned).toBe(true);

      const listRes = await request(app)
        .get('/api/notes?tag=trade_fair')
        .set(authHeaders);

      expect(listRes.status).toBe(200);
      expect(listRes.body.notes.some((n) => n.id === noteId)).toBe(true);

      const toggleRes = await request(app)
        .patch(`/api/notes/${noteId}/pin`)
        .set(authHeaders);

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.note.pinned).toBe(false);

      const delRes = await request(app)
        .delete(`/api/notes/${noteId}`)
        .set(authHeaders);

      expect(delRes.status).toBe(200);
    });
  });

  describe('5. Today Command Center Performance & Aggregation', () => {
    it('GET /api/today/summary returns targets, progress, and responds in under 2000ms', async () => {
      const startTime = Date.now();

      const res = await request(app)
        .get('/api/today/summary')
        .set(authHeaders);

      const elapsedMs = Date.now() - startTime;

      expect(res.status).toBe(200);
      expect(elapsedMs).toBeLessThan(2000);

      expect(res.body.targets).toBeDefined();
      expect(res.body.targets.calls).toBeDefined();
      expect(res.body.targets.calls.target).toBeGreaterThan(0);
      expect(res.body.overdueFollowUps).toBeDefined();
      expect(res.body.todayFollowUps).toBeDefined();
      expect(res.body.priorities).toBeDefined();
    });
  });
});
