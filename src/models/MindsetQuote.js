const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MindsetQuote = sequelize.define('MindsetQuote', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  text: {
    type: DataTypes.STRING(300),
    allowNull: false
  },
  author: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  language: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'en-IN'
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'MindsetQuotes',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'isActive'] }
  ]
});

module.exports = MindsetQuote;
