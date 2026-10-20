const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when YellowPages.ae updates its DOM structure.
 */
const SELECTORS = {
  card: '.listing-item, .business-card, .search-result-item, .yp-card',
  title: '.company-name, h2 a, .business-title, a.title',
  address: '.address, .location, .city-text',
  phone: '.phone, a[href^="tel:"], .contact-number',
  website: 'a.website-link, a[href^="http"]:not([href*="yellowpages"])',
  link: 'a.company-name, h2 a'
};

class YellowPagesUaeScraper extends BaseScraper {
  constructor() {
    super('yellowpages_uae', { enabled: true });
  }

  buildUrl(keyword, location) {
    const city = (location || 'dubai').toLowerCase();
    const query = encodeURIComponent(keyword || 'carpet');
    return `https://www.yellowpages.ae/search/${city}/${query}`;
  }

  async scrape({ keyword, country = 'UAE', state = null, city = 'Dubai', leadType = 'rug_retailer' }) {
    logger.info({ keyword, city }, 'Executing UAE Yellow Pages scraper...');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), city);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'YellowPages UAE blocked by robots.txt');
      return [];
    }

    let context = null;
    let page = null;
    try {
      context = await this.newContext();
      page = await context.newPage();

      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.randomDelay(1500, 3000);

      const content = await page.content();
      if (/captcha|access denied|blocked/i.test(content)) {
        await this.captureDebugScreenshot(page, 'blocked');
        throw new Error('Blocked by anti-bot challenge');
      }

      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            const titleEl = card.querySelector(sel.title);
            const addrEl = card.querySelector(sel.address);
            const phoneEl = card.querySelector(sel.phone);
            const webEl = card.querySelector(sel.website);
            const linkEl = card.querySelector(sel.link);

            return {
              name: titleEl ? titleEl.innerText.trim() : null,
              address: addrEl ? addrEl.innerText.trim() : null,
              phone: phoneEl ? phoneEl.innerText.trim() : null,
              website: webEl ? webEl.href : null,
              sourceUrl: linkEl ? linkEl.href : null
            };
          });
        },
        SELECTORS
      );

      const leads = rawCards
        .filter((c) => c && c.name)
        .map((c) => {
          return this.standardizeLead(
            {
              businessName: c.name,
              address: c.address,
              phone: c.phone,
              website: c.website,
              country,
              state,
              city,
              sourceUrl: c.sourceUrl,
              sellsRugsSignal: /rug|carpet|flooring/i.test(c.name)
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'UAE Yellow Pages scrape complete');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'UAE Yellow Pages scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = YellowPagesUaeScraper;
