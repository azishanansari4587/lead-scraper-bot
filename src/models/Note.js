const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Note = sequelize.define('Note', {
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
  ownerType: {
    type: DataTypes.ENUM('lead', 'call', 'task', 'campaign', 'general', 'event'),
    defaultValue: 'lead'
  },
  ownerId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: () => []
  },
  pinned: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
}, {
  tableName: 'Notes',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'ownerType', 'ownerId'] },
    { fields: ['userId', 'pinned'] },
    { fields: ['userId', 'createdAt'] }
  ]
});

module.exports = Note;
