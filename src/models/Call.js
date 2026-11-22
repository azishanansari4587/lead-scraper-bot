const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Call = sequelize.define('Call', {
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
    allowNull: false
  },
  direction: {
    type: DataTypes.ENUM('outbound', 'inbound'),
    defaultValue: 'outbound'
  },
  calledAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  durationSec: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  outcome: {
    type: DataTypes.ENUM(
      'connected',
      'no_answer',
      'voicemail',
      'busy',
      'wrong_number',
      'callback_requested',
      'interested',
      'not_interested'
    ),
    defaultValue: 'connected'
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  nextAction: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  nextFollowUpAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  createdBy: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'Calls',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'leadId'] },
    { fields: ['userId', 'calledAt'] },
    { fields: ['userId', 'outcome'] }
  ]
});

module.exports = Call;
