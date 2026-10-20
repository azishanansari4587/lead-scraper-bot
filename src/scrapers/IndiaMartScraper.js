const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when IndiaMART updates its DOM markup.
 */
const SELECTORS = {
  card: '.m-card, .listing-card, .card-body, .g-col',
  title: '.card-title, .company-name, .lc-cname, h2 a, .c-name',
  address: '.card-address, .company-address, .city-name, .clg',
  phone: '.contact-num, .pns_inner, .mob, .phn',
  link: 'a.card-title, a.company-name, .c-name a, h2 a'
};

class IndiaMartScraper extends BaseScraper {
  constructor() {
    super('indiamart', { enabled: true });
  }

  buildUrl(keyword, location) {
    const query = encodeURIComponent(keyword || 'carpets');
    const city = encodeURIComponent(location || 'Delhi');
    return `https://dir.indiamart.com/search.mp?ss=${query}&cq=${city}`;
  }

  async scrape({ keyword, country = 'India', state = null, city = 'Delhi', leadType = 'rug_wholesaler' }) {
    logger.info({ keyword, city }, 'Executing IndiaMART directory scraper...');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), city);

    // Robots check
    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'IndiaMART blocked by robots.txt');
      return [];
    }

    let context = null;
    let page = null;
    try {
      context = await this.newContext();
      page = await context.newPage();

      // Navigate with timeout
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await this.randomDelay(1500, 3000);

      // Check for bot challenge or block
      const content = await page.content();
      if (/captcha|access denied|block|cf-browser-verification/i.test(content)) {
        await this.captureDebugScreenshot(page, 'blocked');
        throw new Error('Blocked by anti-bot protection');
      }

      // Extract listings using configured selectors
      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            const titleEl = card.querySelector(sel.title);
            const addrEl = card.querySelector(sel.address);
            const phoneEl = card.querySelector(sel.phone);
            const linkEl = card.querySelector(sel.link);

            return {
              name: titleEl ? titleEl.innerText.trim() : null,
              address: addrEl ? addrEl.innerText.trim() : null,
              phone: phoneEl ? phoneEl.innerText.trim() : null,
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
              country,
              state,
              city,
              sourceUrl: c.sourceUrl,
              sellsRugsSignal: /rug|carpet|durrie|mat/i.test(c.name)
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'IndiaMART scraping finished');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'IndiaMART scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = IndiaMartScraper;
