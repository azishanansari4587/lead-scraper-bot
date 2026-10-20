const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Lead = sequelize.define('Lead', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
    index: true
  },
  businessName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  leadType: {
    type: DataTypes.STRING,
    allowNull: false
  },
  subCategory: {
    type: DataTypes.STRING,
    allowNull: true
  },
  country: {
    type: DataTypes.STRING,
    allowNull: false
  },
  state: {
    type: DataTypes.STRING,
    allowNull: true
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  postalCode: {
    type: DataTypes.STRING,
    allowNull: true
  },
  lat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  lng: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true
  },
  phone2: {
    type: DataTypes.STRING,
    allowNull: true
  },
  whatsapp: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true
  },
  email2: {
    type: DataTypes.STRING,
    allowNull: true
  },
  emailVerified: {
    type: DataTypes.ENUM('unknown', 'syntax_ok', 'mx_ok', 'invalid'),
    defaultValue: 'unknown'
  },
  website: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  domain: {
    type: DataTypes.STRING,
    allowNull: true
  },
  googleMapsUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  rating: {
    type: DataTypes.FLOAT,
    allowNull: true
  },
  reviewCount: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  instagram: {
    type: DataTypes.STRING,
    allowNull: true
  },
  facebook: {
    type: DataTypes.STRING,
    allowNull: true
  },
  linkedin: {
    type: DataTypes.STRING,
    allowNull: true
  },
  pinterest: {
    type: DataTypes.STRING,
    allowNull: true
  },
  sellsRugsSignal: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  productNotes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  source: {
    type: DataTypes.STRING,
    allowNull: false
  },
  sourceUrl: {
    type: DataTypes.STRING(1000),
    allowNull: true
  },
  language: {
    type: DataTypes.STRING(10),
    defaultValue: 'en'
  },
  score: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  scoreReason: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('new', 'contacted', 'replied', 'won', 'lost', 'not_interested'),
    defaultValue: 'new'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  tags: {
    type: DataTypes.JSON,
    defaultValue: []
  },
  lastContactedAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  nextFollowUpAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  dedupeKey: {
    type: DataTypes.STRING,
    allowNull: false
  },
  firstSeenAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  lastSeenAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  tableName: 'Leads',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['userId', 'dedupeKey']
    },
    {
      fields: ['userId', 'country', 'city']
    },
    {
      fields: ['userId', 'leadType']
    },
    {
      fields: ['userId', 'score']
    },
    {
      fields: ['userId', 'status']
    }
  ]
});

module.exports = Lead;
