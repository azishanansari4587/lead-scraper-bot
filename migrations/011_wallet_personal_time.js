/**
 * Migration 011: Add minDailyPersonalMinutes to WalletPolicies
 *
 * Safe for both SQLite and MySQL.
 * Fully idempotent.
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    try {
      const tableDef = await queryInterface.describeTable('WalletPolicies');
      if (!tableDef.minDailyPersonalMinutes) {
        await queryInterface.addColumn('WalletPolicies', 'minDailyPersonalMinutes', {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 120 // 2 hours minimum personal time per day
        });
      }
    } catch (err) {
      // Table may not exist yet in certain test setups
    }
  },

  down: async (queryInterface) => {
    try {
      await queryInterface.removeColumn('WalletPolicies', 'minDailyPersonalMinutes');
    } catch {
      // Ignore
    }
  }
};
