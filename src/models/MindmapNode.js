const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MindmapNode = sequelize.define('MindmapNode', {
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
  mindmapId: {
    type: DataTypes.INTEGER,
    allowNull: false,
    index: true
  },
  parentId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    index: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  summary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  why: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  how: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dueDate: {
    type: DataTypes.DATE,
    allowNull: true
  },
  owner: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  kpiLabel: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  kpiTarget: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: true
  },
  kpiCurrent: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00
  },
  priority: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'now' // 'now' (gold), 'next' (sky), 'later' (slate)
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'todo' // 'todo', 'doing', 'done'
  },
  color: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  icon: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: () => []
  },
  collapsed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  sortOrder: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  linkedTaskId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  linkedCampaignId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  linkedLeadId: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'MindmapNodes',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'mindmapId'] },
    { fields: ['mindmapId', 'parentId', 'sortOrder'] },
    { fields: ['userId', 'dueDate'] },
    { fields: ['linkedTaskId'] },
    { fields: ['mindmapId'] }
  ]
});

module.exports = MindmapNode;
