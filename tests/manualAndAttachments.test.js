import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import app from '../src/api/server';
import sequelize from '../src/config/database';
import Lead from '../src/models/Lead';

describe('Manual Lead Insertion & Attachment Dispatch Integration Tests', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync();
    await Lead.destroy({ where: { userId: 'test_curator' } });
  });

  beforeEach(async () => {
    await Lead.destroy({ where: { userId: 'test_curator' } });
  });

  afterAll(async () => {
    await Lead.destroy({ where: { userId: 'test_curator' } });
  });

  describe('1. Manual Lead Insertion via POST /api/leads', () => {
    it('manually creates a high-fit rug retailer lead with normalized phone and auto-score', async () => {
      const payload = {
        businessName: 'Royal Persian Carpets LLC',
        country: 'UAE',
        city: 'Dubai',
        state: 'Dubai Emirate',
        leadType: 'rug_retailer',
        phone: '+971 50 987 6543',
        whatsapp: '+971 50 987 6543',
        email: 'buyer@royalcarpets.ae',
        website: 'https://www.royalcarpets.ae',
        address: 'Al Quoz 3, Sheikh Zayed Road, Dubai',
        sellsRugsSignal: true,
        notes: 'Interested in bespoke 9x12 wool and bamboo silk carpets'
      };

      const res = await request(app)
        .post('/api/leads')
        .set('x-test-user-id', 'test_curator')
        .send(payload);

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.lead).toBeDefined();
      expect(res.body.lead.businessName).toBe('Royal Persian Carpets LLC');
      expect(res.body.lead.domain).toBe('royalcarpets.ae');
      expect(res.body.lead.phone).toBe('+971509876543');
      expect(res.body.lead.score).toBeGreaterThan(60);
      expect(res.body.lead.source).toBe('manual');
    });

    it('rejects manual insertion if required fields are missing', async () => {
      const res = await request(app)
        .post('/api/leads')
        .set('x-test-user-id', 'test_curator')
        .send({
          businessName: 'Incomplete Studio'
          // country and city missing
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });
  });

  describe('2. Attachment Upload via POST /api/bulk/upload-attachment', () => {
    it('uploads a PDF catalog attachment and returns safe metadata', async () => {
      const mockPdfBuffer = Buffer.from('%PDF-1.4 Mock Knotiq Rugs Catalogue Content %EOF');

      const res = await request(app)
        .post('/api/bulk/upload-attachment')
        .set('x-bulk-auth', 'knotiq2026')
        .attach('file', mockPdfBuffer, 'Knotiq_Rugs_Catalogue_2026.pdf');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attachment).toBeDefined();
      expect(res.body.attachment.filename).toBe('Knotiq_Rugs_Catalogue_2026.pdf');
      expect(res.body.attachment.mimeType).toBe('application/pdf');
      expect(fs.existsSync(res.body.attachment.path)).toBe(true);
    });

    it('uploads a rug photo / image attachment successfully', async () => {
      const mockImageBuffer = Buffer.from('mock-png-image-binary-data');

      const res = await request(app)
        .post('/api/bulk/upload-attachment')
        .set('x-bulk-auth', 'knotiq2026')
        .attach('file', mockImageBuffer, 'hand_knotted_sample.png');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.attachment.filename).toBe('hand_knotted_sample.png');
    });

    it('rejects unsupported file formats like .exe or .sh', async () => {
      const mockScriptBuffer = Buffer.from('#!/bin/bash\necho hello');

      const res = await request(app)
        .post('/api/bulk/upload-attachment')
        .set('x-bulk-auth', 'knotiq2026')
        .attach('file', mockScriptBuffer, 'malicious.sh');

      expect(res.statusCode).toBe(500); // Multer fileFilter error handled by express errorHandler
    });
  });

  describe('3. Direct Single Buyer Send with Attachments via POST /api/outreach/send-direct', () => {
    it('dispatches direct email with attachments to a buyer', async () => {
      // Create lead
      const lead = await Lead.create({
        userId: 'test_curator',
        businessName: 'Dubai Design Gallery',
        leadType: 'interior_designer',
        source: 'manual',
        country: 'UAE',
        city: 'Dubai',
        email: 'info@dubaidesigngallery.ae',
        phone: '971501112233',
        score: 75,
        dedupeKey: 'dubaidesigngalleryae_uae_dubai'
      });

      const attachments = [
        {
          filename: 'Knotiq_Catalogue.pdf',
          path: path.resolve(process.cwd(), 'data/keywords.json'), // using existing file as mock
          mimeType: 'application/pdf'
        }
      ];

      const res = await request(app)
        .post('/api/outreach/send-direct')
        .set('x-test-user-id', 'test_curator')
        .send({
          leadId: lead.id,
          channel: 'email',
          subject: 'Exclusive Knotiq Trade Catalogue',
          body: 'Hello Dubai Design Gallery, please find our catalogue attached.',
          attachments,
          dryRun: true
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify lead status updated to 'contacted'
      const updated = await Lead.findByPk(lead.id);
      expect(updated.status).toBe('contacted');
      expect(updated.lastContactedAt).toBeDefined();
    });
  });

  describe('4. Bulk Campaign Send with Attachments', () => {
    it('launches bulk send campaign passing attachments to the background worker', async () => {
      const leads = [
        {
          id: 501,
          name: 'Sarah Jenkins',
          businessName: 'Jenkins Interiors',
          email: 'sarah@jenkinsinteriors.com',
          phone: '971509998877'
        }
      ];

      const attachments = [
        {
          filename: 'Bespoke_Rugs_Lookbook.pdf',
          path: path.resolve(process.cwd(), 'data/keywords.json'),
          mimeType: 'application/pdf'
        }
      ];

      const res = await request(app)
        .post('/api/bulk/send')
        .set('x-bulk-auth', 'knotiq2026')
        .send({
          leads,
          channels: ['email'],
          subject: 'Handmade Rugs for {company}',
          message: 'Hi {name}, see attached lookbook.',
          attachments,
          dryRun: true
        });

      expect(res.statusCode).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.jobId).toBeDefined();
    });
  });
});
