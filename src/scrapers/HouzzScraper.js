const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when Houzz updates its professional directory markup.
 */
const SELECTORS = {
  card: '.hz-pro-card, .pro-card, [data-component="ProCard"]',
  title: '.hz-pro-card__title, .pro-title, a[data-track="pro_title"]',
  location: '.hz-pro-card__location, .pro-location',
  phone: '.hz-pro-card__phone, a[href^="tel:"]',
  rating: '.hz-star-rate__rating-number, .pro-rating',
  reviewCount: '.hz-pro-card__reviews-count, .pro-review-count',
  link: 'a[data-track="pro_title"], a.hz-pro-card__title'
};

class HouzzScraper extends BaseScraper {
  constructor() {
    super('houzz', { enabled: true });
  }

  buildUrl(keyword, location) {
    const loc = (location || 'new-york-ny').toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `https://www.houzz.com/professionals/interior-designer/c/${loc}`;
  }

  async scrape({ keyword, country = 'United States', state = null, city = 'New York', leadType = 'interior_designer' }) {
    logger.info({ city, country }, 'Executing Houzz directory scraper...');
    const targetUrl = this.buildUrl(keyword, city);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'Houzz blocked by robots.txt');
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
        throw new Error('Blocked by Houzz anti-bot challenge');
      }

      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            const titleEl = card.querySelector(sel.title);
            const locEl = card.querySelector(sel.location);
            const phoneEl = card.querySelector(sel.phone);
            const ratingEl = card.querySelector(sel.rating);
            const reviewEl = card.querySelector(sel.reviewCount);
            const linkEl = card.querySelector(sel.link);

            const ratingVal = ratingEl ? parseFloat(ratingEl.innerText.trim()) : null;
            const reviewVal = reviewEl ? parseInt(reviewEl.innerText.replace(/\D/g, ''), 10) : 0;

            return {
              name: titleEl ? titleEl.innerText.trim() : null,
              address: locEl ? locEl.innerText.trim() : null,
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
              country,
              state,
              city,
              rating: c.rating,
              reviewCount: c.reviewCount,
              sourceUrl: c.sourceUrl,
              sellsRugsSignal: /rug|carpet|decor/i.test(c.name)
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'Houzz directory scrape complete');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'Houzz scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = HouzzScraper;
