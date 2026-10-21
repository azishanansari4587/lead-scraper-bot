const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SearchPreset = sequelize.define('SearchPreset', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  leadTypes: {
    type: DataTypes.JSON,
    defaultValue: () => []
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: true
  },
  customKeyword: {
    type: DataTypes.STRING,
    allowNull: true
  },
  minRating: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  minReviews: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  hasWebsite: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hasEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hasPhone: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  hasWhatsapp: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  minScore: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  }
}, {
  tableName: 'SearchPresets',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'name'] }
  ]
});

module.exports = SearchPreset;
