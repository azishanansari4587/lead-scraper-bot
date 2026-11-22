/**
 * Buyer Classification Engine for Knotiq Rugs
 * Classifies leads into:
 * designer, importer, hotel, retailer, online_seller, homeowner, developer, investor, unclassified
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const env = require('../../config/env');
const logger = require('../../config/logger');

const BUYER_SIGNALS = {
  designer: [
    'interior design',
    'interior designer',
    'interior architecture',
    'interior architect',
    'architectural',
    'architect',
    'decor studio',
    'design studio',
    'studio',
    'residential interiors',
    'commercial interiors',
    'interior styling',
    'interiors & architecture',
    'decorating studio',
    'ff&e'
  ],
  hotel: [
    'hotel',
    'resort',
    'hospitality',
    'turnkey fit-out',
    'fit-out',
    'fitout',
    'contract furnishing',
    'guest house',
    'palace',
    'suites & resort',
    'hotel procurement',
    'luxury lodging'
  ],
  importer: [
    'rug importer',
    'carpet importer',
    'direct importer',
    'customs clearance',
    'general trading',
    'trading llc',
    'wholesale distribution',
    'wholesale',
    'wholesaler',
    'importer & distributor',
    'flooring distributor',
    'distribution',
    'distributor',
    'import export',
    'import',
    'trading'
  ],
  retailer: [
    'carpet showroom',
    'rug boutique',
    'furniture store',
    'furniture',
    'flooring gallery',
    'home decor store',
    'home decor',
    'rug retailer',
    'rug gallery',
    'carpet shop',
    'carpet house',
    'showroom'
  ],
  online_seller: [
    'amazon',
    'noon.com',
    'noon',
    'shopify',
    'etsy',
    'wayfair',
    'online store',
    'ecommerce',
    'e-commerce',
    'buy online',
    'online rugs',
    'online seller'
  ],
  developer: [
    'real estate developer',
    'real estate',
    'developments',
    'development',
    'properties llc',
    'properties',
    'master developer',
    'fit-out contractor',
    'fit out contractor',
    'building contractor',
    'contracting',
    'contractor',
    'luxury villa developer',
    'construction contracting'
  ],
  investor: [
    'private equity',
    'venture capital',
    'venture partner',
    'venture fund',
    'capital partner',
    'capital management',
    'seed capital',
    'investor',
    'angel investor',
    'investment',
    'investments',
    'asset management',
    'family office',
    'property investor',
    'commercial investor',
    'investment group'
  ],
  homeowner: [
    'homeowner',
    'private client',
    'villa resident',
    'personal residence',
    'inbound enquiry',
    'inbound',
    'individual buyer'
  ]
};

// In-memory daily counter for Gemini evaluation quota
let dailyAiUsage = 0;
let lastUsageReset = new Date().toDateString();

function checkAndIncrementAiQuota() {
  const today = new Date().toDateString();
  if (today !== lastUsageReset) {
    dailyAiUsage = 0;
    lastUsageReset = today;
  }
  const cap = env.GEMINI_DAILY_LIMIT || 100;
  if (dailyAiUsage >= cap) {
    return false;
  }
  dailyAiUsage++;
  return true;
}

/**
 * Rule-based classification from lead text and fields
 * @param {object} lead
 * @returns {{ buyerType: string, confidence: number, reason: string }}
 */
function classifyByRules(lead = {}) {
  const textCorpus = [
    lead.businessName || '',
    lead.category || '',
    lead.subCategory || '',
    lead.productNotes || '',
    lead.bio || '',
    lead.description || '',
    lead.notes || '',
    lead.website || '',
    lead.sourceUrl || '',
    lead.detail || '',
    lead.leadType || ''
  ]
    .join(' ')
    .toLowerCase();

  const scores = {};
  const matchedSignals = {};

  for (const [type, signals] of Object.entries(BUYER_SIGNALS)) {
    scores[type] = 0;
    matchedSignals[type] = [];

    for (const signal of signals) {
      if (textCorpus.includes(signal)) {
        scores[type] += 1;
        matchedSignals[type].push(signal);
      }
    }
  }

  // Check specific existing leadType mappings as initial boost
  if (lead.leadType === 'interior_designer') scores.designer += 2;
  if (lead.leadType === 'rug_wholesaler') scores.importer += 2;
  if (lead.leadType === 'rug_retailer') scores.retailer += 2;
  if (lead.leadType === 'interior_contractor') scores.developer += 2;
  if (lead.leadType === 'architect') scores.designer += 2;

  // Specific domain checks for online seller
  const urlCorpus = `${lead.website || ''} ${lead.sourceUrl || ''}`.toLowerCase();
  if (
    urlCorpus.includes('amazon') ||
    urlCorpus.includes('noon.com') ||
    urlCorpus.includes('noon') ||
    urlCorpus.includes('shopify') ||
    urlCorpus.includes('etsy') ||
    urlCorpus.includes('wayfair')
  ) {
    scores.online_seller += 3;
    matchedSignals.online_seller.push('e-commerce domain link');
  }

  // Find highest scoring type
  let bestType = 'unclassified';
  let highestScore = 0;

  for (const [type, score] of Object.entries(scores)) {
    if (score > highestScore) {
      highestScore = score;
      bestType = type;
    }
  }

  if (highestScore >= 2) {
    const confidence = Math.min(0.95, 0.75 + highestScore * 0.08);
    const reason = `Rule match for ${bestType}: matched signals [${matchedSignals[bestType].slice(0, 3).join(', ')}]`;
    return { buyerType: bestType, confidence: parseFloat(confidence.toFixed(2)), reason };
  } else if (highestScore === 1) {
    return {
      buyerType: bestType,
      confidence: 0.85,
      reason: `Rule match for ${bestType}: matched signal [${matchedSignals[bestType][0]}]`
    };
  }

  return {
    buyerType: 'unclassified',
    confidence: 0.2,
    reason: 'Insufficient distinctive keywords found across business name and profile.'
  };
}

/**
 * Optional LLM Fallback when rule confidence < 0.70
 */
async function classifyWithGemini(lead = {}) {
  const apiKey = env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey || !checkAndIncrementAiQuota()) {
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: env.GEMINI_MODEL || 'gemini-1.5-flash' });

    // Cleanse untrusted data
    const safeData = JSON.stringify({
      businessName: (lead.businessName || '').replace(/[\x00-\x1F\x7F]/g, ''),
      category: (lead.subCategory || lead.leadType || '').replace(/[\x00-\x1F\x7F]/g, ''),
      website: (lead.website || '').replace(/[\x00-\x1F\x7F]/g, ''),
      notes: (lead.productNotes || lead.notes || '').replace(/[\x00-\x1F\x7F]/g, '')
    });

    const prompt = `You are an expert B2B classification agent for Knotiq Rugs, a luxury handmade rug exporter.
Classify the following business into EXACTLY ONE buyer type key from this list:
[designer, importer, hotel, retailer, online_seller, homeowner, developer, investor, unclassified]

Definitions:
- designer: Interior design studios, architects, FF&E styling decorators.
- importer: Direct rug/carpet importers, bulk wholesale distributors.
- hotel: Luxury hotels, resorts, hospitality operators, commercial contract fit-outs.
- retailer: Rug boutiques, carpet showrooms, furniture retail stores.
- online_seller: E-commerce brands selling on Amazon, Noon, Shopify, Etsy.
- homeowner: Private residential client or personal buyer.
- developer: Real estate master developers, luxury villa contractors.
- investor: Commercial property investors, holiday home portfolio managers.
- unclassified: If impossible to determine.

Data to evaluate:
<untrusted_scraped_data>
${safeData}
</untrusted_scraped_data>

Return JSON ONLY in this format:
{"buyerType": "one_of_the_keys", "confidence": 0.85, "reason": "concise 1-sentence reason"}`;

    const result = await model.generateContent(prompt);
    const raw = result.response.text();
    const cleanJson = raw.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    const validKeys = [
      'designer',
      'importer',
      'hotel',
      'retailer',
      'online_seller',
      'homeowner',
      'developer',
      'investor',
      'unclassified'
    ];

    if (validKeys.includes(parsed.buyerType)) {
      return {
        buyerType: parsed.buyerType,
        confidence: Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0.75)),
        reason: `AI classification: ${parsed.reason || 'classified by model'}`
      };
    }
  } catch (err) {
    logger.debug({ err: err.message }, 'Gemini classification fallback encountered an error');
  }

  return null;
}

/**
 * Main Classifier Function
 * @param {object} lead
 * @returns {Promise<{ buyerType: string, confidence: number, reason: string }>}
 */
async function classifyBuyer(lead = {}) {
  // If homeowner has been indicated manually, respect it
  if (lead.buyerType === 'homeowner' && lead.buyerTypeManual) {
    return {
      buyerType: 'homeowner',
      confidence: 1.0,
      reason: 'Homeowner indicated manually'
    };
  }

  // 1. Try deterministic rules
  const ruleResult = classifyByRules(lead);

  // If rule confidence is high (>= 0.70), return immediately
  if (ruleResult.confidence >= 0.7) {
    return ruleResult;
  }

  // 2. Try Gemini fallback if rule confidence is moderate/low
  const aiResult = await classifyWithGemini(lead);
  if (aiResult && aiResult.confidence >= 0.65) {
    return aiResult;
  }

  // 3. Fallback to rule result or unclassified
  return ruleResult.confidence >= 0.5
    ? ruleResult
    : {
        buyerType: 'unclassified',
        confidence: 0.3,
        reason: 'Low confidence matching across keywords and profile data.'
      };
}

module.exports = {
  classifyBuyer,
  classifyByRules,
  BUYER_SIGNALS
};
