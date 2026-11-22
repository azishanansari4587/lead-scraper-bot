const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CampaignLead = sequelize.define('CampaignLead', {
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
  campaignId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  leadId: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  addedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'CampaignLeads',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['campaignId', 'leadId']
    },
    { fields: ['userId', 'campaignId'] },
    { fields: ['userId', 'leadId'] }
  ]
});

module.exports = CampaignLead;
