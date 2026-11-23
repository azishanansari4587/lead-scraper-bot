const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Mindmap = sequelize.define('Mindmap', {
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
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  goalText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  targetValue: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  targetUnit: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  deadline: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'active' // 'active', 'archived'
  },
  layoutPref: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'radial' // 'radial', 'horizontal', 'vertical'
  }
}, {
  tableName: 'Mindmaps',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status'] },
    { fields: ['userId', 'createdAt'] }
  ]
});

module.exports = Mindmap;
