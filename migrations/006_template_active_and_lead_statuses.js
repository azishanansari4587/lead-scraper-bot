/**
 * Migration 006: OutreachTemplate isActive & MySQL ENUM Safety Expansion
 *
 * Safe & Idempotent across both SQLite and MySQL:
 * 1. Adds isActive boolean (default true) and index to OutreachTemplates.
 * 2. Ensures BulkSendLogs table exists with status supporting 'simulated'.
 * 3. Safely inspects information_schema on MySQL before modifying Leads.status or BulkSendLogs.status:
 *    - Preserves NOT NULL, DEFAULT, CHARSET, and COLLATION.
 *    - Skips alteration if target enum values already exist.
 *
 * ROLLBACK NOTE (MySQL):
 * If rolling back Leads.status on MySQL to the initial 001 ENUM ('new','contacted','replied','won','lost','not_interested'),
 * any leads currently stored with newer statuses ('sample_sent', 'quotation', 'negotiation', 'repeat_client')
 * must first be updated to an allowed legacy status:
 *   UPDATE Leads SET status = 'contacted' WHERE status IN ('sample_sent', 'quotation', 'negotiation');
 *   UPDATE Leads SET status = 'won' WHERE status = 'repeat_client';
 * followed by:
 *   ALTER TABLE Leads MODIFY COLUMN status ENUM('new','contacted','replied','won','lost','not_interested') DEFAULT 'new';
 */

const { DataTypes } = require('sequelize');

async function safeCreateTable(queryInterface, tableName, attributes) {
  try {
    await queryInterface.createTable(tableName, attributes);
  } catch (err) {
    const isExists =
      err.name === 'SequelizeDatabaseError' &&
      (err.parent?.code === 'ER_TABLE_EXISTS_ERROR' ||
        err.parent?.errno === 1050 ||
        err.message?.includes('already exists') ||
        err.original?.message?.includes('already exists'));
    if (!isExists) throw err;
  }
}

async function safeAddColumn(queryInterface, tableName, columnName, attribute) {
  try {
    await queryInterface.addColumn(tableName, columnName, attribute);
  } catch (err) {
    const isDup =
      err.parent?.code === 'ER_DUP_FIELDNAME' ||
      err.parent?.errno === 1060 ||
      err.message?.includes('duplicate column') ||
      err.message?.includes('already exists');
    if (!isDup) throw err;
  }
}

async function safeAddIndex(queryInterface, tableName, fields, options = {}) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (err) {
    const isDup =
      err.parent?.code === 'ER_DUP_KEYNAME' ||
      err.parent?.errno === 1061 ||
      err.message?.includes('already exists') ||
      err.message?.includes('Duplicate key name');
    if (!isDup) throw err;
  }
}

module.exports = {
  up: async (queryInterface, sequelize) => {
    const db = sequelize || queryInterface.sequelize;
    const dialect = db?.getDialect ? db.getDialect() : (queryInterface.sequelize?.options?.dialect || 'sqlite');

    // 1. Add isActive to OutreachTemplates (default true)
    await safeAddColumn(queryInterface, 'OutreachTemplates', 'isActive', {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    });
    await safeAddIndex(queryInterface, 'OutreachTemplates', ['userId', 'isActive']);

    // 2. Ensure BulkSendLogs table exists (with status supporting 'simulated')
    await safeCreateTable(queryInterface, 'BulkSendLogs', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      jobId: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      leadId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      recipient: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      channel: {
        type: DataTypes.STRING(20),
        allowNull: false
      },
      businessName: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20), // 'sent', 'failed', 'skipped', 'simulated'
        allowNull: false
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      details: {
        type: DataTypes.JSON,
        defaultValue: {}
      },
      sentAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    await safeAddIndex(queryInterface, 'BulkSendLogs', ['jobId']);
    await safeAddIndex(queryInterface, 'BulkSendLogs', ['recipient', 'channel']);
    await safeAddIndex(queryInterface, 'BulkSendLogs', ['status']);
    await safeAddIndex(queryInterface, 'BulkSendLogs', ['sentAt']);

    // 3. MySQL-safe Column Inspection & Alteration
    if (dialect === 'mysql') {
      // --- A. Leads.status inspection & safe alteration ---
      try {
        const [rows] = await db.query(`
          SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_SET_NAME, COLLATION_NAME
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Leads' AND COLUMN_NAME = 'status'
        `);

        if (rows && rows.length > 0) {
          const col = rows[0];
          const currentType = String(col.COLUMN_TYPE || '').toLowerCase();
          const targetValues = ['sample_sent', 'quotation', 'negotiation', 'repeat_client'];
          const missingValues = targetValues.filter((val) => !currentType.includes(val));

          if (col.DATA_TYPE === 'enum' && missingValues.length > 0) {
            const nullClause = col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
            const defaultVal = col.COLUMN_DEFAULT !== null ? col.COLUMN_DEFAULT : 'new';
            const defaultClause = `DEFAULT '${defaultVal}'`;
            const charsetClause = col.CHARACTER_SET_NAME ? `CHARACTER SET ${col.CHARACTER_SET_NAME}` : '';
            const collateClause = col.COLLATION_NAME ? `COLLATE ${col.COLLATION_NAME}` : '';

            await db.query(`
              ALTER TABLE Leads
              MODIFY COLUMN status ENUM(
                'new', 'contacted', 'replied', 'sample_sent', 'quotation',
                'negotiation', 'won', 'lost', 'repeat_client', 'not_interested'
              ) ${charsetClause} ${collateClause} ${nullClause} ${defaultClause};
            `);
          }
        }
      } catch (err) {
        console.warn('MySQL Leads.status inspection/alter warning:', err.message);
      }

      // --- B. BulkSendLogs.status inspection & safe alteration ---
      try {
        const [bulkRows] = await db.query(`
          SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_SET_NAME, COLLATION_NAME, CHARACTER_MAXIMUM_LENGTH
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'BulkSendLogs' AND COLUMN_NAME = 'status'
        `);

        if (bulkRows && bulkRows.length > 0) {
          const col = bulkRows[0];
          const currentType = String(col.COLUMN_TYPE || '').toLowerCase();

          if (col.DATA_TYPE === 'enum' && !currentType.includes('simulated')) {
            const nullClause = col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
            const defaultVal = col.COLUMN_DEFAULT !== null ? col.COLUMN_DEFAULT : 'sent';
            const defaultClause = `DEFAULT '${defaultVal}'`;
            const charsetClause = col.CHARACTER_SET_NAME ? `CHARACTER SET ${col.CHARACTER_SET_NAME}` : '';
            const collateClause = col.COLLATION_NAME ? `COLLATE ${col.COLLATION_NAME}` : '';

            await db.query(`
              ALTER TABLE BulkSendLogs
              MODIFY COLUMN status ENUM('sent', 'failed', 'skipped', 'simulated')
              ${charsetClause} ${collateClause} ${nullClause} ${defaultClause};
            `);
          } else if (col.DATA_TYPE === 'varchar' && col.CHARACTER_MAXIMUM_LENGTH < 20) {
            await db.query(`
              ALTER TABLE BulkSendLogs
              MODIFY COLUMN status VARCHAR(20) NOT NULL DEFAULT 'sent';
            `);
          }
        }
      } catch (err) {
        console.warn('MySQL BulkSendLogs.status inspection/alter warning:', err.message);
      }
    }
  },

  down: async () => {
    // Non-destructive down migration: keeps existing data intact
  }
};
