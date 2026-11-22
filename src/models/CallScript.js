const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CallScript = sequelize.define('CallScript', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  buyerType: {
    type: DataTypes.STRING(50),
    allowNull: false
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  scriptText: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  objectionHandling: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tips: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'CallScripts',
  timestamps: true,
  indexes: [
    { fields: ['buyerType'] }
  ]
});

module.exports = CallScript;
