const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WorkSchedule = sequelize.define('WorkSchedule', {
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
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  assignedDays: {
    type: DataTypes.STRING(50), // "[1,2,3,4,5]"
    allowNull: false,
    defaultValue: '[]'
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  travelStartDate: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: true
  },
  travelEndDate: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: true
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'WorkSchedules',
  timestamps: true
});

module.exports = WorkSchedule;
