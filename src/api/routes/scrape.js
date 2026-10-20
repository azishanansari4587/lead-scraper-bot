/**
 * Scraper Run REST API Router
 * Endpoints for triggering live scrapes and viewing scraper run audit histories.
 */

const express = require('express');
const ScraperRun = require('../../models/ScraperRun');
const scraperManager = require('../../scrapers/ScraperManager');
const logger = require('../../config/logger');

const router = express.Router();

/**
 * POST /api/scrape/run - Trigger a scraper run
 */
router.post('/run', async (req, res, next) => {
  try {
    const userId = req.userId;
    const {
      platform = 'overpass',
      keyword,
      leadType = 'rug_retailer',
      country = 'UAE',
      state = null,
      city = 'Dubai',
      enrichWebsites = false
    } = req.body;

    logger.info({ userId, platform, country, city, leadType }, 'Triggering scrape run via API');

    const result = await scraperManager.runScraper({
      userId,
      platform,
      keyword,
      leadType,
      country,
      state,
      city,
      enrichWebsites
    });

    res.json({
      success: true,
      result
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/scrape/runs - List past scraper runs
 */
router.get('/runs', async (req, res, next) => {
  try {
    const userId = req.userId;
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const runs = await ScraperRun.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']],
      limit
    });

    res.json({
      success: true,
      runs
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/scrape/runs/:id - Get specific scraper run
 */
router.get('/runs/:id', async (req, res, next) => {
  try {
    const run = await ScraperRun.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!run) {
      return res.status(404).json({ error: 'NotFound', message: 'Scraper run not found' });
    }

    res.json({ success: true, run });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
