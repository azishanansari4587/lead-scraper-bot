/**
 * Sources / Platforms Router
 */

const express = require('express');
const scraperManager = require('../../scrapers/ScraperManager');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  const sources = [];
  for (const [platform, scraper] of scraperManager.scrapers.entries()) {
    sources.push({
      platform,
      name: scraper.name,
      enabled: scraper.enabled,
      rateLimitMs: scraper.rateLimitMs,
      tier: ['overpass', 'google_places', 'google_maps'].includes(platform) ? 1 : 2
    });
  }
  res.json({ success: true, sources });
});

/**
 * PATCH /api/sources/:platform/toggle - Enable/Disable scraper source (Admin only)
 */
router.patch('/:platform/toggle', requireAuth, requireAdmin, (req, res) => {
  const { platform } = req.params;
  const scraper = scraperManager.scrapers.get(platform);
  if (!scraper) {
    return res.status(404).json({ error: 'NotFound', message: `Source '${platform}' not found` });
  }

  scraper.enabled = !scraper.enabled;
  res.json({ success: true, platform, enabled: scraper.enabled });
});

/**
 * POST /api/sources/:platform/test - Test a specific scraper engine
 */
router.post('/:platform/test', requireAuth, async (req, res, next) => {
  try {
    const { platform } = req.params;
    const { keyword, leadType, country, city } = req.body || {};
    const result = await scraperManager.testScraper(platform, { keyword, leadType, country, city });
    res.json({ success: true, result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
