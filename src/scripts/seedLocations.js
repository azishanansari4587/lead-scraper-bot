const fs = require('fs');
const path = require('path');
const { Location, sequelize } = require('../models');
const logger = require('../config/logger');

async function seedLocations() {
  await sequelize.authenticate();
  logger.info('Seeding locations database...');

  const dataPath = path.resolve(__dirname, '../../data/locations.json');
  const raw = fs.readFileSync(dataPath, 'utf8');
  const locations = JSON.parse(raw);

  let inserted = 0;
  let updated = 0;

  for (const loc of locations) {
    const existing = await Location.findOne({
      where: {
        country: loc.country,
        city: loc.city
      }
    });

    if (existing) {
      await existing.update(loc);
      updated++;
    } else {
      await Location.create(loc);
      inserted++;
    }
  }

  logger.info(`Locations seeded successfully. Inserted: ${inserted}, Updated: ${updated}, Total: ${locations.length}`);
}

if (require.main === module) {
  seedLocations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = seedLocations;
