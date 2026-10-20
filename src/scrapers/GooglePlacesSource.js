const axios = require('axios');
const BaseScraper = require('./BaseScraper');
const env = require('../config/env');
const logger = require('../config/logger');

class GooglePlacesSource extends BaseScraper {
  constructor() {
    super('google_places', { enabled: true });
    this.apiKey = env.GOOGLE_PLACES_API_KEY;
  }

  get activeApiKey() {
    return process.env.GOOGLE_PLACES_API_KEY || env.GOOGLE_PLACES_API_KEY || this.apiKey;
  }

  buildUrl(keyword, location) {
    const query = `${keyword} in ${location}`;
    return `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}`;
  }

  async scrape({ keyword, country, state, city, leadType }) {
    const apiKey = this.activeApiKey;
    if (!apiKey) {
      logger.info('GOOGLE_PLACES_API_KEY not configured. Skipping Google Places API live search.');
      return [];
    }

    const locationQuery = [city, state, country].filter(Boolean).join(', ');
    const query = `${keyword || leadType.replace('_', ' ')} in ${locationQuery}`;
    logger.info({ query }, 'Executing Google Places Text Search...');

    try {
      const searchUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${apiKey}`;
      const response = await this.retry(async () => {
        return await axios.get(searchUrl, { timeout: 15000 });
      });

      const data = response.data;
      if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
        logger.warn({ status: data.status, msg: data.error_message }, 'Google Places API status warning');
        return [];
      }

      const results = data.results || [];
      const leads = [];

      for (const place of results.slice(0, 20)) {
        let details = place;

        // Optionally fetch Place Details for website & phone
        if (place.place_id) {
          try {
            const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,formatted_address,formatted_phone_number,international_phone_number,website,url,rating,user_ratings_total,geometry,types&key=${apiKey}`;
            const detailRes = await axios.get(detailUrl, { timeout: 8000 });
            if (detailRes.data?.result) {
              details = { ...place, ...detailRes.data.result };
            }
          } catch (detailErr) {
            logger.debug({ err: detailErr.message }, 'Could not fetch place details');
          }
        }

        const name = details.name;
        if (!name) continue;

        const isRugRelated = /rug|carpet|flooring|matting|dhurrie|kilim/i.test(name) ||
          (details.types && details.types.some((t) => t.includes('home_goods') || t.includes('carpet')));

        const raw = {
          name,
          country,
          state,
          city,
          address: details.formatted_address || null,
          lat: details.geometry?.location?.lat,
          lng: details.geometry?.location?.lng,
          phone: details.international_phone_number || details.formatted_phone_number,
          website: details.website || null,
          googleMapsUrl: details.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
          rating: details.rating || null,
          reviewCount: details.user_ratings_total || 0,
          sellsRugsSignal: isRugRelated,
          sourceUrl: details.url || null,
          tags: details.types || []
        };

        leads.push(this.standardizeLead(raw, { country, state, city, leadType }));
      }

      logger.info({ found: leads.length }, 'Google Places scrape complete');
      return leads;
    } catch (err) {
      logger.error({ err: err.message }, 'Google Places scrape error');
      return [];
    }
  }
}

module.exports = GooglePlacesSource;
