const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DailyPlan = sequelize.define('DailyPlan', {
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
  date: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: false
  },
  mit1: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  mit2: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  mit3: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  mit1TaskId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  mit2TaskId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  mit3TaskId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  outreachTarget: {
    type: DataTypes.INTEGER,
    defaultValue: 20
  },
  callTarget: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  morningNote: {
    type: DataTypes.TEXT,
    allowNull: true
  }
}, {
  tableName: 'DailyPlans',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'date'] }
  ]
});

module.exports = DailyPlan;
