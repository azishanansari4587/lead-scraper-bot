const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletReward = sequelize.define('WalletReward', {
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
  title: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  pricePaise: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'Gift'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'WalletRewards',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'isActive'] }
  ]
});

module.exports = WalletReward;
