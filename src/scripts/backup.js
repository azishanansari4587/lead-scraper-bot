/**
 * Database & Data Backup Script for Knotiq Rugs Lead Scraper
 * Creates portable timestamped backups of SQLite file or JSON snapshots of core tables.
 */

const fs = require('fs');
const path = require('path');
const env = require('../config/env');
const logger = require('../config/logger');
const sequelize = require('../config/database');
const Lead = require('../models/Lead');
const ScraperRun = require('../models/ScraperRun');
const Schedule = require('../models/Schedule');
const SearchPreset = require('../models/SearchPreset');
const OptOut = require('../models/OptOut');

async function runBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(__dirname, '../../data/backups');

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  logger.info({ backupDir, dialect: env.DB_DIALECT }, 'Initiating database backup...');

  try {
    // 1. If SQLite, copy database file directly
    if (env.DB_DIALECT === 'sqlite' && fs.existsSync(env.DB_STORAGE)) {
      const sqliteBackupFile = path.join(backupDir, `sqlite_backup_${timestamp}.sqlite`);
      fs.copyFileSync(env.DB_STORAGE, sqliteBackupFile);
      logger.info({ file: sqliteBackupFile }, 'SQLite database file backed up successfully');
    }

    // 2. Database-agnostic JSON Snapshot for portability (works on both MySQL & SQLite)
    const [leads, runs, schedules, presets, optOuts] = await Promise.all([
      Lead.findAll({ raw: true }).catch(() => []),
      ScraperRun.findAll({ raw: true }).catch(() => []),
      Schedule.findAll({ raw: true }).catch(() => []),
      SearchPreset.findAll({ raw: true }).catch(() => []),
      OptOut.findAll({ raw: true }).catch(() => [])
    ]);

    const snapshot = {
      timestamp: new Date().toISOString(),
      dialect: env.DB_DIALECT,
      counts: {
        leads: leads.length,
        runs: runs.length,
        schedules: schedules.length,
        presets: presets.length,
        optOuts: optOuts.length
      },
      data: {
        leads,
        runs,
        schedules,
        presets,
        optOuts
      }
    };

    const snapshotFile = path.join(backupDir, `snapshot_${timestamp}.json`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf8');

    logger.info({
      snapshotFile,
      records: snapshot.counts
    }, 'JSON database snapshot generated successfully');

    // 3. Prune older backups (keep last 10 snapshots and last 10 sqlite backups)
    const pruneGroup = (prefix, maxKeep = 10) => {
      const files = fs.readdirSync(backupDir)
        .filter((f) => f.startsWith(prefix))
        .map((f) => ({ name: f, time: fs.statSync(path.join(backupDir, f)).mtimeMs }))
        .sort((a, b) => a.time - b.time);

      if (files.length > maxKeep) {
        const toDelete = files.slice(0, files.length - maxKeep);
        for (const item of toDelete) {
          fs.unlinkSync(path.join(backupDir, item.name));
          logger.debug({ file: item.name }, 'Pruned stale backup file');
        }
      }
    };

    pruneGroup('snapshot_', 10);
    pruneGroup('sqlite_backup_', 10);

    logger.info('Database backup routine finished successfully.');
    return { success: true, timestamp, snapshotFile };
  } catch (err) {
    logger.error({ err: err.message }, 'Database backup routine failed');
    throw err;
  } finally {
    if (require.main === module) {
      await sequelize.close().catch(() => {});
    }
  }
}

if (require.main === module) {
  runBackup()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = runBackup;
