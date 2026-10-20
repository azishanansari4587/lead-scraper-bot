/**
 * Exports API Router
 * Manages lead export requests and secure signed token downloads with path traversal defenses.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const ExportJob = require('../../models/ExportJob');
const exportManager = require('../../services/exports/exportManager');
const { requireAuth } = require('../middleware/auth');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * POST /api/exports - Trigger an export job
 */
router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.userId;
    const { format = 'csv', filters = {} } = req.body;

    const allowedFormats = ['csv', 'xlsx', 'pdf', 'whatsapp', 'json'];
    if (!allowedFormats.includes(format)) {
      return res.status(400).json({
        error: 'ValidationError',
        message: `Invalid format '${format}'. Allowed formats: ${allowedFormats.join(', ')}`
      });
    }

    const job = await exportManager.createExportJob(userId, format, filters);
    res.status(202).json({
      success: true,
      job: {
        id: job.id,
        format: job.format,
        status: job.status,
        downloadUrl: job.downloadUrl,
        expiresAt: job.expiresAt
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/exports - List recent export jobs for current user
 */
router.get('/', requireAuth, async (req, res, next) => {
  try {
    const jobs = await ExportJob.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']],
      limit: 30
    });

    res.json({ success: true, jobs });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/exports/:id - Get export job status
 */
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const job = await ExportJob.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!job) {
      return res.status(404).json({ error: 'NotFound', message: 'Export job not found' });
    }

    res.json({ success: true, job });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/exports/download/:token - Download file using signed 15-minute token
 * This endpoint is public because the token itself carries an HMAC signature and expiry.
 */
router.get('/download/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const verification = exportManager.verifyDownloadToken(token);

    if (!verification.valid) {
      return res.status(403).json({
        error: 'Forbidden',
        message: verification.reason || 'Invalid or expired download link'
      });
    }

    const job = await ExportJob.findByPk(verification.jobId);
    if (!job) {
      return res.status(404).json({ error: 'NotFound', message: 'Export job not found' });
    }

    if (job.status !== 'completed' || !job.filePath) {
      return res.status(400).json({ error: 'NotReady', message: `Export job status is ${job.status}` });
    }

    // Path traversal defense
    if (!exportManager.isSafePath(job.filePath) || !fs.existsSync(job.filePath)) {
      logger.warn({ filePath: job.filePath }, 'Blocked attempt to access invalid or unsafe export file path');
      return res.status(400).json({ error: 'SecurityViolation', message: 'Invalid file path' });
    }

    res.download(job.filePath, job.fileName);
  } catch (err) {
    logger.error({ err: err.message }, 'Error serving export download');
    res.status(500).json({ error: 'ServerError', message: 'Failed to download file' });
  }
});

module.exports = router;
