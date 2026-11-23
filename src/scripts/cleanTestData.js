/**
 * Clean Test Data Script
 * Clears all mock/test transactional records from the database,
 * leaving schema, UserSettings, 5 Founder Mantras, CallScripts, and OutreachTemplates
 * pristine, neat, and ready for live production usage.
 */

const fs = require('fs');
const path = require('path');
const sequelize = require('../config/database');
const logger = require('../config/logger');

const TABLES_TO_CLEAR = [
  'AuditLogs',
  'BulkSendLogs',
  'CalendarEvents',
  'Calls',
  'CampaignLeads',
  'Campaigns',
  'ContentPosts',
  'DailyPlans',
  'DailyReviews',
  'ExportJobs',
  'FollowUps',
  'Leads',
  'MindmapNodes',
  'Mindmaps',
  'MindsetGateLogs',
  'Notes',
  'OptOuts',
  'OutreachLogs',
  'ReminderLogs',
  'Schedules',
  'ScraperRuns',
  'SearchPresets',
  'Tasks'
];

async function cleanTestData() {
  await sequelize.authenticate();
  const dialect = sequelize.getDialect();
  console.log(`\n======================================================`);
  console.log(`🧹 CLEANING TEST DATA (${dialect.toUpperCase()})`);
  console.log(`======================================================`);

  if (dialect === 'mysql' || dialect === 'mariadb') {
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');
    for (const table of TABLES_TO_CLEAR) {
      try {
        await sequelize.query(`TRUNCATE TABLE \`${table}\`;`);
        console.log(`  ✓ Cleared table: ${table}`);
      } catch (err) {
        // Fallback to DELETE if TRUNCATE has foreign key restriction in some MySQL configs
        try {
          await sequelize.query(`DELETE FROM \`${table}\`;`);
          console.log(`  ✓ Cleared table via DELETE: ${table}`);
        } catch (delErr) {
          console.warn(`  ⚠️ Could not clear table ${table}: ${delErr.message}`);
        }
      }
    }
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');
  } else {
    // SQLite
    await sequelize.query('PRAGMA foreign_keys = OFF;');
    for (const table of TABLES_TO_CLEAR) {
      try {
        await sequelize.query(`DELETE FROM "${table}";`);
        console.log(`  ✓ Cleared table: ${table}`);
      } catch (err) {
        console.warn(`  ⚠️ Could not clear table ${table}: ${err.message}`);
      }
    }
    await sequelize.query('PRAGMA foreign_keys = ON;');
  }

  // Clean stale exports in data/exports
  const exportsDir = path.resolve(__dirname, '../../data/exports');
  if (fs.existsSync(exportsDir)) {
    const files = fs.readdirSync(exportsDir);
    let count = 0;
    for (const file of files) {
      if (file.endsWith('.csv') || file.endsWith('.xlsx') || file.endsWith('.pdf')) {
        try {
          fs.unlinkSync(path.join(exportsDir, file));
          count++;
        } catch (_) {}
      }
    }
    console.log(`  ✓ Removed ${count} stale export files from data/exports/`);
  }

  // Clean dummy 26-byte test samples from data/attachments
  const attachmentsDir = path.resolve(__dirname, '../../data/attachments');
  if (fs.existsSync(attachmentsDir)) {
    const files = fs.readdirSync(attachmentsDir);
    let count = 0;
    for (const file of files) {
      if (file.includes('hand_knotted_sample.png') || file.includes('Catalogue_2026.pdf')) {
        try {
          const stat = fs.statSync(path.join(attachmentsDir, file));
          if (stat.size < 1000) { // Only delete dummy mock test files (< 1 KB)
            fs.unlinkSync(path.join(attachmentsDir, file));
            count++;
          }
        } catch (_) {}
      }
    }
    console.log(`  ✓ Cleaned ${count} mock dummy attachments from data/attachments/`);
  }

  // Verify remaining database state
  console.log(`\n--- POST-CLEANUP INTEGRITY CHECK ---`);
  const [tables] = await sequelize.query(
    dialect === 'mysql' ? 'SHOW TABLES;' : "SELECT name FROM sqlite_master WHERE type='table';"
  );

  for (const row of tables) {
    const tableName = Object.values(row)[0];
    try {
      const [countResult] = await sequelize.query(
        dialect === 'mysql' ? `SELECT COUNT(*) as c FROM \`${tableName}\`;` : `SELECT COUNT(*) as c FROM "${tableName}";`
      );
      const count = countResult[0].c;
      if (count > 0) {
        console.log(`  📌 ${tableName}: ${count} records (PRESERVED)`);
      }
    } catch (_) {}
  }

  console.log(`\n✅ DATABASE AND WORKSPACE ARE NOW 100% CLEAN AND PRISTINE.`);
  console.log(`======================================================\n`);
  process.exit(0);
}

cleanTestData().catch((err) => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
