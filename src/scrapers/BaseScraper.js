const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

const env = require('../config/env');
const logger = require('../config/logger');
const { isUrlAllowed } = require('../services/robots');
const { normalizeDomain, normalizePhone, generateDedupeKey } = require('../services/dedupe');

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:135.0) Gecko/20100101 Firefox/135.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_7_2) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36 Edg/132.0.0.0'
];

class BaseScraper {
  /**
   * @param {string} name Scraper identifier
   * @param {object} [options]
   */
  constructor(name, options = {}) {
    if (!name) throw new Error('BaseScraper requires a unique name');
    this.name = name;
    this.enabled = options.enabled !== false;
    this.browser = null;
    this.debugDir = path.resolve(process.cwd(), 'data/debug');

    if (!fs.existsSync(this.debugDir)) {
      fs.mkdirSync(this.debugDir, { recursive: true });
    }
  }

  getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
  }

  async randomDelay(minMs = 1500, maxMs = 4500) {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  async retry(fn, maxRetries = 3, backoffFactor = 2) {
    let attempt = 0;
    let delay = 1500;
    while (attempt < maxRetries) {
      try {
        return await fn();
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) throw err;
        logger.warn({ scraper: this.name, attempt, err: err.message }, `Retrying after ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= backoffFactor;
      }
    }
  }

  async launchBrowser() {
    if (!this.browser) {
      const launchOptions = {
        headless: env.SCRAPER_HEADLESS,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu'
        ]
      };

      if (env.SCRAPER_PROXY_URL) {
        launchOptions.proxy = { server: env.SCRAPER_PROXY_URL };
      }

      this.browser = await chromium.launch(launchOptions);
    }
    return this.browser;
  }

  async newContext() {
    const browser = await this.launchBrowser();
    const context = await browser.newContext({
      userAgent: this.getRandomUserAgent(),
      viewport: { width: 1280, height: 800 },
      locale: 'en-US',
      timezoneId: 'Asia/Kolkata',
      ignoreHTTPSErrors: true
    });
    return context;
  }

  async closeBrowser() {
    if (this.browser) {
      try {
        await this.browser.close();
      } catch (err) {
        logger.debug({ err: err.message }, 'Error closing browser');
      }
      this.browser = null;
    }
  }

  async captureDebugScreenshot(page, contextInfo = 'error') {
    if (!page) return null;
    try {
      const filename = `${this.name}_${contextInfo}_${Date.now()}.png`;
      const filePath = path.join(this.debugDir, filename);
      await page.screenshot({ path: filePath, fullPage: false });
      logger.info({ filePath }, `Saved debug screenshot for ${this.name}`);
      return filePath;
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to take debug screenshot');
      return null;
    }
  }

  async checkRobots(targetUrl) {
    return isUrlAllowed(targetUrl);
  }

  /**
   * Standardizes raw scraped lead into clean lead object matching database schema
   * @param {object} raw
   * @param {object} context
   * @returns {object}
   */
  standardizeLead(raw, context = {}) {
    const domain = normalizeDomain(raw.website || raw.domain);
    const phone = normalizePhone(raw.phone);
    const whatsapp = normalizePhone(raw.whatsapp || raw.phone);

    const lead = {
      businessName: (raw.businessName || raw.name || '').trim(),
      leadType: context.leadType || raw.leadType || 'other',
      subCategory: raw.subCategory || null,
      country: context.country || raw.country || 'Unknown',
      state: context.state || raw.state || null,
      city: context.city || raw.city || 'Unknown',
      address: raw.address || null,
      postalCode: raw.postalCode || null,
      lat: raw.lat ? parseFloat(raw.lat) : null,
      lng: raw.lng || raw.lon ? parseFloat(raw.lng || raw.lon) : null,
      phone: phone,
      phone2: normalizePhone(raw.phone2),
      whatsapp: whatsapp,
      email: raw.email ? raw.email.toLowerCase().trim() : null,
      email2: raw.email2 ? raw.email2.toLowerCase().trim() : null,
      emailVerified: 'unknown',
      website: raw.website || null,
      domain: domain,
      googleMapsUrl: raw.googleMapsUrl || null,
      rating: raw.rating ? parseFloat(raw.rating) : null,
      reviewCount: raw.reviewCount ? parseInt(raw.reviewCount, 10) : 0,
      instagram: raw.instagram || null,
      facebook: raw.facebook || null,
      linkedin: raw.linkedin || null,
      pinterest: raw.pinterest || null,
      sellsRugsSignal: Boolean(raw.sellsRugsSignal),
      productNotes: raw.productNotes || null,
      source: this.name,
      sourceUrl: raw.sourceUrl || null,
      language: raw.language || 'en',
      score: 0,
      scoreReason: null,
      status: 'new',
      notes: null,
      tags: raw.tags || []
    };

    lead.dedupeKey = generateDedupeKey(lead);
    return lead;
  }

  /**
   * Abstract method: build search URL
   */
  buildUrl(keyword, location) {
    throw new Error(`buildUrl() not implemented in ${this.name}`);
  }

  /**
   * Abstract method: scrape leads
   */
  async scrape({ keyword, location, country, state, city, leadType }) {
    throw new Error(`scrape() not implemented in ${this.name}`);
  }
}

module.exports = BaseScraper;
