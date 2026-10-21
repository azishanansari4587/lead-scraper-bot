const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, sequelize) => {
    try {
      await queryInterface.changeColumn('ScraperRuns', 'status', {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'running'
      });
    } catch (err) {
      // In SQLite changeColumn might require raw query or be a no-op
      try {
        await sequelize.query('ALTER TABLE ScraperRuns MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT "running";');
      } catch (e) {
        // fallback ignored
      }
    }
  },

  down: async (queryInterface, sequelize) => {
    // No-op
  }
};
