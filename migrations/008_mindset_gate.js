/**
 * Migration 008: Mindset Gate Module
 *
 * Creates MindsetQuotes and MindsetGateLogs tables.
 * Adds gate configuration columns to UserSettings.
 * Idempotent and safe for both SQLite and MySQL (using STRING/VARCHAR, no MySQL ENUMs).
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Create MindsetQuotes Table
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables) ? tables.map((t) => (typeof t === 'string' ? t : t.tableName || Object.values(t)[0])) : [];

    if (!tableNames.includes('MindsetQuotes') && !tableNames.includes('mindsetquotes')) {
      await queryInterface.createTable('MindsetQuotes', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        userId: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        text: {
          type: DataTypes.STRING(300),
          allowNull: false
        },
        author: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
        language: {
          type: DataTypes.STRING(20),
          allowNull: false,
          defaultValue: 'en-IN'
        },
        sortOrder: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        isActive: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      await queryInterface.addIndex('MindsetQuotes', ['userId', 'isActive'], {
        name: 'idx_mindset_quotes_user_active'
      });
    }

    // 2. Create MindsetGateLogs Table
    if (!tableNames.includes('MindsetGateLogs') && !tableNames.includes('mindsetgatelogs')) {
      await queryInterface.createTable('MindsetGateLogs', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        userId: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        gateDate: {
          type: DataTypes.STRING(10), // YYYY-MM-DD
          allowNull: false
        },
        startedAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        method: {
          type: DataTypes.STRING(30), // 'voice', 'typed_fallback', 'mixed'
          allowNull: false,
          defaultValue: 'voice'
        },
        attemptsTotal: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        quotesCompleted: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        quotesTyped: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
          defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
        }
      });

      await queryInterface.addIndex('MindsetGateLogs', ['userId', 'gateDate'], {
        name: 'idx_mindset_gate_logs_user_date'
      });
    }

    // 3. Add gate columns to UserSettings
    const userSettingsTable = await queryInterface.describeTable('UserSettings');

    const columnDefs = {
      gateMode: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'every_session'
      },
      gateResetHour: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      gateLanguage: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'en-IN'
      },
      gateMatchThreshold: {
        type: DataTypes.FLOAT,
        allowNull: false,
        defaultValue: 0.8
      },
      gateFallbackAfterAttempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3
      },
      gateStrictnessEffectiveNextDay: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      pendingGateMode: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      pendingGateMatchThreshold: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      pendingEffectiveDate: {
        type: DataTypes.STRING(10),
        allowNull: true
      }
    };

    for (const [colName, colSpec] of Object.entries(columnDefs)) {
      if (!userSettingsTable[colName]) {
        await queryInterface.addColumn('UserSettings', colName, colSpec);
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('MindsetGateLogs');
    await queryInterface.dropTable('MindsetQuotes');
    // For UserSettings additions, leave columns intact or remove if needed
  }
};
