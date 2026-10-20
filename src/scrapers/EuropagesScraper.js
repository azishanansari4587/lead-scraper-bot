const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when Europages updates its B2B supplier listing structure.
 */
const SELECTORS = {
  card: '.company-card, .ep-card, .search-card, article.company-snippet',
  title: 'h2 a, .company-name, .title a, a[data-e2e="company-name"]',
  location: '.company-city, .company-country, .location-text',
  website: 'a.external-link, a[data-e2e="website-link"]',
  link: 'h2 a, a[data-e2e="company-name"]'
};

class EuropagesScraper extends BaseScraper {
  constructor() {
    super('europages', { enabled: true });
  }

  buildUrl(keyword, location) {
    const loc = encodeURIComponent(location || 'Frankfurt');
    const query = encodeURIComponent(keyword || 'carpets');
    return `https://www.europages.co.uk/companies/${loc}/${query}.html`;
  }

  async scrape({ keyword, country = 'Germany', state = null, city = 'Frankfurt', leadType = 'rug_wholesaler' }) {
    logger.info({ keyword, city, country }, 'Executing Europages B2B directory scraper...');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), city);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'Europages blocked by robots.txt');
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
      if (/captcha|access denied|datadome|blocked/i.test(content)) {
        await this.captureDebugScreenshot(page, 'blocked');
        throw new Error('Blocked by Europages anti-bot challenge');
      }

      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            const titleEl = card.querySelector(sel.title);
            const locEl = card.querySelector(sel.location);
            const webEl = card.querySelector(sel.website);
            const linkEl = card.querySelector(sel.link);

            return {
              name: titleEl ? titleEl.innerText.trim() : null,
              address: locEl ? locEl.innerText.trim() : null,
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
              website: c.website,
              country,
              state,
              city,
              sourceUrl: c.sourceUrl,
              sellsRugsSignal: /rug|carpet|teppich|tapis|alfombra/i.test(c.name)
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'Europages directory scrape complete');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'Europages scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = EuropagesScraper;
