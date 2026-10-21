const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const KeywordSet = sequelize.define('KeywordSet', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  leadType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  keywords: {
    type: DataTypes.JSON,
    defaultValue: () => []
  },
  language: {
    type: DataTypes.STRING(10),
    defaultValue: 'en'
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'KeywordSets',
  timestamps: true,
  indexes: [
    { fields: ['leadType', 'language'] }
  ]
});

module.exports = KeywordSet;
