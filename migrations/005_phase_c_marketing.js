const { DataTypes } = require('sequelize');

async function safeCreateTable(queryInterface, tableName, attributes) {
  try {
    await queryInterface.createTable(tableName, attributes);
  } catch (err) {
    const isExists =
      err.name === 'SequelizeDatabaseError' &&
      (err.parent?.code === 'ER_TABLE_EXISTS_ERROR' ||
        err.parent?.errno === 1050 ||
        err.message?.includes('already exists') ||
        err.original?.message?.includes('already exists'));
    if (!isExists) throw err;
  }
}

async function safeAddColumn(queryInterface, tableName, columnName, attribute) {
  try {
    await queryInterface.addColumn(tableName, columnName, attribute);
  } catch (err) {
    const isDup =
      err.parent?.code === 'ER_DUP_FIELDNAME' ||
      err.parent?.errno === 1060 ||
      err.message?.includes('duplicate column') ||
      err.message?.includes('already exists');
    if (!isDup) throw err;
  }
}

async function safeAddIndex(queryInterface, tableName, fields, options = {}) {
  try {
    await queryInterface.addIndex(tableName, fields, options);
  } catch (err) {
    const isDup =
      err.parent?.code === 'ER_DUP_KEYNAME' ||
      err.parent?.errno === 1061 ||
      err.message?.includes('already exists') ||
      err.message?.includes('Duplicate key name');
    if (!isDup) throw err;
  }
}

module.exports = {
  up: async (queryInterface, sequelize) => {
    // 1. Create ContentPosts table (Content Calendar & Manual Metrics)
    await safeCreateTable(queryInterface, 'ContentPosts', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      platform: {
        type: DataTypes.STRING(50),
        defaultValue: 'instagram'
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      topic: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      caption: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      hashtags: {
        type: DataTypes.STRING(500),
        allowNull: true
      },
      assetLink: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(30),
        defaultValue: 'idea'
      },
      campaignId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      postedUrl: {
        type: DataTypes.STRING(1000),
        allowNull: true
      },
      postedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      impressions: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      likes: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      comments: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      saves: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      clicks: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      leadsGenerated: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    await safeAddIndex(queryInterface, 'ContentPosts', ['userId', 'status']);
    await safeAddIndex(queryInterface, 'ContentPosts', ['userId', 'scheduledAt']);
    await safeAddIndex(queryInterface, 'ContentPosts', ['campaignId']);

    // 2. Create Campaigns table
    await safeCreateTable(queryInterface, 'Campaigns', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      goal: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      channel: {
        type: DataTypes.STRING(50),
        defaultValue: 'email'
      },
      targetBuyerType: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      startDate: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      endDate: {
        type: DataTypes.STRING(10),
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(30),
        defaultValue: 'planned'
      },
      budget: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
      },
      currency: {
        type: DataTypes.STRING(10),
        defaultValue: 'AED'
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    await safeAddIndex(queryInterface, 'Campaigns', ['userId', 'status']);
    await safeAddIndex(queryInterface, 'Campaigns', ['userId', 'startDate']);

    // 3. Create CampaignLeads join table (with tenant userId scoping)
    await safeCreateTable(queryInterface, 'CampaignLeads', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
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
      },
      createdAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      },
      updatedAt: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
      }
    });

    await safeAddIndex(queryInterface, 'CampaignLeads', ['campaignId', 'leadId'], { unique: true });
    await safeAddIndex(queryInterface, 'CampaignLeads', ['userId', 'campaignId']);
    await safeAddIndex(queryInterface, 'CampaignLeads', ['userId', 'leadId']);

    // 4. Add deal value & currency to Leads (item 1: Revenue tracking)
    await safeAddColumn(queryInterface, 'Leads', 'dealValue', {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'Leads', 'dealCurrency', {
      type: DataTypes.STRING(10),
      defaultValue: 'AED'
    });

    // 5. Add attribution columns to OutreachLogs
    await safeAddColumn(queryInterface, 'OutreachLogs', 'campaignId', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'OutreachLogs', 'templateId', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await safeAddColumn(queryInterface, 'OutreachLogs', 'variant', {
      type: DataTypes.STRING(10),
      defaultValue: 'A'
    });
    await safeAddIndex(queryInterface, 'OutreachLogs', ['campaignId']);
    await safeAddIndex(queryInterface, 'OutreachLogs', ['templateId', 'variant']);

    // 6. Add attribution columns to Calls
    await safeAddColumn(queryInterface, 'Calls', 'campaignId', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await safeAddIndex(queryInterface, 'Calls', ['campaignId']);

    // 7. Add attribution columns to FollowUps
    await safeAddColumn(queryInterface, 'FollowUps', 'campaignId', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await safeAddIndex(queryInterface, 'FollowUps', ['campaignId']);

    // 8. Add variant, step, and buyerType to OutreachTemplates
    await safeAddColumn(queryInterface, 'OutreachTemplates', 'variant', {
      type: DataTypes.STRING(10),
      defaultValue: 'A'
    });
    await safeAddColumn(queryInterface, 'OutreachTemplates', 'step', {
      type: DataTypes.STRING(50),
      defaultValue: 'day1'
    });
    await safeAddColumn(queryInterface, 'OutreachTemplates', 'buyerType', {
      type: DataTypes.STRING(50),
      allowNull: true
    });
    await safeAddIndex(queryInterface, 'OutreachTemplates', ['buyerType', 'step', 'channel', 'variant']);

    // 9. Add weeklyPostTarget and contentReminderTime to UserSettings
    await safeAddColumn(queryInterface, 'UserSettings', 'weeklyPostTarget', {
      type: DataTypes.INTEGER,
      defaultValue: 5
    });
    await safeAddColumn(queryInterface, 'UserSettings', 'contentReminderTime', {
      type: DataTypes.STRING(10),
      defaultValue: '10:00'
    });

    // 10. Idempotent Backfill: Standardize Lead.source from platform
    // Only updates if source is null, empty, or generic 'scraper', keeping the original platform
    try {
      const db = sequelize || queryInterface.sequelize;
      if (db) {
        await db.query(`
          UPDATE Leads
          SET source = platform
          WHERE (source IS NULL OR source = '' OR source = 'scraper')
            AND platform IS NOT NULL
            AND platform != '';
        `);
      }
    } catch {
      // Graceful fallback if query interface differs
    }
  },

  down: async () => {
    // Production safety: Non-destructive down migrations
  }
};
