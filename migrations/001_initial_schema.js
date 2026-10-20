const { DataTypes } = require('sequelize');

async function safeCreateTable(queryInterface, tableName, attributes) {
  try {
    await queryInterface.createTable(tableName, attributes);
  } catch (err) {
    if (!err.message?.includes('already exists')) {
      throw err;
    }
  }
}

async function safeAddIndex(queryInterface, tableName, fields, options = {}) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (err) {
    if (!err.message?.includes('already exists')) {
      throw err;
    }
  }
}

module.exports = {
  up: async (queryInterface) => {
    // 1. Leads Table
    await safeCreateTable(queryInterface, 'Leads', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      businessName: { type: DataTypes.STRING, allowNull: false },
      leadType: { type: DataTypes.STRING, allowNull: false },
      subCategory: { type: DataTypes.STRING, allowNull: true },
      country: { type: DataTypes.STRING, allowNull: false },
      state: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: false },
      address: { type: DataTypes.TEXT, allowNull: true },
      postalCode: { type: DataTypes.STRING, allowNull: true },
      lat: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      lng: { type: DataTypes.DECIMAL(10, 7), allowNull: true },
      phone: { type: DataTypes.STRING, allowNull: true },
      phone2: { type: DataTypes.STRING, allowNull: true },
      whatsapp: { type: DataTypes.STRING, allowNull: true },
      email: { type: DataTypes.STRING, allowNull: true },
      email2: { type: DataTypes.STRING, allowNull: true },
      emailVerified: {
        type: DataTypes.ENUM('unknown', 'syntax_ok', 'mx_ok', 'invalid'),
        defaultValue: 'unknown'
      },
      website: { type: DataTypes.STRING(1000), allowNull: true },
      domain: { type: DataTypes.STRING, allowNull: true },
      googleMapsUrl: { type: DataTypes.STRING(1000), allowNull: true },
      rating: { type: DataTypes.FLOAT, allowNull: true },
      reviewCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      instagram: { type: DataTypes.STRING, allowNull: true },
      facebook: { type: DataTypes.STRING, allowNull: true },
      linkedin: { type: DataTypes.STRING, allowNull: true },
      pinterest: { type: DataTypes.STRING, allowNull: true },
      sellsRugsSignal: { type: DataTypes.BOOLEAN, defaultValue: false },
      productNotes: { type: DataTypes.TEXT, allowNull: true },
      source: { type: DataTypes.STRING, allowNull: false },
      sourceUrl: { type: DataTypes.STRING(1000), allowNull: true },
      language: { type: DataTypes.STRING(10), defaultValue: 'en' },
      score: { type: DataTypes.INTEGER, defaultValue: 0 },
      scoreReason: { type: DataTypes.TEXT, allowNull: true },
      status: {
        type: DataTypes.ENUM('new', 'contacted', 'replied', 'won', 'lost', 'not_interested'),
        defaultValue: 'new'
      },
      notes: { type: DataTypes.TEXT, allowNull: true },
      tags: { type: DataTypes.JSON, defaultValue: [] },
      lastContactedAt: { type: DataTypes.DATE, allowNull: true },
      nextFollowUpAt: { type: DataTypes.DATE, allowNull: true },
      dedupeKey: { type: DataTypes.STRING, allowNull: false },
      firstSeenAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      lastSeenAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await safeAddIndex(queryInterface, 'Leads', ['userId', 'dedupeKey'], { unique: true });
    await safeAddIndex(queryInterface, 'Leads', ['userId', 'country', 'city']);
    await safeAddIndex(queryInterface, 'Leads', ['userId', 'leadType']);
    await safeAddIndex(queryInterface, 'Leads', ['userId', 'score']);

    // 2. ScraperRuns Table
    await safeCreateTable(queryInterface, 'ScraperRuns', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      platform: { type: DataTypes.STRING, allowNull: false },
      keyword: { type: DataTypes.STRING, allowNull: false },
      country: { type: DataTypes.STRING, allowNull: false },
      state: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: false },
      status: {
        type: DataTypes.ENUM('running', 'completed', 'failed', 'blocked'),
        defaultValue: 'running'
      },
      foundCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      newCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      duplicateCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      errorCount: { type: DataTypes.INTEGER, defaultValue: 0 },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      debugScreenshot: { type: DataTypes.STRING, allowNull: true },
      durationMs: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 3. Schedules Table
    await safeCreateTable(queryInterface, 'Schedules', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      cronExpression: { type: DataTypes.STRING, allowNull: false },
      leadTypes: { type: DataTypes.JSON, defaultValue: [] },
      country: { type: DataTypes.STRING, allowNull: false },
      state: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: false },
      enabled: { type: DataTypes.BOOLEAN, defaultValue: true },
      lastRunAt: { type: DataTypes.DATE, allowNull: true },
      nextRunAt: { type: DataTypes.DATE, allowNull: true },
      lastStatus: { type: DataTypes.STRING, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 4. SearchPresets Table
    await safeCreateTable(queryInterface, 'SearchPresets', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      leadTypes: { type: DataTypes.JSON, defaultValue: [] },
      country: { type: DataTypes.STRING, allowNull: false },
      state: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: true },
      customKeyword: { type: DataTypes.STRING, allowNull: true },
      minRating: { type: DataTypes.FLOAT, allowNull: true },
      minReviews: { type: DataTypes.INTEGER, allowNull: true },
      hasWebsite: { type: DataTypes.BOOLEAN, defaultValue: false },
      hasEmail: { type: DataTypes.BOOLEAN, defaultValue: false },
      hasPhone: { type: DataTypes.BOOLEAN, defaultValue: false },
      hasWhatsapp: { type: DataTypes.BOOLEAN, defaultValue: false },
      minScore: { type: DataTypes.INTEGER, defaultValue: 0 },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 5. KeywordSets Table
    await safeCreateTable(queryInterface, 'KeywordSets', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      leadType: { type: DataTypes.STRING, allowNull: false },
      keywords: { type: DataTypes.JSON, defaultValue: [] },
      language: { type: DataTypes.STRING(10), defaultValue: 'en' },
      description: { type: DataTypes.STRING, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 6. Locations Table
    await safeCreateTable(queryInterface, 'Locations', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      country: { type: DataTypes.STRING, allowNull: false },
      countryCode: { type: DataTypes.STRING(10), allowNull: true },
      state: { type: DataTypes.STRING, allowNull: true },
      city: { type: DataTypes.STRING, allowNull: false },
      priority: { type: DataTypes.INTEGER, defaultValue: 10 },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 7. ExportJobs Table
    await safeCreateTable(queryInterface, 'ExportJobs', {
      id: { type: DataTypes.STRING, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      format: {
        type: DataTypes.ENUM('csv', 'xlsx', 'pdf', 'json', 'whatsapp'),
        allowNull: false
      },
      status: {
        type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
        defaultValue: 'pending'
      },
      totalRecords: { type: DataTypes.INTEGER, defaultValue: 0 },
      fileName: { type: DataTypes.STRING, allowNull: true },
      filePath: { type: DataTypes.STRING(1000), allowNull: true },
      downloadUrl: { type: DataTypes.STRING(1000), allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: true },
      filters: { type: DataTypes.JSON, defaultValue: {} },
      errorMessage: { type: DataTypes.TEXT, allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 8. AuditLogs Table
    await safeCreateTable(queryInterface, 'AuditLogs', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: true },
      action: { type: DataTypes.STRING, allowNull: false },
      entityType: { type: DataTypes.STRING, allowNull: true },
      entityId: { type: DataTypes.STRING, allowNull: true },
      details: { type: DataTypes.JSON, defaultValue: {} },
      ipAddress: { type: DataTypes.STRING, allowNull: true },
      userAgent: { type: DataTypes.STRING(1000), allowNull: true },
      createdAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 9. OutreachTemplates Table
    await safeCreateTable(queryInterface, 'OutreachTemplates', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.STRING, allowNull: false },
      name: { type: DataTypes.STRING, allowNull: false },
      targetLeadType: { type: DataTypes.STRING, allowNull: true },
      channel: {
        type: DataTypes.ENUM('email', 'whatsapp'),
        defaultValue: 'email'
      },
      subject: { type: DataTypes.STRING, allowNull: true },
      body: { type: DataTypes.TEXT, allowNull: false },
      variables: { type: DataTypes.JSON, defaultValue: [] },
      isDefault: { type: DataTypes.BOOLEAN, defaultValue: false },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    // 10. OptOuts Table
    await safeCreateTable(queryInterface, 'OptOuts', {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      type: {
        type: DataTypes.ENUM('email', 'domain', 'phone'),
        allowNull: false
      },
      value: { type: DataTypes.STRING, allowNull: false },
      reason: { type: DataTypes.STRING, allowNull: true },
      requestedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      createdAt: { type: DataTypes.DATE, allowNull: false },
      updatedAt: { type: DataTypes.DATE, allowNull: false }
    });

    await safeAddIndex(queryInterface, 'OptOuts', ['type', 'value'], { unique: true });
  },

  down: async (queryInterface) => {
    const tables = [
      'OptOuts',
      'OutreachTemplates',
      'AuditLogs',
      'ExportJobs',
      'Locations',
      'KeywordSets',
      'SearchPresets',
      'Schedules',
      'ScraperRuns',
      'Leads'
    ];
    for (const table of tables) {
      await queryInterface.dropTable(table);
    }
  }
};
