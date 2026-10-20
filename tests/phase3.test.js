const { validateUrlForSsrf, isPrivateIPv4 } = require('../src/services/ssrfGuard');
const WebsiteEnricher = require('../src/scrapers/WebsiteEnricher');
const scraperManager = require('../src/scrapers/ScraperManager');
const BaseScraper = require('../src/scrapers/BaseScraper');

describe('Phase 3 - Directory Scrapers & Website Enrichment', () => {
  describe('SSRF Protection Guard', () => {
    it('detects private IPv4 addresses correctly', () => {
      expect(isPrivateIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateIPv4('10.0.1.25')).toBe(true);
      expect(isPrivateIPv4('172.16.5.10')).toBe(true);
      expect(isPrivateIPv4('192.168.1.1')).toBe(true);
      expect(isPrivateIPv4('169.254.169.254')).toBe(true); // Cloud metadata
      expect(isPrivateIPv4('8.8.8.8')).toBe(false);        // Public DNS
      expect(isPrivateIPv4('93.184.216.34')).toBe(false);  // Example.com
    });

    it('blocks loopback and localhost URLs', async () => {
      const res1 = await validateUrlForSsrf('http://localhost:5000/admin');
      expect(res1.isSafe).toBe(false);

      const res2 = await validateUrlForSsrf('http://127.0.0.1:3306');
      expect(res2.isSafe).toBe(false);

      const res3 = await validateUrlForSsrf('http://127.0.0.5:8080');
      expect(res3.isSafe).toBe(false);
    });

    it('blocks cloud metadata endpoint (169.254.169.254)', async () => {
      const res = await validateUrlForSsrf('http://169.254.169.254/latest/meta-data/');
      expect(res.isSafe).toBe(false);
      expect(res.reason).toContain('Blocked private IPv4 destination');
    });

    it('blocks private LAN subnets (192.168.x.x, 10.x.x.x)', async () => {
      const res1 = await validateUrlForSsrf('http://192.168.1.1/router');
      expect(res1.isSafe).toBe(false);

      const res2 = await validateUrlForSsrf('http://10.20.30.40/secret');
      expect(res2.isSafe).toBe(false);
    });

    it('blocks forbidden protocols like file://, gopher://, ftp://', async () => {
      const res1 = await validateUrlForSsrf('file:///etc/passwd');
      expect(res1.isSafe).toBe(false);

      const res2 = await validateUrlForSsrf('gopher://127.0.0.1');
      expect(res2.isSafe).toBe(false);

      const res3 = await validateUrlForSsrf('ftp://public.ftp.com');
      expect(res3.isSafe).toBe(false);
    });

    it('allows safe public websites', async () => {
      const res = await validateUrlForSsrf('https://example.com');
      expect(res.isSafe).toBe(true);
      expect(res.resolvedIps.length).toBeGreaterThan(0);
    });
  });

  describe('WebsiteEnricher Contact & Signal Extraction', () => {
    const enricher = new WebsiteEnricher();

    it('extracts emails, phone, whatsapp, socials, and rug signal from sample HTML', () => {
      const sampleHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head><title>Artisan Rugs & Luxury Interiors</title></head>
        <body>
          <h1>Welcome to Artisan Rugs Studio</h1>
          <p>We are premier designers of bespoke hand-tufted wool rugs and oriental carpets in Dubai.</p>
          <div class="contact">
            <p>Email us at: info@artisanrugs.com or sales@artisanrugs.com</p>
            <p>Do not contact: logo.png or support@sentry.io</p>
            <p>Call us: +971 4 338 9900</p>
            <a href="https://wa.me/971501234567">Chat on WhatsApp</a>
            <a href="https://instagram.com/artisanrugsdubai">Instagram</a>
            <a href="https://facebook.com/artisanrugs">Facebook</a>
            <a href="https://linkedin.com/company/artisan-rugs">LinkedIn</a>
            <a href="https://pinterest.com/artisanrugs">Pinterest</a>
          </div>
        </body>
        </html>
      `;

      const data = enricher.extractDataFromHtml(sampleHtml, 'https://artisanrugs.com');

      // Emails
      expect(data.emails.has('info@artisanrugs.com')).toBe(true);
      expect(data.emails.has('sales@artisanrugs.com')).toBe(true);
      expect(data.emails.has('logo.png')).toBe(false);
      expect(data.emails.has('support@sentry.io')).toBe(false);

      // WhatsApp & Phone
      expect(data.whatsapp).toBe('+971501234567');
      expect(data.phones.size).toBeGreaterThan(0);

      // Socials
      expect(data.instagram).toBe('https://instagram.com/artisanrugsdubai');
      expect(data.facebook).toBe('https://facebook.com/artisanrugs');
      expect(data.linkedin).toBe('https://linkedin.com/company/artisan-rugs');
      expect(data.pinterest).toBe('https://pinterest.com/artisanrugs');

      // Sells Rugs Signal
      expect(data.sellsRugsSignal).toBe(true);
      expect(data.productNotes.length).toBeGreaterThan(0);
      expect(data.language).toBe('en');
    });

    it('returns false sellsRugsSignal for generic software agency HTML', () => {
      const agencyHtml = `
        <html>
        <body>
          <h1>Cloud Software Agency</h1>
          <p>We build web and mobile applications using Python and React.</p>
          <a href="mailto:contact@techagency.io">contact@techagency.io</a>
        </body>
        </html>
      `;

      const data = enricher.extractDataFromHtml(agencyHtml, 'https://techagency.io');
      expect(data.sellsRugsSignal).toBe(false);
      expect(data.emails.has('contact@techagency.io')).toBe(true);
    });
  });

  describe('Directory Scrapers Registry & Health', () => {
    it('registers all Tier 1 and Tier 2 directory scrapers in ScraperManager', () => {
      const registered = scraperManager.listScrapers().map((s) => s.name);
      expect(registered).toContain('google_places');
      expect(registered).toContain('overpass');
      expect(registered).toContain('indiamart');
      expect(registered).toContain('tradeindia');
      expect(registered).toContain('justdial');
      expect(registered).toContain('yellowpages_uae');
      expect(registered).toContain('yelp');
      expect(registered).toContain('yellowpages');
      expect(registered).toContain('houzz');
      expect(registered).toContain('europages');
      expect(registered).toContain('alibaba');
    });

    it('allows enabling and disabling individual scrapers dynamically', () => {
      expect(scraperManager.getScraper('houzz').enabled).toBe(true);
      scraperManager.toggleScraper('houzz', false);
      expect(scraperManager.getScraper('houzz').enabled).toBe(false);
      scraperManager.toggleScraper('houzz', true);
      expect(scraperManager.getScraper('houzz').enabled).toBe(true);
    });

    it('every scraper subclasses BaseScraper and provides buildUrl()', () => {
      const scrapers = scraperManager.listScrapers();
      for (const { name } of scrapers) {
        const scraper = scraperManager.getScraper(name);
        expect(scraper instanceof BaseScraper).toBe(true);
        expect(typeof scraper.buildUrl).toBe('function');
        const url = scraper.buildUrl('rugs', 'Dubai');
        expect(typeof url).toBe('string');
        expect(url.length).toBeGreaterThan(10);
      }
    });
  });
});
