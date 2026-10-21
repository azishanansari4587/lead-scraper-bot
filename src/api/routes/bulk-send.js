/**
 * Bulk Send API Router for Knotiq Rugs
 * Exposes POST /api/bulk/send, GET /api/bulk/status/:id, POST /api/bulk/upload,
 * GET /api/bulk/leads, GET /api/bulk/history, and password/API key authentication.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ExcelJS = require('exceljs');
const env = require('../../config/env');
const logger = require('../../config/logger');
const bulkSendService = require('../../services/bulkSendService');
const crypto = require('crypto');
const Lead = require('../../models/Lead');
const OptOut = require('../../models/OptOut');
const BulkSendLog = require('../../models/BulkSendLog');
const { requireAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

// Attachment upload storage for PDFs, Catalogs, Images
const attachmentsDir = path.resolve(process.cwd(), 'data/attachments');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}

const attachmentStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, attachmentsDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const unique = `${Date.now()}_${safeName}`;
    cb(null, unique);
  }
});

const uploadAttachment = multer({
  storage: attachmentStorage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.doc', '.docx'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type '${ext}' not supported. Please upload PDF or image files.`));
    }
  }
});

// Multer memory storage with 5MB file size limit for CSV/Excel lead lists
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = (file.originalname || '').toLowerCase();
    if (ext.endsWith('.csv') || ext.endsWith('.xlsx') || ext.endsWith('.xls')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel (.xlsx, .xls) files are supported.'));
    }
  }
});

function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Authentication Middleware for Bulk Send
 * Protects against unauthorized access when exposed via localtunnel.
 */
function authBulk(req, res, next) {
  const isProduction = (env.NODE_ENV === 'production' || process.env.NODE_ENV === 'production');

  // Test auth bypass: strictly in non-production when ENABLE_TEST_AUTH is on
  if (!isProduction && env.ENABLE_TEST_AUTH && (req.headers['x-test-user-id'] || env.NODE_ENV === 'test')) {
    const role = req.headers['x-test-role'] || 'admin';
    req.userId = req.headers['x-test-user-id'] || 'test_user';
    req.auth = { userId: req.userId, role };
    return next();
  }

  // Already authenticated via Clerk / JWT session
  if (req.auth && req.auth.role === 'admin') {
    req.userId = req.auth.userId;
    return next();
  }

  const configuredPass = env.BULK_PASSWORD || process.env.BULK_PASSWORD;
  if (!configuredPass || (isProduction && configuredPass === 'knotiq2026')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Bulk Auth Password is unset or using an insecure default.'
    });
  }

  const providedPass =
    req.headers['x-bulk-auth'] ||
    (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')
      ? req.headers.authorization.split(' ')[1]
      : null);

  if (configuredPass && providedPass && safeCompare(providedPass, configuredPass)) {
    req.userId = 'bulk_admin';
    req.auth = { userId: 'bulk_admin', role: 'admin' };
    return next();
  }

  return res.status(401).json({
    error: 'Unauthorized',
    message: 'Invalid or missing Bulk Auth Password.'
  });
}

// Apply authBulk and requireAdmin to all routes in this router
router.use(authBulk);
router.use(requireAdmin);

/**
 * GET /api/bulk/verify-auth - Check if current credentials are valid
 */
router.get('/verify-auth', (req, res) => {
  res.json({ success: true, authenticated: true, message: 'Authentication successful' });
});

/**
 * POST /api/bulk/send - Start a background bulk sending job
 */
router.post('/send', async (req, res, next) => {
  try {
    const configuredPass = env.BULK_PASSWORD || process.env.BULK_PASSWORD;
    const isTest = (env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test');
    if (!isTest && (!configuredPass || configuredPass === 'knotiq2026')) {
      return res.status(403).json({
        error: 'SecurityRefusal',
        message: 'BULK_PASSWORD is unset or set to the default insecure value. Refusing to start bulk sending.'
      });
    }
    const {
      leads,
      channels = ['email'],
      subject = '',
      message,
      attachments = [],
      useTemplate = false,
      skipAlreadySent = true,
      delayMs = env.DELAY_MS || 3000,
      dryRun = env.DRY_RUN || false
    } = req.body;

    if (!Array.isArray(leads) || leads.length === 0) {
      return res.status(400).json({ error: 'ValidationError', message: 'Leads array cannot be empty.' });
    }

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'ValidationError', message: 'Message body is required.' });
    }

    const validChannels = channels.filter((c) => c === 'email' || c === 'whatsapp');
    if (validChannels.length === 0) {
      return res.status(400).json({ error: 'ValidationError', message: 'At least one channel (email or whatsapp) must be selected.' });
    }

    const jobId = bulkSendService.startBulkJob({
      leads,
      channels: validChannels,
      subject,
      message,
      attachments,
      useTemplate,
      skipAlreadySent,
      delayMs: Number(delayMs) || 3000,
      dryRun: !!dryRun,
      userId: req.userId || 'dev_user_knotiq'
    });

    res.status(202).json({
      success: true,
      message: 'Bulk send job started successfully',
      jobId,
      totalLeads: leads.length,
      channels: validChannels,
      dryRun: !!dryRun
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bulk/status/:id - Get real-time status of a job
 */
router.get('/status/:id', (req, res) => {
  const job = bulkSendService.getJobStatus(req.params.id);
  if (!job) {
    return res.status(404).json({ error: 'NotFound', message: `Job ${req.params.id} not found.` });
  }

  res.json({
    success: true,
    job
  });
});

/**
 * POST /api/bulk/stop/:id - Stop an ongoing job
 */
router.post('/stop/:id', (req, res) => {
  const stopped = bulkSendService.stopJob(req.params.id);
  if (!stopped) {
    return res.status(400).json({ error: 'BadRequest', message: 'Job not found or not currently running.' });
  }

  res.json({
    success: true,
    message: `Job ${req.params.id} was stopped.`
  });
});

/**
 * POST /api/bulk/upload-attachment - Upload PDF or Image attachment
 */
router.post('/upload-attachment', uploadAttachment.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'ValidationError', message: 'No file uploaded.' });
  }

  res.json({
    success: true,
    attachment: {
      filename: req.file.originalname,
      savedName: req.file.filename,
      path: req.file.path,
      size: req.file.size,
      mimeType: req.file.mimetype,
      url: `/api/attachments/${req.file.filename}`
    }
  });
});

/**
 * POST /api/bulk/upload - Upload and parse CSV / XLSX file
 */
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ValidationError', message: 'No file uploaded.' });
    }

    const filename = req.file.originalname.toLowerCase();
    const workbook = new ExcelJS.Workbook();

    if (filename.endsWith('.csv')) {
      const { Readable } = require('stream');
      const stream = Readable.from(req.file.buffer);
      await workbook.csv.read(stream);
    } else {
      await workbook.xlsx.load(req.file.buffer);
    }

    const worksheet = workbook.worksheets[0];
    if (!worksheet) {
      return res.status(400).json({ error: 'ValidationError', message: 'Worksheet is empty.' });
    }

    // Inspect header row (row 1)
    const headerRow = worksheet.getRow(1);
    const headers = [];
    headerRow.eachCell((cell, colNumber) => {
      headers[colNumber] = String(cell.value || '').trim();
    });

    // Flexible column mapping
    let nameCol = -1;
    let companyCol = -1;
    let emailCol = -1;
    let phoneCol = -1;
    let cityCol = -1;
    let countryCol = -1;

    for (let c = 1; c < headers.length; c++) {
      const h = (headers[c] || '').toLowerCase();
      if (emailCol === -1 && /email|e-mail|mail/i.test(h)) emailCol = c;
      else if (phoneCol === -1 && /phone|mobile|cell|whatsapp|contact.*no|tel/i.test(h)) phoneCol = c;
      else if (companyCol === -1 && /company|business|organization|firm|org/i.test(h)) companyCol = c;
      else if (nameCol === -1 && /name|full\s*name|contact|lead/i.test(h)) nameCol = c;
      else if (cityCol === -1 && /city|location/i.test(h)) cityCol = c;
      else if (countryCol === -1 && /country/i.test(h)) countryCol = c;
    }

    const parsedLeads = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const getVal = (col) => {
        if (col === -1) return '';
        const val = row.getCell(col).value;
        if (val && typeof val === 'object') {
          return val.text || val.result || '';
        }
        return val ? String(val).trim() : '';
      };

      const name = getVal(nameCol);
      const company = getVal(companyCol) || name;
      const email = getVal(emailCol);
      const phone = getVal(phoneCol);
      const city = getVal(cityCol);
      const country = getVal(countryCol);

      // Only include rows that have at least an email or a phone
      if (email || phone) {
        parsedLeads.push({
          id: `upload_${rowNumber}`,
          name: name || company || `Lead #${rowNumber}`,
          company: company || name || 'Company',
          email,
          phone,
          city,
          country,
          source: 'upload'
        });
      }
    });

    res.json({
      success: true,
      filename: req.file.originalname,
      count: parsedLeads.length,
      leads: parsedLeads
    });
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to parse uploaded leads file');
    next(err);
  }
});

/**
 * GET /api/bulk/leads - Fetch existing leads from DB with search/filter
 */
router.get('/leads', async (req, res, next) => {
  try {
    const { city, leadType, search, limit = 200 } = req.query;
    const where = {};

    if (city) where.city = city;
    if (leadType) where.leadType = leadType;
    if (search) {
      where[Op.or] = [
        { businessName: { [Op.like]: `%${search}%` } },
        { email: { [Op.like]: `%${search}%` } },
        { phone: { [Op.like]: `%${search}%` } }
      ];
    }

    const leads = await Lead.findAll({
      where,
      limit: Math.min(Number(limit) || 200, 500),
      order: [['score', 'DESC'], ['createdAt', 'DESC']]
    });

    const formatted = leads.map((l) => ({
      id: l.id,
      name: l.businessName,
      company: l.businessName,
      businessName: l.businessName,
      leadType: l.leadType,
      city: l.city,
      country: l.country,
      email: l.email || l.email2 || '',
      phone: l.whatsapp || l.phone || l.phone2 || '',
      score: l.score,
      status: l.status,
      lastContactedAt: l.lastContactedAt
    }));

    res.json({
      success: true,
      count: formatted.length,
      leads: formatted
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/bulk/history - Recent send history
 */
router.get('/history', async (req, res, next) => {
  try {
    const logs = await BulkSendLog.findAll({
      limit: 100,
      order: [['sentAt', 'DESC']]
    });

    const todayCount = await bulkSendService.getDailySentCount();

    res.json({
      success: true,
      dailySent: todayCount,
      dailyLimit: env.DAILY_LIMIT || 50,
      logs
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/bulk/optout - Add recipient to STOP list
 */
router.post('/optout', async (req, res, next) => {
  try {
    const { type, value, reason = 'User requested STOP' } = req.body;
    if (!type || !value) {
      return res.status(400).json({ error: 'ValidationError', message: 'type and value are required.' });
    }

    const cleanVal = type === 'email' ? value.trim().toLowerCase() : value.replace(/[^0-9]/g, '');
    const [opt, created] = await OptOut.findOrCreate({
      where: { type, value: cleanVal },
      defaults: { reason }
    });

    res.json({
      success: true,
      created,
      optOut: opt
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
