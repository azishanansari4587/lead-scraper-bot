/**
 * One-time CLI Script to Backfill Buyer Types
 * Usage:
 *   node src/scripts/backfillBuyerTypes.js --dry-run
 *   node src/scripts/backfillBuyerTypes.js --apply
 */

const Lead = require('../models/Lead');
const { classifyBuyer } = require('../services/classification/buyerClassifier');
const logger = require('../config/logger');

async function runBackfill() {
  const isApply = process.argv.includes('--apply');
  const isDryRun = !isApply || process.argv.includes('--dry-run');

  console.log(`\n=== Knotiq Rugs Buyer Type Backfill (${isDryRun ? 'DRY RUN' : 'APPLY MODE'}) ===\n`);

  const leads = await Lead.findAll({
    order: [['id', 'ASC']]
  });

  console.log(`Found ${leads.length} total leads to evaluate.\n`);

  let updatedCount = 0;
  let skippedManualCount = 0;
  const breakdown = {};

  for (const lead of leads) {
    if (lead.buyerTypeManual) {
      skippedManualCount++;
      continue;
    }

    const classification = await classifyBuyer(lead);
    const newType = classification.buyerType;

    breakdown[newType] = (breakdown[newType] || 0) + 1;

    console.log(
      `[#${lead.id}] ${lead.businessName.padEnd(35)} -> ${newType.padEnd(15)} (conf: ${classification.confidence}) - ${classification.reason}`
    );

    if (isApply) {
      await lead.update({
        buyerType: newType,
        buyerTypeConfidence: classification.confidence,
        buyerTypeReason: classification.reason
      });
      updatedCount++;
    }
  }

  console.log('\n--- Summary Breakdown ---');
  Object.entries(breakdown).forEach(([k, v]) => console.log(`  ${k.padEnd(16)}: ${v}`));
  console.log(`  Skipped Manual  : ${skippedManualCount}`);
  if (isApply) {
    console.log(`\nSuccessfully applied buyer types to ${updatedCount} leads in database.`);
  } else {
    console.log(`\n[DRY RUN COMPLETE] Zero database rows modified. Run with --apply to commit changes.`);
  }
}

if (require.main === module) {
  runBackfill()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runBackfill;
