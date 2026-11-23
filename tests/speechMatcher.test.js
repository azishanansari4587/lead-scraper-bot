import { describe, it, expect } from 'vitest';
import {
  normalizeText,
  matchQuoteText,
  levenshteinDistance
} from '../src/utils/speechMatcher.js';

describe('Speech & Text Matcher Engine (Mindset Gate - Amendment 2 & 9)', () => {
  const quote10Words = 'Every luxury interior starts with an artisan loom foundation today';

  it('1. rejects when 8 of 10 words are spoken but the final word is omitted', () => {
    // 8 of 10 words spoken in order, but "foundation" and "today" are missing
    const spoken8Words = 'Every luxury interior starts with an artisan loom';
    const result = matchQuoteText(quote10Words, spoken8Words, 0.8);

    expect(result.coverage).toBe(0.8); // 8/10 = 0.8
    expect(result.isMatch).toBe(false); // Rejected because last word 'today' is missing!
    expect(result.reason).toBe('missing_final_word');
  });

  it('2. accepts full quote with filler words and hesitation in between', () => {
    const spokenWithFillers =
      'umm every luxury interior like starts with an you know artisan loom foundation yeah today';
    const result = matchQuoteText(quote10Words, spokenWithFillers, 0.8);

    expect(result.coverage).toBe(1.0); // all 10 target words matched in order
    expect(result.isMatch).toBe(true);
    expect(result.matchedIndices).toHaveLength(10);
  });

  it('3. rejects long rambling transcripts exceeding 3x the target token count', () => {
    const target = 'Bespoke rugs require patience and dedication'; // 6 tokens
    // 6 * 3 = 18 max allowed tokens. Let's provide 22 tokens of rambling:
    const ramblingTranscript =
      'Bespoke rugs require patience and dedication and we also need to check the inventory and then call the supplier in Bhadohi and verify the yarn specifications for tomorrow morning';
    const result = matchQuoteText(target, ramblingTranscript, 0.8);

    expect(result.isMatch).toBe(false);
    expect(result.reason).toBe('transcript_too_long');
  });

  it('4. accepts Devanagari / Hindi quotes with danda punctuation', () => {
    const hindiTarget = 'हस्तनिर्मित कालीनों में गुणवत्ता ही हमारी असली पहचान है।';
    // User speaks the quote without punctuation (speech recognition output)
    const spokenHindi = 'हस्तनिर्मित कालीनों में गुणवत्ता ही हमारी असली पहचान है';
    const result = matchQuoteText(hindiTarget, spokenHindi, 0.8);

    expect(result.isMatch).toBe(true);
    expect(result.coverage).toBe(1.0);
  });

  it('5. rejects empty transcript or whitespace-only speech', () => {
    const result1 = matchQuoteText(quote10Words, '', 0.8);
    expect(result1.isMatch).toBe(false);
    expect(result1.reason).toBe('empty_transcript');

    const result2 = matchQuoteText(quote10Words, '    ', 0.8);
    expect(result2.isMatch).toBe(false);
    expect(result2.reason).toBe('empty_transcript');
  });

  it('6. tolerates minor singular/plural and recognition slips (edit distance <= 1 or 2)', () => {
    const target = 'Handcrafted wool rugs create timeless elegance';
    // "rug" instead of "rugs", "handcraft" instead of "handcrafted"
    const spoken = 'Handcrafted wool rug create timeless elegance';
    const result = matchQuoteText(target, spoken, 0.8);

    expect(result.isMatch).toBe(true);
    expect(result.coverage).toBeGreaterThanOrEqual(0.8);
  });

  it('7. correctly tracks matched word indices for real-time word highlighting', () => {
    const target = 'Craftsmanship over speed every time';
    const spokenPartial = 'Craftsmanship over';
    const result = matchQuoteText(target, spokenPartial, 0.8);

    expect(result.matchedIndices).toEqual([0, 1]);
    expect(result.isMatch).toBe(false); // Incomplete
  });
});
