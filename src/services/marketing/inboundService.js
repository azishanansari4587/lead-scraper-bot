/**
 * Inbound Lead Creation Service
 * Quick-form ingestion for walk-ins, referrals, inbound WhatsApp, and website forms.
 * Enforces deduplication and auto-creates an initial follow-up.
 */

const crypto = require('crypto');
const Lead = require('../../models/Lead');
const Note = require('../../models/Note');
const followUpEngine = require('../followUp/followUpEngine');
const logger = require('../../config/logger');

class InboundService {
  /**
   * Generates deterministic dedupe key for inbound lead
   */
  generateDedupeKey(phone, email, businessName, city) {
    if (phone) {
      const cleanPhone = String(phone).replace(/[^0-9]/g, '');
      if (cleanPhone.length >= 7) return `ph_${cleanPhone}`;
    }
    if (email) {
      return `em_${String(email).trim().toLowerCase()}`;
    }
    const cleanName = String(businessName || 'inbound').trim().toLowerCase();
    const cleanCity = String(city || 'dubai').trim().toLowerCase();
    return `inb_${crypto.createHash('sha256').update(`${cleanName}__${cleanCity}`).digest('hex').slice(0, 16)}`;
  }

  /**
   * Creates an inbound lead with deduplication check and follow-up
   */
  async addInboundLead(userId, data) {
    const {
      businessName,
      contactPerson,
      phone,
      email,
      source = 'whatsapp_inbound',
      buyerType = 'designer',
      dealValue = null,
      dealCurrency = 'AED',
      city = 'Dubai',
      country = 'United Arab Emirates',
      notes = ''
    } = data;

    if (!businessName || !businessName.trim()) {
      throw new Error('Business name or client name is required');
    }

    const dedupeKey = this.generateDedupeKey(phone, email, businessName, city);

    // Deduplication check: if lead already exists, enrich and schedule follow-ups
    const existing = await Lead.findOne({ where: { userId, dedupeKey } });
    if (existing) {
      const updates = {};
      if (dealValue) {
        updates.dealValue = parseFloat(dealValue);
        updates.dealCurrency = dealCurrency || existing.dealCurrency;
      }
      if (buyerType && existing.buyerType === 'unclassified') {
        updates.buyerType = buyerType;
      }
      if (Object.keys(updates).length > 0) {
        await existing.update(updates);
      }

      if (notes && notes.trim()) {
        await Note.create({
          userId,
          ownerType: 'lead',
          ownerId: String(existing.id),
          title: `Inbound Inquiry via ${source}`,
          body: notes.trim()
        }).catch(() => {});
      }

      const initialChannel = phone ? 'whatsapp' : (email ? 'email' : 'call');
      await followUpEngine.scheduleInitialFollowUps(userId, existing.id, initialChannel);

      logger.info({ leadId: existing.id, source, buyerType }, 'Deduplicated and updated existing inbound lead');
      return existing;
    }

    const lead = await Lead.create({
      userId,
      businessName: businessName.trim(),
      leadType: buyerType || 'interior_design',
      buyerType: buyerType || 'unclassified',
      buyerTypeConfidence: 1.0,
      buyerTypeManual: true,
      buyerTypeReason: 'Manual inbound lead entry',
      source: source || 'whatsapp_inbound',
      phone: phone ? String(phone).trim() : null,
      whatsapp: phone ? String(phone).trim() : null,
      email: email ? String(email).trim().toLowerCase() : null,
      city: city || 'Dubai',
      country: country || 'United Arab Emirates',
      dealValue: dealValue ? parseFloat(dealValue) : null,
      dealCurrency: dealCurrency || 'AED',
      notes: notes || null,
      status: 'new',
      dedupeKey
    });

    // Create note if provided
    if (notes && notes.trim()) {
      await Note.create({
        userId,
        ownerType: 'lead',
        ownerId: String(lead.id),
        title: `Inbound Inquiry via ${source}`,
        body: notes.trim()
      }).catch(() => {});
    }

    // Schedule initial Day 1 follow-up task
    const initialChannel = phone ? 'whatsapp' : (email ? 'email' : 'call');
    await followUpEngine.scheduleInitialFollowUps(userId, lead.id, initialChannel);

    logger.info({ leadId: lead.id, source, buyerType }, 'Created inbound lead');
    return lead;
  }
}

module.exports = new InboundService();
