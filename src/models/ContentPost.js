const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ContentPost = sequelize.define('ContentPost', {
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
  platform: {
    type: DataTypes.ENUM(
      'instagram',
      'linkedin',
      'facebook',
      'pinterest',
      'youtube',
      'blog',
      'newsletter',
      'whatsapp_status',
      'other'
    ),
    defaultValue: 'instagram'
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  topic: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  caption: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  hashtags: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  assetLink: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('idea', 'draft', 'ready', 'scheduled', 'posted', 'skipped'),
    defaultValue: 'idea'
  },
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  postedUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  postedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  impressions: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  likes: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  comments: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  saves: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  clicks: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  leadsGenerated: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  tableName: 'ContentPosts',
  timestamps: true,
  indexes: [
    { fields: ['userId', 'status'] },
    { fields: ['userId', 'scheduledAt'] },
    { fields: ['campaignId'] }
  ]
});

module.exports = ContentPost;
