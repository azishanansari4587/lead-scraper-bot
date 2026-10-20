const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Location = sequelize.define('Location', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  countryCode: {
    type: DataTypes.STRING(10),
    allowNull: true
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 10
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  }
}, {
  tableName: 'Locations',
  timestamps: true,
  indexes: [
    { fields: ['country', 'state', 'city'] },
    { fields: ['priority'] }
  ]
});

module.exports = Location;
