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
  BulkSendLog
};

module.exports = models;
