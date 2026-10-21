const axios = require('axios');
const BaseScraper = require('./BaseScraper');
const logger = require('../config/logger');

const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter'
];

class OverpassSource extends BaseScraper {
  constructor() {
    super('overpass', { enabled: true });
    this.endpoints = MIRRORS;
  }

  buildUrl(keyword, location) {
    return `${this.endpoints[0]}?data=[out:json];...`;
  }

  async checkRobots(targetUrl) {
    // Official public API endpoint - allowed
    return true;
  }

  getOsmFilters(leadType) {
    switch (leadType) {
      case 'rug_retailer':
      case 'rug_wholesaler':
        return ['node["shop"="carpet"]', 'way["shop"="carpet"]'];
      case 'interior_designer':
        return [
          'node["office"="interior_design"]', 'way["office"="interior_design"]',
          'node["shop"="interior_decoration"]', 'way["shop"="interior_decoration"]'
        ];
      case 'interior_contractor':
        return [
          'node["shop"="interior_decoration"]', 'way["shop"="interior_decoration"]',
          'node["craft"="carpenter"]', 'way["craft"="carpenter"]'
        ];
      case 'architect':
        return ['node["office"="architect"]', 'way["office"="architect"]'];
      case 'home_decor':
        return [
          'node["shop"="furniture"]', 'way["shop"="furniture"]',
          'node["shop"="interior_decoration"]', 'way["shop"="interior_decoration"]'
        ];
      default:
        return ['node["shop"="carpet"]', 'way["shop"="carpet"]'];
    }
  }

  buildQuery(city, country, leadType) {
    const filters = this.getOsmFilters(leadType);
    const targetArea = (city || country || '').trim();

    const filterClauses = filters
      .map((f) => `${f}(area.searchArea);`)
      .join('\n  ');

    return `
[out:json][timeout:15];
(
  area["name"="${targetArea}"];
  area["name:en"="${targetArea}"];
)->.searchArea;
(
  ${filterClauses}
);
out center 40;
    `.trim();
  }

  parseElements(elements, { country, state, city, leadType }) {
    const leads = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || tags['name:ar'];
      if (!name) continue;

      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;

      const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ');
      const addrCity = tags['addr:city'] || city;
      const fullAddress = [street, addrCity, tags['addr:postcode'], country].filter(Boolean).join(', ');

      const phone = tags.phone || tags['contact:phone'] || null;
      const email = tags.email || tags['contact:email'] || null;
      const website = tags.website || tags['contact:website'] || null;

      const isCarpet = tags.shop === 'carpet' || /rug|carpet|carpeted|floor/i.test(name);

      const raw = {
        name,
        country,
        state,
        city: addrCity,
        address: fullAddress || null,
        postalCode: tags['addr:postcode'] || null,
        lat,
        lng,
        phone,
        email,
        website,
        sellsRugsSignal: isCarpet,
        sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        tags: Object.keys(tags)
      };

      leads.push(this.standardizeLead(raw, { country, state, city, leadType }));
    }
    return leads;
  }

  async scrape({ keyword, country, state, city, leadType }) {
    this.lastError = null;
    this.isBlocked = false;
    const targetArea = city || country;
    logger.info({ city, country, leadType }, 'Starting Overpass OSM query...');
    const query = this.buildQuery(city, country, leadType);

    let lastErrMsg = null;

    for (const endpoint of this.endpoints) {
      try {
        const client = this.client || axios;
        const response = await client.post(
          endpoint,
          `data=${encodeURIComponent(query)}`,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'User-Agent': 'KnotiqLeadBot/1.0 (info@knotiqrugs.com)'
            },
            timeout: 10000
          }
        );

        const elements = response.data?.elements || [];
        if (elements.length > 0) {
          const leads = this.parseElements(elements, { country, state, city, leadType });
          logger.info({ found: leads.length, endpoint }, 'Overpass OSM scrape complete');
          return leads;
        } else {
          this.lastError = `Overpass returned 0 elements for ${leadType} in ${targetArea}`;
          return [];
        }
      } catch (err) {
        lastErrMsg = err.message;
        const isBlocked = /403|blocked|rate|limit|too many/i.test(err.message);
        if (isBlocked) {
          this.isBlocked = true;
        }
        logger.warn({ endpoint, err: err.message }, 'Overpass mirror request failed, trying next mirror');
      }
    }

    this.lastError = `All Overpass mirrors failed or timed out: ${lastErrMsg || 'No response'}`;
    return [];
  }
}

module.exports = OverpassSource;
