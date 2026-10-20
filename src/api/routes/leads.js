/**
 * Leads REST API Router
 * Endpoints for searching, paginating, creating, updating, and bulk operations on leads.
 */

const express = require('express');
const { Op } = require('sequelize');
const Lead = require('../../models/Lead');
const AuditLog = require('../../models/AuditLog');
const { calculateLeadScore } = require('../../services/scoring');
const { generateDedupeKey, normalizeDomain, normalizePhone } = require('../../services/dedupe');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * GET /api/leads - List and filter leads
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const where = { userId };

    // Filters
    if (req.query.leadType) where.leadType = req.query.leadType;
    if (req.query.country) where.country = req.query.country;
    if (req.query.city) where.city = req.query.city;
    if (req.query.status) where.status = req.query.status;
    if (req.query.source) where.source = req.query.source;

    if (req.query.sellsRugsSignal !== undefined) {
      where.sellsRugsSignal = req.query.sellsRugsSignal === 'true';
    }

    if (req.query.minScore) {
      const minScore = parseInt(req.query.minScore, 10);
      if (!isNaN(minScore)) {
        where.score = { [Op.gte]: minScore };
      }
    }

    if (req.query.hasEmail === 'true') {
      where.email = { [Op.ne]: null };
    }
    if (req.query.hasPhone === 'true') {
      where.phone = { [Op.ne]: null };
    }
    if (req.query.hasWebsite === 'true') {
      where.website = { [Op.ne]: null };
    }

    // Search query
    if (req.query.search) {
      const search = `%${req.query.search.trim()}%`;
      where[Op.or] = [
        { businessName: { [Op.like]: search } },
        { city: { [Op.like]: search } },
        { email: { [Op.like]: search } },
        { phone: { [Op.like]: search } }
      ];
    }

    // Sorting
    const sortBy = req.query.sortBy || 'score';
    const sortOrder = req.query.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const allowedSortFields = ['score', 'createdAt', 'rating', 'reviewCount', 'businessName'];
    const order = [[allowedSortFields.includes(sortBy) ? sortBy : 'score', sortOrder]];

    const { count, rows } = await Lead.findAndCountAll({
      where,
      limit,
      offset,
      order
    });

    res.json({
      success: true,
      total: count,
      page,
      limit,
      totalPages: Math.ceil(count / limit),
      leads: rows
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/leads/stats - Summary metrics for dashboard
 */
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.userId;
    const leads = await Lead.findAll({ where: { userId } });

    const total = leads.length;
    const highFit = leads.filter((l) => (l.score || 0) >= 70).length;
    const rugsVerified = leads.filter((l) => l.sellsRugsSignal).length;
    const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / total) : 0;

    const byLeadType = {};
    const byCountry = {};
    const byStatus = {};

    leads.forEach((l) => {
      byLeadType[l.leadType] = (byLeadType[l.leadType] || 0) + 1;
      byCountry[l.country] = (byCountry[l.country] || 0) + 1;
      byStatus[l.status] = (byStatus[l.status] || 0) + 1;
    });

    res.json({
      success: true,
      total,
      highFit,
      rugsVerified,
      avgScore,
      byLeadType,
      byCountry,
      byStatus
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/leads/:id - Single lead detail
 */
router.get('/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!lead) {
      return res.status(404).json({ error: 'NotFound', message: 'Lead not found' });
    }

    res.json({ success: true, lead });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/leads - Create lead manually
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const payload = req.body;

    if (!payload.businessName || !payload.country || !payload.city) {
      return res.status(400).json({ error: 'ValidationError', message: 'businessName, country, and city are required' });
    }

    const leadData = {
      ...payload,
      userId,
      domain: payload.domain || (payload.website ? normalizeDomain(payload.website) : null),
      phone: payload.phone ? normalizePhone(payload.phone) : null,
      whatsapp: payload.whatsapp ? normalizePhone(payload.whatsapp) : (payload.phone ? normalizePhone(payload.phone) : null),
      leadType: payload.leadType || 'rug_retailer',
      source: payload.source || 'manual',
      status: payload.status || 'new'
    };

    leadData.dedupeKey = generateDedupeKey(leadData);
    const scoreResult = calculateLeadScore(leadData);
    leadData.score = scoreResult.score;
    leadData.scoreReason = scoreResult.scoreReason;

    const created = await Lead.create(leadData);

    await AuditLog.create({
      userId,
      action: 'lead_created',
      entityType: 'Lead',
      entityId: String(created.id),
      details: { businessName: created.businessName }
    });

    res.status(201).json({ success: true, lead: created });
  } catch (err) {
    if (err.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'DuplicateLead',
        message: 'A lead with the same business name, domain, or phone already exists'
      });
    }
    next(err);
  }
});

/**
 * PATCH /api/leads/:id - Update lead
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!lead) {
      return res.status(404).json({ error: 'NotFound', message: 'Lead not found' });
    }

    // Do not allow changing userId or dedupeKey directly
    const { userId: _, dedupeKey: __, id: ___, ...updates } = req.body;

    // Recalculate score if key attributes changed
    if (updates.leadType || updates.phone || updates.email || updates.website || updates.sellsRugsSignal !== undefined) {
      const merged = { ...lead.toJSON(), ...updates };
      const scoreResult = calculateLeadScore(merged);
      updates.score = scoreResult.score;
      updates.scoreReason = scoreResult.scoreReason;
    }

    await lead.update(updates);

    await AuditLog.create({
      userId: req.userId,
      action: 'lead_updated',
      entityType: 'Lead',
      entityId: String(lead.id),
      details: updates
    });

    res.json({ success: true, lead });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/leads/:id - Delete single lead
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const lead = await Lead.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!lead) {
      return res.status(404).json({ error: 'NotFound', message: 'Lead not found' });
    }

    await lead.destroy();

    await AuditLog.create({
      userId: req.userId,
      action: 'lead_deleted',
      entityType: 'Lead',
      entityId: String(req.params.id)
    });

    res.json({ success: true, message: 'Lead deleted successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/leads/bulk-delete - Delete multiple leads
 */
router.post('/bulk-delete', async (req, res, next) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'ValidationError', message: 'ids array required' });
    }

    const deletedCount = await Lead.destroy({
      where: {
        id: ids,
        userId: req.userId
      }
    });

    res.json({ success: true, deletedCount });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/leads/bulk-status - Bulk update status
 */
router.post('/bulk-status', async (req, res, next) => {
  try {
    const { ids, status } = req.body;
    if (!Array.isArray(ids) || !status) {
      return res.status(400).json({ error: 'ValidationError', message: 'ids array and status required' });
    }

    const [updatedCount] = await Lead.update(
      { status },
      {
        where: {
          id: ids,
          userId: req.userId
        }
      }
    );

    res.json({ success: true, updatedCount });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
