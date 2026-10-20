/**
 * Outreach Helper Service for Knotiq Rugs
 * Manages cold email / WhatsApp outreach generation, daily send caps (30/day),
 * suppression checks, and Gemini AI message customization.
 */

const env = require('../../config/env');
const logger = require('../../config/logger');
const OptOut = require('../../models/OptOut');
const Lead = require('../../models/Lead');
const OutreachTemplate = require('../../models/OutreachTemplate');
const AuditLog = require('../../models/AuditLog');
const aiService = require('../aiService');

// In-memory daily outreach tracking: "userId:YYYY-MM-DD" -> count
const dailyOutreachCounts = new Map();

class OutreachHelper {
  constructor() {
    this.dailyCap = env.OUTREACH_DAILY_CAP || 30;
  }

  getTodayKey(userId) {
    const today = new Date().toISOString().slice(0, 10);
    return `${userId}:${today}`;
  }

  getDailySentCount(userId) {
    const key = this.getTodayKey(userId);
    return dailyOutreachCounts.get(key) || 0;
  }

  incrementDailyCount(userId) {
    const key = this.getTodayKey(userId);
    const count = this.getDailySentCount(userId);
    dailyOutreachCounts.set(key, count + 1);
    return count + 1;
  }

  /**
   * Checks if recipient or company is on the OptOut suppression list
   * @param {object} lead
   * @returns {Promise<{ suppressed: boolean, reason?: string }>}
   */
  async checkSuppression(lead) {
    const values = [];
    if (lead.email) values.push({ type: 'email', value: lead.email.toLowerCase().trim() });
    if (lead.domain) values.push({ type: 'domain', value: lead.domain.toLowerCase().trim() });
    if (lead.phone) values.push({ type: 'phone', value: lead.phone.replace(/[^0-9+]/g, '') });

    for (const item of values) {
      const match = await OptOut.findOne({
        where: { type: item.type, value: item.value }
      });
      if (match) {
        return {
          suppressed: true,
          reason: `Recipient is on OptOut suppression list (${item.type}: ${item.value})`
        };
      }
    }

    return { suppressed: false };
  }

  /**
   * Generates a tailored outreach message for a lead
   * @param {object} options { userId, leadId, templateId, channel, useAi }
   * @returns {Promise<object>} { subject, body, channel, recipient }
   */
  async generateOutreach({ userId, leadId, templateId = null, channel = 'email', useAi = false }) {
    // 1. Daily Cap Check
    const currentSent = this.getDailySentCount(userId);
    if (currentSent >= this.dailyCap) {
      throw new Error(`Daily outreach limit reached (${currentSent}/${this.dailyCap} messages). Try again tomorrow.`);
    }

    // 2. Fetch Lead
    const lead = await Lead.findOne({ where: { id: leadId, userId } });
    if (!lead) {
      throw new Error('Lead not found or not owned by user');
    }

    // 3. Suppression Check
    const suppression = await this.checkSuppression(lead);
    if (suppression.suppressed) {
      throw new Error(`Outreach blocked: ${suppression.reason}`);
    }

    let subject = '';
    let body = '';

    // 4. AI-Powered Generation (if requested and Gemini configured)
    if (useAi && aiService.client && aiService.checkDailyQuota()) {
      try {
        const cleanName = lead.businessName.replace(/[\x00-\x1F\x7F]/g, '');
        const prompt = `
SYSTEM INSTRUCTION:
You are an expert B2B export copywriter for "Knotiq Rugs", a high-end handmade rug manufacturer in India.
Write a personalized, concise, and non-salesy ${channel} cold outreach message to an interior design / carpet retail buyer.

LEAD DETAILS:
Business Name: ${cleanName}
City: ${lead.city}
Country: ${lead.country}
Category: ${lead.leadType}
Product Notes: ${lead.productNotes || 'Boutique decor'}

OFFER POINTS:
- Direct manufacturer from India (no distributor markups)
- Bespoke hand-knotted and hand-tufted rugs in custom dimensions
- Free sample yarn kit & digital trade catalog for trade partners

OUTPUT FORMAT:
Return ONLY a valid JSON object matching:
{
  "subject": "Email subject line (max 9 words)",
  "body": "Concise 3-paragraph email or 1-paragraph WhatsApp message"
}
        `.trim();

        aiService.incrementDailyQuota();
        const response = await aiService.client.generateContent(prompt);
        const text = response.response.text();
        const cleanJson = text.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        subject = parsed.subject;
        body = parsed.body;
      } catch (err) {
        logger.warn({ err: err.message }, 'AI outreach generation failed, using standard template');
      }
    }

    // 5. Fallback to Template or Default Copy
    if (!body) {
      let template = null;
      if (templateId) {
        template = await OutreachTemplate.findOne({ where: { id: templateId, userId } });
      } else {
        template = await OutreachTemplate.findOne({ where: { userId, channel, isDefault: true } });
      }

      subject = template?.subject || `Trade Partnership: Bespoke Handmade Rugs for ${lead.businessName}`;
      body = template?.body || (
        channel === 'whatsapp'
          ? `Hello ${lead.businessName} Team, this is Knotiq Rugs (artisan handmade rug manufacturer, WhatsApp: +971 582549695). We love your interior design portfolio in ${lead.city} and would love to share our 2026 digital trade catalog and yarn swatches for your upcoming client projects.`
          : `Hi ${lead.businessName} Team,\n\nI came across your design portfolio in ${lead.city || lead.country} and love your aesthetic. At Knotiq Rugs, we are direct manufacturers of artisan hand-knotted and hand-tufted rugs in India, supplying luxury interior designers and boutique showrooms worldwide.\n\nWe provide bespoke sizing, custom dye-matching, and direct trade pricing without intermediary markups.\n\nCould I send over our digital trade catalog and complimentary yarn sample kit for your upcoming projects?\n\nWarm regards,\nExport Team | Knotiq Rugs\nEmail: info@knotiqrugs.com\nWhatsApp: +971 582549695`
      );

      // Perform variable substitutions
      const vars = {
        businessName: lead.businessName || 'Design Team',
        city: lead.city || 'your city',
        country: lead.country || '',
        leadType: (lead.leadType || '').replace(/_/g, ' ')
      };

      Object.entries(vars).forEach(([k, v]) => {
        subject = subject.replace(new RegExp(`{{${k}}}`, 'g'), v);
        body = body.replace(new RegExp(`{{${k}}}`, 'g'), v);
      });
    }

    const recipient = channel === 'whatsapp' ? (lead.whatsapp || lead.phone) : lead.email;

    return {
      leadId: lead.id,
      businessName: lead.businessName,
      recipient,
      channel,
      subject,
      body,
      dailyCount: currentSent,
      dailyCap: this.dailyCap
    };
  }

  /**
   * Records that outreach was performed, increments daily counter, and updates lead status
   * @param {string} userId
   * @param {number} leadId
   * @param {string} channel
   */
  async recordOutreachSent(userId, leadId, channel = 'email') {
    this.incrementDailyCount(userId);

    const lead = await Lead.findOne({ where: { id: leadId, userId } });
    if (lead) {
      await lead.update({
        status: 'contacted',
        lastContactedAt: new Date()
      });

      await AuditLog.create({
        userId,
        action: 'outreach_dispatched',
        entityType: 'Lead',
        entityId: String(lead.id),
        details: { channel, recipient: channel === 'whatsapp' ? lead.phone : lead.email }
      });
    }

    return {
      success: true,
      dailySent: this.getDailySentCount(userId),
      dailyCap: this.dailyCap
    };
  }
}

module.exports = new OutreachHelper();
