const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Campaign = sequelize.define('Campaign', {
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
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  goal: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  channel: {
    type: DataTypes.ENUM(
      'email',
      'whatsapp',
      'instagram',
      'linkedin',
      'trade_show',
      'mixed',
      'other'
    ),
    defaultValue: 'email'
  },
  targetBuyerType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  startDate: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: true
  },
  endDate: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('planned', 'active', 'paused', 'completed', 'archived'),
    defaultValue: 'planned'
  },
  budget: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'AED'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'Campaigns',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status'] },
    { fields: ['userId', 'startDate'] }
  ]
});

module.exports = Campaign;
