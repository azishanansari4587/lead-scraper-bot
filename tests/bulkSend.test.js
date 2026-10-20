import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../src/api/server';
import bulkSendService from '../src/services/bulkSendService';
import sequelize from '../src/config/database';

describe('Bulk Send Feature & Security Integration', () => {
  beforeAll(async () => {
    await sequelize.authenticate();
    await sequelize.sync();
  });

  describe('Phone Cleaning Unit Tests', () => {
    it('formats 10 digit Indian numbers with country code 91', () => {
      const res = bulkSendService.cleanPhone('9876543210', '91');
      expect(res.valid).toBe(true);
      expect(res.phone).toBe('919876543210');
    });

    it('formats 11 digit numbers with leading 0', () => {
      const res = bulkSendService.cleanPhone('09876543210', '91');
      expect(res.valid).toBe(true);
      expect(res.phone).toBe('919876543210');
    });

    it('cleans formatted phone strings with symbols', () => {
      const res = bulkSendService.cleanPhone('+91 (987) 654-3210', '91');
      expect(res.valid).toBe(true);
      expect(res.phone).toBe('919876543210');
    });

    it('rejects short and invalid phone strings', () => {
      const res = bulkSendService.cleanPhone('12345', '91');
      expect(res.valid).toBe(false);
    });
  });

  describe('Email & Template Rendering', () => {
    it('validates email addresses properly', () => {
      expect(bulkSendService.isValidEmail('export@knotiqrugs.com')).toBe(true);
      expect(bulkSendService.isValidEmail('invalid@')).toBe(false);
    });

    it('replaces {name} and {company} placeholders in messages', () => {
      const template = 'Hi {name}, hope {company} is doing well.';
      const rendered = bulkSendService.renderMessage(template, { name: 'Sunil', company: 'Sunil Rugs' });
      expect(rendered).toBe('Hi Sunil, hope Sunil Rugs is doing well.');
    });
  });

  describe('Bulk API Endpoints Security & Execution', () => {
    it('allows access with correct bulk auth header', async () => {
      const res = await request(app)
        .get('/api/bulk/verify-auth')
        .set('x-bulk-auth', 'knotiq2026');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('allows access in test mode with test auth bypass', async () => {
      const res = await request(app)
        .get('/api/bulk/leads')
        .set('x-test-user-id', 'test_admin');

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.leads)).toBe(true);
    });

    it('starts a background job and retrieves its status', async () => {
      const leads = [
        { id: 101, name: 'Lead 101', company: 'Company 101', email: 'test101@example.com', phone: '9876543211' }
      ];

      const startRes = await request(app)
        .post('/api/bulk/send')
        .set('x-bulk-auth', 'knotiq2026')
        .send({
          leads,
          channels: ['email'],
          subject: 'Test Subject',
          message: 'Hello {name}',
          dryRun: true
        });

      expect(startRes.statusCode).toBe(202);
      expect(startRes.body.success).toBe(true);
      expect(startRes.body.jobId).toBeDefined();

      const jobId = startRes.body.jobId;

      const statusRes = await request(app)
        .get(`/api/bulk/status/${jobId}`)
        .set('x-bulk-auth', 'knotiq2026');

      expect(statusRes.statusCode).toBe(200);
      expect(statusRes.body.job).toBeDefined();
      expect(statusRes.body.job.jobId).toBe(jobId);
    });

    it('validates empty leads rejection', async () => {
      const res = await request(app)
        .post('/api/bulk/send')
        .set('x-bulk-auth', 'knotiq2026')
        .send({
          leads: [],
          channels: ['email'],
          message: 'Hello'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.error).toBe('ValidationError');
    });
  });
});
