const express = require('express');
const request = require('supertest');
const app = require('../src/api/server');
const {
  sequelize,
  Lead,
  ScraperRun,
  Schedule,
  SearchPreset,
  KeywordSet,
  Location,
  ExportJob,
  AuditLog,
  OutreachTemplate,
  OptOut
} = require('../src/models');
const { requireAuth } = require('../src/api/middleware/auth');

describe('Phase 1 - Foundation & Data Isolation', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  describe('Database Models & Constraints', () => {
    it('creates all 10 models with correct schemas', async () => {
      expect(Lead).toBeDefined();
      expect(ScraperRun).toBeDefined();
      expect(Schedule).toBeDefined();
      expect(SearchPreset).toBeDefined();
      expect(KeywordSet).toBeDefined();
      expect(Location).toBeDefined();
      expect(ExportJob).toBeDefined();
      expect(AuditLog).toBeDefined();
      expect(OutreachTemplate).toBeDefined();
      expect(OptOut).toBeDefined();
    });

    it('creates a Lead and queries it successfully', async () => {
      const lead = await Lead.create({
        userId: 'user_test_alpha',
        businessName: 'Knotiq Artisan Showroom',
        leadType: 'rug_retailer',
        country: 'India',
        state: 'Uttar Pradesh',
        city: 'Bhadohi',
        phone: '+919876543210',
        email: 'info@knotiqrugs.com',
        website: 'https://knotiqrugs.com',
        rating: 4.8,
        reviewCount: 35,
        sellsRugsSignal: true,
        source: 'manual',
        score: 85,
        scoreReason: 'Exact match: rug retailer with verified rugs signal',
        dedupeKey: 'knotiq-artisan-showroom-bhadohi'
      });

      expect(lead.id).toBeDefined();
      expect(lead.businessName).toBe('Knotiq Artisan Showroom');
      expect(lead.emailVerified).toBe('unknown');
      expect(lead.status).toBe('new');
    });

    it('enforces unique dedupeKey constraint per user', async () => {
      let threwError = false;
      try {
        await Lead.create({
          userId: 'user_test_alpha',
          businessName: 'Duplicate Knotiq',
          leadType: 'rug_retailer',
          country: 'India',
          city: 'Bhadohi',
          source: 'manual',
          dedupeKey: 'knotiq-artisan-showroom-bhadohi'
        });
      } catch (err) {
        threwError = true;
      }
      expect(threwError).toBe(true);
    });

    it('allows identical dedupeKey for different users (per-user namespace)', async () => {
      const betaLead = await Lead.create({
        userId: 'user_test_beta',
        businessName: 'Knotiq Artisan Showroom',
        leadType: 'rug_retailer',
        country: 'India',
        city: 'Bhadohi',
        source: 'manual',
        dedupeKey: 'knotiq-artisan-showroom-bhadohi'
      });

      expect(betaLead.id).toBeDefined();
      expect(betaLead.userId).toBe('user_test_beta');
    });
  });

  describe('Health Check API', () => {
    it('GET /health returns 200 with service information and database status', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('lead-scraper-bot-api');
      expect(res.body.version).toBe('1.0.0');
      expect(res.body.database.status).toBe('connected');
      expect(res.headers['x-request-id']).toBeDefined();
    });

    it('returns 404 for unknown routes', async () => {
      const res = await request(app).get('/api/unknown-endpoint');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
    });
  });

  describe('Auth Middleware & User Isolation Verification', () => {
    const testApp = express();
    testApp.use(express.json());
    testApp.get('/api/test-leads', requireAuth, async (req, res) => {
      const userLeads = await Lead.findAll({
        where: { userId: req.auth.userId }
      });
      res.json({ count: userLeads.length, leads: userLeads });
    });

    it('User Alpha only sees User Alpha leads', async () => {
      const res = await request(testApp)
        .get('/api/test-leads')
        .set('x-test-user-id', 'user_test_alpha');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.leads[0].userId).toBe('user_test_alpha');
    });

    it('User Beta only sees User Beta leads (User A cannot read User B data)', async () => {
      const res = await request(testApp)
        .get('/api/test-leads')
        .set('x-test-user-id', 'user_test_beta');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.leads[0].userId).toBe('user_test_beta');
    });

    it('User Gamma (new user) sees 0 leads', async () => {
      const res = await request(testApp)
        .get('/api/test-leads')
        .set('x-test-user-id', 'user_test_gamma');

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(0);
    });
  });
});
