const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when Justdial updates its listing elements.
 */
const SELECTORS = {
  card: '.resultbox, .jsx-card, .store-details, div[class*="resultbox"]',
  title: '.resultbox_title_anchor, .store-name, h2 a, [class*="resultbox_title"]',
  address: '.resultbox_address, .address-info, [class*="address"]',
  phone: '.callcontent, a[href^="tel:"], [class*="call_now"]',
  rating: '.resultbox_totalrate, .rating-num, [class*="totalrate"]',
  reviewCount: '.resultbox_countrate, .rating-count',
  link: 'a.resultbox_title_anchor, h2 a'
};

class JustdialScraper extends BaseScraper {
  constructor() {
    super('justdial', { enabled: true });
  }

  buildUrl(keyword, location) {
    const city = (location || 'mumbai').toLowerCase().replace(/[^a-z0-9]/g, '-');
    const query = (keyword || 'carpet-dealers').toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `https://www.justdial.com/${city}/${query}`;
  }

  async scrape({ keyword, country = 'India', state = null, city = 'Mumbai', leadType = 'rug_retailer' }) {
    logger.info({ keyword, city }, 'Executing Justdial directory scraper...');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), city);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'Justdial blocked by robots.txt');
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
        throw new Error('Blocked by Justdial anti-bot challenge');
      }

      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            const titleEl = card.querySelector(sel.title);
            const addrEl = card.querySelector(sel.address);
            const phoneEl = card.querySelector(sel.phone);
            const ratingEl = card.querySelector(sel.rating);
            const reviewEl = card.querySelector(sel.reviewCount);
            const linkEl = card.querySelector(sel.link);

            const ratingVal = ratingEl ? parseFloat(ratingEl.innerText.trim()) : null;
            const reviewVal = reviewEl ? parseInt(reviewEl.innerText.replace(/\D/g, ''), 10) : 0;

            return {
              name: titleEl ? titleEl.innerText.trim() : null,
              address: addrEl ? addrEl.innerText.trim() : null,
              phone: phoneEl ? phoneEl.innerText.trim() : null,
              rating: ratingVal,
              reviewCount: reviewVal,
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
              rating: c.rating,
              reviewCount: c.reviewCount,
              country,
              state,
              city,
              sourceUrl: c.sourceUrl,
              sellsRugsSignal: /rug|carpet|flooring|mat/i.test(c.name)
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'Justdial directory scrape complete');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'Justdial scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = JustdialScraper;
