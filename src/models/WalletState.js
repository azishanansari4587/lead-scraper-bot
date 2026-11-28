const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletState = sequelize.define('WalletState', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  balancePaise: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  settledUpTo: {
    type: DataTypes.DATE,
    allowNull: true
  },
  activeSessionId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  activeBreakId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  isPaused: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'WalletStates',
  timestamps: true
});

module.exports = WalletState;
