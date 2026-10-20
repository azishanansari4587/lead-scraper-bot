const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when YellowPages (US) updates its search markup.
 */
const SELECTORS = {
  card: '.result, .srp-listing, div.v-card',
  title: 'a.business-name, h2.entry-title a, .business-name span',
  address: '.adr, .street-address, .locality',
  phone: '.phones, .phone, div[class*="phone"]',
  website: 'a.track-visit-website',
  link: 'a.business-name'
};

class YellowPagesScraper extends BaseScraper {
  constructor() {
    super('yellowpages', { enabled: true });
  }

  buildUrl(keyword, location) {
    const terms = encodeURIComponent(keyword || 'carpet store');
    const geo = encodeURIComponent(location || 'New York, NY');
    return `https://www.yellowpages.com/search?search_terms=${terms}&geo_location_terms=${geo}`;
  }

  async scrape({ keyword, country = 'United States', state = null, city = 'New York', leadType = 'rug_retailer' }) {
    logger.info({ keyword, city }, 'Executing YellowPages US directory scraper...');
    const locationStr = [city, state, country].filter(Boolean).join(', ');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), locationStr);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'YellowPages US blocked by robots.txt');
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
      if (/captcha|access denied|perimeterx|blocked/i.test(content)) {
        await this.captureDebugScreenshot(page, 'blocked');
        throw new Error('Blocked by YellowPages anti-bot challenge');
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

      logger.info({ found: leads.length }, 'YellowPages US directory scrape complete');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'YellowPages US scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = YellowPagesScraper;
