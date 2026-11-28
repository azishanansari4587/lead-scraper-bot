const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const RoutinePolicy = sequelize.define('RoutinePolicy', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
    allowNull: false
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  escalationEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false // Opt-in
  },
  l1NudgeMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0 // At start time
  },
  l2TelegramMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15
  },
  l3EmailMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 30
  },
  l4FocusLockMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 45
  },
  quietHoursStart: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '22:00'
  },
  quietHoursEnd: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: '07:00'
  },
  maxNudgesPerHour: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2 // Capped per overdue entry
  },
  maxSnoozesPerDay: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3
  },
  focusLockEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  minDailyRestHours: {
    type: DataTypes.FLOAT,
    allowNull: false,
    defaultValue: 7.0
  },
  weeklyRestDay: {
    type: DataTypes.INTEGER, // null = none, 0=Sun..6=Sat
    allowNull: true,
    defaultValue: null // Default is none per amendment 12
  },
  emergencyExitsUsed: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  emergencyExitsMaxPerWeek: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2
  },
  lastEmergencyExitAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  partnerTelegramChatId: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  partnerTelegramUsername: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  partnerOptInStatus: {
    type: DataTypes.STRING(30), // 'none', 'pending', 'confirmed', 'stopped'
    allowNull: false,
    defaultValue: 'none'
  },
  partnerOptInTokenHash: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  partnerTokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  partnerConsentedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  partnerRevokedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  partnerDailySummaryEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  supportedStakes: {
    type: DataTypes.TEXT, // JSON array string e.g. '["restrict_non_essential_pages", "pledge_reminder"]'
    allowNull: true
  },
  pledgeText: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  pendingPolicy: {
    type: DataTypes.TEXT, // JSON string of loosened changes scheduled for tomorrow
    allowNull: true
  },
  pendingEffectiveDate: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: true
  }
}, {
  tableName: 'RoutinePolicies',
  timestamps: true,
  indexes: [
    { fields: ['userId'], unique: true }
  ]
});

module.exports = RoutinePolicy;
