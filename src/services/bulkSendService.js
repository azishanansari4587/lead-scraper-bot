/**
 * Bulk Outreach Service for Knotiq Rugs
 * Supports Email (Nodemailer SMTP) and WhatsApp (Meta WhatsApp Cloud API).
 * Includes phone cleaning, email validation, deduplication, opt-out suppression,
 * daily caps, anti-ban pacing delays, background job tracking, and dry-run mode.
 */

const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const env = require('../config/env');
const logger = require('../config/logger');
const BulkSendLog = require('../models/BulkSendLog');
const OptOut = require('../models/OptOut');
const Lead = require('../models/Lead');
const { Op } = require('sequelize');

class BulkSendService {
  constructor() {
    this.jobs = new Map();
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const host = process.env.SMTP_HOST || env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER || env.SMTP_USER;
    const pass = process.env.SMTP_PASS || env.SMTP_PASS;

    if (host && user && pass) {
      try {
        this.transporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user,
            pass
          }
        });
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to initialize Nodemailer transporter in BulkSendService');
      }
    }
  }

  /**
   * Cleans and formats phone number
   * - Strips non-digits
   * - If 10 digits, prepends default country code (default: 91)
   * - If starts with 0 and 11 digits, replaces 0 with country code
   * @param {string} rawPhone
   * @param {string} defaultCountry
   * @returns {{ valid: boolean, phone?: string, reason?: string }}
   */
  cleanPhone(rawPhone, defaultCountry = env.DEFAULT_COUNTRY_CODE || '971') {
    if (!rawPhone) {
      return { valid: false, reason: 'Phone number is empty' };
    }

    const countryCode = String(defaultCountry).trim().replace(/^\+/, '') || '971';
    let cleaned = String(rawPhone).trim().replace(/[^0-9+]/g, '');
    cleaned = cleaned.replace(/^\+/, '');

    // Handle UAE local mobile: 05XXXXXXXX (10 digits) -> 9715XXXXXXXX
    if (cleaned.startsWith('05') && cleaned.length === 10) {
      cleaned = '971' + cleaned.slice(1);
    } else if (cleaned.startsWith('0') && (cleaned.length === 10 || cleaned.length === 11)) {
      cleaned = countryCode + cleaned.slice(1);
    } else if (cleaned.length === 10) {
      cleaned = countryCode + cleaned;
    }

    if (cleaned.length < 10 || cleaned.length > 15) {
      return { valid: false, reason: `Invalid phone length (${cleaned.length} digits): ${cleaned}` };
    }

    return { valid: true, phone: cleaned };
  }

  /**
   * Validates email syntax
   * @param {string} email
   * @returns {boolean}
   */
  isValidEmail(email) {
    if (!email || typeof email !== 'string') return false;
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return re.test(email.trim());
  }

  /**
   * Interpolates {name}, {company}, {city}, {country} placeholders
   * @param {string} template
   * @param {object} lead
   * @returns {string}
   */
  renderMessage(template, lead = {}) {
    if (!template) return '';
    const name = lead.name || lead.businessName || 'Valued Partner';
    const company = lead.company || lead.businessName || 'your company';
    const city = lead.city || '';
    const country = lead.country || '';

    return template
      .replace(/{name}|\{\{name\}\}/gi, name)
      .replace(/{company}|\{\{company\}\}/gi, company)
      .replace(/{city}|\{\{city\}\}/gi, city)
      .replace(/{country}|\{\{country\}\}/gi, country);
  }

  /**
   * Checks if an email or phone is on the OptOut/STOP list
   * @param {string} email
   * @param {string} phone
   * @returns {Promise<{ optedOut: boolean, reason?: string }>}
   */
  async checkOptOut(email, phone) {
    try {
      const checks = [];
      if (email) {
        checks.push({ type: 'email', value: email.toLowerCase().trim() });
      }
      if (phone) {
        checks.push({ type: 'phone', value: phone.replace(/[^0-9]/g, '') });
      }

      for (const item of checks) {
        const found = await OptOut.findOne({ where: { type: item.type, value: item.value } });
        if (found) {
          return { optedOut: true, reason: `Recipient opted out / STOP list (${item.type}: ${item.value})` };
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Error checking OptOut table');
    }
    return { optedOut: false };
  }

  /**
   * Checks how many messages were already sent today
   * @returns {Promise<number>}
   */
  async getDailySentCount() {
    try {
      const startOfDay = new Date();
      startOfDay.setHours(0, 0, 0, 0);

      const count = await BulkSendLog.count({
        where: {
          status: 'sent',
          sentAt: {
            [Op.gte]: startOfDay
          }
        }
      });
      return count;
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to query daily sent count from BulkSendLog');
      return 0;
    }
  }

  /**
   * Checks if recipient was already sent to in the past
   * @param {string} recipient
   * @param {string} channel
   * @returns {Promise<boolean>}
   */
  async hasAlreadySent(recipient, channel) {
    try {
      const count = await BulkSendLog.count({
        where: {
          recipient,
          channel,
          status: 'sent'
        }
      });
      return count > 0;
    } catch (err) {
      return false;
    }
  }

  /**
   * Sends an email via Nodemailer
   * @param {object} param0 { to, subject, body, dryRun, attachments }
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string, simulated?: boolean }>}
   */
  async sendEmail({ to, subject, body, dryRun = false, attachments = [] }) {
    if (dryRun || env.DRY_RUN) {
      logger.info({ to, subject, attachmentsCount: (attachments || []).length }, '🧪 [DRY_RUN] Simulating Email dispatch');
      return { success: true, simulated: true, messageId: `dry-run-email-${Date.now()}` };
    }

    if (!this.transporter) {
      this.initTransporter();
      if (!this.transporter) {
        return {
          success: false,
          error: 'SMTP credentials not configured in .env (SMTP_HOST, SMTP_USER, SMTP_PASS)'
        };
      }
    }

    const fromAddress = process.env.SMTP_FROM || env.SMTP_FROM || '"Knotiq Rugs" <info@knotiqrugs.com>';
    const senderPhone = process.env.SENDER_PHONE || env.SENDER_PHONE || '+971 582549695';
    const waClean = senderPhone.replace(/[^0-9]/g, '');

    const unsubscribeFooter = `\n\n---\nKnotiq Rugs | Handcrafted Luxury Carpets\nEmail: info@knotiqrugs.com | WhatsApp: ${senderPhone}\nTo unsubscribe, reply 'STOP'.`;
    const fullTextBody = body + unsubscribeFooter;
    const fullHtmlBody = `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 650px;">
        <div style="white-space: pre-wrap; margin-bottom: 20px;">${body}</div>
        <hr style="border: none; border-top: 1px solid #cbd5e1; margin: 24px 0 12px;" />
        <div style="font-size: 12px; color: #475569; line-height: 1.5;">
          <strong>Knotiq Rugs</strong> — Direct Manufacturer & Exporter of Handmade Rugs<br/>
          📧 Email: <a href="mailto:info@knotiqrugs.com" style="color: #b45309; text-decoration: none;">info@knotiqrugs.com</a> &nbsp;|&nbsp; 
          📱 WhatsApp: <a href="https://wa.me/${waClean}" style="color: #059669; text-decoration: none;">${senderPhone}</a>
        </div>
        <p style="font-size: 11px; color: #94a3b8; margin-top: 10px;">
          You received this inquiry from Knotiq Rugs. To opt out, reply <strong>STOP</strong>.
        </p>
      </div>
    `;

    try {
      const mailOptions = {
        from: fromAddress,
        to,
        subject,
        text: fullTextBody,
        html: fullHtmlBody
      };

      if (Array.isArray(attachments) && attachments.length > 0) {
        mailOptions.attachments = attachments.map((att) => ({
          filename: att.filename,
          path: att.path,
          contentType: att.mimeType || att.contentType
        }));
      }

      const info = await this.transporter.sendMail(mailOptions);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      logger.error({ err: err.message, to }, 'Failed to dispatch email');
      return { success: false, error: err.message };
    }
  }

  /**
   * Sends a WhatsApp message via Meta WhatsApp Cloud API
   * Supports approved templates or direct text messages
   * @param {object} param0 { to, message, lead, useTemplate, dryRun, attachments }
   * @returns {Promise<{ success: boolean, messageId?: string, error?: string, simulated?: boolean }>}
   */
  async sendWhatsApp({ to, message, lead = {}, useTemplate = false, dryRun = false, attachments = [] }) {
    if (dryRun || env.DRY_RUN) {
      logger.info({ to, attachmentsCount: (attachments || []).length }, '🧪 [DRY_RUN] Simulating WhatsApp dispatch');
      return { success: true, simulated: true, messageId: `dry-run-wa-${Date.now()}` };
    }

    if (!env.WHATSAPP_TOKEN || !env.WHATSAPP_PHONE_NUMBER_ID) {
      return {
        success: false,
        error: 'WhatsApp Cloud API credentials not configured in .env (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)'
      };
    }

    const url = `https://graph.facebook.com/v21.0/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
    let payload;

    if (useTemplate && env.WHATSAPP_TEMPLATE_NAME) {
      const leadName = lead.name || lead.businessName || 'Design Partner';
      const companyName = lead.company || lead.businessName || 'your company';
      payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: env.WHATSAPP_TEMPLATE_NAME,
          language: { code: env.WHATSAPP_TEMPLATE_LANG || 'en_US' },
          components: [
            {
              type: 'body',
              parameters: [
                { type: 'text', text: leadName },
                { type: 'text', text: companyName }
              ]
            }
          ]
        }
      };
    } else {
      payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: {
          preview_url: false,
          body: message
        }
      };
    }

    try {
      const res = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      });

      const messageId = res.data?.messages?.[0]?.id || 'wa-sent';
      return { success: true, messageId };
    } catch (err) {
      const apiErr = err.response?.data?.error?.message || err.message;
      logger.error({ err: apiErr, to }, 'Failed to dispatch WhatsApp message');
      return { success: false, error: apiErr };
    }
  }

  /**
   * Starts a background bulk outreach job
   * @param {object} jobParams
   * @returns {string} jobId
   */
  startBulkJob(jobParams) {
    const {
      leads = [],
      channels = ['email'], // 'email', 'whatsapp', or both
      subject = '',
      message = '',
      attachments = [],
      useTemplate = false,
      skipAlreadySent = true,
      delayMs = env.DELAY_MS || 3000,
      dryRun = env.DRY_RUN || false,
      userId = 'dev_user_knotiq'
    } = jobParams;

    const jobId = `job_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const job = {
      jobId,
      userId,
      status: 'running',
      total: leads.length,
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      channels,
      subject,
      message,
      attachments,
      useTemplate,
      skipAlreadySent,
      delayMs,
      dryRun,
      results: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      stopped: false
    };

    this.jobs.set(jobId, job);

    // Run processing asynchronously in background
    setImmediate(() => this.processJob(jobId, leads));

    return jobId;
  }

  /**
   * Processes the bulk send job item-by-item with delay and safety guards
   */
  async processJob(jobId, leads) {
    const job = this.jobs.get(jobId);
    if (!job) return;

    const seenEmails = new Set();
    const seenPhones = new Set();
    const dailyLimit = env.DAILY_LIMIT || 50;

    logger.info({ jobId, total: leads.length, channels: job.channels }, 'Starting Bulk Send background job');

    for (let i = 0; i < leads.length; i++) {
      if (job.stopped) {
        job.status = 'stopped';
        break;
      }

      const rawLead = leads[i];
      const leadName = rawLead.name || rawLead.businessName || 'Valued Partner';
      const companyName = rawLead.company || rawLead.businessName || 'Company';
      const leadId = rawLead.id || null;

      // 1. Daily limit check
      const todaySentCount = await this.getDailySentCount();
      if (todaySentCount >= dailyLimit) {
        logger.warn({ todaySentCount, dailyLimit }, 'Daily send cap reached. Skipping remaining leads.');
        for (let j = i; j < leads.length; j++) {
          job.processed++;
          job.skipped++;
          job.results.push({
            leadId: leads[j].id || null,
            name: leads[j].name || leads[j].businessName || '',
            company: leads[j].company || '',
            channel: job.channels.join(', '),
            recipient: leads[j].email || leads[j].phone || '',
            status: 'skipped',
            error: `Daily limit reached (${todaySentCount}/${dailyLimit})`,
            timestamp: new Date().toISOString()
          });
        }
        break;
      }

      // 2. Process each chosen channel
      for (const channel of job.channels) {
        if (job.stopped) break;

        const renderedSubject = this.renderMessage(job.subject, rawLead);
        const renderedBody = this.renderMessage(job.message, rawLead);

        if (channel === 'email') {
          const rawEmail = (rawLead.email || '').trim().toLowerCase();

          // Validation
          if (!rawEmail || !this.isValidEmail(rawEmail)) {
            job.processed++;
            job.skipped++;
            job.results.push({
              leadId,
              name: leadName,
              company: companyName,
              channel: 'email',
              recipient: rawEmail || 'N/A',
              status: 'skipped',
              error: 'Invalid or missing email address',
              timestamp: new Date().toISOString()
            });
            continue;
          }

          // Deduplication
          if (seenEmails.has(rawEmail)) {
            job.processed++;
            job.skipped++;
            job.results.push({
              leadId,
              name: leadName,
              company: companyName,
              channel: 'email',
              recipient: rawEmail,
              status: 'skipped',
              error: 'Duplicate email in this bulk batch',
              timestamp: new Date().toISOString()
            });
            continue;
          }
          seenEmails.add(rawEmail);

          // Opt-out check
          const optCheck = await this.checkOptOut(rawEmail, null);
          if (optCheck.optedOut) {
            job.processed++;
            job.skipped++;
            job.results.push({
              leadId,
              name: leadName,
              company: companyName,
              channel: 'email',
              recipient: rawEmail,
              status: 'skipped',
              error: optCheck.reason,
              timestamp: new Date().toISOString()
            });
            continue;
          }

          // Skip already sent check
          if (job.skipAlreadySent) {
            const alreadySent = await this.hasAlreadySent(rawEmail, 'email');
            if (alreadySent) {
              job.processed++;
              job.skipped++;
              job.results.push({
                leadId,
                name: leadName,
                company: companyName,
                channel: 'email',
                recipient: rawEmail,
                status: 'skipped',
                error: 'Already contacted previously',
                timestamp: new Date().toISOString()
              });
              continue;
            }
          }

          // Dispatch email
          const res = await this.sendEmail({
            to: rawEmail,
            subject: renderedSubject,
            body: renderedBody,
            attachments: job.attachments,
            dryRun: job.dryRun
          });

          const logStatus = res.success ? 'sent' : 'failed';
          if (res.success) {
            job.sent++;
          } else {
            job.failed++;
          }
          job.processed++;

          job.results.push({
            leadId,
            name: leadName,
            company: companyName,
            channel: 'email',
            recipient: rawEmail,
            status: logStatus,
            error: res.error || null,
            messageId: res.messageId || null,
            timestamp: new Date().toISOString()
          });

          // Record in DB
          try {
            await BulkSendLog.create({
              jobId,
              leadId,
              recipient: rawEmail,
              channel: 'email',
              businessName: companyName,
              status: logStatus,
              error: res.error || null,
              details: { dryRun: job.dryRun, messageId: res.messageId }
            });

            if (res.success && leadId) {
              await Lead.update(
                { status: 'contacted', lastContactedAt: new Date() },
                { where: { id: leadId } }
              );
            }
          } catch (dbErr) {
            logger.warn({ dbErr: dbErr.message }, 'Failed to persist BulkSendLog');
          }

          // Anti-spam delay
          if (i < leads.length - 1 && job.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, job.delayMs));
          }
        }

        if (channel === 'whatsapp') {
          const rawPhone = rawLead.phone || rawLead.whatsapp || '';
          const phoneRes = this.cleanPhone(rawPhone);

          // Validation
          if (!phoneRes.valid) {
            job.processed++;
            job.skipped++;
            job.results.push({
              leadId,
              name: leadName,
              company: companyName,
              channel: 'whatsapp',
              recipient: rawPhone || 'N/A',
              status: 'skipped',
              error: phoneRes.reason,
              timestamp: new Date().toISOString()
            });
            continue;
          }

          const cleanedPhone = phoneRes.phone;

          // Deduplication
          if (seenPhones.has(cleanedPhone)) {
            job.processed++;
            job.skipped++;
            job.results.push({
              leadId,
              name: leadName,
              company: companyName,
              channel: 'whatsapp',
              recipient: cleanedPhone,
              status: 'skipped',
              error: 'Duplicate phone in this bulk batch',
              timestamp: new Date().toISOString()
            });
            continue;
          }
          seenPhones.add(cleanedPhone);

          // Opt-out check
          const optCheck = await this.checkOptOut(null, cleanedPhone);
          if (optCheck.optedOut) {
            job.processed++;
            job.skipped++;
            job.results.push({
              leadId,
              name: leadName,
              company: companyName,
              channel: 'whatsapp',
              recipient: cleanedPhone,
              status: 'skipped',
              error: optCheck.reason,
              timestamp: new Date().toISOString()
            });
            continue;
          }

          // Skip already sent check
          if (job.skipAlreadySent) {
            const alreadySent = await this.hasAlreadySent(cleanedPhone, 'whatsapp');
            if (alreadySent) {
              job.processed++;
              job.skipped++;
              job.results.push({
                leadId,
                name: leadName,
                company: companyName,
                channel: 'whatsapp',
                recipient: cleanedPhone,
                status: 'skipped',
                error: 'Already contacted previously',
                timestamp: new Date().toISOString()
              });
              continue;
            }
          }

          // Dispatch WhatsApp
          const res = await this.sendWhatsApp({
            to: cleanedPhone,
            message: renderedBody,
            lead: rawLead,
            attachments: job.attachments,
            useTemplate: job.useTemplate,
            dryRun: job.dryRun
          });

          const logStatus = res.success ? 'sent' : 'failed';
          if (res.success) {
            job.sent++;
          } else {
            job.failed++;
          }
          job.processed++;

          job.results.push({
            leadId,
            name: leadName,
            company: companyName,
            channel: 'whatsapp',
            recipient: cleanedPhone,
            status: logStatus,
            error: res.error || null,
            messageId: res.messageId || null,
            timestamp: new Date().toISOString()
          });

          // Record in DB
          try {
            await BulkSendLog.create({
              jobId,
              leadId,
              recipient: cleanedPhone,
              channel: 'whatsapp',
              businessName: companyName,
              status: logStatus,
              error: res.error || null,
              details: { dryRun: job.dryRun, messageId: res.messageId }
            });

            if (res.success && leadId) {
              await Lead.update(
                { status: 'contacted', lastContactedAt: new Date() },
                { where: { id: leadId } }
              );
            }
          } catch (dbErr) {
            logger.warn({ dbErr: dbErr.message }, 'Failed to persist BulkSendLog for WhatsApp');
          }

          // Anti-spam delay
          if (i < leads.length - 1 && job.delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, job.delayMs));
          }
        }
      }
    }

    if (!job.stopped) {
      job.status = 'completed';
    }
    job.completedAt = new Date().toISOString();
    logger.info({ jobId, sent: job.sent, failed: job.failed, skipped: job.skipped }, 'Bulk Send job finished');
  }

  /**
   * Retrieves job status and itemized results
   * @param {string} jobId
   * @returns {object|null}
   */
  getJobStatus(jobId) {
    return this.jobs.get(jobId) || null;
  }

  /**
   * Stops an active job
   * @param {string} jobId
   * @returns {boolean}
   */
  stopJob(jobId) {
    const job = this.jobs.get(jobId);
    if (job && job.status === 'running') {
      job.stopped = true;
      job.status = 'stopped';
      job.completedAt = new Date().toISOString();
      return true;
    }
    return false;
  }
}

module.exports = new BulkSendService();
