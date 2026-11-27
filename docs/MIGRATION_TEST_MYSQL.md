# Local MySQL Migration & Verification Guide

This document details how to test migrations `003` to `008` against a **LOCAL MySQL 8.0** instance (Docker or local installation) before any production deployment.

> **CRITICAL SAFETY DIRECTIVE:**
> **Never** execute test scripts or development migrations against remote database hosts. The codebase enforces this automatically: connections to non-local MySQL hosts (`DB_HOST` $\ne$ `127.0.0.1` / `localhost`) are refused unless `ALLOW_REMOTE_DB=true` is explicitly provided.

---

## 1. Quickstart with Docker (Recommended)

### Step 1: Start a Local MySQL 8.0 Container
Run the following PowerShell commands to start a local MySQL 8.0 instance on port 3306:

```powershell
docker run --name knotiq-mysql-test `
  -e MYSQL_ROOT_PASSWORD=testroot `
  -e MYSQL_DATABASE=knotiq_local_test `
  -p 3306:3306 -d mysql:8.0
```

Wait ~15 seconds for the MySQL engine to initialize:
```powershell
docker logs -f knotiq-mysql-test
# Press Ctrl+C once you see: "ready for connections. Version: '8.0.x'"
```

---

## 2. (Optional) Restore a Pre-Migration MySQL Dump

If you have a production dump taken prior to migration `003` (e.g. `backup.sql`):

```powershell
Get-Content backup.sql | docker exec -i knotiq-mysql-test mysql -u root -ptestroot knotiq_local_test
```

---

## 3. Run the Automated Migration & Smoke Test Script

The project provides an automated local verification script: [src/scripts/testLocalMysqlMigrations.js](file:///f:/lead-scraper-bot/src/scripts/testLocalMysqlMigrations.js).

This script:
1. Verifies that the target host is strictly `127.0.0.1` or `localhost`.
2. Applies migrations `001` through `007` sequentially.
3. Inspects `information_schema.COLUMNS` to verify:
   - `Leads.status` ENUM contains all 10 statuses.
   - `Notes.ownerType` ENUM contains `'mindmap_node'`.
   - `Mindmaps` and `MindmapNodes` tables exist with correct keys and indexes.
4. Executes live `INSERT` queries for each Phase A/C status and `mindmap_node` Note.
5. Executes live `INSERT` on `BulkSendLogs` with `status: 'simulated'` to prove simulation logs are accepted without error.
6. Executes live `INSERT` on `MindsetQuotes` and `MindsetGateLogs` (Migration 008) to verify Mindset Gate table creation and field types.
7. Automatically cleans up test records.

Run the script in PowerShell:

```powershell
$env:DB_HOST="127.0.0.1"
$env:DB_PORT="3306"
$env:DB_USER="root"
$env:DB_PASS="testroot"
$env:DB_NAME="knotiq_local_test"

node src/scripts/testLocalMysqlMigrations.js
```

### Expected Output
```text
====================================================
🧪 LOCAL MYSQL MIGRATION & SMOKE TEST RUNNER
====================================================
🔌 Target Host: 127.0.0.1:3306 (Database: knotiq_local_test)
✅ Connected to local MySQL instance successfully.

📦 Running Sequential Migrations...
  ⏳ Applying: 001_initial_schema.js...
  ✅ Successfully applied: 001_initial_schema.js
  ⏳ Applying: 002_update_scraper_run_status.js...
  ✅ Successfully applied: 002_update_scraper_run_status.js
  ⏳ Applying: 003_phase_a_crm_tables.js...
  ✅ Successfully applied: 003_phase_a_crm_tables.js
  ⏳ Applying: 004_phase_b_planner.js...
  ✅ Successfully applied: 004_phase_b_planner.js
  ⏳ Applying: 005_phase_c_marketing.js...
  ✅ Successfully applied: 005_phase_c_marketing.js
  ⏳ Applying: 006_template_active_and_lead_statuses.js...
  ✅ Successfully applied: 006_template_active_and_lead_statuses.js

🔍 Smoke Test 1: Inspecting Leads.status column definition in MySQL information_schema...
   DATA_TYPE: enum
   COLUMN_TYPE: enum('new','contacted','replied','sample_sent','quotation','negotiation','won','lost','repeat_client','not_interested')
✅ Smoke Test 1 PASSED: All 10 Lead statuses are present in MySQL ENUM definition.

📝 Smoke Test 2: Testing live INSERT with sample_sent, quotation, negotiation, repeat_client...
   Inserted Lead ID 1 with status="sample_sent"
   Inserted Lead ID 2 with status="quotation"
   Inserted Lead ID 3 with status="negotiation"
   Inserted Lead ID 4 with status="repeat_client"
✅ Smoke Test 2 PASSED: MySQL accepted all Phase A/C statuses without data truncation.

✉️ Smoke Test 3: Testing BulkSendLog INSERT with status="simulated"...
   Inserted BulkSendLog ID 1 with status="simulated"
✅ Smoke Test 3 PASSED: BulkSendLog supports status="simulated" on MySQL.

💼 Smoke Test 6: Testing Work Wallet row locking (SELECT ... FOR UPDATE) & unique constraint...
   Verified parallel workers: exactly 1 ledger entry posted for segmentKey="seg_test_...".
✅ Smoke Test 6 PASSED: MySQL SELECT ... FOR UPDATE and unique constraint guarantee zero double-posting.

🧹 Cleaning up test artifacts...
✅ Cleanup complete.

====================================================
🎉 ALL LOCAL MYSQL MIGRATION TESTS PASSED CLEANLY!
====================================================
```

---

## 4. Work Wallet Concurrency & Row-Level Locking Verification

In Work Wallet settlements, concurrency safety across parallel tabs or simultaneous `/api/wallet/state` calls is guaranteed via a **defense-in-depth triple layer**:
1. **Per-User In-Process Mutex Lock**: Serializes incoming requests per `userId` within Node.js.
2. **MySQL Row-Level Lock (`SELECT ... FOR UPDATE`)**: Inside the database transaction `t`, Sequelize executes `await WalletState.findOne({ where: { userId }, transaction: t, lock: t.LOCK.UPDATE });`. On MySQL (InnoDB), this places an exclusive row lock on the user's `WalletStates` record, forcing any concurrent transactions on another worker or process to wait until commit/rollback.
3. **Database Unique Constraint**: `WalletLedgerEntries` enforces `UNIQUE (userId, date, segmentKey)`. Even if two parallel transactions race past the application tier, MySQL's unique constraint causes duplicate segment inserts to fail gracefully via `findOrCreate`, making double-posting physically impossible.

---

## 5. Teardown

When testing is complete, destroy the local test container:

```powershell
docker stop knotiq-mysql-test
docker rm knotiq-mysql-test
```
