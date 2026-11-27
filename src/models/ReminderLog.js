const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ReminderLog = sequelize.define('ReminderLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    index: true
  },
  reminderType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  referenceId: {
    type: DataTypes.STRING(100), // e.g. "2026-11-22" for daily brief, or event ID
    allowNull: false
  },
  channel: {
    type: DataTypes.STRING(20),
    defaultValue: 'telegram'
  },
  sentAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'ReminderLogs',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'reminderType', 'referenceId'] }
  ]
});

module.exports = ReminderLog;
