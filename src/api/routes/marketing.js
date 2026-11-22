/**
 * Marketing Hub Router
 * Serves Marketing Overview KPIs, Lead Sources & Attribution analytics,
 * Excel export downloads, and Quick-Add Inbound Lead ingestion.
 */

const express = require('express');
const { z } = require('zod');
const { Op } = require('sequelize');
const Campaign = require('../../models/Campaign');
const CampaignLead = require('../../models/CampaignLead');
const ContentPost = require('../../models/ContentPost');
const Lead = require('../../models/Lead');
const UserSettings = require('../../models/UserSettings');
const attributionService = require('../../services/marketing/attributionService');
const inboundService = require('../../services/marketing/inboundService');
const campaignService = require('../../services/marketing/campaignService');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../config/logger');

const router = express.Router();

const inboundLeadSchema = z.object({
  businessName: z.string().min(1, 'Business or client name is required'),
  phone: z.string().optional().nullable(),
  email: z.string().email('Invalid email address').optional().nullable().or(z.literal('')),
  source: z.enum([
    'referral',
    'trade_show',
    'instagram',
    'linkedin',
    'website_form',
    'whatsapp_inbound',
    'walk_in',
    'other',
    'manual'
  ]).default('whatsapp_inbound'),
  buyerType: z.string().default('designer'),
  dealValue: z.number().optional().nullable(),
  dealCurrency: z.string().default('AED'),
  city: z.string().default('Dubai'),
  country: z.string().default('United Arab Emirates'),
  notes: z.string().optional().nullable()
});

/**
 * GET /api/marketing/overview - High-level cockpit for Marketing Hub
 */
router.get('/overview', async (req, res, next) => {
  try {
    const userId = req.userId;
    const now = new Date();

    // 1. Posts due this week
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(now.setDate(diff));
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    const [postsDueThisWeek, ideasCount, activeCampaigns, settings] = await Promise.all([
      ContentPost.findAll({
        where: {
          userId,
          scheduledAt: { [Op.between]: [startOfWeek, endOfWeek] }
        },
        order: [['scheduledAt', 'ASC']],
        limit: 10
      }),
      ContentPost.count({ where: { userId, status: 'idea' } }),
      Campaign.findAll({
        where: { userId, status: 'active' },
        order: [['startDate', 'DESC']],
        limit: 5
      }),
      UserSettings.findOne({ where: { userId } })
    ]);

    // Active campaign funnels mini-bars
    const activeCampaignFunnels = await Promise.all(
      activeCampaigns.map(async (c) => {
        const funnel = await campaignService.getCampaignFunnel(userId, c.id);
        return {
          id: c.id,
          name: c.name,
          channel: c.channel,
          stages: funnel.stages,
          revenue: funnel.revenue
        };
      })
    );

    // Consistency
    const publishedCount = await ContentPost.count({
      where: {
        userId,
        status: 'posted',
        postedAt: { [Op.gte]: startOfWeek }
      }
    });
    const weeklyTarget = settings?.weeklyPostTarget || 5;

    // Top source this month
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const recentLeads = await Lead.findAll({
      where: { userId, createdAt: { [Op.gte]: startOfMonth } },
      attributes: ['source']
    });

    const sourceFreq = new Map();
    recentLeads.forEach((l) => {
      const src = l.source || 'unspecified';
      sourceFreq.set(src, (sourceFreq.get(src) || 0) + 1);
    });

    let topSource = 'N/A';
    let topSourceCount = 0;
    sourceFreq.forEach((cnt, src) => {
      if (cnt > topSourceCount) {
        topSource = src;
        topSourceCount = cnt;
      }
    });

    res.json({
      success: true,
      postsDueThisWeek: postsDueThisWeek.map((p) => ({
        ...p.toJSON(),
        isMissed: Boolean(p.status !== 'posted' && p.scheduledAt && new Date(p.scheduledAt) < new Date())
      })),
      ideasCount,
      activeCampaigns: activeCampaignFunnels,
      consistency: {
        publishedThisWeek: publishedCount,
        weeklyTarget,
        percentage: Math.min(100, Math.round((publishedCount / weeklyTarget) * 100))
      },
      topSourceMonth: {
        source: topSource,
        count: topSourceCount
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/marketing/sources-report - Full attribution analytics and A/B metrics
 */
router.get('/sources-report', async (req, res, next) => {
  try {
    const userId = req.userId;
    const report = await attributionService.getSourcesReport(userId, req.query);
    res.json({ success: true, ...report });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/marketing/export-sources - Download Excel attribution report
 */
router.get('/export-sources', async (req, res, next) => {
  try {
    const userId = req.userId;
    const buffer = await attributionService.exportSourcesExcel(userId, req.query);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="knotiq_marketing_sources_${new Date().toISOString().slice(0, 10)}.xlsx"`);
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/marketing/inbound-lead - Quick Add Inbound Lead Form
 */
router.post('/inbound-lead', async (req, res, next) => {
  try {
    const userId = req.userId;
    const validated = inboundLeadSchema.parse(req.body);

    const lead = await inboundService.addInboundLead(userId, validated);

    await AuditLog.create({
      userId,
      action: 'create_inbound_lead',
      entity: 'Lead',
      entityId: String(lead.id),
      details: { businessName: lead.businessName, source: lead.source, buyerType: lead.buyerType }
    }).catch(() => {});

    res.status(201).json({ success: true, lead });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
