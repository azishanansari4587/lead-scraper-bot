const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Task = sequelize.define('Task', {
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
  category: {
    type: DataTypes.ENUM('sales', 'marketing', 'production', 'shipping', 'accounts', 'personal'),
    defaultValue: 'sales'
  },
  priority: {
    type: DataTypes.ENUM('high', 'medium', 'low'),
    defaultValue: 'medium'
  },
  dueAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('todo', 'doing', 'done', 'cancelled'),
    defaultValue: 'todo'
  },
  isMIT: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  relatedLeadId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  recurrenceRule: {
    type: DataTypes.ENUM('none', 'daily', 'weekly', 'monthly', 'weekdays'),
    defaultValue: 'none'
  },
  recurrenceParentId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  relatedMindmapNodeId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'Tasks',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status', 'dueAt'] },
    { fields: ['userId', 'isMIT'] },
    { fields: ['userId', 'category'] },
    { fields: ['relatedLeadId'] },
    { fields: ['recurrenceParentId'] },
    { fields: ['relatedMindmapNodeId'] }
  ]
});

module.exports = Task;
