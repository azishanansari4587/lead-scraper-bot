const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserSettings = sequelize.define('UserSettings', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  timezone: {
    type: DataTypes.STRING(50),
    defaultValue: 'Asia/Dubai'
  },
  dailyEmailTarget: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  dailyWhatsappTarget: {
    type: DataTypes.INTEGER,
    defaultValue: 30
  },
  dailyCallTarget: {
    type: DataTypes.INTEGER,
    defaultValue: 20
  },
  notifyTelegram: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  notifyEmail: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  morningBriefTime: {
    type: DataTypes.STRING(10), // HH:mm
    defaultValue: '08:30'
  },
  eveningNudgeTime: {
    type: DataTypes.STRING(10), // HH:mm
    defaultValue: '18:30'
  },
  eventReminderMinutes: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  remindersEnabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  weeklyPostTarget: {
    type: DataTypes.INTEGER,
    defaultValue: 5
  },
  contentReminderTime: {
    type: DataTypes.STRING(10), // HH:mm
    defaultValue: '10:00'
  }
}, {
  tableName: 'UserSettings',
  timestamps: true
});

module.exports = UserSettings;
