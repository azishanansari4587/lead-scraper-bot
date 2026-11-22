const { DataTypes } = require('sequelize');

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
    // 1. Add isActive to OutreachTemplates (default true)
    await safeAddColumn(queryInterface, 'OutreachTemplates', 'isActive', {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    });
    await safeAddIndex(queryInterface, 'OutreachTemplates', ['userId', 'isActive']);

    // 2. MySQL-safe ENUM expansion for Leads.status (adds sample_sent, quotation, negotiation, repeat_client)
    // In SQLite, ENUM is stored as TEXT, so this raw ALTER is skipped for SQLite
    const db = sequelize || queryInterface.sequelize;
    const dialect = db?.getDialect ? db.getDialect() : (queryInterface.sequelize?.options?.dialect || 'sqlite');

    if (dialect === 'mysql') {
      try {
        await db.query(`
          ALTER TABLE Leads
          MODIFY COLUMN status ENUM(
            'new', 'contacted', 'replied', 'sample_sent', 'quotation',
            'negotiation', 'won', 'lost', 'repeat_client', 'not_interested'
          ) DEFAULT 'new';
        `);
      } catch (err) {
        // Log warning but allow migration to proceed if already modified or restricted
        console.warn('MySQL Leads.status ALTER warning:', err.message);
      }
    }
  },

  down: async () => {
    // Non-destructive down migration
  }
};
