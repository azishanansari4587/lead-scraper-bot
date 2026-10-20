const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION:
 * Update these CSS selectors when Yelp updates its search markup.
 */
const SELECTORS = {
  card: '[data-testid="serp-ia-card"], div.container__09f24__Fe1R4',
  title: 'h3 a, a.css-19v1rkv, a[href^="/biz/"]',
  rating: '[aria-label*="star rating"], span.css-gutk1c',
  reviewCount: 'span.css-chan6m',
  link: 'a[href^="/biz/"]'
};

class YelpScraper extends BaseScraper {
  constructor() {
    super('yelp', { enabled: true });
  }

  buildUrl(keyword, location) {
    const desc = encodeURIComponent(keyword || 'carpet store');
    const loc = encodeURIComponent(location || 'New York, NY');
    return `https://www.yelp.com/search?find_desc=${desc}&find_loc=${loc}`;
  }

  async scrape({ keyword, country = 'United States', state = null, city = 'New York', leadType = 'rug_retailer' }) {
    logger.info({ keyword, city }, 'Executing Yelp directory scraper...');
    const locationStr = [city, state, country].filter(Boolean).join(', ');
    const targetUrl = this.buildUrl(keyword || leadType.replace('_', ' '), locationStr);

    if (!(await this.checkRobots(targetUrl))) {
      logger.info({ targetUrl }, 'Yelp blocked by robots.txt');
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
        throw new Error('Blocked by Yelp anti-bot check');
      }

      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            const titleEl = card.querySelector(sel.title);
            const ratingEl = card.querySelector(sel.rating);
            const reviewEl = card.querySelector(sel.reviewCount);
            const linkEl = card.querySelector(sel.link);

            const ratingText = ratingEl ? ratingEl.getAttribute('aria-label') || ratingEl.innerText : null;
            const ratingNum = ratingText ? parseFloat(ratingText.match(/\d+(\.\d+)?/)?.[0]) : null;

            const reviewText = reviewEl ? reviewEl.innerText : null;
            const reviewNum = reviewText ? parseInt(reviewText.replace(/\D/g, ''), 10) : 0;

            return {
              name: titleEl ? titleEl.innerText.trim() : null,
              rating: ratingNum,
              reviewCount: reviewNum,
              sourceUrl: linkEl ? linkEl.href : null
            };
          });
        },
        SELECTORS
      );

      const leads = rawCards
        .filter((c) => c && c.name && !c.name.includes('Yelp') && !c.name.includes('Ad'))
        .map((c) => {
          return this.standardizeLead(
            {
              businessName: c.name,
              country,
              state,
              city,
              rating: c.rating,
              reviewCount: c.reviewCount,
              sourceUrl: c.sourceUrl,
              sellsRugsSignal: /rug|carpet|flooring/i.test(c.name)
            },
            { country, state, city, leadType }
          );
        });

      logger.info({ found: leads.length }, 'Yelp directory scrape complete');
      return leads;
    } catch (err) {
      if (page) await this.captureDebugScreenshot(page, 'error');
      logger.warn({ err: err.message }, 'Yelp scraper encountered an issue');
      return [];
    } finally {
      if (context) await context.close();
      await this.closeBrowser();
    }
  }
}

module.exports = YelpScraper;
