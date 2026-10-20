const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when TradeIndia updates its search markup.
 */
const SELECTORS = {
  card: '.co_card, .supplier-card, .search-card, .listing_box',
  title: '.co_name, .supplier-name, h2 a, .company_name',
  address: '.co_location, .city, .location_txt',
  phone: '.contact-btn, .phone-num, .mob_no',
  link: 'a.co_name, a.company_link, h2 a'
};

class TradeIndiaScraper extends BaseScraper {
  constructor() {
    super('tradeindia', { enabled: true });
  }

  buildUrl(keyword, location) {
    const query = encodeURIComponent(keyword || 'carpets');
    const city = encodeURIComponent(location || 'Delhi');
    return `https://www.tradeindia.com/search.html?keyword=${query}&city=${city}`;
  }

  async scrape({ keyword, country = 'India', state = null, city = 'Jaipur', leadType = 'rug_wholesaler' }) {
    logger.info({ keyword, city }, 'Executing TradeIndia directory scraper...');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), city);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'TradeIndia blocked by robots.txt');
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
      if (/captcha|access denied|cloudflare|blocked/i.test(content)) {
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
              sellsRugsSignal: /rug|carpet|textile|handicraft/i.test(c.name)
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'TradeIndia scraping finished');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'TradeIndia scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = TradeIndiaScraper;
