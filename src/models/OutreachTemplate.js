const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OutreachTemplate = sequelize.define('OutreachTemplate', {
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
  targetLeadType: {
    type: DataTypes.STRING,
    allowNull: true // null for all
  },
  buyerType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  step: {
    type: DataTypes.STRING(50),
    defaultValue: 'day1'
  },
  variant: {
    type: DataTypes.STRING(10),
    defaultValue: 'A'
  },
  channel: {
    type: DataTypes.ENUM('email', 'whatsapp'),
    defaultValue: 'email'
  },
  subject: {
    type: DataTypes.STRING,
    allowNull: true
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  variables: {
    type: DataTypes.JSON,
    defaultValue: () => ['businessName', 'city', 'leadType']
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'OutreachTemplates',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'channel'] },
    { fields: ['buyerType', 'step', 'channel', 'variant'] }
  ]
});

module.exports = OutreachTemplate;
