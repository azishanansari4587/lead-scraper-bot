/**
 * Campaigns Router
 * Endpoints for campaign creation, filtered bulk lead ingestion,
 * stage-rank funnel reporting, send queue execution, and archiving.
 */

const express = require('express');
const { z } = require('zod');
const Campaign = require('../../models/Campaign');
const CampaignLead = require('../../models/CampaignLead');
const Lead = require('../../models/Lead');
const campaignService = require('../../services/marketing/campaignService');
const AuditLog = require('../../models/AuditLog');
const logger = require('../../config/logger');

const router = express.Router();

const campaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  goal: z.string().max(255).optional().nullable(),
  channel: z.enum(['email', 'whatsapp', 'instagram', 'linkedin', 'trade_show', 'mixed', 'other']).default('email'),
  targetBuyerType: z.string().max(50).optional().nullable(),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
  status: z.enum(['planned', 'active', 'paused', 'completed', 'archived']).default('planned'),
  budget: z.number().optional().nullable(),
  currency: z.string().max(10).default('AED'),
  notes: z.string().optional().nullable()
});

/**
 * GET /api/campaigns - List campaigns
 */
router.get('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const where = { userId };
    if (req.query.status && req.query.status !== 'all') {
      where.status = req.query.status;
    }

    const campaigns = await Campaign.findAll({
      where,
      order: [
        ['status', 'ASC'],
        ['startDate', 'DESC'],
        ['createdAt', 'DESC']
      ]
    });

    // Attach quick lead counts
    const campaignList = await Promise.all(
      campaigns.map(async (c) => {
        const leadCount = await CampaignLead.count({ where: { campaignId: c.id, userId } });
        return {
          ...c.toJSON(),
          leadCount
        };
      })
    );

    res.json({ success: true, total: campaignList.length, campaigns: campaignList });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns - Create a new campaign
 */
router.post('/', async (req, res, next) => {
  try {
    const userId = req.userId;
    const validated = campaignSchema.parse(req.body);

    const campaign = await Campaign.create({
      userId,
      ...validated
    });

    await AuditLog.create({
      userId,
      action: 'create_campaign',
      entity: 'Campaign',
      entityId: String(campaign.id),
      details: { name: campaign.name, channel: campaign.channel }
    }).catch(() => {});

    res.status(201).json({ success: true, campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns/:id - Get campaign details with funnel metrics and lead roster
 */
router.get('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);

    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const funnel = await campaignService.getCampaignFunnel(userId, campaignId);

    const leads = await CampaignLead.findAll({
      where: { campaignId, userId },
      include: [{
        model: Lead,
        as: 'lead',
        attributes: ['id', 'businessName', 'email', 'phone', 'whatsapp', 'buyerType', 'city', 'country', 'status', 'dealValue', 'dealCurrency', 'score']
      }],
      order: [['addedAt', 'DESC']]
    });

    res.json({
      success: true,
      campaign,
      funnel,
      leads: leads.map((cl) => cl.lead).filter(Boolean)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/campaigns/:id - Update campaign details
 */
router.patch('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const campaign = await Campaign.findOne({ where: { id: req.params.id, userId } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    await campaign.update(req.body);
    res.json({ success: true, campaign });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:id/preview-leads - Preview lead count and skipped opt-outs before bulk addition
 */
router.post('/:id/preview-leads', async (req, res, next) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const preview = await campaignService.previewLeads(userId, req.body.filters || {});
    res.json({ success: true, ...preview });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:id/add-leads - Bulk add filtered leads to campaign (enforces OptOut skip)
 */
router.post('/:id/add-leads', async (req, res, next) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const result = await campaignService.bulkAddLeads(userId, campaignId, req.body.filters || {});

    await AuditLog.create({
      userId,
      action: 'add_leads_to_campaign',
      entity: 'Campaign',
      entityId: String(campaignId),
      details: { addedCount: result.addedCount, skippedOptOuts: result.skippedOptOuts }
    }).catch(() => {});

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/campaigns/:id/send-queue - Get queue of pending leads to send for this campaign
 */
router.get('/:id/send-queue', async (req, res, next) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const queueData = await campaignService.getCampaignSendQueue(userId, campaignId);
    res.json({ success: true, ...queueData });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/campaigns/:id/record-send - Record sent outreach for a queued lead (re-checks OptOut and creates Day 4/7 follow-ups)
 */
router.post('/:id/record-send', async (req, res, next) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    const { leadId, messageSent, variant, templateId } = req.body;

    if (!leadId) {
      return res.status(400).json({ success: false, message: 'leadId is required' });
    }

    const result = await campaignService.recordCampaignSend(userId, campaignId, leadId, {
      messageSent,
      variant,
      templateId
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/campaigns/:id - Archive or delete campaign (Rule 9)
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const userId = req.userId;
    const campaignId = parseInt(req.params.id, 10);
    const result = await campaignService.archiveCampaign(userId, campaignId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
