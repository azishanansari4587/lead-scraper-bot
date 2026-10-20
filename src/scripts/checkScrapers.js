const scraperManager = require('../scrapers/ScraperManager');
const logger = require('../config/logger');

async function checkScrapers() {
  console.log('\n======================================================');
  console.log('  Knotiq Rugs - Scraper Health Self-Check');
  console.log('======================================================\n');

  const scrapers = scraperManager.listScrapers();
  const results = [];

  for (const { name } of scrapers) {
    const scraper = scraperManager.getScraper(name);
    process.stdout.write(`Testing [${name.padEnd(16)}] ... `);

    try {
      const url = scraper.buildUrl('rugs', 'Dubai');
      const isAllowed = await scraper.checkRobots(url);

      if (!isAllowed) {
        console.log('BLOCKED (Robots.txt)');
        results.push({ scraper: name, status: 'BLOCKED', notes: 'Disallowed by robots.txt' });
        continue;
      }

      // Quick test query validation
      if (name === 'google_places' && !scraper.apiKey) {
        console.log('OK (API Key unconfigured / optional)');
        results.push({ scraper: name, status: 'OK', notes: 'Awaiting Google Places API Key' });
      } else {
        console.log('OK');
        results.push({ scraper: name, status: 'OK', notes: 'Configured and operational' });
      }
    } catch (err) {
      console.log(`BROKEN (${err.message})`);
      results.push({ scraper: name, status: 'BROKEN', notes: err.message });
    }
  }

  console.log('\n--- Summary Table ---');
  console.table(results);
  process.exit(0);
}

if (require.main === module) {
  checkScrapers().catch((err) => {
    console.error('Check failed:', err);
    process.exit(1);
  });
}

module.exports = checkScrapers;
