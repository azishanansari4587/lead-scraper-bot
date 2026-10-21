/**
 * Google Places API (New) Scraper
 * Uses POST https://places.googleapis.com/v1/places:searchText
 * Returns full place details in a single request with X-Goog-FieldMask,
 * eliminating the expensive per-place Details loop.
 */

const axios = require('axios');
const BaseScraper = require('./BaseScraper');
const env = require('../config/env');
const logger = require('../config/logger');
const { buildSearchQuery } = require('../services/queryBuilder');

// Daily in-memory request tracker
let dailyRequestTracker = { date: '', count: 0 };

function checkAndIncrementCap(cap = 100) {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyRequestTracker.date !== today) {
    dailyRequestTracker.date = today;
    dailyRequestTracker.count = 0;
  }
  if (dailyRequestTracker.count >= cap) {
    return false;
  }
  dailyRequestTracker.count++;
  return true;
}

class GooglePlacesSource extends BaseScraper {
  constructor() {
    super('google_places', { enabled: true });
    this.apiKey = env.GOOGLE_PLACES_API_KEY;
    this.dailyRequestTracker = dailyRequestTracker;
  }

  get activeApiKey() {
    if (this.apiKey === null) return null;
    return process.env.GOOGLE_PLACES_API_KEY || env.GOOGLE_PLACES_API_KEY || this.apiKey;
  }

  buildUrl(keyword, location) {
    return 'https://places.googleapis.com/v1/places:searchText';
  }

  async scrape({ keyword, country = 'UAE', state = null, city = 'Dubai', leadType = 'rug_retailer', pageToken = null }) {
    this.lastError = null;
    const apiKey = this.activeApiKey;
    if (!apiKey) {
      const msg = 'GOOGLE_PLACES_API_KEY is not configured';
      logger.warn(msg);
      this.lastError = msg;
      return [];
    }

    // Enforce daily request budget cap
    const dailyCap = parseInt(process.env.GOOGLE_PLACES_DAILY_REQUEST_CAP || env.GOOGLE_PLACES_DAILY_REQUEST_CAP || '100', 10);
    if (!checkAndIncrementCap(dailyCap)) {
      const capMsg = `Google Places daily request cap of ${dailyCap} requests reached. Halting live search to prevent cost overruns.`;
      logger.warn(capMsg);
      this.lastError = capMsg;
      return [];
    }

    // Build intelligent query from keywords.json / defaults or custom override
    const query = buildSearchQuery({ keyword, leadType, city, state, country });
    logger.info({ query, platform: 'google_places' }, 'Executing Places API (New) searchText...');

    const endpoint = 'https://places.googleapis.com/v1/places:searchText';
    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.nationalPhoneNumber',
      'places.internationalPhoneNumber',
      'places.websiteUri',
      'places.googleMapsUri',
      'places.rating',
      'places.userRatingCount',
      'places.types'
    ].join(',');

    const requestBody = {
      textQuery: query,
      maxResultCount: 20
    };
    if (pageToken) {
      requestBody.pageToken = pageToken;
    }

    try {
      const response = await this.retry(async () => {
        const client = this.client || axios;
        return await client.post(
          endpoint,
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': apiKey,
              'X-Goog-FieldMask': fieldMask
            },
            timeout: 15000
          }
        );
      });

      const places = response.data?.places || [];
      const leads = [];

      for (const place of places) {
        const name = place.displayName?.text || place.displayName;
        if (!name) continue;

        const isRugRelated = /rug|carpet|flooring|matting|dhurrie|kilim/i.test(name) ||
          (Array.isArray(place.types) && place.types.some((t) => t.includes('home_goods') || t.includes('carpet') || t.includes('furniture')));

        const raw = {
          name,
          country,
          state,
          city,
          address: place.formattedAddress || null,
          lat: place.location?.latitude || null,
          lng: place.location?.longitude || null,
          phone: place.internationalPhoneNumber || place.nationalPhoneNumber || null,
          website: place.websiteUri || null,
          googleMapsUrl: place.googleMapsUri || (place.id ? `https://www.google.com/maps/place/?q=place_id:${place.id}` : null),
          rating: place.rating || null,
          reviewCount: place.userRatingCount || 0,
          sellsRugsSignal: isRugRelated,
          sourceUrl: place.googleMapsUri || null,
          tags: place.types || []
        };

        leads.push(this.standardizeLead(raw, { country, state, city, leadType }));
      }

      logger.info({ found: leads.length, platform: 'google_places' }, 'Google Places API (New) scrape complete');
      return leads;
    } catch (err) {
      let errorMsg = err.message;
      if (err.response) {
        const gErr = err.response.data?.error;
        const statusCode = err.response.status;
        errorMsg = gErr ? `HTTP ${statusCode}: ${gErr.message || JSON.stringify(gErr)}` : `HTTP ${statusCode}: ${err.message}`;
      }
      logger.error({ err: errorMsg, platform: 'google_places' }, 'Google Places API (New) request failed');
      this.lastError = errorMsg;
      return [];
    }
  }
}

module.exports = GooglePlacesSource;
