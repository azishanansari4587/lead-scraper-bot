const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletBreak = sequelize.define('WalletBreak', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    index: true
  },
  date: {
    type: DataTypes.STRING(10), // Local YYYY-MM-DD
    allowNull: false
  },
  startAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  }
}, {
  tableName: 'WalletBreaks',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'date'] }
  ]
});

module.exports = WalletBreak;
