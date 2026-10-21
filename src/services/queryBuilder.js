/**
 * Query Builder Helper
 * Builds query strings from data/keywords.json / KeywordSet per leadType,
 * with fallback default map and full custom keyword override support.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../config/logger');

const DEFAULT_MAP = {
  rug_retailer: ['carpet shop', 'rug store', 'rug showroom', 'luxury carpets'],
  rug_wholesaler: ['carpet wholesaler', 'rug distributor', 'wholesale carpets'],
  interior_designer: ['interior design studio', 'interior designer', 'interior decor'],
  interior_contractor: ['fitout contractor', 'interior contractor', 'interior fit out'],
  architect: ['architectural firm', 'architects', 'architect office'],
  home_decor: ['home decor store', 'luxury furniture showroom', 'interior furnishings']
};

let cachedKeywords = null;

function loadKeywordsFile() {
  if (cachedKeywords) return cachedKeywords;
  try {
    const filePath = path.resolve(process.cwd(), 'data/keywords.json');
    if (fs.existsSync(filePath)) {
      cachedKeywords = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      return cachedKeywords;
    }
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not read data/keywords.json, using fallback map');
  }
  return [];
}

/**
 * Resolves keyword for a lead type with priority:
 * 1. Custom user keyword override (if specified)
 * 2. Primary keyword from data/keywords.json matching leadType & language
 * 3. Fallback dictionary map per leadType
 * 4. leadType.replace(/_/g, ' ')
 *
 * @param {object} params
 * @param {string} [params.keyword] Custom keyword override
 * @param {string} [params.leadType] e.g. rug_retailer
 * @param {string} [params.language] Language code ('en', 'ar', etc.)
 * @returns {string}
 */
function getKeywordForLeadType({ keyword, leadType = 'rug_retailer', language = 'en' }) {
  if (keyword && typeof keyword === 'string' && keyword.trim()) {
    return keyword.trim();
  }

  const allKeywords = loadKeywordsFile();
  const matched = allKeywords.find(
    (k) => k.leadType === leadType && (k.language === language || (!k.language || k.language === 'en'))
  );

  if (matched && Array.isArray(matched.keywords) && matched.keywords.length > 0) {
    return matched.keywords[0];
  }

  const fallback = DEFAULT_MAP[leadType];
  if (fallback && fallback.length > 0) {
    return fallback[0];
  }

  return leadType.replace(/_/g, ' ');
}

/**
 * Builds full query with location: "<keyword> in <city>, <state>, <country>"
 */
function buildSearchQuery({ keyword, leadType = 'rug_retailer', city, state, country, language = 'en' }) {
  const searchTerm = getKeywordForLeadType({ keyword, leadType, language });
  const locationParts = [city, state, country].filter(Boolean).join(', ');
  return locationParts ? `${searchTerm} in ${locationParts}` : searchTerm;
}

module.exports = {
  getKeywordForLeadType,
  buildSearchQuery,
  DEFAULT_MAP
};
