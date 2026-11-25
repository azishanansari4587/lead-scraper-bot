/**
 * Migration 009: CEO Routine Engine
 *
 * Creates RoutineTemplates, RoutineBlocks, RoutineEntries, and RoutinePolicies tables.
 * Safe for both SQLite and MySQL (using STRING/VARCHAR, no MySQL ENUMs).
 * Idempotent: checks table existence before creating.
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map((t) => (typeof t === 'string' ? t.toLowerCase() : (t.tableName || Object.values(t)[0] || '').toLowerCase()))
      : [];

    // 1. Create RoutineTemplates Table
    if (!tableNames.includes('routinetemplates')) {
      await queryInterface.createTable('RoutineTemplates', {
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
        name: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        description: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        isDefault: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        assignedDays: {
          type: DataTypes.STRING(50), // JSON array string e.g. "[1,2,3,4,5]"
          allowNull: false,
          defaultValue: '[]'
        },
        travelStartDate: {
          type: DataTypes.STRING(10), // YYYY-MM-DD
          allowNull: true
        },
        travelEndDate: {
          type: DataTypes.STRING(10), // YYYY-MM-DD
          allowNull: true
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

      await queryInterface.addIndex('RoutineTemplates', ['userId', 'isActive'], {
        name: 'idx_routine_templates_user_active'
      });
    }

    // 2. Create RoutineBlocks Table
    if (!tableNames.includes('routineblocks')) {
      await queryInterface.createTable('RoutineBlocks', {
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
        templateId: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: 'RoutineTemplates',
            key: 'id'
          },
          onDelete: 'CASCADE'
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        category: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: 'deep_work'
        },
        startTime: {
          type: DataTypes.STRING(10), // Local HH:MM
          allowNull: false
        },
        endTime: {
          type: DataTypes.STRING(10), // Local HH:MM
          allowNull: false
        },
        daysOfWeek: {
          type: DataTypes.STRING(50), // JSON array string e.g. "[1,2,3,4,5]"
          allowNull: false,
          defaultValue: '[]'
        },
        isMustDo: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        isProtected: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        linkedTaskId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'Tasks',
            key: 'id'
          },
          onDelete: 'SET NULL'
        },
        notes: {
          type: DataTypes.TEXT,
          allowNull: true
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

      await queryInterface.addIndex('RoutineBlocks', ['userId', 'templateId'], {
        name: 'idx_routine_blocks_user_template'
      });
      await queryInterface.addIndex('RoutineBlocks', ['userId', 'category'], {
        name: 'idx_routine_blocks_user_category'
      });
      await queryInterface.addIndex('RoutineBlocks', ['linkedTaskId'], {
        name: 'idx_routine_blocks_linked_task'
      });
    }

    // 3. Create RoutineEntries Table
    if (!tableNames.includes('routineentries')) {
      await queryInterface.createTable('RoutineEntries', {
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
        date: {
          type: DataTypes.STRING(10), // YYYY-MM-DD
          allowNull: false
        },
        blockId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'RoutineBlocks',
            key: 'id'
          },
          onDelete: 'SET NULL'
        },
        title: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        category: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: 'deep_work'
        },
        isMustDo: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        isProtected: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        linkedTaskId: {
          type: DataTypes.INTEGER,
          allowNull: true,
          references: {
            model: 'Tasks',
            key: 'id'
          },
          onDelete: 'SET NULL'
        },
        plannedStart: {
          type: DataTypes.STRING(10), // Local HH:MM
          allowNull: false
        },
        plannedEnd: {
          type: DataTypes.STRING(10), // Local HH:MM
          allowNull: false
        },
        plannedStartAt: {
          type: DataTypes.DATE, // UTC instant
          allowNull: false
        },
        plannedEndAt: {
          type: DataTypes.DATE, // UTC instant
          allowNull: false
        },
        status: {
          type: DataTypes.STRING(30), // 'pending', 'in_progress', 'done', 'partial', 'skipped', 'missed'
          allowNull: false,
          defaultValue: 'pending'
        },
        actualStart: {
          type: DataTypes.DATE,
          allowNull: true
        },
        actualEnd: {
          type: DataTypes.DATE,
          allowNull: true
        },
        completedAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        skipReason: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        note: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        carriedFromEntryId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        carryCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        escalationLevel: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        lastNudgeAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        snoozeCount: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        lastSnoozeAt: {
          type: DataTypes.DATE,
          allowNull: true
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

      await queryInterface.addIndex('RoutineEntries', ['userId', 'date'], {
        name: 'idx_routine_entries_user_date'
      });
      await queryInterface.addIndex('RoutineEntries', ['userId', 'status'], {
        name: 'idx_routine_entries_user_status'
      });
      await queryInterface.addIndex('RoutineEntries', ['blockId'], {
        name: 'idx_routine_entries_block'
      });
      await queryInterface.addIndex('RoutineEntries', ['carriedFromEntryId'], {
        name: 'idx_routine_entries_carried'
      });
      await queryInterface.addIndex('RoutineEntries', ['plannedStartAt', 'plannedEndAt'], {
        name: 'idx_routine_entries_planned_window'
      });
    }

    // 4. Create RoutinePolicies Table
    if (!tableNames.includes('routinepolicies')) {
      await queryInterface.createTable('RoutinePolicies', {
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
          defaultValue: false
        },
        l1NudgeMinutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
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
          defaultValue: 2
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
          defaultValue: null
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
          type: DataTypes.TEXT, // JSON string of loosened policy changes
          allowNull: true
        },
        pendingEffectiveDate: {
          type: DataTypes.STRING(10), // YYYY-MM-DD
          allowNull: true
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

      await queryInterface.addIndex('RoutinePolicies', ['userId'], {
        name: 'idx_routine_policies_user',
        unique: true
      });
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('RoutinePolicies').catch(() => {});
    await queryInterface.dropTable('RoutineEntries').catch(() => {});
    await queryInterface.dropTable('RoutineBlocks').catch(() => {});
    await queryInterface.dropTable('RoutineTemplates').catch(() => {});
  }
};
