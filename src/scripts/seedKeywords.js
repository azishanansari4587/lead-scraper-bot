const fs = require('fs');
const path = require('path');
const { KeywordSet, sequelize } = require('../models');
const logger = require('../config/logger');

async function seedKeywords() {
  await sequelize.authenticate();
  logger.info('Seeding keyword sets database...');

  const dataPath = path.resolve(__dirname, '../../data/keywords.json');
  const raw = fs.readFileSync(dataPath, 'utf8');
  const keywordSets = JSON.parse(raw);

  let inserted = 0;
  let updated = 0;

  for (const set of keywordSets) {
    const existing = await KeywordSet.findOne({
      where: {
        leadType: set.leadType,
        language: set.language
      }
    });

    if (existing) {
      await existing.update(set);
      updated++;
    } else {
      await KeywordSet.create(set);
      inserted++;
    }
  }

  logger.info(`Keywords seeded successfully. Inserted: ${inserted}, Updated: ${updated}, Total: ${keywordSets.length}`);
}

if (require.main === module) {
  seedKeywords()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedKeywords;
