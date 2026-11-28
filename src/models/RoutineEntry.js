const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoutineEntry = sequelize.define('RoutineEntry', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    index: true
  },
  date: {
    type: DataTypes.STRING(10), // Local YYYY-MM-DD
    allowNull: false
  },
  blockId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  category: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'deep_work'
  },
  isMustDo: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  isProtected: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  linkedTaskId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true
  },
  plannedStart: {
    type: DataTypes.STRING(10), // Local HH:MM
    allowNull: false
  },
  plannedEnd: {
    type: DataTypes.STRING(10), // Local HH:MM
    allowNull: false
  },
  plannedStartAt: {
    type: DataTypes.DATE, // UTC instant
    allowNull: false
  },
  plannedEndAt: {
    type: DataTypes.DATE, // UTC instant (supports crossing midnight)
    allowNull: false
  },
  status: {
    type: DataTypes.STRING(30), // 'pending', 'in_progress', 'done', 'partial', 'skipped', 'missed'
    allowNull: false,
    defaultValue: 'pending'
  },
  actualStart: {
    type: DataTypes.DATE,
    allowNull: true
  },
  actualEnd: {
    type: DataTypes.DATE,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  skipReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  carriedFromEntryId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true
  },
  carryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  escalationLevel: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lastNudgeAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  snoozeCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  lastSnoozeAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  tableName: 'RoutineEntries',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'date'] },
    { fields: ['userId', 'status'] },
    { fields: ['blockId'] },
    { fields: ['carriedFromEntryId'] },
    { fields: ['plannedStartAt', 'plannedEndAt'] }
  ]
});

module.exports = RoutineEntry;
