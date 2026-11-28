const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoutineBlock = sequelize.define('RoutineBlock', {
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
  templateId: {
    type: DataTypes.INTEGER,
    allowNull: false,
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
  startTime: {
    type: DataTypes.STRING(10), // Local HH:MM
    allowNull: false
  },
  endTime: {
    type: DataTypes.STRING(10), // Local HH:MM
    allowNull: false
  },
  daysOfWeek: {
    type: DataTypes.STRING(50), // JSON array string e.g. "[1,2,3,4,5]"
    allowNull: false,
    defaultValue: '[]'
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
  countsAsWork: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  linkedTaskId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  }
}, {
  tableName: 'RoutineBlocks',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'templateId'] },
    { fields: ['userId', 'category'] },
    { fields: ['linkedTaskId'] }
  ]
});

RoutineBlock.beforeValidate((block) => {
  if (block.countsAsWork === undefined || block.countsAsWork === null) {
    const cat = (block.category || '').toLowerCase().trim();
    // admin, deep_work, sales_outreach, client_calls, marketing default to true
    // learning, health, other, sleep, meals, rest, personal default to false
    block.countsAsWork = ['deep_work', 'admin', 'sales_outreach', 'client_calls', 'marketing'].includes(cat);
  }
});

module.exports = RoutineBlock;
