const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const DailyReview = sequelize.define('DailyReview', {
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
  date: {
    type: DataTypes.STRING(10), // YYYY-MM-DD
    allowNull: false
  },
  doneSummary: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  win: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  lesson: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tomorrowNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  completedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'DailyReviews',
  timestamps: true,
  indexes: [
    { unique: true, fields: ['userId', 'date'] }
  ]
});

module.exports = DailyReview;
