const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FollowUp = sequelize.define('FollowUp', {
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
  dueAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  channel: {
    type: DataTypes.ENUM('email', 'whatsapp', 'call'),
    defaultValue: 'call'
  },
  step: {
    type: DataTypes.STRING(50),
    defaultValue: 'custom' // 'day1', 'day4', 'day7', 'custom'
  },
  status: {
    type: DataTypes.ENUM('pending', 'done', 'skipped', 'cancelled'),
    defaultValue: 'pending'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'FollowUps',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status', 'dueAt'] },
    { fields: ['userId', 'leadId'] },
    { fields: ['userId', 'dueAt'] }
  ]
});

module.exports = FollowUp;
