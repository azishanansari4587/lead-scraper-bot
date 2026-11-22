/**
 * Settings & System Diagnostics API Router
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const env = require('../../config/env');
const aiService = require('../../services/aiService');
const scraperManager = require('../../scrapers/ScraperManager');
const UserSettings = require('../../models/UserSettings');
const logger = require('../../config/logger');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/settings/user - Get founder user settings (timezone, daily targets)
 */
router.get('/user', async (req, res, next) => {
  try {
    const userId = req.userId;
    let settings = await UserSettings.findOne({ where: { userId } });
    if (!settings) {
      settings = await UserSettings.create({
        userId,
        timezone: 'Asia/Dubai',
        dailyEmailTarget: 30,
        dailyWhatsappTarget: 30,
        dailyCallTarget: 20
      });
    }
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/settings/user - Update founder user settings
 */
router.patch('/user', async (req, res, next) => {
  try {
    const userId = req.userId;
    let settings = await UserSettings.findOne({ where: { userId } });
    if (!settings) {
      settings = await UserSettings.create({ userId, ...req.body });
    } else {
      const allowed = [
        'timezone',
        'dailyEmailTarget',
        'dailyWhatsappTarget',
        'dailyCallTarget',
        'notifyTelegram',
        'notifyEmail'
      ];
      const updates = {};
      allowed.forEach((k) => {
        if (req.body[k] !== undefined) updates[k] = req.body[k];
      });
      await settings.update(updates);
    }
    res.json({ success: true, settings });
  } catch (err) {
    next(err);
  }
});

function updateEnvFile(key, value) {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    let content = '';
    if (fs.existsSync(envPath)) {
      content = fs.readFileSync(envPath, 'utf8');
    }

    const regex = new RegExp(`^${key}=.*$`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = content ? `${content.trim()}\n${key}=${value}` : `${key}=${value}`;
    }
    fs.writeFileSync(envPath, content.trim() + '\n', 'utf8');
  } catch (err) {
    logger.warn({ err: err.message }, 'Could not persist key to .env file');
  }
}

router.get('/', (req, res, next) => {
  try {
    const geminiStats = aiService.getUsageStats();
    const scrapers = Array.from(scraperManager.scrapers.keys());
    const activePlacesKey = process.env.GOOGLE_PLACES_API_KEY || env.GOOGLE_PLACES_API_KEY || '';

    res.json({
      success: true,
      settings: {
        userId: req.userId,
        appVersion: '1.0.0',
        databaseDialect: env.DB_DIALECT,
        geminiModel: process.env.GEMINI_MODEL || env.GEMINI_MODEL || 'gemini-1.5-flash',
        geminiStats,
        activeScrapers: scrapers,
        googlePlacesApiKeyConfigured: Boolean(activePlacesKey),
        environment: env.NODE_ENV
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/api-keys', requireAdmin, (req, res, next) => {
  try {
    const { googlePlacesApiKey } = req.body;

    if (typeof googlePlacesApiKey !== 'string') {
      return res.status(400).json({
        error: 'BadRequest',
        message: 'googlePlacesApiKey must be a string'
      });
    }

    const trimmedKey = googlePlacesApiKey.trim();

    // Update in-memory process.env and env object
    process.env.GOOGLE_PLACES_API_KEY = trimmedKey;
    env.GOOGLE_PLACES_API_KEY = trimmedKey;

    // Persist to .env file
    updateEnvFile('GOOGLE_PLACES_API_KEY', trimmedKey);

    logger.info(
      { configured: Boolean(trimmedKey) },
      'Updated Google Places API Key via Settings API'
    );

    res.json({
      success: true,
      message: trimmedKey
        ? 'Google Places API Key configured successfully!'
        : 'Google Places API Key removed.',
      configured: Boolean(trimmedKey)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
