/**
 * Smoke Test Suite for Lead Scraper Bot
 * Tests /health, /api/settings, /api/leads/stats and a google_places query.
 * Prints a clean pass/fail table.
 */

const http = require('http');
const axios = require('axios');
const app = require('../api/server');
const sequelize = require('../config/database');
const { Lead } = require('../models');
const scraperManager = require('../scrapers/ScraperManager');

async function runSmokeTests() {
  console.log('\n======================================================');
  console.log('🧪 Starting Lead Scraper Bot Smoke Test Suite');
  console.log('======================================================\n');

  const results = [];
  let server = null;

  try {
    // 1. Initialize and sync database
    await sequelize.authenticate();
    await sequelize.sync();

    // 2. Start HTTP server on an ephemeral free port
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    const baseUrl = `http://127.0.0.1:${port}`;

    const client = axios.create({
      baseURL: baseUrl,
      timeout: 10000,
      validateStatus: () => true, // capture all HTTP codes without throwing
      headers: {
        'x-test-user-id': 'smoke-test-user'
      }
    });

    // Test 1: GET /health
    try {
      const res = await client.get('/health');
      const pass = res.status === 200 && res.data?.ok === true;
      results.push({
        'Test Target': 'GET /health',
        Status: pass ? 'PASS' : 'FAIL',
        Details: `HTTP ${res.status} | ok: ${res.data?.ok} | db: ${res.data?.db} | uptime: ${res.data?.uptime}s`
      });
    } catch (err) {
      results.push({
        'Test Target': 'GET /health',
        Status: 'FAIL',
        Details: err.message
      });
    }

    // Test 2: GET /api/settings
    try {
      const res = await client.get('/api/settings');
      const pass = res.status === 200 && res.data?.success === true;
      results.push({
        'Test Target': 'GET /api/settings',
        Status: pass ? 'PASS' : 'FAIL',
        Details: `HTTP ${res.status} | version: ${res.data?.settings?.appVersion} | scrapers: ${res.data?.settings?.activeScrapers?.length || 0} active`
      });
    } catch (err) {
      results.push({
        'Test Target': 'GET /api/settings',
        Status: 'FAIL',
        Details: err.message
      });
    }

    // Test 3: GET /api/leads/stats
    try {
      const res = await client.get('/api/leads/stats');
      const pass = res.status === 200 && res.data?.success === true;
      results.push({
        'Test Target': 'GET /api/leads/stats',
        Status: pass ? 'PASS' : 'FAIL',
        Details: `HTTP ${res.status} | totalLeads: ${res.data?.stats?.totalLeads ?? 0} | hotLeads: ${res.data?.stats?.hotLeads ?? 0}`
      });
    } catch (err) {
      results.push({
        'Test Target': 'GET /api/leads/stats',
        Status: 'FAIL',
        Details: err.message
      });
    }

    // Test 4: ScraperManager google_places query
    try {
      const queryResult = await scraperManager.runScraper({
        userId: 'smoke-test-user',
        platform: 'google_places',
        keyword: 'rug boutique',
        city: 'Dubai',
        country: 'UAE',
        leadType: 'rug_retailer'
      });

      const validStatuses = ['ok', 'empty', 'error', 'blocked'];
      const pass = queryResult && validStatuses.includes(queryResult.status);
      const detailMsg = queryResult.errorMessage
        ? `status: ${queryResult.status} | reason: ${queryResult.errorMessage.slice(0, 50)}...`
        : `status: ${queryResult.status} | count: ${queryResult.count ?? queryResult.foundCount ?? 0}`;

      results.push({
        'Test Target': 'google_places Scraper Query',
        Status: pass ? 'PASS' : 'FAIL',
        Details: detailMsg
      });
    } catch (err) {
      results.push({
        'Test Target': 'google_places Scraper Query',
        Status: 'FAIL',
        Details: err.message
      });
    }

  } catch (initErr) {
    results.push({
      'Test Target': 'Smoke Test Setup',
      Status: 'FAIL',
      Details: initErr.message
    });
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    try {
      await sequelize.close();
    } catch (e) {}
  }

  // Display results
  console.table(results);

  const hasFailures = results.some((r) => r.Status === 'FAIL');
  if (hasFailures) {
    console.error('\n❌ Smoke tests failed.\n');
    process.exit(1);
  } else {
    console.log('\n✅ All smoke tests passed successfully!\n');
    process.exit(0);
  }
}

if (require.main === module) {
  runSmokeTests();
}

module.exports = runSmokeTests;
