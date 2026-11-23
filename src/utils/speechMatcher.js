/**
 * Pure Speech & Text Matcher Utility for Knotiq Mindset Gate
 *
 * Implements:
 * 1. NFKC unicode normalization, lowercase, punctuation & Devanagari danda removal.
 * 2. Word-by-word in-order fuzzy alignment (Levenshtein distance tolerance).
 * 3. Token length guard: rejects transcripts longer than 3x target token count.
 * 4. Final word requirement: the final target word must be matched in order.
 * 5. Matched word highlight tracking.
 */

/**
 * Computes Levenshtein distance between two strings
 */
function levenshteinDistance(s1, s2) {
  if (s1 === s2) return 0;
  if (!s1.length) return s2.length;
  if (!s2.length) return s1.length;

  const d = [];
  for (let i = 0; i <= s1.length; i++) {
    d[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    d[0][j] = j;
  }

  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      d[i][j] = Math.min(
        d[i - 1][j] + 1,       // deletion
        d[i][j - 1] + 1,       // insertion
        d[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return d[s1.length][s2.length];
}

/**
 * Normalizes text:
 * - Lowercases and normalizes NFKC
 * - Strips punctuation, quotes, ellipses, hyphens, and Devanagari dandas (। ॥)
 * - Collapses spaces
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';

  return text
    .normalize('NFKC')
    .toLowerCase()
    // Remove all standard punctuation, quotes, brackets, and Devanagari dandas
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'’“”«»…।॥]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Splits text into normalized token array
 */
function tokenize(text) {
  const norm = normalizeText(text);
  return norm ? norm.split(' ').filter(Boolean) : [];
}

/**
 * Determines if two individual tokens match with small recognition tolerance
 */
function isTokenMatch(t1, t2) {
  if (t1 === t2) return true;
  const len = Math.max(t1.length, t2.length);

  // Very short words (<=3 chars) must match exactly
  if (len <= 3) return false;

  // Medium words (4-6 chars): 1 typo allowed
  if (len <= 6) {
    return levenshteinDistance(t1, t2) <= 1;
  }

  // Long words (>=7 chars): up to 2 typos allowed
  return levenshteinDistance(t1, t2) <= 2;
}

/**
 * Matches spoken transcript against target quote.
 *
 * @param {string} targetQuote - The expected quote text
 * @param {string} spokenTranscript - What the user said or typed
 * @param {number} [threshold=0.8] - Required match coverage (default 0.8)
 * @returns {object} {
 *   isMatch: boolean,
 *   coverage: number,
 *   matchedIndices: number[], // Target word indices that matched
 *   targetWordCount: number,
 *   spokenWordCount: number,
 *   reason?: string
 * }
 */
function matchQuoteText(targetQuote, spokenTranscript, threshold = 0.8) {
  const targetTokens = tokenize(targetQuote);
  const spokenTokens = tokenize(spokenTranscript);

  const N = targetTokens.length;
  const M = spokenTokens.length;

  if (N === 0) {
    return {
      isMatch: M === 0,
      coverage: M === 0 ? 1 : 0,
      matchedIndices: [],
      targetWordCount: 0,
      spokenWordCount: M
    };
  }

  if (M === 0) {
    return {
      isMatch: false,
      coverage: 0,
      matchedIndices: [],
      targetWordCount: N,
      spokenWordCount: 0,
      reason: 'empty_transcript'
    };
  }

  // Guard: Reject transcripts longer than 3x target token count (Amendment 2: long rambling)
  if (M > 3 * N) {
    return {
      isMatch: false,
      coverage: 0,
      matchedIndices: [],
      targetWordCount: N,
      spokenWordCount: M,
      reason: 'transcript_too_long'
    };
  }

  // In-Order Greedy Alignment with Lookahead
  // Matches target words in order within the spoken tokens, allowing fillers
  const matchedIndices = [];
  let sIndex = 0;

  for (let tIndex = 0; tIndex < N; tIndex++) {
    const tWord = targetTokens[tIndex];

    // Look for tWord in spokenTokens starting from sIndex up to a reasonable forward window
    // (allows filler words or slight stumbles in spokenTokens)
    let foundAt = -1;
    const maxLookahead = Math.min(spokenTokens.length, sIndex + 5);

    for (let k = sIndex; k < maxLookahead; k++) {
      if (isTokenMatch(tWord, spokenTokens[k])) {
        foundAt = k;
        break;
      }
    }

    if (foundAt !== -1) {
      matchedIndices.push(tIndex);
      sIndex = foundAt + 1; // Advance spoken cursor past matched word
    }
  }

  const coverage = +(matchedIndices.length / N).toFixed(3);

  // Final Word Requirement (Amendment 2):
  // The final target token (N - 1) MUST be included in the matched sequence.
  const isLastWordMatched = matchedIndices.includes(N - 1);

  const isMatch = coverage >= threshold && isLastWordMatched;

  let reason;
  if (!isMatch) {
    if (coverage < threshold) {
      reason = 'coverage_too_low';
    } else if (!isLastWordMatched) {
      reason = 'missing_final_word';
    }
  }

  return {
    isMatch,
    coverage,
    matchedIndices,
    targetWordCount: N,
    spokenWordCount: M,
    reason
  };
}

const matcherExports = {
  normalizeText,
  tokenize,
  levenshteinDistance,
  isTokenMatch,
  matchQuoteText
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = matcherExports;
  module.exports.default = matcherExports;
}
