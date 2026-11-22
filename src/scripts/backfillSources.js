/**
 * Lead.source Backfill Utility
 * Standardizes Lead.source from Lead.platform while preserving existing non-empty specific sources.
 *
 * Usage:
 *   node src/scripts/backfillSources.js --dry-run
 *   node src/scripts/backfillSources.js
 */

const { Op } = require('sequelize');
const Lead = require('../models/Lead');
const logger = require('../config/logger');

async function backfillSources(options = false) {
  const isDryRun = typeof options === 'boolean' ? options : Boolean(options?.dryRun);
  logger.info({ isDryRun }, 'Starting Lead.source backfill inspection...');

  const candidates = await Lead.findAll({
    where: {
      [Op.or]: [
        { source: null },
        { source: '' },
        { source: 'scraper' }
      ],
      platform: {
        [Op.and]: [
          { [Op.ne]: null },
          { [Op.ne]: '' }
        ]
      }
    },
    attributes: ['id', 'businessName', 'source', 'platform', 'country', 'city']
  });

  console.log(`\n========================================`);
  console.log(`📋 LEAD SOURCE BACKFILL ${isDryRun ? '[DRY-RUN PREVIEW]' : '[APPLYING UPDATES]'}`);
  console.log(`========================================`);
  console.log(`Found ${candidates.length} candidate leads eligible for source standardization.\n`);

  if (candidates.length === 0) {
    console.log('✅ All leads already have standardized specific sources. Nothing to backfill.');
    return { candidateCount: 0, updatedCount: 0 };
  }

  const previewTable = candidates.slice(0, 10).map((l) => ({
    id: l.id,
    business: l.businessName.slice(0, 25),
    currentSource: l.source || '<empty>',
    targetSource: l.platform,
    location: `${l.city}, ${l.country}`
  }));

  console.table(previewTable);
  if (candidates.length > 10) {
    console.log(`... and ${candidates.length - 10} more leads.`);
  }

  if (isDryRun) {
    console.log(`\n🧪 Dry run complete. 0 database rows modified.`);
    return { candidateCount: candidates.length, updatedCount: 0 };
  }

  let updatedCount = 0;
  for (const lead of candidates) {
    await lead.update({ source: lead.platform });
    updatedCount++;
  }

  console.log(`\n✅ Successfully backfilled ${updatedCount} leads.`);
  return { candidateCount: candidates.length, updatedCount };
}

if (require.main === module) {
  const isDryRun = process.argv.includes('--dry-run');
  backfillSources(isDryRun)
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error during source backfill:', err);
      process.exit(1);
    });
}

module.exports = backfillSources;
module.exports.backfillSources = backfillSources;
