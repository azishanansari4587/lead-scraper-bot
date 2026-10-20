const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OptOut = sequelize.define('OptOut', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  type: {
    type: DataTypes.ENUM('email', 'domain', 'phone'),
    allowNull: false
  },
  value: {
    type: DataTypes.STRING,
    allowNull: false
  },
  reason: {
    type: DataTypes.STRING,
    allowNull: true
  },
  requestedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'OptOuts',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['type', 'value']
    }
  ]
});

module.exports = OptOut;
