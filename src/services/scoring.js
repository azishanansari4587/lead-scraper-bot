const logger = require('../config/logger');

// Configurable priority countries for Knotiq Rugs export target markets
const DEFAULT_PRIORITY_COUNTRIES = [
  'uae', 'united arab emirates',
  'uk', 'united kingdom', 'great britain',
  'usa', 'united states', 'united states of america',
  'germany', 'deutschland',
  'australia',
  'saudi arabia', 'saudi', 'ksa',
  'qatar',
  'kuwait',
  'oman',
  'bahrain'
];

// Marketplace / Competitor keywords that should receive a score penalty
const COMPETITOR_MARKETPLACE_KEYWORDS = [
  'amazon', 'ebay', 'etsy', 'walmart', 'wayfair', 'flipkart', 'aliexpress',
  'rug manufacturer india', 'carpet factory bhadohi', 'carpet exporter mirzapur'
];

const B2B_TRADE_KEYWORDS = [
  'import', 'importer', 'wholesale', 'wholesaler', 'bulk', 'trade', 'trade discount',
  'project', 'hospitality', 'contract', 'custom size', 'bespoke', 'b2b', 'procurement'
];

/**
 * Calculates rule-based lead score (0-100) and readable scoreReason
 * @param {object} lead Lead data or model instance
 * @param {object} [options] Custom weights or priority countries
 * @returns {{ score: number, scoreReason: string }}
 */
function calculateLeadScore(lead, options = {}) {
  const priorityCountries = (options.priorityCountries || DEFAULT_PRIORITY_COUNTRIES).map((c) => c.toLowerCase());
  const reasons = [];
  let score = 0;

  // 1. Suppression / Opt-Out Check (-100)
  if (lead.isOptedOut) {
    return {
      score: 0,
      scoreReason: 'Lead is on the OptOut suppression list (-100)'
    };
  }

  // 2. Category Match
  const leadType = (lead.leadType || '').toLowerCase();
  if (leadType === 'rug_retailer' || leadType === 'rug_wholesaler') {
    score += 20;
    reasons.push('+20 Exact category match (rug retailer/wholesaler)');
  } else if (leadType === 'interior_designer' || leadType === 'interior_contractor') {
    score += 15;
    reasons.push('+15 High-fit category (interior designer/fit-out)');
  } else if (leadType === 'architect' || leadType === 'home_decor' || leadType === 'hospitality') {
    score += 10;
    reasons.push('+10 Relevant category (architect/decor/hospitality)');
  } else {
    score += 5;
    reasons.push('+5 Generic business category');
  }

  // 3. Sells Rugs / Carpets Signal (+15)
  if (lead.sellsRugsSignal) {
    score += 15;
    reasons.push('+15 Verified rugs/carpets signal');
  }

  // 4. Contact Channels (has website, has business email, has phone/WhatsApp, cap +25)
  let contactPoints = 0;
  const channels = [];
  if (lead.website || lead.domain) {
    contactPoints += 10;
    channels.push('website');
  }
  if (lead.email) {
    contactPoints += 10;
    channels.push('email');
  }
  if (lead.phone || lead.whatsapp) {
    contactPoints += 10;
    channels.push('phone/WhatsApp');
  }

  const cappedContactPoints = Math.min(25, contactPoints);
  if (cappedContactPoints > 0) {
    score += cappedContactPoints;
    reasons.push(`+${cappedContactPoints} Contact details verified (${channels.join(', ')})`);
  }

  // 5. Established Business (+10 for rating >= 4.0 and reviewCount >= 20)
  const rating = parseFloat(lead.rating) || 0;
  const reviewCount = parseInt(lead.reviewCount, 10) || 0;
  if (rating >= 4.0 && reviewCount >= 20) {
    score += 10;
    reasons.push(`+10 Established business (${rating}★ with ${reviewCount} reviews)`);
  }

  // 6. Priority Export Country (+10)
  const country = (lead.country || '').toLowerCase().trim();
  if (country && priorityCountries.some((pc) => country === pc || country.includes(pc))) {
    score += 10;
    reasons.push(`+10 Target export country (${lead.country})`);
  }

  // 7. B2B / Trade / Import signals (+10)
  const searchableText = [
    lead.businessName,
    lead.productNotes,
    lead.notes,
    Array.isArray(lead.tags) ? lead.tags.join(' ') : ''
  ].join(' ').toLowerCase();

  const foundB2bKeywords = B2B_TRADE_KEYWORDS.filter((kw) => searchableText.includes(kw));
  if (foundB2bKeywords.length > 0) {
    score += 10;
    reasons.push(`+10 Mentions trade/bulk keywords (${foundB2bKeywords.slice(0, 2).join(', ')})`);
  }

  // 8. Competitor or marketplace penalty (-20)
  const isCompetitorOrMarketplace = COMPETITOR_MARKETPLACE_KEYWORDS.some((kw) => searchableText.includes(kw));
  if (isCompetitorOrMarketplace) {
    score -= 20;
    reasons.push('-20 Marketplace or direct manufacturer listing');
  }

  // Clamp final score to 0–100
  const finalScore = Math.max(0, Math.min(100, score));
  const scoreReason = reasons.join('; ');

  return {
    score: finalScore,
    scoreReason
  };
}

module.exports = {
  calculateLeadScore,
  DEFAULT_PRIORITY_COUNTRIES
};
