const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutreachLog = sequelize.define('OutreachLog', {
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
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  channel: {
    type: DataTypes.ENUM('email', 'whatsapp'),
    allowNull: false
  },
  step: {
    type: DataTypes.STRING(50),
    defaultValue: 'day1'
  },
  messageSent: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  sentAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  outcome: {
    type: DataTypes.ENUM('queued', 'sent', 'delivered', 'read', 'failed', 'replied'),
    defaultValue: 'sent'
  },
  recipient: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  providerMessageId: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'OutreachLogs',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'sentAt'] },
    { fields: ['userId', 'channel'] },
    { fields: ['userId', 'leadId'] }
  ]
});

module.exports = OutreachLog;
