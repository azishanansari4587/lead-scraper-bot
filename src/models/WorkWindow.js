const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkWindow = sequelize.define('WorkWindow', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  scheduleId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    index: true
  },
  startTime: {
    type: DataTypes.STRING(10), // Local HH:MM
    allowNull: false
  },
  endTime: {
    type: DataTypes.STRING(10), // Local HH:MM
    allowNull: false
  },
  isOvernight: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  daysOfWeek: {
    type: DataTypes.STRING(50), // JSON array "[1,2,3,4,5]"
    allowNull: false,
    defaultValue: '[]'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'WorkWindows',
  timestamps: true
});

module.exports = WorkWindow;
