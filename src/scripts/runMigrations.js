const fs = require('fs');
const path = require('path');
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const logger = require('../config/logger');

async function runMigrations() {
  const queryInterface = sequelize.getQueryInterface();
  logger.info('Starting database migrations...');

  // Ensure SequelizeMeta table exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS SequelizeMeta (
      name VARCHAR(255) NOT NULL PRIMARY KEY
    );
  `);

  const [appliedRows] = await sequelize.query('SELECT name FROM SequelizeMeta;');
  const applied = new Set(appliedRows.map((r) => r.name));

  const migrationsDir = path.resolve(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    logger.warn('No migrations directory found.');
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.js'))
    .sort();

  for (const file of files) {
    if (!applied.has(file)) {
      logger.info(`Applying migration: ${file}`);
      const migration = require(path.join(migrationsDir, file));
      try {
        await migration.up(queryInterface, sequelize);
        await sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?);', {
          replacements: [file]
        });
        logger.info(`Successfully applied: ${file}`);
      } catch (err) {
        logger.error({ err, file }, `Failed to apply migration: ${file}`);
        throw err;
      }
    } else {
      logger.debug(`Skipping already applied migration: ${file}`);
    }
  }

  logger.info('All migrations completed successfully.');
}

if (require.main === module) {
  runMigrations()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = runMigrations;
