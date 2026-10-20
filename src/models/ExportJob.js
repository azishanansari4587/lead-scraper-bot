const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ExportJob = sequelize.define('ExportJob', {
  id: {
    type: DataTypes.STRING, // UUID / unique string id
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false
  },
  format: {
    type: DataTypes.ENUM('csv', 'xlsx', 'pdf', 'json', 'whatsapp'),
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
    defaultValue: 'pending'
  },
  totalRecords: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  fileName: {
    type: DataTypes.STRING,
    allowNull: true
  },
  filePath: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  downloadUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  expiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  filters: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  errorMessage: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'ExportJobs',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status'] },
    { fields: ['expiresAt'] }
  ]
});

module.exports = ExportJob;
