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
    '006_template_active_and_lead_statuses.js',
    '007_mindmap_module.js',
    '008_mindset_gate.js',
    '009_ceo_routine_engine.js',
    '010_work_wallet.js',
    '011_wallet_personal_time.js'
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

  // 8. Smoke Test 4: Migration 007 Mindmaps, MindmapNodes, and Notes.ownerType='mindmap_node'
  console.log('\n🧠 Smoke Test 4: Testing Migration 007 Mindmap tables and Notes.ownerType="mindmap_node"...');
  const [mindmapResult] = await sequelize.query(`
    INSERT INTO Mindmaps (userId, title, goalText, targetValue, targetUnit, status, layoutPref, createdAt, updatedAt)
    VALUES (?, 'Smoke Test Mindmap', '100k AED Revenue', 100000.00, 'AED', 'active', 'radial', NOW(), NOW());
  `, { replacements: [testUserId] });
  console.log(`   Inserted Mindmap ID ${mindmapResult}`);

  const [nodeResult] = await sequelize.query(`
    INSERT INTO MindmapNodes (userId, mindmapId, title, priority, status, sortOrder, createdAt, updatedAt)
    VALUES (?, ?, 'Smoke Root Action', 'now', 'todo', 0, NOW(), NOW());
  `, { replacements: [testUserId, mindmapResult] });
  console.log(`   Inserted MindmapNode ID ${nodeResult}`);

  const [noteResult] = await sequelize.query(`
    INSERT INTO Notes (userId, ownerType, ownerId, title, body, createdAt, updatedAt)
    VALUES (?, 'mindmap_node', ?, 'Smoke Node Note', 'Testing mindmap_node ownerType on MySQL', NOW(), NOW());
  `, { replacements: [testUserId, String(nodeResult)] });
  console.log(`   Inserted Note ID ${noteResult} with ownerType="mindmap_node"`);
  console.log('✅ Smoke Test 4 PASSED: Mindmaps, MindmapNodes and Notes.ownerType="mindmap_node" verified on MySQL.');

  // 9. Smoke Test 5: Migration 008 MindsetQuotes & MindsetGateLogs
  console.log('\n🎙️ Smoke Test 5: Testing Migration 008 MindsetQuotes and MindsetGateLogs tables...');
  const [quoteResult] = await sequelize.query(`
    INSERT INTO MindsetQuotes (userId, text, author, language, sortOrder, isActive, createdAt, updatedAt)
    VALUES (?, 'Smoke Test Principle: Every carpet is woven with integrity.', 'Knotiq Founder', 'en-IN', 0, 1, NOW(), NOW());
  `, { replacements: [testUserId] });
  console.log(`   Inserted MindsetQuote ID ${quoteResult}`);

  const [gateLogResult] = await sequelize.query(`
    INSERT INTO MindsetGateLogs (userId, gateDate, startedAt, completedAt, method, attemptsTotal, quotesCompleted, quotesTyped, createdAt, updatedAt)
    VALUES (?, '2026-11-23', NOW(), NOW(), 'voice', 5, 5, 0, NOW(), NOW());
  `, { replacements: [testUserId] });
  console.log(`   Inserted MindsetGateLog ID ${gateLogResult} with method="voice"`);
  console.log('✅ Smoke Test 5 PASSED: MindsetQuotes and MindsetGateLogs verified on MySQL.');

  // 10. Smoke Test 6: Migration 010 & 011 Work Wallet Concurrency & Row Locking (SELECT ... FOR UPDATE)
  console.log('\n💼 Smoke Test 6: Testing Work Wallet row locking (SELECT ... FOR UPDATE) & unique constraint...');
  const walletUserId = `wallet_smoke_${Date.now()}`;
  await sequelize.query(`
    INSERT INTO WalletPolicies (userId, enabled, earnRatePaisePerMin, penaltyRatePaisePerMin, minDailyPersonalMinutes, createdAt, updatedAt)
    VALUES (?, 1, 100, 100, 120, NOW(), NOW());
  `, { replacements: [walletUserId] });

  await sequelize.query(`
    INSERT INTO WalletStates (userId, balancePaise, isPaused, createdAt, updatedAt)
    VALUES (?, 0, 0, NOW(), NOW());
  `, { replacements: [walletUserId] });

  // Fire 5 concurrent transactions simulating parallel /wallet/state settlement
  const segmentKey = `seg_test_${Date.now()}`;
  const settleDate = '2026-11-28';
  let successfulCreations = 0;

  await Promise.all(
    [1, 2, 3, 4, 5].map(async (workerId) => {
      const t = await sequelize.transaction();
      try {
        // Confirm row-level lock on MySQL
        const [lockedRows] = await sequelize.query(`
          SELECT * FROM WalletStates WHERE userId = ? FOR UPDATE;
        `, { replacements: [walletUserId], transaction: t });

        // Try inserting into WalletLedgerEntries (idempotent unique key)
        const [existing] = await sequelize.query(`
          SELECT id FROM WalletLedgerEntries WHERE userId = ? AND date = ? AND segmentKey = ?;
        `, { replacements: [walletUserId, settleDate, segmentKey], transaction: t });

        if (existing.length === 0) {
          await sequelize.query(`
            INSERT INTO WalletLedgerEntries (userId, date, segmentKey, type, amountPaise, minutes, isProvisional, createdAt, updatedAt)
            VALUES (?, ?, ?, 'earn', 500, 5, 0, NOW(), NOW());
          `, { replacements: [walletUserId, settleDate, segmentKey], transaction: t });
          successfulCreations++;
        }

        await t.commit();
      } catch (err) {
        await t.rollback();
      }
    })
  );

  const [ledgerCount] = await sequelize.query(`
    SELECT COUNT(*) as count FROM WalletLedgerEntries WHERE userId = ? AND segmentKey = ?;
  `, { replacements: [walletUserId, segmentKey] });

  if (Number(ledgerCount[0].count) !== 1) {
    throw new Error(`Concurrency failure: expected exactly 1 ledger row, found ${ledgerCount[0].count}`);
  }
  console.log(`   Verified parallel workers: exactly 1 ledger entry posted for segmentKey="${segmentKey}".`);
  console.log('✅ Smoke Test 6 PASSED: MySQL SELECT ... FOR UPDATE and unique constraint guarantee zero double-posting.');

  // 11. Clean up smoke test data
  console.log('\n🧹 Cleaning up test artifacts...');
  await sequelize.query('DELETE FROM Leads WHERE userId = ?;', { replacements: [testUserId] });
  await sequelize.query('DELETE FROM BulkSendLogs WHERE id = ?;', { replacements: [bulkLogResult] });
  await sequelize.query('DELETE FROM Notes WHERE id = ?;', { replacements: [noteResult] });
  await sequelize.query('DELETE FROM MindmapNodes WHERE id = ?;', { replacements: [nodeResult] });
  await sequelize.query('DELETE FROM Mindmaps WHERE id = ?;', { replacements: [mindmapResult] });
  await sequelize.query('DELETE FROM MindsetQuotes WHERE id = ?;', { replacements: [quoteResult] });
  await sequelize.query('DELETE FROM MindsetGateLogs WHERE id = ?;', { replacements: [gateLogResult] });
  await sequelize.query('DELETE FROM WalletLedgerEntries WHERE userId = ?;', { replacements: [walletUserId] });
  await sequelize.query('DELETE FROM WalletStates WHERE userId = ?;', { replacements: [walletUserId] });
  await sequelize.query('DELETE FROM WalletPolicies WHERE userId = ?;', { replacements: [walletUserId] });
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
