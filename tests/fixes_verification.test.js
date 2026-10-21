import { describe, it, expect, vi, beforeEach } from 'vitest';
import GooglePlacesSource from '../src/scrapers/GooglePlacesSource';
import OverpassSource from '../src/scrapers/OverpassSource';
import { validateProductionSecrets } from '../src/api/middleware/auth';

describe('Fixes & Hardening Verification Suite', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Places API (New) Request Shape & Headers', () => {
    it('sends correct POST URL, headers, and body according to Places API (New) spec', async () => {
      const places = new GooglePlacesSource();
      process.env.GOOGLE_PLACES_API_KEY = 'test_gplaces_key_12345';

      let capturedUrl = '';
      let capturedBody = null;
      let capturedHeaders = null;

      places.client = {
        post: vi.fn().mockImplementation(async (url, body, config) => {
          capturedUrl = url;
          capturedBody = body;
          capturedHeaders = config?.headers;
          return {
            status: 200,
            data: {
              places: [
                {
                  id: 'place_999',
                  displayName: { text: 'Dubai Rugs Emporium' },
                  formattedAddress: 'Sheikh Zayed Rd, Dubai',
                  nationalPhoneNumber: '04 123 4567',
                  internationalPhoneNumber: '+971 4 123 4567',
                  websiteUri: 'https://dubairugs.ae',
                  googleMapsUri: 'https://maps.google.com/?cid=123',
                  rating: 4.8,
                  userRatingCount: 85,
                  types: ['carpet_store', 'store']
                }
              ]
            }
          };
        })
      };

      const leads = await places.scrape({
        keyword: 'persian carpets',
        city: 'Dubai',
        country: 'UAE',
        leadType: 'rug_retailer'
      });

      // Assert API endpoint URL
      expect(capturedUrl).toBe('https://places.googleapis.com/v1/places:searchText');

      // Assert Headers
      expect(capturedHeaders['X-Goog-Api-Key']).toBe('test_gplaces_key_12345');
      expect(capturedHeaders['X-Goog-FieldMask']).toBe(
        'places.id,places.displayName,places.formattedAddress,places.location,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.googleMapsUri,places.rating,places.userRatingCount,places.types'
      );
      expect(capturedHeaders['Content-Type']).toBe('application/json');

      // Assert Body
      expect(capturedBody).toMatchObject({
        textQuery: 'persian carpets in Dubai, UAE',
        maxResultCount: 20
      });

      // Assert Lead mapping without Details loop
      expect(leads.length).toBe(1);
      expect(leads[0].businessName).toBe('Dubai Rugs Emporium');
      expect(leads[0].website).toBe('https://dubairugs.ae');
      expect(leads[0].rating).toBe(4.8);
      expect(leads[0].reviewCount).toBe(85);
      expect(leads[0].sellsRugsSignal).toBe(true);
    });

    it('surfaces Google Places exact HTTP status and error message to this.lastError', async () => {
      const places = new GooglePlacesSource();
      process.env.GOOGLE_PLACES_API_KEY = 'invalid_key';

      const axiosError = new Error('Request failed with status code 403');
      axiosError.response = {
        status: 403,
        data: {
          error: {
            code: 403,
            message: 'The provided API key is invalid or lacks Places API (New) permissions.'
          }
        }
      };

      places.client = {
        post: vi.fn().mockRejectedValue(axiosError)
      };

      const leads = await places.scrape({
        keyword: 'carpets',
        city: 'Dubai',
        country: 'UAE'
      });

      expect(leads).toEqual([]);
      expect(places.lastError).toContain('HTTP 403');
      expect(places.lastError).toContain('The provided API key is invalid');
    });

    it('respects GOOGLE_PLACES_DAILY_REQUEST_CAP', async () => {
      const places = new GooglePlacesSource();
      process.env.GOOGLE_PLACES_API_KEY = 'test_key';
      process.env.GOOGLE_PLACES_DAILY_REQUEST_CAP = '2';

      places.client = {
        post: vi.fn().mockResolvedValue({
          status: 200,
          data: { places: [] }
        })
      };

      // Reset internal counter for clean test run
      places.dailyRequestTracker.date = new Date().toISOString().slice(0, 10);
      places.dailyRequestTracker.count = 0;

      await places.scrape({ keyword: 'test 1', city: 'Dubai', country: 'UAE' });
      await places.scrape({ keyword: 'test 2', city: 'Dubai', country: 'UAE' });
      const cappedRun = await places.scrape({ keyword: 'test 3', city: 'Dubai', country: 'UAE' });

      expect(cappedRun).toEqual([]);
      expect(places.lastError).toContain('daily request cap');
    });
  });

  describe('2. SearchScrape Banner Status Logic', () => {
    // Pure function representing the banner logic in SearchScrape.jsx
    function getBannerState(result) {
      if (!result) return null;
      if (result.status === 'ok') {
        return {
          type: 'success',
          color: 'green',
          message: `Scrape completed successfully! Found ${result.foundCount ?? result.count ?? 0} leads.`
        };
      }
      if (result.status === 'empty') {
        return {
          type: 'warning',
          color: 'amber',
          message: result.errorMessage || 'No leads found matching query.'
        };
      }
      if (result.status === 'error' || result.status === 'blocked') {
        return {
          type: 'error',
          color: 'red',
          message: result.errorMessage || (result.status === 'blocked' ? 'Scraper was blocked by anti-bot challenge.' : 'Scraper engine encountered an error.')
        };
      }
      return null;
    }

    it('shows green success banner ONLY when result.status === "ok"', () => {
      const banner = getBannerState({ status: 'ok', foundCount: 15 });
      expect(banner.type).toBe('success');
      expect(banner.color).toBe('green');
      expect(banner.message).toContain('15 leads');
    });

    it('shows amber warning notice when result.status === "empty"', () => {
      const banner = getBannerState({ status: 'empty', foundCount: 0, errorMessage: 'Zero leads matched criteria' });
      expect(banner.type).toBe('warning');
      expect(banner.color).toBe('amber');
      expect(banner.message).toBe('Zero leads matched criteria');
    });

    it('shows red error notice when result.status === "error" or "blocked"', () => {
      const errBanner = getBannerState({ status: 'error', errorMessage: 'HTTP 403 Forbidden' });
      expect(errBanner.type).toBe('error');
      expect(errBanner.color).toBe('red');
      expect(errBanner.message).toBe('HTTP 403 Forbidden');

      const blockedBanner = getBannerState({ status: 'blocked', errorMessage: 'Cloudflare captcha encountered' });
      expect(blockedBanner.type).toBe('error');
      expect(blockedBanner.color).toBe('red');
      expect(blockedBanner.message).toBe('Cloudflare captcha encountered');
    });
  });

  describe('3. OverpassSource: No Fixture Fallback Behavior', () => {
    it('never inserts sample fixture data; returns empty array and sets lastError on failure', async () => {
      const overpass = new OverpassSource();

      // Mock client network requests to fail
      overpass.client = {
        post: vi.fn().mockRejectedValue(new Error('Overpass server 504 Gateway Timeout'))
      };

      const leads = await overpass.scrape({
        city: 'Dubai',
        country: 'UAE',
        leadType: 'rug_retailer'
      });

      // Crucial requirement: Must never return fixture sample leads
      expect(leads).toEqual([]);
      expect(leads.length).toBe(0);
      expect(overpass.lastError).toBeDefined();
      expect(overpass.lastError).toContain('All Overpass mirrors failed or timed out');
    });

    it('returns empty array and sets informative lastError when zero elements found', async () => {
      const overpass = new OverpassSource();

      overpass.client = {
        post: vi.fn().mockResolvedValue({
          status: 200,
          data: { elements: [] }
        })
      };

      const leads = await overpass.scrape({
        city: 'RemoteTown',
        country: 'UAE',
        leadType: 'rug_retailer'
      });

      expect(leads).toEqual([]);
      expect(overpass.lastError).toContain('Overpass returned 0 elements');
    });
  });

  describe('4. Auth & Production Defaults Refusal', () => {
    it('throws when CLERK_SECRET_KEY is a placeholder in production', () => {
      expect(() => {
        validateProductionSecrets({
          NODE_ENV: 'production',
          CLERK_SECRET_KEY: 'sk_test_placeholder',
          APP_SECRET: 'production-secret-strong-at-least-32-chars-long-12345678',
          BULK_PASSWORD: 'custom_strong_bulk_pass_2026',
          DOWNLOAD_SIGNING_SECRET: 'custom-download-signing-secret-random-32'
        });
      }).toThrow(/CLERK_SECRET_KEY is set to a known default/);
    });

    it('throws when APP_SECRET uses default dev secret in production', () => {
      expect(() => {
        validateProductionSecrets({
          NODE_ENV: 'production',
          CLERK_SECRET_KEY: 'live_clerk_secret_key_1234567890',
          APP_SECRET: 'dev-secret-string-at-least-32-chars-long-security',
          BULK_PASSWORD: 'custom_strong_bulk_pass_2026',
          DOWNLOAD_SIGNING_SECRET: 'custom-download-signing-secret-random-32'
        });
      }).toThrow(/APP_SECRET is set to a known default/);
    });

    it('throws when BULK_PASSWORD uses default knotiq2026 in production', () => {
      expect(() => {
        validateProductionSecrets({
          NODE_ENV: 'production',
          CLERK_SECRET_KEY: 'live_clerk_secret_key_1234567890',
          APP_SECRET: 'production-secret-strong-at-least-32-chars-long-12345678',
          BULK_PASSWORD: 'knotiq2026',
          DOWNLOAD_SIGNING_SECRET: 'custom-download-signing-secret-random-32'
        });
      }).toThrow(/BULK_PASSWORD is set to a known default/);
    });

    it('throws when DOWNLOAD_SIGNING_SECRET uses known dev secret in production', () => {
      expect(() => {
        validateProductionSecrets({
          NODE_ENV: 'production',
          CLERK_SECRET_KEY: 'live_clerk_secret_key_1234567890',
          APP_SECRET: 'production-secret-strong-at-least-32-chars-long-12345678',
          BULK_PASSWORD: 'custom_strong_bulk_pass_2026',
          DOWNLOAD_SIGNING_SECRET: 'dev-signing-secret-random-32chars'
        });
      }).toThrow(/DOWNLOAD_SIGNING_SECRET is set to a known default/);
    });

    it('succeeds when all production secrets are valid and secure', () => {
      expect(() => {
        validateProductionSecrets({
          NODE_ENV: 'production',
          CLERK_SECRET_KEY: 'sk_live_genuine_production_key_for_clerk_auth',
          APP_SECRET: 'production-secret-strong-at-least-32-chars-long-12345678',
          BULK_PASSWORD: 'custom_strong_bulk_pass_2026_xyz',
          DOWNLOAD_SIGNING_SECRET: 'custom-download-signing-secret-random-32'
        });
      }).not.toThrow();
    });
  });
});
