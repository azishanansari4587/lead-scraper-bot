/**
 * Outreach Templates & AI Drafting Router
 */

const express = require('express');
const OutreachTemplate = require('../../models/OutreachTemplate');
const Lead = require('../../models/Lead');
const outreachHelper = require('../../services/outreach/outreachHelper');
const bulkSendService = require('../../services/bulkSendService');
const env = require('../../config/env');

const router = express.Router();

router.get('/templates', async (req, res, next) => {
  try {
    const templates = await OutreachTemplate.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, templates });
  } catch (err) {
    next(err);
  }
});

router.post('/templates', async (req, res, next) => {
  try {
    const { name, targetLeadType, channel = 'email', subject, body, isDefault } = req.body;
    if (!name || !body) {
      return res.status(400).json({ error: 'ValidationError', message: 'name and body are required' });
    }

    const template = await OutreachTemplate.create({
      userId: req.userId,
      name,
      targetLeadType,
      channel,
      subject,
      body,
      isDefault: !!isDefault
    });

    res.status(201).json({ success: true, template });
  } catch (err) {
    next(err);
  }
});

router.put('/templates/:id', async (req, res, next) => {
  try {
    const template = await OutreachTemplate.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!template) {
      return res.status(404).json({ error: 'NotFound', message: 'Template not found' });
    }

    const { id: _, userId: __, ...updates } = req.body;
    await template.update(updates);
    res.json({ success: true, template });
  } catch (err) {
    next(err);
  }
});

router.delete('/templates/:id', async (req, res, next) => {
  try {
    const template = await OutreachTemplate.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!template) {
      return res.status(404).json({ error: 'NotFound', message: 'Template not found' });
    }

    await template.destroy();
    res.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/outreach/stats - Daily send caps tracking
 */
router.get('/stats', (req, res) => {
  res.json({
    success: true,
    dailySent: outreachHelper.getDailySentCount(req.userId),
    dailyCap: outreachHelper.dailyCap
  });
});

/**
 * POST /api/outreach/draft - Generate customized draft message for a lead with daily cap & suppression checks
 */
router.post('/draft', async (req, res, next) => {
  try {
    const { leadId, templateId, channel = 'email', useAi = false } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'ValidationError', message: 'leadId is required' });
    }

    const draft = await outreachHelper.generateOutreach({
      userId: req.userId,
      leadId,
      templateId,
      channel,
      useAi
    });

    res.json({
      success: true,
      draft
    });
  } catch (err) {
    if (err.message.includes('blocked') || err.message.includes('limit reached')) {
      return res.status(400).json({ error: 'OutreachGuardrail', message: err.message });
    }
    next(err);
  }
});

/**
 * POST /api/outreach/send-direct - Send personalized message & attachments directly to a single buyer
 */
router.post('/send-direct', async (req, res, next) => {
  try {
    const { leadId, channel = 'email', subject, body, attachments = [], dryRun } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'ValidationError', message: 'leadId is required' });
    }
    if (!body || typeof body !== 'string' || body.trim() === '') {
      return res.status(400).json({ error: 'ValidationError', message: 'Message body cannot be empty' });
    }

    const lead = await Lead.findOne({ where: { id: leadId, userId: req.userId } });
    if (!lead) {
      return res.status(404).json({ error: 'NotFound', message: 'Lead not found' });
    }

    let result;
    if (channel === 'email') {
      const recipient = lead.email;
      if (!recipient) {
        return res.status(400).json({ error: 'ValidationError', message: 'Lead does not have a valid email address' });
      }

      result = await bulkSendService.sendEmail({
        to: recipient,
        subject: subject || 'Knotiq Rugs - Partnership & Catalogue',
        body,
        lead,
        attachments,
        dryRun: dryRun !== undefined ? dryRun : env.DRY_RUN
      });
    } else {
      const rawPhone = lead.phone || lead.whatsapp;
      const phoneRes = bulkSendService.cleanPhone(rawPhone);
      if (!phoneRes.valid) {
        return res.status(400).json({ error: 'ValidationError', message: `Invalid phone number: ${phoneRes.reason}` });
      }

      result = await bulkSendService.sendWhatsApp({
        to: phoneRes.phone,
        message: body,
        lead,
        attachments,
        dryRun: dryRun !== undefined ? dryRun : env.DRY_RUN
      });
    }

    if (result.success) {
      await outreachHelper.recordOutreachSent(req.userId, leadId, channel);
      await lead.update({
        status: 'contacted',
        lastContactedAt: new Date()
      });
    }

    res.json({
      success: result.success,
      result,
      message: result.success ? `Message dispatched via ${channel} successfully!` : (result.error || 'Failed to dispatch message')
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/outreach/record-sent - Record manual outreach and update lead status
 */
router.post('/record-sent', async (req, res, next) => {
  try {
    const { leadId, channel = 'email' } = req.body;
    if (!leadId) {
      return res.status(400).json({ error: 'ValidationError', message: 'leadId is required' });
    }

    const lead = await Lead.findOne({ where: { id: leadId, userId: req.userId } });
    if (!lead) {
      return res.status(404).json({ error: 'NotFound', message: 'Lead not found' });
    }

    await outreachHelper.recordOutreachSent(req.userId, leadId, channel);
    await lead.update({
      status: 'contacted',
      lastContactedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Outreach recorded and lead status updated to contacted'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
