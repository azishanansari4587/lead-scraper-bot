const scraperManager = require('../scrapers/ScraperManager');
const { sequelize } = require('../models');
const logger = require('../config/logger');

// Parse CLI flags
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    type: 'rug_retailer',
    country: 'UAE',
    city: 'Dubai',
    platform: 'overpass',
    keyword: null,
    userId: 'cli_user'
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--type' || arg === '-t') {
      options.type = args[++i];
    } else if (arg === '--country' || arg === '-c') {
      options.country = args[++i];
    } else if (arg === '--city') {
      options.city = args[++i];
    } else if (arg === '--platform' || arg === '-p') {
      options.platform = args[++i];
    } else if (arg === '--keyword' || arg === '-k') {
      options.keyword = args[++i];
    } else if (arg === '--user' || arg === '-u') {
      options.userId = args[++i];
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();
  console.log('\n======================================================');
  console.log('  Knotiq Rugs - B2B Lead Generation Scraper CLI');
  console.log('======================================================');
  console.log(` Lead Type: ${options.type}`);
  console.log(` Target:    ${options.city}, ${options.country}`);
  console.log(` Platform:  ${options.platform}`);
  console.log(` Keyword:   ${options.keyword || '(auto from category)'}`);
  console.log('------------------------------------------------------\n');

  await sequelize.authenticate();

  const platforms = options.platform === 'all'
    ? ['google_places', 'google_maps', 'overpass']
    : [options.platform];

  for (const plat of platforms) {
    console.log(`\n⏳ Running scraper on platform: ${plat}...`);
    const result = await scraperManager.runScraper({
      userId: options.userId,
      platform: plat,
      leadType: options.type,
      country: options.country,
      city: options.city,
      keyword: options.keyword,
      onProgress: (prog) => {
        process.stdout.write(`\rFound: ${prog.foundCount} | New: ${prog.newCount} | Dupes: ${prog.duplicateCount} | Processing: ${prog.currentLead.slice(0, 30)}...`);
      }
    });

    console.log('\n\n--- Run Summary ---');
    console.log(` Status:          ${result.status.toUpperCase()}`);
    console.log(` Total Found:     ${result.foundCount}`);
    console.log(` Newly Added:     ${result.newCount}`);
    console.log(` Duplicates/Merged: ${result.duplicateCount}`);
    console.log(` Errors:          ${result.errorCount}`);
    console.log(` Duration:        ${(result.durationMs / 1000).toFixed(2)}s\n`);
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    logger.error({ err }, 'CLI scrape failed');
    console.error('Scrape execution failed:', err.message);
    process.exit(1);
  });
}

module.exports = main;
