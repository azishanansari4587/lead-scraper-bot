/**
 * Local MySQL Migration & Schema Smoke Test Runner
 *
 * STRICT SAFETY RULE:
 * This script strictly connects to LOCALHOST (127.0.0.1 / localhost) only.
 * It will refuse to run against any non-local or remote host.
 *
 * Usage:
 *   $env:DB_HOST="127.0.0.1"; $env:DB_USER="root"; $env:DB_PASS="password"; node src/scripts/testLocalMysqlMigrations.js
 */

const path = require('path');
const fs = require('fs');
const { Sequelize, DataTypes, Op } = require('sequelize');

function isLocalHost(host) {
  if (!host) return true;
  const clean = String(host).trim().toLowerCase();
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1';
}

async function runLocalMysqlSmokeTest() {
  const host = process.env.DB_HOST || '127.0.0.1';
  const port = Number(process.env.DB_PORT || 3306);
  const user = process.env.DB_USER || 'root';
  const pass = process.env.DB_PASS || '';
  const dbName = process.env.DB_NAME || 'knotiq_local_test';

  console.log('====================================================');
  console.log('🧪 LOCAL MYSQL MIGRATION & SMOKE TEST RUNNER');
  console.log('====================================================');

  // 1. Strict Localhost Verification Guard
  if (!isLocalHost(host)) {
    console.error(`❌ [SAFETY GUARD BLOCKED] Target host "${host}" is NOT local.`);
    console.error('This script is strictly restricted to localhost / 127.0.0.1.');
    process.exit(1);
  }

  console.log(`🔌 Target Host: ${host}:${port} (Database: ${dbName})`);

  // 2. Initialize connection
  const sequelize = new Sequelize(dbName, user, pass, {
    host,
    port,
    dialect: 'mysql',
    logging: false,
    dialectOptions: {
      connectTimeout: 5000
    }
  });

  try {
    await sequelize.authenticate();
    console.log('✅ Connected to local MySQL instance successfully.');
  } catch (err) {
    console.error('❌ Failed to connect to local MySQL:', err.message);
    console.error('Please ensure your local MySQL server or Docker container is running.');
    process.exit(1);
  }

  const queryInterface = sequelize.getQueryInterface();

  // 3. Ensure SequelizeMeta table exists
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS SequelizeMeta (
      name VARCHAR(255) NOT NULL PRIMARY KEY
    );
  `);

  // 4. Run Migrations 003, 004, 005, 006 sequentially
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  const targetMigrations = [
    '001_initial_schema.js',
    '002_update_scraper_run_status.js',
    '003_phase_a_crm_tables.js',
    '004_phase_b_planner.js',
    '005_phase_c_marketing.js',
    '006_template_active_and_lead_statuses.js'
  ];

  const [appliedRows] = await sequelize.query('SELECT name FROM SequelizeMeta;');
  const applied = new Set(appliedRows.map((r) => r.name));

  console.log('\n📦 Running Sequential Migrations...');
  for (const file of targetMigrations) {
    const filePath = path.join(migrationsDir, file);
    if (!fs.existsSync(filePath)) {
      console.warn(`⚠️ Migration file not found: ${file}`);
      continue;
    }

    if (!applied.has(file)) {
      console.log(`  ⏳ Applying: ${file}...`);
      const migration = require(filePath);
      await migration.up(queryInterface, sequelize);
      await sequelize.query('INSERT INTO SequelizeMeta (name) VALUES (?);', {
        replacements: [file]
      });
      console.log(`  ✅ Successfully applied: ${file}`);
    } else {
      console.log(`  ℹ️ Already applied: ${file}`);
    }
  }

  // 5. Smoke Test 1: Verify Leads.status MySQL ENUM contains all 10 values
  console.log('\n🔍 Smoke Test 1: Inspecting Leads.status column definition in MySQL information_schema...');
  const [colRows] = await sequelize.query(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Leads' AND COLUMN_NAME = 'status'
  `, { replacements: [dbName] });

  if (colRows.length === 0) {
    throw new Error('Leads.status column not found in database!');
  }

  const statusCol = colRows[0];
  console.log(`   DATA_TYPE: ${statusCol.DATA_TYPE}`);
  console.log(`   COLUMN_TYPE: ${statusCol.COLUMN_TYPE}`);

  const requiredStatuses = [
    'new', 'contacted', 'replied', 'sample_sent', 'quotation',
    'negotiation', 'won', 'lost', 'repeat_client', 'not_interested'
  ];

  const missingFromDb = requiredStatuses.filter(
    (s) => !String(statusCol.COLUMN_TYPE).toLowerCase().includes(s)
  );

  if (missingFromDb.length > 0) {
    throw new Error(`MySQL Leads.status is missing expected ENUM values: ${missingFromDb.join(', ')}`);
  }
  console.log('✅ Smoke Test 1 PASSED: All 10 Lead statuses are present in MySQL ENUM definition.');

  // 6. Smoke Test 2: Insert/Update leads with Phase A/C statuses
  console.log('\n📝 Smoke Test 2: Testing live INSERT with sample_sent, quotation, negotiation, repeat_client...');
  const testUserId = `smoke_user_${Date.now()}`;
  const testLeads = [
    { businessName: 'Smoke Sample Sent LLC', status: 'sample_sent' },
    { businessName: 'Smoke Quotation Co', status: 'quotation' },
    { businessName: 'Smoke Negotiation Studio', status: 'negotiation' },
    { businessName: 'Smoke Repeat Client Hotels', status: 'repeat_client' }
  ];

  const insertedIds = [];
  for (const t of testLeads) {
    const [result] = await sequelize.query(`
      INSERT INTO Leads (businessName, status, userId, createdAt, updatedAt)
      VALUES (?, ?, ?, NOW(), NOW());
    `, { replacements: [t.businessName, t.status, testUserId] });
    insertedIds.push(result);
    console.log(`   Inserted Lead ID ${result} with status="${t.status}"`);
  }
  console.log('✅ Smoke Test 2 PASSED: MySQL accepted all Phase A/C statuses without data truncation.');

  // 7. Smoke Test 3: BulkSendLog.status accepts 'simulated'
  console.log('\n✉️ Smoke Test 3: Testing BulkSendLog INSERT with status="simulated"...');
  const [bulkLogResult] = await sequelize.query(`
    INSERT INTO BulkSendLogs (jobId, recipient, channel, status, details, sentAt, createdAt)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW());
  `, {
    replacements: [
      `smoke_job_${Date.now()}`,
      'designer@dubai-interiors.ae',
      'email',
      'simulated',
      JSON.stringify({ dryRun: true, simulated: true })
    ]
  });
  console.log(`   Inserted BulkSendLog ID ${bulkLogResult} with status="simulated"`);
  console.log('✅ Smoke Test 3 PASSED: BulkSendLog supports status="simulated" on MySQL.');

  // 8. Clean up smoke test data
  console.log('\n🧹 Cleaning up test artifacts...');
  await sequelize.query('DELETE FROM Leads WHERE userId = ?;', { replacements: [testUserId] });
  await sequelize.query('DELETE FROM BulkSendLogs WHERE id = ?;', { replacements: [bulkLogResult] });
  console.log('✅ Cleanup complete.');

  await sequelize.close();
  console.log('\n====================================================');
  console.log('🎉 ALL LOCAL MYSQL MIGRATION TESTS PASSED CLEANLY!');
  console.log('====================================================');
}

if (require.main === module) {
  runLocalMysqlSmokeTest().catch((err) => {
    console.error('\n❌ Local MySQL test failed:', err);
    process.exit(1);
  });
}

module.exports = { runLocalMysqlSmokeTest };
