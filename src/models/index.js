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
  ReminderLog
};

module.exports = models;
