const axios = require('axios');
const logger = require('../config/logger');
const { validateUrlForSsrf } = require('../services/ssrfGuard');
const { isUrlAllowed } = require('../services/robots');
const { normalizePhone } = require('../services/dedupe');

const RUG_KEYWORDS = [
  'rug', 'rugs', 'carpet', 'carpets', 'hand-tufted', 'hand tufted',
  'hand-knotted', 'hand knotted', 'area rug', 'oriental rug', 'persian rug',
  'custom rug', 'kilim', 'dhurrie', 'wool rug', 'silk rug', 'wall-to-wall',
  'floor covering', 'broadloom', 'runners'
];

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
const WHATSAPP_REGEX = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d+)/i;
const PHONE_REGEX = /(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}\b/g;

class WebsiteEnricher {
  constructor() {
    this.name = 'website_enricher';
    this.timeoutMs = 15000;
    this.maxResponseBytes = 2 * 1024 * 1024; // 2 MB
  }

  /**
   * Safely fetches an HTML page with SSRF protection, size caps, and robots.txt check
   */
  async fetchSafePage(url) {
    // 1. SSRF Guard
    const ssrfCheck = await validateUrlForSsrf(url);
    if (!ssrfCheck.isSafe) {
      logger.warn({ url, reason: ssrfCheck.reason }, 'SSRF guard blocked request');
      return null;
    }

    // 2. Robots.txt check
    const robotsAllowed = await isUrlAllowed(url);
    if (!robotsAllowed) {
      logger.info({ url }, 'URL disallowed by robots.txt');
      return null;
    }

    // 3. Fetch with strict security options
    try {
      const response = await axios.get(url, {
        timeout: this.timeoutMs,
        maxContentLength: this.maxResponseBytes,
        maxBodyLength: this.maxResponseBytes,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'KnotiqLeadBot/1.0 (+https://knotiqrugs.com/bot; public contact discovery)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        responseType: 'text',
        validateStatus: (status) => status === 200
      });

      return typeof response.data === 'string' ? response.data : '';
    } catch (err) {
      logger.debug({ url, err: err.message }, 'Failed to fetch page for enrichment');
      return null;
    }
  }

  /**
   * Extracts clean business contact data from HTML text
   */
  extractDataFromHtml(html, baseUrl) {
    const data = {
      emails: new Set(),
      phones: new Set(),
      whatsapp: null,
      instagram: null,
      facebook: null,
      linkedin: null,
      pinterest: null,
      sellsRugsSignal: false,
      productNotes: [],
      language: 'en'
    };

    if (!html) return data;

    // Detect language
    const langMatch = html.match(/<html[^>]*lang=["']([^"']+)["']/i);
    if (langMatch) {
      data.language = langMatch[1].split('-')[0].toLowerCase();
    }

    // 1. Emails
    const rawEmails = html.match(EMAIL_REGEX) || [];
    for (const email of rawEmails) {
      const lower = email.toLowerCase().trim();
      // Filter out asset files, dummy sentry/google emails
      if (
        !lower.endsWith('.png') &&
        !lower.endsWith('.jpg') &&
        !lower.endsWith('.svg') &&
        !lower.endsWith('.webp') &&
        !lower.includes('sentry.io') &&
        !lower.includes('example.com') &&
        !lower.includes('schema.org') &&
        !lower.includes('w3.org')
      ) {
        data.emails.add(lower);
      }
    }

    // 2. WhatsApp
    const waMatch = html.match(WHATSAPP_REGEX);
    if (waMatch && waMatch[1]) {
      const rawWa = waMatch[1].startsWith('+') ? waMatch[1] : `+${waMatch[1]}`;
      data.whatsapp = normalizePhone(rawWa);
    }

    // 3. Social Media Links
    const socialMatches = {
      instagram: /href=["'](https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.-]+)\/?["']/i,
      facebook: /href=["'](https?:\/\/(?:www\.)?facebook\.com\/[a-zA-Z0-9_.-]+)\/?["']/i,
      linkedin: /href=["'](https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[a-zA-Z0-9_.-]+)\/?["']/i,
      pinterest: /href=["'](https?:\/\/(?:www\.)?pinterest\.com\/[a-zA-Z0-9_.-]+)\/?["']/i
    };

    for (const [platform, regex] of Object.entries(socialMatches)) {
      const match = html.match(regex);
      if (match && match[1]) {
        // Exclude generic share URLs
        if (!match[1].includes('/sharer') && !match[1].includes('/intent')) {
          data[platform] = match[1];
        }
      }
    }

    // 4. "Do they sell rugs?" Signal & Product notes
    const plainText = html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');

    for (const kw of RUG_KEYWORDS) {
      const regex = new RegExp(`\\b${kw}\\b`, 'i');
      if (regex.test(plainText)) {
        data.sellsRugsSignal = true;
        // Grab a short contextual snippet around the keyword
        const idx = plainText.toLowerCase().indexOf(kw.toLowerCase());
        if (idx !== -1 && data.productNotes.length < 3) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(plainText.length, idx + 60);
          const snippet = plainText.slice(start, end).trim();
          data.productNotes.push(`...${snippet}...`);
        }
      }
    }

    // 5. Phone numbers
    const rawPhones = html.match(PHONE_REGEX) || [];
    for (const phone of rawPhones) {
      const norm = normalizePhone(phone);
      if (norm && norm.length >= 8 && norm.length <= 15) {
        data.phones.add(norm);
      }
    }

    return data;
  }

  /**
   * Enriches a lead by crawling homepage, /contact, and /about
   * @param {object} lead
   * @returns {Promise<object>} enriched updates
   */
  async enrichLead(lead) {
    if (!lead.website && !lead.domain) return {};

    const rawUrl = lead.website || `http://${lead.domain}`;
    let baseUrl;
    try {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : `http://${rawUrl}`);
      baseUrl = `${parsed.protocol}//${parsed.hostname}`;
    } catch (e) {
      return {};
    }

    logger.info({ businessName: lead.businessName, baseUrl }, 'Enriching lead from website...');

    const pagesToTry = [
      baseUrl,
      `${baseUrl}/contact`,
      `${baseUrl}/contact-us`,
      `${baseUrl}/about`,
      `${baseUrl}/about-us`
    ];

    const aggregated = {
      emails: new Set(),
      phones: new Set(),
      whatsapp: null,
      instagram: null,
      facebook: null,
      linkedin: null,
      pinterest: null,
      sellsRugsSignal: false,
      productNotes: [],
      language: lead.language || 'en'
    };

    let pagesFetched = 0;
    for (const pageUrl of pagesToTry) {
      if (pagesFetched >= 3) break; // Maximum 3 pages per domain

      const html = await this.fetchSafePage(pageUrl);
      if (html) {
        pagesFetched++;
        const pageData = this.extractDataFromHtml(html, baseUrl);

        pageData.emails.forEach((e) => aggregated.emails.add(e));
        pageData.phones.forEach((p) => aggregated.phones.add(p));
        if (pageData.whatsapp && !aggregated.whatsapp) aggregated.whatsapp = pageData.whatsapp;
        if (pageData.instagram && !aggregated.instagram) aggregated.instagram = pageData.instagram;
        if (pageData.facebook && !aggregated.facebook) aggregated.facebook = pageData.facebook;
        if (pageData.linkedin && !aggregated.linkedin) aggregated.linkedin = pageData.linkedin;
        if (pageData.pinterest && !aggregated.pinterest) aggregated.pinterest = pageData.pinterest;
        if (pageData.sellsRugsSignal) aggregated.sellsRugsSignal = true;
        if (pageData.productNotes.length > 0) {
          aggregated.productNotes.push(...pageData.productNotes);
        }
        if (pageData.language) aggregated.language = pageData.language;

        // Polite delay between pages on same domain
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const emailList = Array.from(aggregated.emails);
    const phoneList = Array.from(aggregated.phones);

    const updates = {};
    if (emailList.length > 0 && !lead.email) updates.email = emailList[0];
    if (emailList.length > 1 && !lead.email2) updates.email2 = emailList[1];
    if (phoneList.length > 0 && !lead.phone) updates.phone = phoneList[0];
    if (phoneList.length > 1 && !lead.phone2) updates.phone2 = phoneList[1];
    if (aggregated.whatsapp && !lead.whatsapp) updates.whatsapp = aggregated.whatsapp;
    if (aggregated.instagram && !lead.instagram) updates.instagram = aggregated.instagram;
    if (aggregated.facebook && !lead.facebook) updates.facebook = aggregated.facebook;
    if (aggregated.linkedin && !lead.linkedin) updates.linkedin = aggregated.linkedin;
    if (aggregated.pinterest && !lead.pinterest) updates.pinterest = aggregated.pinterest;
    if (aggregated.sellsRugsSignal && !lead.sellsRugsSignal) updates.sellsRugsSignal = true;
    if (aggregated.productNotes.length > 0) {
      updates.productNotes = aggregated.productNotes.slice(0, 3).join(' | ');
    }
    if (aggregated.language) updates.language = aggregated.language;

    return updates;
  }
}

module.exports = WebsiteEnricher;
