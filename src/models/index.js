const sequelize = require('../config/database');
const Lead = require('./Lead');
const ScraperRun = require('./ScraperRun');
const Schedule = require('./Schedule');
const SearchPreset = require('./SearchPreset');
const KeywordSet = require('./KeywordSet');
const Location = require('./Location');
const ExportJob = require('./ExportJob');
const AuditLog = require('./AuditLog');
const OutreachTemplate = require('./OutreachTemplate');
const OptOut = require('./OptOut');
const BulkSendLog = require('./BulkSendLog');
const Call = require('./Call');
const CallScript = require('./CallScript');
const Note = require('./Note');
const FollowUp = require('./FollowUp');
const OutreachLog = require('./OutreachLog');
const UserSettings = require('./UserSettings');
const Task = require('./Task');
const CalendarEvent = require('./CalendarEvent');
const DailyPlan = require('./DailyPlan');
const DailyReview = require('./DailyReview');
const ReminderLog = require('./ReminderLog');
const ContentPost = require('./ContentPost');
const Campaign = require('./Campaign');
const CampaignLead = require('./CampaignLead');

// Associations (idempotent guard for multi-import/test environments)
if (!Lead.associations?.calls) {
  Lead.hasMany(Call, { foreignKey: 'leadId', as: 'calls' });
}
if (!Call.associations?.lead) {
  Call.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
}

if (!Lead.associations?.followUps) {
  Lead.hasMany(FollowUp, { foreignKey: 'leadId', as: 'followUps' });
}
if (!FollowUp.associations?.lead) {
  FollowUp.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
}

if (!Lead.associations?.outreachLogs) {
  Lead.hasMany(OutreachLog, { foreignKey: 'leadId', as: 'outreachLogs' });
}
if (!OutreachLog.associations?.lead) {
  OutreachLog.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
}

if (!Lead.associations?.tasks) {
  Lead.hasMany(Task, { foreignKey: 'relatedLeadId', as: 'tasks' });
}
if (!Task.associations?.lead) {
  Task.belongsTo(Lead, { foreignKey: 'relatedLeadId', as: 'lead' });
}

if (!Lead.associations?.calendarEvents) {
  Lead.hasMany(CalendarEvent, { foreignKey: 'relatedLeadId', as: 'calendarEvents' });
}
if (!CalendarEvent.associations?.lead) {
  CalendarEvent.belongsTo(Lead, { foreignKey: 'relatedLeadId', as: 'lead' });
}

// Phase C: Campaign & Marketing Associations
if (!Campaign.associations?.campaignLeads) {
  Campaign.hasMany(CampaignLead, { foreignKey: 'campaignId', as: 'campaignLeads' });
}
if (!CampaignLead.associations?.campaign) {
  CampaignLead.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
}
if (!CampaignLead.associations?.lead) {
  CampaignLead.belongsTo(Lead, { foreignKey: 'leadId', as: 'lead' });
}
if (!Lead.associations?.campaignLeads) {
  Lead.hasMany(CampaignLead, { foreignKey: 'leadId', as: 'campaignLeads' });
}
if (!Campaign.associations?.leads) {
  Campaign.belongsToMany(Lead, { through: CampaignLead, foreignKey: 'campaignId', otherKey: 'leadId', as: 'leads' });
}
if (!Lead.associations?.campaigns) {
  Lead.belongsToMany(Campaign, { through: CampaignLead, foreignKey: 'leadId', otherKey: 'campaignId', as: 'campaigns' });
}

if (!Campaign.associations?.posts) {
  Campaign.hasMany(ContentPost, { foreignKey: 'campaignId', as: 'posts' });
}
if (!ContentPost.associations?.campaign) {
  ContentPost.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
}

if (!Campaign.associations?.outreachLogs) {
  Campaign.hasMany(OutreachLog, { foreignKey: 'campaignId', as: 'outreachLogs' });
}
if (!OutreachLog.associations?.campaign) {
  OutreachLog.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
}

if (!Campaign.associations?.calls) {
  Campaign.hasMany(Call, { foreignKey: 'campaignId', as: 'calls' });
}
if (!Call.associations?.campaign) {
  Call.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
}

if (!Campaign.associations?.followUps) {
  Campaign.hasMany(FollowUp, { foreignKey: 'campaignId', as: 'followUps' });
}
if (!FollowUp.associations?.campaign) {
  FollowUp.belongsTo(Campaign, { foreignKey: 'campaignId', as: 'campaign' });
}

const models = {
  sequelize,
  Lead,
  ScraperRun,
  Schedule,
  SearchPreset,
  KeywordSet,
  Location,
  ExportJob,
  AuditLog,
  OutreachTemplate,
  OptOut,
  BulkSendLog,
  Call,
  CallScript,
  Note,
  FollowUp,
  OutreachLog,
  UserSettings,
  Task,
  CalendarEvent,
  DailyPlan,
  DailyReview,
  ReminderLog,
  ContentPost,
  Campaign,
  CampaignLead
};

module.exports = models;
