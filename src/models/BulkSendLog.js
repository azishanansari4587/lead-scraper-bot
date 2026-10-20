const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const BulkSendLog = sequelize.define('BulkSendLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  jobId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  recipient: {
    type: DataTypes.STRING,
    allowNull: false
  },
  channel: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20), // 'sent', 'failed', 'skipped'
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
  }
}, {
  tableName: 'BulkSendLogs',
  timestamps: true,
  updatedAt: false,
  indexes: [
    { fields: ['jobId'] },
    { fields: ['recipient', 'channel'] },
    { fields: ['status'] },
    { fields: ['sentAt'] }
  ]
});

module.exports = BulkSendLog;
