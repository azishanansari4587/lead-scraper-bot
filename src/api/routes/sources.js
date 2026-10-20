/**
 * Sources / Platforms Router
 */

const express = require('express');
const scraperManager = require('../../scrapers/ScraperManager');
const { requireAuth } = require('../middleware/auth');

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

router.patch('/:platform/toggle', requireAuth, (req, res) => {
  const { platform } = req.params;
  const scraper = scraperManager.scrapers.get(platform);
  if (!scraper) {
    return res.status(404).json({ error: 'NotFound', message: `Source '${platform}' not found` });
  }

  scraper.enabled = !scraper.enabled;
  res.json({ success: true, platform, enabled: scraper.enabled });
});

module.exports = router;
