const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CalendarEvent = sequelize.define('CalendarEvent', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    index: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  startAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  endAt: {
    type: DataTypes.DATE,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM('meeting', 'call_block', 'work_block', 'production', 'shipping', 'other'),
    defaultValue: 'meeting'
  },
  relatedLeadId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  location: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  allDay: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'CalendarEvents',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'startAt', 'endAt'] },
    { fields: ['userId', 'type'] },
    { fields: ['relatedLeadId'] }
  ]
});

module.exports = CalendarEvent;
