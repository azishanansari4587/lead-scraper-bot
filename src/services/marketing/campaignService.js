/**
 * Campaign Management & Funnel Aggregation Service
 * Enforces multi-stage OptOut suppression, strict tenancy checks,
 * deterministic A/B variant assignment, and stage-rank funnel reporting.
 */

const { Op } = require('sequelize');
const Campaign = require('../../models/Campaign');
const CampaignLead = require('../../models/CampaignLead');
const Lead = require('../../models/Lead');
const OptOut = require('../../models/OptOut');
const OutreachLog = require('../../models/OutreachLog');
const OutreachTemplate = require('../../models/OutreachTemplate');
const Call = require('../../models/Call');
const AuditLog = require('../../models/AuditLog');
const followUpEngine = require('../followUp/followUpEngine');
const abTestingService = require('./abTestingService');
const outreachHelper = require('../outreach/outreachHelper');
const bulkSendService = require('../bulkSendService');
const env = require('../../config/env');
const logger = require('../../config/logger');

// Stage ranking mapping for funnel evaluation (Rule 2)
const STATUS_RANK = {
  new: 1,
  contacted: 2,
  replied: 3,
  sample_sent: 4,
  quotation: 5,
  negotiation: 5,
  won: 6,
  repeat_client: 6,
  lost: 0,
  not_interested: 0
};

class CampaignService {
  /**
   * Checks if a lead is opted out (either via Lead.optedOut flag or OptOut table)
   * @param {object} lead
   * @returns {Promise<boolean>}
   */
  async isLeadOptedOut(lead) {
    if (lead.optedOut) return true;

    const values = [];
    if (lead.email) values.push({ type: 'email', value: lead.email.toLowerCase().trim() });
    if (lead.domain) values.push({ type: 'domain', value: lead.domain.toLowerCase().trim() });
    if (lead.phone) values.push({ type: 'phone', value: lead.phone.replace(/[^0-9+]/g, '') });

    for (const item of values) {
      const match = await OptOut.findOne({ where: { type: item.type, value: item.value } });
      if (match) return true;
    }

    return false;
  }

  /**
   * Preview lead filter counts and calculate skipped opt-outs before adding to campaign
   */
  async previewLeads(userId, filters = {}) {
    const where = { userId };

    if (filters.buyerType && filters.buyerType !== 'all') where.buyerType = filters.buyerType;
    if (filters.city) where.city = filters.city;
    if (filters.country) where.country = filters.country;
    if (filters.status && filters.status !== 'all') where.status = filters.status;
    if (filters.priority && filters.priority !== 'all') where.priority = filters.priority;
    if (filters.minScore !== undefined) {
      where.score = { [Op.gte]: parseInt(filters.minScore, 10) };
    }
    if (filters.maxScore !== undefined) {
      where.score = { ...(where.score || {}), [Op.lte]: parseInt(filters.maxScore, 10) };
    }

    const matchedLeads = await Lead.findAll({
      where,
      attributes: ['id', 'businessName', 'email', 'phone', 'domain', 'buyerType', 'city', 'country', 'optedOut', 'status', 'score'],
      limit: 1000
    });

    let skippedOptOuts = 0;
    const eligibleLeads = [];

    for (const lead of matchedLeads) {
      const optedOut = await this.isLeadOptedOut(lead);
      if (optedOut) {
        skippedOptOuts++;
      } else {
        eligibleLeads.push(lead);
      }
    }

    return {
      totalMatched: matchedLeads.length,
      skippedOptOuts,
      eligibleCount: eligibleLeads.length,
      sampleLeads: eligibleLeads.slice(0, 5)
    };
  }

  /**
   * Bulk add filtered leads to campaign with tenancy and OptOut exclusion
   */
  async bulkAddLeads(userId, campaignId, filters = {}) {
    // Rule 5: Ownership validation
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      throw new Error('Campaign not found or access denied');
    }

    const { eligibleCount, skippedOptOuts, sampleLeads } = await this.previewLeads(userId, filters);

    // Fetch full eligible list
    const where = { userId };
    if (filters.buyerType && filters.buyerType !== 'all') where.buyerType = filters.buyerType;
    if (filters.city) where.city = filters.city;
    if (filters.country) where.country = filters.country;
    if (filters.status && filters.status !== 'all') where.status = filters.status;
    if (filters.priority && filters.priority !== 'all') where.priority = filters.priority;
    if (filters.minScore !== undefined) where.score = { [Op.gte]: parseInt(filters.minScore, 10) };
    if (filters.maxScore !== undefined) where.score = { ...(where.score || {}), [Op.lte]: parseInt(filters.maxScore, 10) };

    const candidates = await Lead.findAll({ where });

    let addedCount = 0;
    for (const lead of candidates) {
      const optedOut = await this.isLeadOptedOut(lead);
      if (!optedOut) {
        const [_, created] = await CampaignLead.findOrCreate({
          where: { campaignId, leadId: lead.id },
          defaults: {
            userId,
            campaignId,
            leadId: lead.id,
            addedAt: new Date()
          }
        });
        if (created) addedCount++;
      }
    }

    const totalInCampaign = await CampaignLead.count({ where: { campaignId, userId } });

    logger.info({ campaignId, addedCount, skippedOptOuts, totalInCampaign }, 'Bulk added leads to campaign');
    return {
      success: true,
      addedCount,
      skippedOptOuts,
      totalInCampaign
    };
  }

  /**
   * Calculates campaign funnel by status rank (Rule 2)
   */
  async getCampaignFunnel(userId, campaignId) {
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      throw new Error('Campaign not found or access denied');
    }

    const campaignLeads = await CampaignLead.findAll({
      where: { campaignId, userId },
      include: [{
        model: Lead,
        as: 'lead',
        attributes: ['id', 'businessName', 'buyerType', 'status', 'dealValue', 'dealCurrency', 'score', 'city', 'country']
      }]
    });

    const totalAdded = campaignLeads.length;

    // Counts per stage rank
    let contactedCount = 0;
    let repliedCount = 0;
    let sampleSentCount = 0;
    let quotationCount = 0;
    let wonCount = 0;
    let lostCount = 0;

    let wonRevenueTotal = 0;
    let wonWithoutValueCount = 0;
    let leadsWithNoValue = 0;

    campaignLeads.forEach(({ lead }) => {
      if (!lead) return;
      if (lead.dealValue === null || lead.dealValue === undefined) {
        leadsWithNoValue++;
      }
      const rank = STATUS_RANK[lead.status] || 0;

      if (rank >= 2) contactedCount++;
      if (rank >= 3) repliedCount++;
      if (rank >= 4) sampleSentCount++;
      if (rank >= 5) quotationCount++;
      if (rank >= 6) {
        wonCount++;
        if (lead.dealValue !== null && lead.dealValue !== undefined) {
          wonRevenueTotal += parseFloat(lead.dealValue) || 0;
        } else {
          wonWithoutValueCount++;
        }
      }

      if (lead.status === 'lost' || lead.status === 'not_interested') {
        lostCount++;
      }
    });

    // Derive lost stages from audit logs and activity history (Item 7)
    const lostByStage = {
      new: 0,
      contacted: 0,
      replied: 0,
      sample_sent: 0,
      quotation: 0,
      negotiation: 0,
      unknown: 0
    };

    for (const { lead } of campaignLeads) {
      if (!lead) continue;
      if (lead.status === 'lost' || lead.status === 'not_interested') {
        const stageLost = await this.getLostStageForLead(lead.id, userId);
        lostByStage[stageLost] = (lostByStage[stageLost] || 0) + 1;
      }
    }

    const calcPct = (cnt) => totalAdded > 0 ? parseFloat(((cnt / totalAdded) * 100).toFixed(1)) : 0;

    const stages = [
      { key: 'added', label: 'Added to Campaign', count: totalAdded, percentage: 100 },
      { key: 'contacted', label: 'Contacted', count: contactedCount, percentage: calcPct(contactedCount) },
      { key: 'replied', label: 'Replied', count: repliedCount, percentage: calcPct(repliedCount) },
      { key: 'sample_sent', label: 'Sample Swatches Sent', count: sampleSentCount, percentage: calcPct(sampleSentCount) },
      { key: 'quotation', label: 'Quotation / Specs', count: quotationCount, percentage: calcPct(quotationCount) },
      { key: 'won', label: 'Deal Won', count: wonCount, percentage: calcPct(wonCount) }
    ];

    stages.added = totalAdded;
    stages.contacted = contactedCount;
    stages.replied = repliedCount;
    stages.sample_sent = sampleSentCount;
    stages.quotation = quotationCount;
    stages.won = wonCount;

    // Activity attribution counters
    const [callsCount, outreachCount] = await Promise.all([
      Call.count({ where: { userId, campaignId } }),
      OutreachLog.count({ where: { userId, campaignId } })
    ]);

    return {
      campaignId,
      campaignName: campaign.name,
      channel: campaign.channel,
      currency: campaign.currency || 'AED',
      stages,
      lost: {
        count: lostCount,
        percentage: calcPct(lostCount),
        byStage: lostByStage,
        note: 'Lost stages are derived from status change audit logs and activity history. Unlogged transitions are categorized under unknown.'
      },
      revenue: {
        total: wonRevenueTotal,
        wonRevenue: wonRevenueTotal,
        totalDealValue: wonRevenueTotal,
        currency: campaign.currency || 'AED',
        wonWithDealCount: wonCount - wonWithoutValueCount,
        wonWithoutValueCount,
        leadsWithNoValue
      },
      activity: {
        callsMade: callsCount,
        outreachSent: outreachCount,
        repliesReceived: repliedCount
      }
    };
  }

  /**
   * Derives stage at which a lead was lost from status change audit logs or outreach history
   */
  async getLostStageForLead(leadId, userId) {
    try {
      // 1. Check AuditLog for status change details
      const audit = await AuditLog.findOne({
        where: {
          userId,
          entityType: 'Lead',
          entityId: String(leadId),
          action: { [Op.or]: ['update_lead_status', 'update_lead'] }
        },
        order: [['createdAt', 'DESC']]
      });

      if (audit && audit.details) {
        let details = audit.details;
        if (typeof details === 'string') {
          try { details = JSON.parse(details); } catch (_) {}
        }
        const prev = details?.previousStatus || details?.oldStatus || details?.fromStatus;
        if (prev && STATUS_RANK[prev] !== undefined && STATUS_RANK[prev] > 0) {
          return prev;
        }
      }

      // 2. Fallback: inspect activity history
      const hasReplied = await OutreachLog.findOne({ where: { userId, leadId, outcome: 'replied' } });
      if (hasReplied) return 'replied';

      const hasSent = await OutreachLog.findOne({ where: { userId, leadId, outcome: 'sent' } });
      if (hasSent) return 'contacted';

      return 'new';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Deterministic Template Selection Engine (Item 2)
   * Resolves the single active template to use for a lead:
   * 1. Filters by isActive = true.
   * 2. Finds template for specific buyerType, ordered by: isDefault DESC, updatedAt DESC, id DESC.
   * 3. If none found and buyerType specified, falls back to generic active template (buyerType = null).
   * 4. If requested variant is 'B' and no active B template exists, falls back to active Variant A template.
   * 5. Always returns { template, templateId, variant, isFallback }.
   */
  async resolveTemplate(userId, { channel = 'email', buyerType = null, step = 'day1', variant = 'A' }) {
    const ch = channel === 'whatsapp' ? 'whatsapp' : 'email';

    const findActive = async (bType, v) => {
      const where = {
        userId,
        channel: ch,
        step,
        variant: v,
        isActive: true
      };
      if (bType) {
        where.buyerType = bType;
      } else {
        where.buyerType = null;
      }

      return OutreachTemplate.findOne({
        where,
        order: [
          ['isDefault', 'DESC'],
          ['updatedAt', 'DESC'],
          ['id', 'DESC']
        ]
      });
    };

    // 1. Try specific buyerType with requested variant
    let template = await findActive(buyerType, variant);

    // 2. Fall back to generic template (buyerType = null) with requested variant
    if (!template && buyerType) {
      template = await findActive(null, variant);
    }

    // 3. Honest Challenger Fallback: if variant was 'B' and no active B template found, fall back to Variant A
    if (!template && variant === 'B') {
      let fallbackA = await findActive(buyerType, 'A');
      if (!fallbackA && buyerType) {
        fallbackA = await findActive(null, 'A');
      }

      if (fallbackA) {
        return {
          template: fallbackA,
          templateId: fallbackA.id,
          variant: 'A', // Honest fallback to A
          isFallback: true
        };
      }
    }

    return {
      template,
      templateId: template?.id || null,
      variant: template ? variant : 'A',
      isFallback: false
    };
  }

  /**
   * Retrieves send queue for campaign channel with A/B template assignment and OptOut safety
   */
  async getCampaignSendQueue(userId, campaignId) {
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) {
      throw new Error('Campaign not found or access denied');
    }

    const campaignLeads = await CampaignLead.findAll({
      where: { campaignId, userId },
      include: [{
        model: Lead,
        as: 'lead',
        attributes: ['id', 'businessName', 'email', 'phone', 'whatsapp', 'buyerType', 'city', 'country', 'status', 'optedOut', 'score', 'notes']
      }],
      order: [['addedAt', 'ASC']]
    });

    // Check which leads have already received outreach in this campaign
    const sentLogs = await OutreachLog.findAll({
      where: { userId, campaignId },
      attributes: ['leadId'],
      raw: true
    });
    const sentLeadIds = new Set(sentLogs.map((l) => l.leadId));

    const queue = [];
    for (const { lead } of campaignLeads) {
      if (!lead) continue;
      // Skip if already sent in this campaign
      if (sentLeadIds.has(lead.id)) continue;

      // Rule 6: Re-check OptOut at send-queue time!
      const optedOut = await this.isLeadOptedOut(lead);
      if (optedOut) continue;

      // Deterministic A/B variant assignment
      const assignedVariant = abTestingService.getLeadVariant(lead.id);

      // Deterministic active template resolution
      const resolved = await this.resolveTemplate(userId, {
        channel: campaign.channel,
        buyerType: lead.buyerType || null,
        step: 'day1',
        variant: assignedVariant
      });

      const template = resolved.template;
      const variant = resolved.variant;
      const templateId = resolved.templateId;

      const bodyText = template?.body || `Hello ${lead.businessName}, we are Knotiq Rugs, direct manufacturers of handmade rugs based in Ajman & Bhadohi.`;
      const subjectText = template?.subject || `Bespoke Rug Collections for ${lead.businessName}`;

      // Clean phone for WhatsApp wa.me link
      let waUrl = null;
      if (lead.phone || lead.whatsapp) {
        const rawDigits = String(lead.whatsapp || lead.phone).replace(/[^0-9]/g, '');
        const encodedText = encodeURIComponent(bodyText);
        waUrl = `https://wa.me/${rawDigits}?text=${encodedText}`;
      }

      queue.push({
        lead,
        leadId: lead.id,
        businessName: lead.businessName,
        email: lead.email,
        phone: lead.phone || lead.whatsapp,
        buyerType: lead.buyerType,
        city: lead.city,
        country: lead.country,
        score: lead.score,
        variant,
        templateId,
        subject: subjectText,
        message: bodyText,
        previewMessage: bodyText,
        waUrl
      });
    }

    return {
      campaignId,
      campaignName: campaign.name,
      channel: campaign.channel,
      queueLength: queue.length,
      queue
    };
  }

  /**
   * Record sent outreach for a campaign lead (Rule 6: re-checks OptOut and schedules Day 4/7 follow-ups)
   * Enforces honest attribution: if B template missing, falls back to A and records as 'A'.
   */
  async recordCampaignSend(userId, campaignId, leadId, payload = {}) {
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    const lead = await Lead.findOne({ where: { id: leadId, userId } });
    if (!lead) throw new Error('Lead not found');

    // Rule 6: Re-check OptOut at record-send time
    const isOptedOut = await this.isLeadOptedOut(lead);
    if (isOptedOut) {
      throw new Error('Outreach blocked: Lead is on the OptOut suppression list.');
    }

    const channel = campaign.channel === 'whatsapp' ? 'whatsapp' : 'email';
    const targetVariant = payload.variant || abTestingService.getLeadVariant(leadId);

    // Resolve template deterministically
    let template = null;
    let templateId = payload.templateId || null;
    let variant = targetVariant;

    if (templateId) {
      template = await OutreachTemplate.findOne({ where: { id: templateId, userId } });
      if (template) {
        variant = template.variant || targetVariant;
      }
    }

    if (!template) {
      const resolved = await this.resolveTemplate(userId, {
        channel,
        buyerType: lead.buyerType || null,
        step: 'day1',
        variant: targetVariant
      });
      template = resolved.template;
      templateId = resolved.templateId;
      variant = resolved.variant;
    }

    const messageSent = payload.messageSent || template?.body || 'Outreach dispatched via campaign queue';

    // Zero-mutation guard for DRY_RUN mode
    const isDryRun = payload.dryRun !== undefined ? payload.dryRun : (env.DRY_RUN || false);
    if (isDryRun) {
      logger.info({ userId, campaignId, leadId, channel, variant, templateId, dryRun: true }, '🧪 [DRY_RUN] Simulated campaign outreach send - zero mutations');
      return {
        success: true,
        simulated: true,
        leadId,
        variant,
        templateId,
        channel,
        leadStatus: lead.status,
        followUpsCreated: 0,
        message: '[DRY_RUN] Zero mutations performed in dry-run mode'
      };
    }

    // 1. Create OutreachLog with campaign attribution & actual templateId used
    const log = await OutreachLog.create({
      userId,
      leadId,
      campaignId,
      templateId,
      variant,
      channel,
      step: 'day1',
      messageSent,
      outcome: 'sent',
      sentAt: new Date(),
      recipient: channel === 'whatsapp' ? (lead.phone || lead.whatsapp) : lead.email
    });

    // 2. Schedule Day 4 and Day 7 follow-ups with campaignId attached
    await followUpEngine.scheduleInitialFollowUps(userId, leadId, channel, campaignId);

    // 3. Update lead status if new
    let leadStatus = lead.status;
    if (lead.status === 'new') {
      await lead.update({
        status: 'contacted',
        lastContactedAt: new Date()
      });
      leadStatus = 'contacted';
    }

    logger.info({ userId, campaignId, leadId, channel, variant, templateId }, 'Recorded campaign outreach send');
    return {
      success: true,
      logId: log.id,
      leadId,
      variant,
      templateId,
      channel,
      leadStatus,
      followUpsCreated: 2
    };
  }

  /**
   * Dispatch campaign email respecting daily send cap, anti-spam delay pacing, and DRY_RUN (Item 1 & 5)
   * In DRY_RUN: returns simulated preview, zero database mutations, no follow-ups, and cap untouched.
   */
  async dispatchCampaignEmail(userId, campaignId, leadId, options = {}) {
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    const lead = await Lead.findOne({ where: { id: leadId, userId } });
    if (!lead) throw new Error('Lead not found');

    // 1. OptOut Suppression check
    const isOptedOut = await this.isLeadOptedOut(lead);
    if (isOptedOut) {
      throw new Error('Outreach blocked: Lead is on the OptOut suppression list.');
    }

    // 2. Daily Send Cap Check (cannot bypass)
    const dailyCap = options.dailyCap !== undefined ? options.dailyCap : outreachHelper.dailyCap;
    const currentSent = outreachHelper.getDailySentCount(userId);
    if (currentSent >= dailyCap) {
      throw new Error(`Daily outreach limit reached (${currentSent}/${dailyCap} messages). Send blocked.`);
    }

    // 3. Pacing delay
    if (options.delayMs && options.delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }

    // 4. Resolve template and variant deterministically
    const targetVariant = options.variant || abTestingService.getLeadVariant(leadId);
    const resolved = await this.resolveTemplate(userId, {
      channel: 'email',
      buyerType: lead.buyerType || null,
      step: 'day1',
      variant: targetVariant
    });

    const template = resolved.template;
    const variant = resolved.variant;
    const templateId = resolved.templateId;
    const subject = template?.subject || `Bespoke Rug Collections for ${lead.businessName}`;
    const body = options.messageSent || template?.body || `Hello ${lead.businessName}, we are Knotiq Rugs.`;

    // 5. DRY_RUN Guard: Zero real data mutations!
    const isDryRun = options.dryRun !== undefined ? options.dryRun : (env.DRY_RUN || false);

    if (isDryRun) {
      logger.info(
        { userId, campaignId, leadId, recipient: lead.email, variant, templateId, dryRun: true },
        '🧪 [DRY_RUN] Campaign email dispatch simulated - zero database mutations'
      );
      return {
        success: true,
        simulated: true,
        message: 'DRY_RUN simulation only: no database mutations, no follow-ups scheduled, and daily cap unchanged.',
        leadId: lead.id,
        variant,
        channel: 'email',
        recipient: lead.email,
        templateId,
        previewSubject: subject,
        previewMessage: body,
        dailySent: currentSent, // Untouched!
        dailyCap
      };
    }

    // Live Execution: mutates data, creates logs, schedules follow-ups, and consumes daily quota
    const record = await this.recordCampaignSend(userId, campaignId, leadId, {
      variant,
      templateId,
      messageSent: body
    });

    // Increment daily count
    outreachHelper.incrementDailyCount(userId);

    return {
      success: true,
      simulated: false,
      dailySent: outreachHelper.getDailySentCount(userId),
      dailyCap,
      ...record
    };
  }

  /**
   * Archive campaign when it has linked activity/leads (Rule 9 / Item 6)
   */
  async archiveCampaign(userId, campaignId) {
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    const leadCount = await CampaignLead.count({ where: { campaignId, userId } });
    const logCount = await OutreachLog.count({ where: { campaignId, userId } });

    if (leadCount > 0 || logCount > 0) {
      // Archive to preserve activity and attribution columns
      await campaign.update({ status: 'archived' });
      return { success: true, action: 'archived', message: 'Campaign archived to preserve linked leads and metrics.' };
    }

    // If completely empty with zero records, can delete
    await campaign.destroy();
    return { success: true, action: 'deleted', message: 'Empty campaign removed.' };
  }

  /**
   * Unarchive campaign (Item 6)
   */
  async unarchiveCampaign(userId, campaignId) {
    const campaign = await Campaign.findOne({ where: { id: campaignId, userId } });
    if (!campaign) throw new Error('Campaign not found');

    await campaign.update({ status: 'active' });
    return { success: true, action: 'unarchived', campaign };
  }
}

module.exports = new CampaignService();
