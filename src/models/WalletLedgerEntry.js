const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletLedgerEntry = sequelize.define('WalletLedgerEntry', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  date: {
    type: DataTypes.STRING(10), // Local YYYY-MM-DD
    allowNull: false
  },
  segmentKey: {
    type: DataTypes.STRING(150),
    allowNull: false
  },
  type: {
    type: DataTypes.STRING(30),
    allowNull: false // 'earn', 'penalty', 'reward_redeem', 'reward_refund', 'adjustment', 'cap_trim', 'floor_trim'
  },
  amountPaise: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  minutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  windowId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  sessionId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  refId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  reason: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  isProvisional: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'WalletLedgerEntries',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'date', 'segmentKey'],
      unique: true
    },
    {
      fields: ['userId', 'date']
    }
  ]
});

module.exports = WalletLedgerEntry;
