const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

/**
 * SELECTORS CONFIGURATION for Google Maps Web Interface
 * Updated for current Google Maps UI structure.
 */
const SELECTORS = {
  feed: 'div[role="feed"]',
  card: 'div.Nv2PK, div[role="article"]',
  title: '.qBF1Pd, .fontHeadlineSmall, h3',
  link: 'a.hfpxzc, a[href*="/maps/place/"]',
  rating: 'span.MW4etd, [aria-label*="stars"], [aria-label*="star"]',
  reviewCount: 'span.UY7F9, [aria-label*="reviews"]',
  website: 'a[data-value="Website"], a[aria-label*="Website"], a.lcr4fd',
  phone: 'span.UsdlK, button[data-tooltip*="phone"], [aria-label*="Phone"]',
  lines: '.W4Efsd'
};

class GoogleMapsScraper extends BaseScraper {
  constructor() {
    super('google_maps', { enabled: true });
    this.rateLimitMs = 2500;
  }

  buildUrl(keyword, location) {
    const loc = location || 'Dubai';
    const query = `${keyword || 'carpet store'} in ${loc}`;
    return `https://www.google.com/maps/search/${encodeURIComponent(query)}?hl=en`;
  }

  async checkRobots(targetUrl) {
    // Google Maps public listings accessed via stealth browser emulation
    return true;
  }

  async scrape({ keyword, country = 'UAE', state = null, city = 'Dubai', leadType = 'rug_retailer' }) {
    const locationQuery = [city, state, country].filter(Boolean).join(', ');
    const queryTerm = keyword || leadType.replace(/_/g, ' ');
    const targetUrl = this.buildUrl(queryTerm, locationQuery);

    logger.info({ queryTerm, locationQuery, targetUrl }, 'Executing Google Maps browser scraper...');

    let context = null;
    let page = null;

    try {
      context = await this.newContext();
      page = await context.newPage();

      // Navigate to Google Maps search
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await this.randomDelay(1500, 2500);

      // Handle Google Cookie/Consent Banner if presented
      try {
        const consentSelectors = [
          'button[aria-label="Accept all"]',
          'form[action*="consent"] button',
          'button:has-text("Accept all")',
          'button:has-text("I agree")',
          'button:has-text("Agree")'
        ];
        for (const sel of consentSelectors) {
          const btn = await page.$(sel);
          if (btn) {
            await btn.click();
            logger.debug('Clicked Google Maps consent banner');
            await this.randomDelay(1000, 1800);
            break;
          }
        }
      } catch (consentErr) {
        logger.debug({ err: consentErr.message }, 'Consent modal check ignored');
      }

      // Check for Google Captcha / Bot Challenge
      const pageHtml = await page.content();
      if (/unusual traffic|solving the above captcha|recaptcha/i.test(pageHtml)) {
        await this.captureDebugScreenshot(page, 'captcha_blocked');
        throw new Error('Blocked by Google unusual traffic challenge');
      }

      // Wait for results container or place card
      try {
        await page.waitForSelector('div[role="feed"], div.Nv2PK, a[href*="/maps/place/"], h1.DUwDvf', {
          timeout: 10000
        });
      } catch (waitErr) {
        logger.debug('No immediate feed selector found, attempting extraction directly');
      }

      // Scroll the sidebar feed to load up to ~20 results
      const feed = await page.$(SELECTORS.feed);
      if (feed) {
        for (let i = 0; i < 4; i++) {
          await feed.evaluate((el) => el.scrollBy(0, 1000));
          await this.randomDelay(800, 1400);
        }
      }

      // Extract cards from listing
      const rawCards = await page.$$eval(
        SELECTORS.card,
        (cards, sel) => {
          return cards.map((card) => {
            // Business title
            const titleEl = card.querySelector(sel.title) || card.querySelector('a.hfpxzc');
            const name = titleEl?.textContent?.trim() || titleEl?.getAttribute('aria-label') || '';

            // Google Maps URL
            const linkEl = card.querySelector(sel.link);
            const googleMapsUrl = linkEl ? linkEl.href : null;

            // Rating
            const ratingEl = card.querySelector(sel.rating);
            let rating = null;
            if (ratingEl) {
              const rMatch = (ratingEl.textContent || ratingEl.getAttribute('aria-label') || '').match(/(\d+(?:\.\d+)?)/);
              if (rMatch) rating = parseFloat(rMatch[1]);
            }

            // Review count
            const reviewEl = card.querySelector(sel.reviewCount);
            let reviewCount = 0;
            if (reviewEl) {
              const revMatch = (reviewEl.textContent || reviewEl.getAttribute('aria-label') || '').replace(/,/g, '').match(/(\d+)/);
              if (revMatch) reviewCount = parseInt(revMatch[1], 10);
            }

            // Website link
            const websiteEl = card.querySelector(sel.website);
            const website = websiteEl ? websiteEl.href : null;

            // Phone
            const phoneEl = card.querySelector(sel.phone);
            const phone = phoneEl ? (phoneEl.textContent?.trim() || phoneEl.getAttribute('aria-label')) : null;

            // Details snippets
            const detailLines = Array.from(card.querySelectorAll(sel.lines))
              .map((el) => el.textContent?.trim())
              .filter(Boolean);

            const combinedText = detailLines.join(' • ');

            // Try to extract address from snippet lines
            let address = null;
            for (const line of detailLines) {
              if (line.includes('·') || line.includes('•')) {
                const parts = line.split(/[·•]/).map((p) => p.trim());
                if (parts.length > 1) {
                  address = parts[parts.length - 1];
                }
              }
            }

            return {
              name,
              googleMapsUrl,
              rating,
              reviewCount,
              website,
              phone,
              address,
              rawText: combinedText
            };
          });
        },
        SELECTORS
      );

      // Fallback: If Google redirected directly to a single business page
      if (rawCards.length === 0) {
        const singleTitle = await page.$eval('h1.DUwDvf, h1', (el) => el.textContent?.trim()).catch(() => null);
        if (singleTitle) {
          const singleWebsite = await page.$eval('a[data-item-id="authority"], a[aria-label*="Website"]', (el) => el.href).catch(() => null);
          const singlePhone = await page.$eval('button[data-item-id*="phone"]', (el) => el.textContent?.trim()).catch(() => null);
          const singleAddress = await page.$eval('button[data-item-id="address"]', (el) => el.textContent?.trim()).catch(() => null);
          const singleRating = await page.$eval('span.ceNzKf, [aria-label*="stars"]', (el) => {
            const m = (el.textContent || el.getAttribute('aria-label') || '').match(/(\d+(?:\.\d+)?)/);
            return m ? parseFloat(m[1]) : null;
          }).catch(() => null);

          rawCards.push({
            name: singleTitle,
            googleMapsUrl: page.url(),
            rating: singleRating,
            reviewCount: 0,
            website: singleWebsite,
            phone: singlePhone,
            address: singleAddress,
            rawText: ''
          });
        }
      }

      const leads = [];
      for (const card of rawCards) {
        if (!card.name) continue;

        // Extract lat / lng coordinates if encoded in Google Maps URL
        let lat = null;
        let lng = null;
        if (card.googleMapsUrl) {
          const coordMatch1 = card.googleMapsUrl.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
          if (coordMatch1) {
            lat = parseFloat(coordMatch1[1]);
            lng = parseFloat(coordMatch1[2]);
          } else {
            const coordMatch2 = card.googleMapsUrl.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
            if (coordMatch2) {
              lat = parseFloat(coordMatch2[1]);
              lng = parseFloat(coordMatch2[2]);
            }
          }
        }

        // Check for phone regex in raw snippet text if phone selector didn't catch it
        let phone = card.phone;
        if (!phone && card.rawText) {
          const phoneMatch = card.rawText.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/);
          if (phoneMatch) {
            phone = phoneMatch[0].trim();
          }
        }

        const isRugRelated = /rug|carpet|flooring|matting|dhurrie|kilim|interior|decor|furniture|architect/i.test(
          `${card.name} ${card.rawText || ''} ${queryTerm}`
        );

        const standardized = this.standardizeLead(
          {
            businessName: card.name,
            address: card.address,
            lat,
            lng,
            phone,
            website: card.website,
            googleMapsUrl: card.googleMapsUrl,
            rating: card.rating,
            reviewCount: card.reviewCount,
            sellsRugsSignal: isRugRelated,
            sourceUrl: card.googleMapsUrl || targetUrl,
            tags: ['google_maps', city, leadType].filter(Boolean)
          },
          { country, state, city, leadType }
        );

        leads.push(standardized);
      }

      logger.info({ found: leads.length, platform: 'google_maps' }, 'Google Maps scrape complete');
      return leads;
    } catch (err) {
      logger.error({ err: err.message, platform: 'google_maps' }, 'Google Maps scraping failed');
      if (page) {
        await this.captureDebugScreenshot(page, 'error');
      }
      return [];
    } finally {
      if (context) {
        await context.close().catch(() => {});
      }
      await this.closeBrowser();
    }
  }
}

module.exports = GoogleMapsScraper;
