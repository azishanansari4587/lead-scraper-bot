const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: true // null for system/anonymous actions
  },
  action: {
    type: DataTypes.STRING,
    allowNull: false
  },
  entityType: {
    type: DataTypes.STRING,
    allowNull: true
  },
  entityId: {
    type: DataTypes.STRING,
    allowNull: true
  },
  details: {
    type: DataTypes.JSON,
    defaultValue: {}
  },
  ipAddress: {
    type: DataTypes.STRING,
    allowNull: true
  },
  userAgent: {
    type: DataTypes.STRING(1000),
    allowNull: true
  }
}, {
  tableName: 'AuditLogs',
  timestamps: true,
  updatedAt: false, // Audit logs are append-only
  indexes: [
    { fields: ['userId', 'action'] },
    { fields: ['createdAt'] }
  ]
});

module.exports = AuditLog;
