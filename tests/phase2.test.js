const {
  normalizeBusinessName,
  normalizeDomain,
  normalizePhone,
  generateDedupeKey,
  stringSimilarity,
  mergeLeadData
} = require('../src/services/dedupe');
const { parseRobotsTxt } = require('../src/services/robots');
const scraperManager = require('../src/scrapers/ScraperManager');
const OverpassSource = require('../src/scrapers/OverpassSource');
const GooglePlacesSource = require('../src/scrapers/GooglePlacesSource');
const { Lead, ScraperRun, OptOut } = require('../src/models');

describe('Phase 2 - Core Scraping & Deduplication Engine', () => {
  describe('Deduplication & Normalization Service', () => {
    it('normalizes business names by removing punctuation and legal suffixes', () => {
      expect(normalizeBusinessName('Knotiq Rugs LLC')).toBe('knotiq rugs');
      expect(normalizeBusinessName('Persian Carpet Gallery Pvt. Ltd.')).toBe('persian carpet gallery');
      expect(normalizeBusinessName('Al-Futtaim Interiors & Design Co.')).toBe('al futtaim interiors and design');
      expect(normalizeBusinessName('Dubai Luxury Furnishings FZE')).toBe('dubai luxury furnishings');
      expect(normalizeBusinessName('Modern Deco GmbH')).toBe('modern deco');
    });

    it('normalizes website domains to clean hostnames without www', () => {
      expect(normalizeDomain('https://www.knotiqrugs.com/about-us')).toBe('knotiqrugs.com');
      expect(normalizeDomain('http://dubairugs.ae/contact')).toBe('dubairugs.ae');
      expect(normalizeDomain('www.carpetstore.co.uk/')).toBe('carpetstore.co.uk');
      expect(normalizeDomain('https://sub.domain.com:8080/path')).toBe('sub.domain.com');
      expect(normalizeDomain('')).toBeNull();
    });

    it('normalizes phone numbers to clean digits with optional leading +', () => {
      expect(normalizePhone('+971 4 123 4567')).toBe('+97141234567');
      expect(normalizePhone('(04) 555-1234')).toBe('045551234');
      expect(normalizePhone('+91-98765-43210')).toBe('+919876543210');
      expect(normalizePhone('123')).toBeNull(); // Too short
    });

    it('generates deterministic dedupeKey with domain > phone > name+city priority', () => {
      // 1. With domain
      const key1 = generateDedupeKey({
        website: 'https://www.knotiqrugs.com',
        phone: '+971501234567',
        businessName: 'Knotiq Rugs',
        city: 'Dubai'
      });
      expect(key1).toBe('dom_knotiqrugs.com');

      // 2. Without domain, with phone
      const key2 = generateDedupeKey({
        phone: '+971501234567',
        businessName: 'Knotiq Rugs',
        city: 'Dubai'
      });
      expect(key2).toBe('ph_+971501234567');

      // 3. Without domain or phone, uses cleanName + cleanCity hash
      const key3 = generateDedupeKey({
        businessName: 'Knotiq Rugs LLC',
        city: 'Dubai'
      });
      const key4 = generateDedupeKey({
        businessName: 'Knotiq Rugs',
        city: 'Dubai'
      });
      expect(key3.startsWith('name_')).toBe(true);
      expect(key3).toBe(key4); // Normalized name matches
    });

    it('computes string similarity correctly', () => {
      expect(stringSimilarity('Knotiq Rugs LLC', 'Knotiq Rugs')).toBe(1); // Exact after normalization
      expect(stringSimilarity('Luxury Carpet Gallery', 'Luxury Carpets Gallery')).toBeGreaterThan(0.85);
      expect(stringSimilarity('Knotiq Rugs', 'Completely Unrelated Shop')).toBeLessThan(0.4);
    });

    it('merges new fields into existing lead without overwriting existing data', () => {
      const existing = {
        businessName: 'Dubai Carpets',
        phone: '+97141234567',
        website: null,
        reviewCount: 5,
        rating: 4.0,
        sellsRugsSignal: false
      };

      const newer = {
        businessName: 'Dubai Carpets LLC',
        phone: '+97141234567',
        website: 'https://dubaicarpets.com',
        reviewCount: 25,
        rating: 4.8,
        sellsRugsSignal: true
      };

      const merged = mergeLeadData(existing, newer);
      expect(merged.website).toBe('https://dubaicarpets.com');
      expect(merged.reviewCount).toBe(25);
      expect(merged.rating).toBe(4.8);
      expect(merged.sellsRugsSignal).toBe(true);
      expect(merged.lastSeenAt).toBeInstanceOf(Date);
    });
  });

  describe('Robots.txt Parser', () => {
    it('parses robots.txt disallow rules accurately', () => {
      const robotsContent = `
        User-agent: *
        Disallow: /admin/
        Disallow: /private/
        Allow: /admin/public
      `;
      const rules = parseRobotsTxt(robotsContent);
      expect(rules.length).toBe(1);
      expect(rules[0].disallowed).toContain('/admin/');
      expect(rules[0].disallowed).toContain('/private/');
      expect(rules[0].allowed).toContain('/admin/public');
    });
  });

  describe('Scraper Sources', () => {
    it('OverpassSource constructs valid OSM queries for different lead types', () => {
      const overpass = new OverpassSource();
      const rugQuery = overpass.buildQuery('Dubai', 'UAE', 'rug_retailer');
      expect(rugQuery).toContain('shop"="carpet');
      expect(rugQuery).toContain('Dubai');

      const designerQuery = overpass.buildQuery('Dubai', 'UAE', 'interior_designer');
      expect(designerQuery).toContain('office"="interior_design');
    });

    it('GooglePlacesSource handles missing API key gracefully', async () => {
      const google = new GooglePlacesSource();
      google.apiKey = null; // simulate unconfigured key
      const results = await google.scrape({
        keyword: 'rugs',
        country: 'UAE',
        city: 'Dubai',
        leadType: 'rug_retailer'
      });
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });
  });

  describe('ScraperManager Integration & Persistence', () => {
    it('suppresses leads that match the OptOut suppression list', async () => {
      // Add an opt-out entry
      await OptOut.findOrCreate({
        where: { type: 'email', value: 'optout@spammydomain.com' },
        defaults: { reason: 'GDPR opt-out request' }
      });

      const optOutLead = {
        businessName: 'Unsolicited Interiors',
        email: 'optout@spammydomain.com',
        city: 'Dubai',
        country: 'UAE',
        leadType: 'interior_designer'
      };

      const result = await scraperManager.saveOrMergeLead('user_p2', optOutLead);
      expect(result.status).toBe('opted_out');
    });

    it('persists a new lead and updates duplicate on re-scrape', async () => {
      const rawLead = {
        businessName: 'Knotiq Studio Dubai',
        website: 'https://knotiqdubai.com',
        phone: '+97148889999',
        city: 'Dubai',
        country: 'UAE',
        leadType: 'rug_retailer',
        sellsRugsSignal: true
      };

      await Lead.destroy({ where: { userId: 'user_p2' } });

      // 1. Initial insert
      const res1 = await scraperManager.saveOrMergeLead('user_p2', rawLead);
      expect(res1.status).toBe('new');
      expect(res1.lead.id).toBeDefined();

      // 2. Re-scrape same lead with extra details
      const updatedRaw = {
        ...rawLead,
        address: 'Al Quoz Industrial Area 3, Dubai',
        rating: 4.9
      };
      const res2 = await scraperManager.saveOrMergeLead('user_p2', updatedRaw);
      expect(res2.status).toBe('duplicate');
      expect(res2.lead.id).toBe(res1.lead.id);
      expect(res2.lead.address).toBe('Al Quoz Industrial Area 3, Dubai');
      expect(res2.lead.rating).toBe(4.9);
    });

    it('logs execution metrics in ScraperRun table', async () => {
      const summary = await scraperManager.runScraper({
        userId: 'user_p2',
        platform: 'google_places', // will exit quickly with 0 leads since no live key
        leadType: 'rug_retailer',
        country: 'UAE',
        city: 'Dubai'
      });

      expect(summary.runId).toBeDefined();
      expect(summary.status).toBe('completed');

      const log = await ScraperRun.findByPk(summary.runId);
      expect(log).not.toBeNull();
      expect(log.platform).toBe('google_places');
      expect(log.status).toBe('completed');
    });
  });
});
