const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoutineTemplate = sequelize.define('RoutineTemplate', {
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
  description: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  assignedDays: {
    type: DataTypes.STRING(50), // JSON array string e.g. "[1,2,3,4,5]"
    allowNull: false,
    defaultValue: '[]'
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
  tableName: 'RoutineTemplates',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'isActive'] }
  ]
});

module.exports = RoutineTemplate;
