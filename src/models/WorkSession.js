const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkSession = sequelize.define('WorkSession', {
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
  startAt: {
    type: DataTypes.DATE, // UTC instant
    allowNull: false
  },
  endAt: {
    type: DataTypes.DATE, // UTC instant, null while running
    allowNull: true
  },
  lastHeartbeatAt: {
    type: DataTypes.DATE, // UTC instant
    allowNull: false
  },
  source: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'timer' // 'timer', 'routine_entry', 'manual', 'suggested'
  },
  status: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: 'running' // 'running', 'completed', 'paused', 'cancelled'
  },
  linkedTaskId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  linkedRoutineEntryId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  note: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'WorkSessions',
  timestamps: true
});

module.exports = WorkSession;
