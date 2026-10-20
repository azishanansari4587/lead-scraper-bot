const { calculateLeadScore, DEFAULT_PRIORITY_COUNTRIES } = require('../src/services/scoring');
const aiService = require('../src/services/aiService');

describe('Phase 4 - Lead Scoring & AI Engine', () => {
  describe('Rule-Based Explainable Scoring (0-100)', () => {
    it('awards high score for prime B2B target in priority country with verified rug signal', () => {
      const primeLead = {
        businessName: 'Royal Carpet Gallery LLC',
        leadType: 'rug_retailer',
        country: 'UAE',
        city: 'Dubai',
        website: 'https://royalcarpet.ae',
        email: 'procurement@royalcarpet.ae',
        phone: '+97143398888',
        rating: 4.8,
        reviewCount: 45,
        sellsRugsSignal: true,
        productNotes: 'Importer and distributor of bespoke oriental rugs and bulk hotel flooring'
      };

      const result = calculateLeadScore(primeLead);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.scoreReason).toContain('+20 Exact category match');
      expect(result.scoreReason).toContain('+15 Verified rugs/carpets signal');
      expect(result.scoreReason).toContain('+25 Contact details verified');
      expect(result.scoreReason).toContain('+10 Target export country');
      expect(result.scoreReason).toContain('+10 Established business');
      expect(result.scoreReason).toContain('+10 Mentions trade/bulk keywords');
    });

    it('awards moderate score for interior designer without rug signal', () => {
      const designerLead = {
        businessName: 'Modern Spaces Studio',
        leadType: 'interior_designer',
        country: 'United Kingdom',
        city: 'London',
        website: 'https://modernspaces.co.uk',
        phone: '+442079460123',
        sellsRugsSignal: false
      };

      const result = calculateLeadScore(designerLead);
      // Category: +15, Website+Phone: +20, Priority UK: +10 = ~45
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(75);
      expect(result.scoreReason).toContain('+15 High-fit category');
      expect(result.scoreReason).toContain('+10 Target export country');
    });

    it('penalizes marketplaces and direct manufacturing competitors (-20)', () => {
      const marketplaceLead = {
        businessName: 'Wayfair Rugs Clearance',
        leadType: 'rug_retailer',
        country: 'USA',
        city: 'Boston',
        website: 'https://wayfair.com'
      };

      const result = calculateLeadScore(marketplaceLead);
      expect(result.scoreReason).toContain('-20 Marketplace or direct manufacturer listing');
    });

    it('applies -100 penalty for opted-out leads and clamps score to 0', () => {
      const optOutLead = {
        businessName: 'Spammy Rugs',
        leadType: 'rug_retailer',
        country: 'UAE',
        city: 'Dubai',
        isOptedOut: true
      };

      const result = calculateLeadScore(optOutLead);
      expect(result.score).toBe(0);
      expect(result.scoreReason).toContain('OptOut suppression list');
    });

    it('supports custom priority countries and correctly matches them', () => {
      const lead = {
        businessName: 'Nordic Rugs AS',
        leadType: 'rug_retailer',
        country: 'Norway',
        city: 'Oslo'
      };

      const standardResult = calculateLeadScore(lead);
      expect(standardResult.scoreReason).not.toContain('+10 Target export country');

      const customResult = calculateLeadScore(lead, { priorityCountries: ['Norway', 'Sweden'] });
      expect(customResult.scoreReason).toContain('+10 Target export country (Norway)');
    });
  });

  describe('Gemini Zod Schema Validation', () => {
    it('successfully parses valid Gemini JSON evaluation output', () => {
      const validPayload = {
        sellsRugs: true,
        buyerType: 'retailer',
        priceSegment: 'luxury',
        fitScore: 92,
        oneLineSummary: 'Premier boutique in Dubai Marina carrying hand-knotted silk rugs.',
        personalizedHook: 'Admired your recent luxury penthouse installation featuring neutral tones.'
      };

      const parsed = aiService.geminiEvaluationSchema.parse(validPayload);
      expect(parsed.sellsRugs).toBe(true);
      expect(parsed.buyerType).toBe('retailer');
      expect(parsed.priceSegment).toBe('luxury');
      expect(parsed.fitScore).toBe(92);
      expect(parsed.personalizedHook).toContain('Admired your recent');
    });

    it('rejects invalid payloads with missing required fields or out-of-range fitScore', () => {
      const invalidPayload = {
        sellsRugs: true,
        buyerType: 'non_existent_category',
        fitScore: 150 // out of 0-100 range
      };

      expect(() => aiService.geminiEvaluationSchema.parse(invalidPayload)).toThrow();
    });
  });

  describe('AI Service Quota, Caching & Evaluation Guardrails', () => {
    it('tracks daily quota limits and handles quota check', () => {
      expect(aiService.checkDailyQuota()).toBe(true);
      const usage = aiService.getUsageStats();
      expect(usage.dailyLimit).toBeDefined();
      expect(usage.dailyUsageCount).toBeGreaterThanOrEqual(0);
    });

    it('falls back to rule scoring gracefully when AI client is unconfigured or in test mode', async () => {
      const sampleLead = {
        businessName: 'Al Barsha Carpet House',
        leadType: 'rug_retailer',
        country: 'UAE',
        city: 'Dubai',
        sellsRugsSignal: true,
        website: 'https://albarshacarpets.ae',
        phone: '+97143391111'
      };

      const result = await aiService.evaluateLeadWithAi(sampleLead, 'Luxury Persian and Turkish handmade rugs in Dubai');
      expect(result.score).toBeDefined();
      expect(result.scoreReason).toBeDefined();
      expect(result.score).toBeGreaterThan(0);
    });

    it('computes 50/50 hybrid score and caches domain when AI client returns valid response', async () => {
      const mockLead = {
        businessName: 'Grand Design Interiors',
        leadType: 'interior_designer',
        country: 'UAE',
        city: 'Dubai',
        domain: 'granddesign.ae',
        website: 'https://granddesign.ae',
        phone: '+97145551234'
      };

      // Mock client
      const originalClient = aiService.client;
      let generateCallCount = 0;

      aiService.client = {
        generateContent: async () => {
          generateCallCount++;
          return {
            response: {
              text: () => JSON.stringify({
                sellsRugs: true,
                buyerType: 'interior_designer',
                priceSegment: 'luxury',
                fitScore: 80,
                oneLineSummary: 'Luxury residential fit-out firm in Downtown Dubai.',
                personalizedHook: 'Loved your Palm Jumeirah villa showcase.'
              })
            }
          };
        }
      };

      try {
        // Clear domain cache for test
        aiService.domainCache.delete('granddesign.ae');

        // First call - triggers generateContent
        const result1 = await aiService.evaluateLeadWithAi(mockLead, 'High-end interior design studio');
        expect(generateCallCount).toBe(1);
        expect(result1.score).toBeDefined();
        // Rule score is ~45 (category 15 + contact 20 + target UAE 10 = 45). AI is 80.
        // Hybrid: round(45*0.5 + 80*0.5) = round(22.5 + 40) = 63.
        expect(result1.score).toBeGreaterThanOrEqual(60);
        expect(result1.scoreReason).toContain('Rule');
        expect(result1.scoreReason).toContain('AI (80');
        expect(result1.aiAnalysis.buyerType).toBe('interior_designer');

        // Second call for the same domain - must use cache without re-invoking generateContent
        const result2 = await aiService.evaluateLeadWithAi(mockLead, 'High-end interior design studio');
        expect(generateCallCount).toBe(1); // Call count unchanged!
        expect(result2.score).toBe(result1.score);
        expect(result2.scoreReason).toContain('Cached AI');
      } finally {
        aiService.client = originalClient;
      }
    });

    it('falls back safely to rule scoring if Gemini throws an error or returns malformed JSON', async () => {
      const mockLead = {
        businessName: 'Faulty Data Studio',
        leadType: 'rug_retailer',
        country: 'UAE',
        city: 'Dubai',
        domain: 'faultydata.ae'
      };

      const originalClient = aiService.client;
      aiService.client = {
        generateContent: async () => {
          return {
            response: {
              text: () => 'Sorry, I am unable to analyze this input.' // Invalid JSON
            }
          };
        }
      };

      try {
        const result = await aiService.evaluateLeadWithAi(mockLead, 'Some untrusted text');
        expect(result.score).toBeDefined();
        // Did not throw, returned rule score
        expect(result.scoreReason).toContain('+20 Exact category match');
      } finally {
        aiService.client = originalClient;
      }
    });
  });
});
