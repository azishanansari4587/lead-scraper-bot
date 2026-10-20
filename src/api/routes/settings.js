/**
 * Settings & System Diagnostics API Router
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const env = require('../../config/env');
const aiService = require('../../services/aiService');
const scraperManager = require('../../scrapers/ScraperManager');
const logger = require('../../config/logger');

const router = express.Router();

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

router.get('/', (req, res) => {
  const geminiStats = aiService.getUsageStats();
  const scrapers = Array.from(scraperManager.scrapers.keys());
  const activePlacesKey = process.env.GOOGLE_PLACES_API_KEY || env.GOOGLE_PLACES_API_KEY || '';

  res.json({
    success: true,
    settings: {
      userId: req.userId,
      appVersion: '1.0.0',
      databaseDialect: env.DB_DIALECT,
      geminiModel: 'gemini-1.5-flash',
      geminiStats,
      activeScrapers: scrapers,
      googlePlacesApiKeyConfigured: Boolean(activePlacesKey),
      googlePlacesApiKeyMasked: activePlacesKey
        ? `${activePlacesKey.slice(0, 6)}...${activePlacesKey.slice(-4)}`
        : null,
      environment: env.NODE_ENV
    }
  });
});

router.post('/api-keys', (req, res) => {
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
});

module.exports = router;
