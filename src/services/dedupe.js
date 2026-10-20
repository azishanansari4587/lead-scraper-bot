const crypto = require('crypto');

// Common business entity suffixes to remove during name normalization
const LEGAL_SUFFIXES = [
  'llc', 'l.l.c.', 'pvt ltd', 'pvt. ltd.', 'private limited', 'ltd', 'l.t.d.', 'limited',
  'inc', 'inc.', 'incorporated', 'corp', 'corp.', 'corporation',
  'fze', 'fzc', 'fzc-llc', 'fzco', 'w.l.l.', 'wll', 'spc',
  'gmbh', 'ag', 'sarl', 's.a.r.l.', 'sl', 's.l.', 'sa', 's.a.', 'bv', 'b.v.',
  'co', 'co.', 'company', 'and company', '& co', '& co.'
];

/**
 * Normalizes business name by removing punctuation, extra spaces, and legal suffixes
 * @param {string} name
 * @returns {string}
 */
function normalizeBusinessName(name) {
  if (!name || typeof name !== 'string') return '';

  let cleaned = name.toLowerCase().trim();

  // Normalize ampersand
  cleaned = cleaned.replace(/&/g, ' and ');

  // Remove common punctuation
  cleaned = cleaned.replace(/[^\w\s]/g, ' ');

  // Collapse multiple whitespaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  // Strip legal suffixes from end of string
  for (const suffix of LEGAL_SUFFIXES) {
    const regex = new RegExp(`\\b${suffix.replace('.', '\\.')}$`, 'i');
    if (regex.test(cleaned)) {
      cleaned = cleaned.replace(regex, '').trim();
      break;
    }
  }

  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Normalizes website domain (removes protocol, www, and trailing path)
 * @param {string} urlOrDomain
 * @returns {string|null}
 */
function normalizeDomain(urlOrDomain) {
  if (!urlOrDomain || typeof urlOrDomain !== 'string') return null;

  let cleaned = urlOrDomain.trim().toLowerCase();

  // Add protocol if missing to parse cleanly with URL
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = 'http://' + cleaned;
  }

  try {
    const parsed = new URL(cleaned);
    let host = parsed.hostname;
    if (host.startsWith('www.')) {
      host = host.slice(4);
    }
    return host || null;
  } catch (err) {
    // Fallback regex cleanup if URL constructor fails
    const match = cleaned.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '');
    return match || null;
  }
}

/**
 * Normalizes phone number to clean digit representation with optional leading '+'
 * @param {string} phone
 * @returns {string|null}
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;

  const trimmed = phone.trim();
  const hasPlus = trimmed.startsWith('+');

  // Keep only digits
  const digits = trimmed.replace(/\D/g, '');
  if (!digits || digits.length < 6) return null;

  return hasPlus ? `+${digits}` : digits;
}

/**
 * Generates deterministic dedupe key for lead
 * Hierarchy: domain || normalizedPhone || hash(cleanedName + '_' + cleanCity)
 * @param {object} lead
 * @returns {string}
 */
function generateDedupeKey(lead) {
  const domain = normalizeDomain(lead.website || lead.domain);
  if (domain && domain.includes('.')) {
    return `dom_${domain}`;
  }

  const phone = normalizePhone(lead.phone || lead.whatsapp);
  if (phone && phone.length >= 8) {
    return `ph_${phone}`;
  }

  const cleanName = normalizeBusinessName(lead.businessName);
  const cleanCity = (lead.city || '').toLowerCase().trim().replace(/[^\w]/g, '');

  const composite = `${cleanName}__${cleanCity}`;
  const hash = crypto.createHash('sha256').update(composite).digest('hex').slice(0, 24);
  return `name_${hash}`;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  if (!a) return b ? b.length : 0;
  if (!b) return a.length;

  const matrix = Array.from({ length: a.length + 1 }, () => []);
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}

/**
 * Calculate similarity ratio (0.0 to 1.0)
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function stringSimilarity(a, b) {
  const normA = normalizeBusinessName(a);
  const normB = normalizeBusinessName(b);
  if (!normA || !normB) return 0;
  if (normA === normB) return 1;

  const distance = levenshteinDistance(normA, normB);
  const maxLen = Math.max(normA.length, normB.length);
  return maxLen === 0 ? 1 : 1 - distance / maxLen;
}

/**
 * Merges newly scraped lead data into an existing lead record without overwriting existing rich data
 * @param {object} existingLead
 * @param {object} newLead
 * @returns {object} updated values
 */
function mergeLeadData(existingLead, newLead) {
  const updates = {
    lastSeenAt: new Date()
  };

  const fillableFields = [
    'phone', 'phone2', 'whatsapp', 'email', 'email2', 'website', 'domain',
    'googleMapsUrl', 'address', 'postalCode', 'lat', 'lng', 'rating',
    'reviewCount', 'instagram', 'facebook', 'linkedin', 'pinterest',
    'productNotes', 'sourceUrl'
  ];

  for (const field of fillableFields) {
    if (!existingLead[field] && newLead[field]) {
      updates[field] = newLead[field];
    }
  }

  // Update rating & reviews if newer has higher review count
  if (newLead.reviewCount && newLead.reviewCount > (existingLead.reviewCount || 0)) {
    updates.reviewCount = newLead.reviewCount;
    if (newLead.rating) updates.rating = newLead.rating;
  }

  // If new data signals rugs and existing did not, update signal
  if (newLead.sellsRugsSignal && !existingLead.sellsRugsSignal) {
    updates.sellsRugsSignal = true;
  }

  return updates;
}

module.exports = {
  normalizeBusinessName,
  normalizeDomain,
  normalizePhone,
  generateDedupeKey,
  levenshteinDistance,
  stringSimilarity,
  mergeLeadData
};
