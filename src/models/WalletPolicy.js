const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WalletPolicy = sequelize.define('WalletPolicy', {
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
  earnRatePaisePerMin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100 // 100 paise = 1 INR / min
  },
  penaltyRatePaisePerMin: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100
  },
  overtimeMode: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'none' // 'none', 'half_rate', 'full_rate'
  },
  overtimeCapMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  dailyBreakAllowanceMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 90
  },
  monthlyLeaveAllowanceDays: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 2
  },
  weeklyRestDay: {
    type: DataTypes.INTEGER,
    allowNull: true,
    defaultValue: null // 0=Sun..6=Sat, null = none
  },
  minDailySleepMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 390 // 6.5 hours
  },
  minDailyMealMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60 // 1 hour
  },
  minDailyPersonalMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 120 // 2 hours
  },
  allowNegative: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  floorEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  walletFloorPaise: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  dayCloseGraceHours: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 6
  },
  idleTimeoutMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 10
  },
  idleCheckEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  maxDailyManualMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60
  },
  maxSessionLengthMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 480 // 8 hours max session length
  },
  nudgeThresholdHighHours: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 15
  },
  pendingPolicyJson: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  pendingEffectiveDate: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: true
  }
}, {
  tableName: 'WalletPolicies',
  timestamps: true
});

module.exports = WalletPolicy;
