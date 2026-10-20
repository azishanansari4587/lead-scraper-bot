const request = require('supertest');
const path = require('path');
const fs = require('fs');
const app = require('../src/api/server');
const Lead = require('../src/models/Lead');
const ExportJob = require('../src/models/ExportJob');
const { generateCsvString, sanitizeCsvCell } = require('../src/services/exports/exportCsv');
const { buildLeadsWorkbook } = require('../src/services/exports/exportXlsx');
const { buildPdfHtml } = require('../src/services/exports/exportPdf');
const { generateWhatsappExportContent, toWhatsappDigits } = require('../src/services/exports/exportWhatsapp');
const exportManager = require('../src/services/exports/exportManager');

describe('Phase 5 - API & Export Services', () => {
  const testUserId = 'test_phase5_user';

  const mockLeads = [
    {
      id: 101,
      userId: testUserId,
      businessName: 'Dubai Luxury Carpets LLC',
      leadType: 'rug_retailer',
      country: 'UAE',
      city: 'Dubai',
      score: 85,
      scoreReason: '+20 Category; +15 Rugs; +10 Priority UAE',
      phone: '+971 4 339 1234',
      whatsapp: '+971 50 123 4567',
      email: 'sales@dubailuxurycarpets.ae',
      website: 'https://dubailuxurycarpets.ae',
      sellsRugsSignal: true,
      status: 'new'
    },
    {
      id: 102,
      userId: testUserId,
      businessName: '=cmd|’ /C calc’!A0', // Potential CSV injection payload
      leadType: 'interior_designer',
      country: 'UAE',
      city: 'Dubai',
      score: 65,
      scoreReason: '+15 Category; +10 Priority UAE',
      phone: '+971 4 999 8888',
      email: 'studio@maliciousformula.ae',
      sellsRugsSignal: false,
      status: 'new'
    }
  ];

  describe('CSV Export & Formula Injection Defense', () => {
    it('prepends UTF-8 BOM to CSV output for international character support in Excel', () => {
      const csv = generateCsvString(mockLeads);
      expect(csv.charCodeAt(0)).toBe(0xFEFF);
    });

    it('neutralizes malicious formula injection characters (=, +, -, @, \\t)', () => {
      expect(sanitizeCsvCell('=1+1')).toBe("'=1+1");
      expect(sanitizeCsvCell('+cmd')).toBe("'+cmd");
      expect(sanitizeCsvCell('-5')).toBe("'-5");
      expect(sanitizeCsvCell('@SUM(A1:A5)')).toBe("'@SUM(A1:A5)");

      // Verify lead with malicious formula in businessName is neutralized in CSV output
      const csv = generateCsvString(mockLeads);
      expect(csv).toContain("'=cmd|’ /C calc’!A0");
    });

    it('quotes fields containing commas or quotes correctly', () => {
      expect(sanitizeCsvCell('Carpets, Rugs and Flooring')).toBe('"Carpets, Rugs and Flooring"');
      expect(sanitizeCsvCell('He said "Luxury" rugs')).toBe('"He said ""Luxury"" rugs"');
    });
  });

  describe('Excel XLSX Export Multi-Sheet Structure', () => {
    it('creates workbook with Qualified Leads and Summary & Stats sheets', () => {
      const wb = buildLeadsWorkbook(mockLeads);
      expect(wb.worksheets.length).toBe(2);

      const leadsSheet = wb.getWorksheet('Qualified Leads');
      const statsSheet = wb.getWorksheet('Summary & Stats');

      expect(leadsSheet).toBeDefined();
      expect(statsSheet).toBeDefined();

      // Verify frozen header row
      expect(leadsSheet.views[0].state).toBe('frozen');
      expect(leadsSheet.views[0].ySplit).toBe(1);

      // Verify row count
      expect(leadsSheet.rowCount).toBe(3); // 1 header + 2 data rows
    });
  });

  describe('PDF Dossier Template & WhatsApp Exporter', () => {
    it('renders branded PDF HTML template with Knotiq Rugs title and KPI cards', () => {
      const html = buildPdfHtml(mockLeads);
      expect(html).toContain('KNOTIQ RUGS');
      expect(html).toContain('B2B Lead Intelligence & Export Dossier');
      expect(html).toContain('Dubai Luxury Carpets LLC');
      expect(html).toContain('High-Fit Targets');
    });

    it('formats WhatsApp contacts and builds direct wa.me chat links', () => {
      expect(toWhatsappDigits('+971 50 123 4567')).toBe('971501234567');
      const waContent = generateWhatsappExportContent(mockLeads);
      expect(waContent).toContain('https://wa.me/971501234567?text=');
      expect(waContent.charCodeAt(0)).toBe(0xFEFF); // Has BOM
    });
  });

  describe('Signed Download Token Verification & Path Traversal Guards', () => {
    it('generates and validates signed 15-minute download tokens', () => {
      const jobId = 'test-job-uuid-123';
      const expiresAt = Date.now() + 15 * 60 * 1000;
      const token = exportManager.generateDownloadToken(jobId, expiresAt);

      const verified = exportManager.verifyDownloadToken(token);
      expect(verified.valid).toBe(true);
      expect(verified.jobId).toBe(jobId);
    });

    it('rejects expired download tokens (older than 15 minutes)', () => {
      const jobId = 'test-job-uuid-expired';
      const pastTime = Date.now() - 1000; // already expired
      const token = exportManager.generateDownloadToken(jobId, pastTime);

      const verified = exportManager.verifyDownloadToken(token);
      expect(verified.valid).toBe(false);
      expect(verified.reason).toContain('expired');
    });

    it('rejects tampered tokens with mismatched HMAC signatures', () => {
      const jobId = 'test-job-uuid-tampered';
      const expiresAt = Date.now() + 15 * 60 * 1000;
      const token = exportManager.generateDownloadToken(jobId, expiresAt);

      // Tamper with base64 payload
      const tamperedToken = token.slice(0, -4) + 'AAAA';
      const verified = exportManager.verifyDownloadToken(tamperedToken);
      expect(verified.valid).toBe(false);
    });

    it('guards against path traversal outside the data/exports directory', () => {
      const safePath = path.resolve(process.cwd(), 'data', 'exports', 'knotiq_leads.csv');
      const unsafeTraversalPath = path.resolve(process.cwd(), 'data', 'exports', '..', '..', 'etc', 'passwd');

      expect(exportManager.isSafePath(safePath)).toBe(true);
      expect(exportManager.isSafePath(unsafeTraversalPath)).toBe(false);
    });
  });

  describe('REST API Endpoints Integration', () => {
    beforeAll(async () => {
      // Seed test lead for REST testing
      await Lead.destroy({ where: { userId: testUserId } });
      await Lead.create({
        userId: testUserId,
        businessName: 'Emirates Interior Design Group',
        leadType: 'interior_designer',
        country: 'UAE',
        city: 'Abu Dhabi',
        score: 75,
        scoreReason: '+15 High fit category; +10 UAE',
        phone: '+97126667777',
        email: 'info@emiratesinteriors.ae',
        website: 'https://emiratesinteriors.ae',
        domain: 'emiratesinteriors.ae',
        source: 'manual',
        status: 'new',
        dedupeKey: 'dom_emiratesinteriors.ae'
      });
    });

    it('GET /api/leads - fetches paginated leads for authenticated user', async () => {
      const res = await request(app)
        .get('/api/leads?country=UAE')
        .set('x-test-user-id', testUserId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.leads.length).toBeGreaterThanOrEqual(1);
      expect(res.body.leads[0].businessName).toBe('Emirates Interior Design Group');
    });

    it('GET /api/leads/stats - returns summary statistics', async () => {
      const res = await request(app)
        .get('/api/leads/stats')
        .set('x-test-user-id', testUserId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.total).toBeGreaterThanOrEqual(1);
      expect(res.body.byCountry.UAE).toBeGreaterThanOrEqual(1);
    });

    it('POST /api/leads - creates a new lead and automatically scores it', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('x-test-user-id', testUserId)
        .send({
          businessName: 'Royal Silk Rugs Boutique',
          leadType: 'rug_retailer',
          country: 'UAE',
          city: 'Dubai',
          phone: '+97143395555',
          sellsRugsSignal: true
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.lead.score).toBeGreaterThanOrEqual(40);
      expect(res.body.lead.scoreReason).toContain('+20 Exact category match');
    });

    it('GET /api/sources & PATCH /api/sources/:platform/toggle - manages scraper sources', async () => {
      const listRes = await request(app)
        .get('/api/sources')
        .set('x-test-user-id', testUserId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.sources.length).toBeGreaterThanOrEqual(2);

      const toggleRes = await request(app)
        .patch('/api/sources/overpass/toggle')
        .set('x-test-user-id', testUserId);

      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.success).toBe(true);
      expect(toggleRes.body.platform).toBe('overpass');
    });

    it('POST /api/presets & GET /api/presets - creates and lists search presets', async () => {
      const createRes = await request(app)
        .post('/api/presets')
        .set('x-test-user-id', testUserId)
        .send({
          name: 'UAE Rug Retailers Filter',
          leadTypes: ['rug_retailer'],
          country: 'UAE',
          city: 'Dubai',
          hasWebsite: true,
          minScore: 50
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.preset.name).toBe('UAE Rug Retailers Filter');

      const listRes = await request(app)
        .get('/api/presets')
        .set('x-test-user-id', testUserId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.presets.some((p) => p.name === 'UAE Rug Retailers Filter')).toBe(true);
    });

    it('POST /api/schedules & GET /api/schedules - manages recurring scraper schedules', async () => {
      const createRes = await request(app)
        .post('/api/schedules')
        .set('x-test-user-id', testUserId)
        .send({
          name: 'Weekly Dubai Scrape',
          cronExpression: '0 9 * * 1',
          country: 'UAE',
          city: 'Dubai',
          leadTypes: ['rug_retailer']
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.schedule.name).toBe('Weekly Dubai Scrape');

      const listRes = await request(app)
        .get('/api/schedules')
        .set('x-test-user-id', testUserId);

      expect(listRes.status).toBe(200);
      expect(listRes.body.schedules.some((s) => s.name === 'Weekly Dubai Scrape')).toBe(true);
    });

    it('POST /api/exports - initiates an export job with signed download token', async () => {
      const res = await request(app)
        .post('/api/exports')
        .set('x-test-user-id', testUserId)
        .send({
          format: 'csv',
          filters: { country: 'UAE' }
        });

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.job.id).toBeDefined();
      expect(res.body.job.downloadUrl).toContain('/api/exports/download/');
    });

    it('GET /api/exports/download/:token - blocks expired or tampered token with 403', async () => {
      const res = await request(app).get('/api/exports/download/invalid-tampered-token');
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Forbidden');
    });

    it('POST /api/outreach/draft - generates personalized cold outreach email draft', async () => {
      const lead = (await Lead.findOne({ where: { userId: testUserId, businessName: 'Royal Silk Rugs Boutique' } })) || (await Lead.findOne({ where: { userId: testUserId } }));
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
      expect(res.body.draft.body).toContain('Knotiq Rugs');
    });

    it('POST /api/optout - suppresses entity and zeroes lead score', async () => {
      const res = await request(app)
        .post('/api/optout')
        .set('x-test-user-id', testUserId)
        .send({
          type: 'domain',
          value: 'emiratesinteriors.ae',
          reason: 'Do not contact request'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);

      // Verify matching lead score was zeroed
      const updatedLead = await Lead.findOne({ where: { domain: 'emiratesinteriors.ae' } });
      if (updatedLead) {
        expect(updatedLead.score).toBe(0);
        expect(updatedLead.scoreReason).toContain('Suppressed via OptOut');
      }
    });

    it('GET /api/settings - returns system diagnostics and Gemini quota statistics', async () => {
      const res = await request(app)
        .get('/api/settings')
        .set('x-test-user-id', testUserId);

      expect(res.status).toBe(200);
      expect(res.body.settings.geminiModel).toBe('gemini-1.5-flash');
      expect(res.body.settings.geminiStats).toBeDefined();
      expect(res.body.settings.activeScrapers).toBeDefined();
    });
  });
});
