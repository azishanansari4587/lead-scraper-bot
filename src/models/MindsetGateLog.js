const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MindsetGateLog = sequelize.define('MindsetGateLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  gateDate: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: false
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  method: {
    type: DataTypes.STRING(30), // 'voice', 'typed_fallback', 'mixed'
    allowNull: false,
    defaultValue: 'voice'
  },
  attemptsTotal: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  quotesCompleted: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  quotesTyped: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'MindsetGateLogs',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'gateDate'] }
  ]
});

module.exports = MindsetGateLog;
