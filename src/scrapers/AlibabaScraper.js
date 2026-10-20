const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when Alibaba updates its supplier listings markup.
 */
const SELECTORS = {
  card: '.organic-list-item, .supplier-item, div[data-content="productItem"]',
  title: '.company-name, .search-card-e-company, a.organic-gallery-company-name',
  location: '.country-name, .supplier-country',
  link: 'a.organic-gallery-company-name, a.search-card-e-company'
};

class AlibabaScraper extends BaseScraper {
  constructor() {
    super('alibaba', { enabled: true });
  }

  buildUrl(keyword, location) {
    const query = encodeURIComponent(keyword || 'carpet rugs');
    return `https://www.alibaba.com/trade/search?SearchText=${query}`;
  }

  async scrape({ keyword, country = 'Global', state = null, city = 'Global', leadType = 'rug_wholesaler' }) {
    logger.info({ keyword }, 'Executing Alibaba B2B supplier scraper...');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), city);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'Alibaba blocked by robots.txt');
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
      if (/captcha|access denied|sec.alibaba.com/i.test(content)) {
        await this.captureDebugScreenshot(page, 'blocked');
        throw new Error('Blocked by Alibaba security challenge');
      }

      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            const titleEl = card.querySelector(sel.title);
            const locEl = card.querySelector(sel.location);
            const linkEl = card.querySelector(sel.link);

            return {
              name: titleEl ? titleEl.innerText.trim() : null,
              address: locEl ? locEl.innerText.trim() : null,
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
              country: c.address || country,
              city,
              sourceUrl: c.sourceUrl,
              sellsRugsSignal: true
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'Alibaba directory scrape complete');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'Alibaba scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = AlibabaScraper;
