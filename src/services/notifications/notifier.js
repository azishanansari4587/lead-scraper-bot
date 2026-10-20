/**
 * Notification Service for Knotiq Rugs
 * Supports Telegram Bot Markdown alerts and Nodemailer SMTP digest emails.
 * Gracefully degrades when credentials are not configured.
 */

const axios = require('axios');
const nodemailer = require('nodemailer');
const env = require('../../config/env');
const logger = require('../../config/logger');

class NotifierService {
  constructor() {
    const host = process.env.SMTP_HOST || env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || env.SMTP_PORT || 465);
    const user = process.env.SMTP_USER || env.SMTP_USER;
    const pass = process.env.SMTP_PASS || env.SMTP_PASS;

    if (host && user && pass) {
      try {
        this.mailTransporter = nodemailer.createTransport({
          host,
          port,
          secure: port === 465,
          auth: {
            user,
            pass
          }
        });
      } catch (err) {
        logger.warn({ err: err.message }, 'Failed to initialize Nodemailer transporter');
      }
    }
  }

  /**
   * Sends a Markdown alert to Telegram
   * @param {string} message Markdown formatted text
   * @returns {Promise<{ sent: boolean, reason?: string }>}
   */
  async sendTelegramAlert(message) {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
      logger.debug('Telegram bot token or chat ID unconfigured. Skipping Telegram notification.');
      return { sent: false, reason: 'unconfigured' };
    }

    try {
      const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
      await axios.post(url, {
        chat_id: env.TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      }, { timeout: 8000 });

      logger.info('Telegram alert dispatched successfully');
      return { sent: true };
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to dispatch Telegram alert');
      return { sent: false, reason: err.message };
    }
  }

  /**
   * Sends an HTML digest email via SMTP
   * @param {object} options { to, subject, html, attachments }
   * @returns {Promise<{ sent: boolean, reason?: string }>}
   */
  async sendEmailDigest({ to, subject, html, attachments = [] }) {
    if (!this.mailTransporter) {
      logger.debug('SMTP transporter unconfigured. Skipping email dispatch.');
      return { sent: false, reason: 'unconfigured' };
    }

    try {
      const recipient = to || env.SMTP_USER;
      const info = await this.mailTransporter.sendMail({
        from: env.SMTP_FROM,
        to: recipient,
        subject: subject || 'Knotiq Rugs — B2B Lead Intelligence Digest',
        html,
        attachments
      });

      logger.info({ messageId: info.messageId, recipient }, 'Digest email dispatched successfully');
      return { sent: true, messageId: info.messageId };
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to dispatch SMTP email digest');
      return { sent: false, reason: err.message };
    }
  }

  /**
   * Dispatches summary notifications after a scraper run completes
   * @param {object} run ScraperRun details
   * @param {object} [options]
   */
  async notifyScraperRunCompleted(run, options = {}) {
    const durationSec = Math.round((run.durationMs || 0) / 1000);
    const topLeadInfo = options.topLead
      ? `\n⭐ *Top Lead:* ${options.topLead.businessName} (Score: ${options.topLead.score}/100)`
      : '';

    const telegramText = `
🚀 *Knotiq Rugs Lead Scraper Alert*
━━━━━━━━━━━━━━━━━━━━
📍 *Target:* ${run.city || 'All Cities'}, ${run.country}
🏷️ *Category:* ${run.keyword || run.leadType || 'B2B Target'}
⚙️ *Platform:* ${run.platform}
📊 *Found:* ${run.foundCount || 0} | *New Leads:* +${run.newCount || 0} | *Dupes:* ${run.duplicateCount || 0}
⏱️ *Duration:* ${durationSec}s${topLeadInfo}
━━━━━━━━━━━━━━━━━━━━
View leads in dashboard: ${env.CORS_ORIGIN || 'http://localhost:5173'}
    `.trim();

    const telegramRes = await this.sendTelegramAlert(telegramText);

    // If new leads were found and email is configured, send email summary
    let emailRes = { sent: false };
    if ((run.newCount || 0) > 0 && this.mailTransporter) {
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #0F172A;">
          <h2 style="color: #D97706; border-bottom: 2px solid #F59E0B; padding-bottom: 8px;">
            Knotiq Rugs — Scraper Run Summary
          </h2>
          <p>A scheduled lead scraping run completed successfully for <strong>${run.city}, ${run.country}</strong>.</p>
          <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
            <tr style="background: #F8FAFC;"><td style="padding: 8px; font-weight: bold;">Platform</td><td style="padding: 8px;">${run.platform}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">New Qualified Leads</td><td style="padding: 8px; color: #166534; font-weight: bold;">+${run.newCount}</td></tr>
            <tr style="background: #F8FAFC;"><td style="padding: 8px; font-weight: bold;">Total Found</td><td style="padding: 8px;">${run.foundCount}</td></tr>
            <tr><td style="padding: 8px; font-weight: bold;">Duplicates Merged</td><td style="padding: 8px;">${run.duplicateCount}</td></tr>
            <tr style="background: #F8FAFC;"><td style="padding: 8px; font-weight: bold;">Duration</td><td style="padding: 8px;">${durationSec}s</td></tr>
          </table>
          <p><a href="${env.CORS_ORIGIN}" style="background: #D97706; color: #FFF; padding: 10px 18px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Open Leads Dashboard</a></p>
        </div>
      `;
      emailRes = await this.sendEmailDigest({
        subject: `[Knotiq Rugs] +${run.newCount} New Leads in ${run.city}, ${run.country}`,
        html: emailHtml
      });
    }

    return {
      telegram: telegramRes,
      email: emailRes
    };
  }
}

module.exports = new NotifierService();
