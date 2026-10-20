const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ScraperRun = sequelize.define('ScraperRun', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  platform: {
    type: DataTypes.STRING,
    allowNull: false
  },
  keyword: {
    type: DataTypes.STRING,
    allowNull: false
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('running', 'completed', 'failed', 'blocked'),
    defaultValue: 'running'
  },
  foundCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  newCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  duplicateCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  errorCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  debugScreenshot: {
    type: DataTypes.STRING,
    allowNull: true
  },
  durationMs: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'ScraperRuns',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'createdAt'] },
    { fields: ['platform', 'status'] }
  ]
});

module.exports = ScraperRun;
