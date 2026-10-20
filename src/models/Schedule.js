const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Schedule = sequelize.define('Schedule', {
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
  cronExpression: {
    type: DataTypes.STRING,
    allowNull: false
  },
  leadTypes: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  lastRunAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  nextRunAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  lastStatus: {
    type: DataTypes.STRING,
    allowNull: true
  }
}, {
  tableName: 'Schedules',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'enabled'] }
  ]
});

module.exports = Schedule;
