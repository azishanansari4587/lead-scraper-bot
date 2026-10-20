/**
 * Export Manager Service
 * Manages ExportJob lifecycle, background processing, secure HMAC signed download tokens,
 * 15-minute expiration tracking, and strict path traversal defense.
 */

const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const env = require('../../config/env');
const logger = require('../../config/logger');
const ExportJob = require('../../models/ExportJob');
const Lead = require('../../models/Lead');
const { writeCsvFile } = require('./exportCsv');
const { writeXlsxFile } = require('./exportXlsx');
const { writePdfFile } = require('./exportPdf');
const { writeWhatsappFile } = require('./exportWhatsapp');

const EXPORTS_DIR = path.resolve(process.cwd(), 'data', 'exports');
const TOKEN_SECRET = env.CLERK_SECRET_KEY || 'knotiq_export_signing_secret_key_123';
const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

class ExportManager {
  constructor() {
    if (!fs.existsSync(EXPORTS_DIR)) {
      fs.mkdirSync(EXPORTS_DIR, { recursive: true });
    }
  }

  /**
   * Generates a signed download token with 15-minute expiry
   * @param {string} jobId
   * @param {number} expiresAtTimestamp
   * @returns {string}
   */
  generateDownloadToken(jobId, expiresAtTimestamp) {
    const payload = `${jobId}:${expiresAtTimestamp}`;
    const hmac = crypto.createHmac('sha256', TOKEN_SECRET).update(payload).digest('hex');
    return Buffer.from(`${payload}:${hmac}`).toString('base64url');
  }

  /**
   * Verifies signed download token and expiration
   * @param {string} token
   * @returns {{ valid: boolean, jobId?: string, reason?: string }}
   */
  verifyDownloadToken(token) {
    try {
      const decoded = Buffer.from(token, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      if (parts.length !== 3) {
        return { valid: false, reason: 'Malformed token structure' };
      }

      const [jobId, expiresAtStr, receivedHmac] = parts;
      const expiresAt = parseInt(expiresAtStr, 10);

      // Check signature
      const expectedPayload = `${jobId}:${expiresAt}`;
      const expectedHmac = crypto.createHmac('sha256', TOKEN_SECRET).update(expectedPayload).digest('hex');

      if (!crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))) {
        return { valid: false, reason: 'Invalid token signature' };
      }

      // Check expiration (15 minutes)
      if (Date.now() > expiresAt) {
        return { valid: false, reason: 'Download link has expired (15-minute limit)' };
      }

      return { valid: true, jobId };
    } catch (err) {
      return { valid: false, reason: 'Failed to verify token' };
    }
  }

  /**
   * Validates that a file path is strictly within the data/exports directory
   * @param {string} targetFilePath
   * @returns {boolean}
   */
  isSafePath(targetFilePath) {
    const resolvedTarget = path.resolve(targetFilePath);
    return resolvedTarget.startsWith(EXPORTS_DIR + path.sep);
  }

  /**
   * Creates an ExportJob and launches background file generation
   * @param {string} userId
   * @param {'csv'|'xlsx'|'pdf'|'whatsapp'|'json'} format
   * @param {object} filters
   * @returns {Promise<ExportJob>}
   */
  async createExportJob(userId, format, filters = {}) {
    const jobId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);
    const token = this.generateDownloadToken(jobId, expiresAt.getTime());

    const fileName = `knotiq_leads_${format}_${Date.now()}.${format === 'whatsapp' ? 'csv' : format}`;
    const destinationPath = path.join(EXPORTS_DIR, fileName);

    const job = await ExportJob.create({
      id: jobId,
      userId,
      format,
      status: 'pending',
      fileName,
      filePath: destinationPath,
      downloadUrl: `/api/exports/download/${token}`,
      expiresAt,
      filters
    });

    // Run export in background asynchronously
    this.processExport(job).catch((err) => {
      logger.error({ jobId, err: err.message }, 'Background export failed');
    });

    return job;
  }

  /**
   * Processes the export job and writes data to disk
   * @param {ExportJob} job
   */
  async processExport(job) {
    try {
      await job.update({ status: 'processing' });

      // Build query filters scoped to user
      const whereClause = { userId: job.userId };
      const filters = job.filters || {};

      if (filters.leadType) whereClause.leadType = filters.leadType;
      if (filters.country) whereClause.country = filters.country;
      if (filters.city) whereClause.city = filters.city;
      if (filters.status) whereClause.status = filters.status;
      if (filters.sellsRugsSignal !== undefined) whereClause.sellsRugsSignal = filters.sellsRugsSignal;

      const leads = await Lead.findAll({
        where: whereClause,
        order: [['score', 'DESC'], ['createdAt', 'DESC']],
        limit: filters.limit || 5000
      });

      // Guard path traversal
      if (!this.isSafePath(job.filePath)) {
        throw new Error('Unsafe export file path detected');
      }

      switch (job.format) {
        case 'csv':
          await writeCsvFile(job.filePath, leads);
          break;
        case 'xlsx':
          await writeXlsxFile(job.filePath, leads);
          break;
        case 'pdf':
          await writePdfFile(job.filePath, leads);
          break;
        case 'whatsapp':
          await writeWhatsappFile(job.filePath, leads);
          break;
        case 'json':
          await fs.promises.writeFile(job.filePath, JSON.stringify(leads, null, 2), 'utf8');
          break;
        default:
          throw new Error(`Unsupported export format: ${job.format}`);
      }

      await job.update({
        status: 'completed',
        totalRecords: leads.length
      });

      logger.info({ jobId: job.id, totalRecords: leads.length, format: job.format }, 'Export job completed successfully');
    } catch (err) {
      logger.error({ jobId: job.id, err: err.message }, 'Export job processing error');
      await job.update({
        status: 'failed',
        errorMessage: err.message
      });
    }
  }
}

module.exports = new ExportManager();
