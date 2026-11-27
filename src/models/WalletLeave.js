const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletLeave = sequelize.define('WalletLeave', {
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
  type: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'sick' // 'sick', 'travel', 'personal'
  },
  reason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isExceedingAllowance: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  }
}, {
  tableName: 'WalletLeaves',
  timestamps: true,
  indexes: [
    {
      fields: ['userId', 'date'],
      unique: true
    }
  ]
});

module.exports = WalletLeave;
