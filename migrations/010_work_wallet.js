/**
 * Migration 010: Work Wallet Engine
 *
 * Creates:
 * 1. WalletPolicies
 * 2. WalletStates
 * 3. WorkSchedules
 * 4. WorkWindows
 * 5. WorkSessions
 * 6. WalletBreaks
 * 7. WalletLeaves
 * 8. WalletLedgerEntries (with unique index on userId, date, segmentKey)
 * 9. WalletRewards
 * Adds 'countsAsWork' column to RoutineBlocks.
 *
 * Safe for both SQLite and MySQL (STRING/VARCHAR, no MySQL ENUMs).
 * Fully idempotent.
 */

const { DataTypes } = require('sequelize');

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    const tableNames = Array.isArray(tables)
      ? tables.map((t) => (typeof t === 'string' ? t.toLowerCase() : (t.tableName || Object.values(t)[0] || '').toLowerCase()))
      : [];

    // 1. WalletPolicies Table
    if (!tableNames.includes('walletpolicies')) {
      await queryInterface.createTable('WalletPolicies', {
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
          defaultValue: 480 // 8 hours max session
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

      await queryInterface.addIndex('WalletPolicies', ['userId'], {
        name: 'idx_wallet_policies_user_id',
        unique: true
      });
    }

    // 2. WalletStates Table (Per Amendment 3: balance & settlement state separated)
    if (!tableNames.includes('walletstates')) {
      await queryInterface.createTable('WalletStates', {
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
        balancePaise: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        settledUpTo: {
          type: DataTypes.DATE,
          allowNull: true
        },
        activeSessionId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        activeBreakId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        isPaused: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
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

      await queryInterface.addIndex('WalletStates', ['userId'], {
        name: 'idx_wallet_states_user_id',
        unique: true
      });
    }

    // 3. WorkSchedules Table
    if (!tableNames.includes('workschedules')) {
      await queryInterface.createTable('WorkSchedules', {
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
        assignedDays: {
          type: DataTypes.STRING(50), // "[1,2,3,4,5]"
          allowNull: false,
          defaultValue: '[]'
        },
        isDefault: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        travelStartDate: {
          type: DataTypes.STRING(10),
          allowNull: true
        },
        travelEndDate: {
          type: DataTypes.STRING(10),
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

      await queryInterface.addIndex('WorkSchedules', ['userId', 'isActive'], {
        name: 'idx_work_schedules_user_active'
      });
    }

    // 4. WorkWindows Table
    if (!tableNames.includes('workwindows')) {
      await queryInterface.createTable('WorkWindows', {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false
        },
        scheduleId: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        userId: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        startTime: {
          type: DataTypes.STRING(10), // Local HH:MM
          allowNull: false
        },
        endTime: {
          type: DataTypes.STRING(10), // Local HH:MM
          allowNull: false
        },
        isOvernight: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
        },
        daysOfWeek: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: '[]'
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

      await queryInterface.addIndex('WorkWindows', ['scheduleId'], {
        name: 'idx_work_windows_schedule_id'
      });
      await queryInterface.addIndex('WorkWindows', ['userId', 'isActive'], {
        name: 'idx_work_windows_user_active'
      });
    }

    // 5. WorkSessions Table (Per Amendment 1: server heartbeat & liveness)
    if (!tableNames.includes('worksessions')) {
      await queryInterface.createTable('WorkSessions', {
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
        startAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        endAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        lastHeartbeatAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        source: {
          type: DataTypes.STRING(30),
          allowNull: false,
          defaultValue: 'timer' // 'timer', 'routine_entry', 'manual', 'suggested'
        },
        status: {
          type: DataTypes.STRING(30),
          allowNull: false,
          defaultValue: 'running' // 'running', 'completed', 'paused', 'cancelled'
        },
        linkedTaskId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        linkedRoutineEntryId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        note: {
          type: DataTypes.TEXT,
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

      await queryInterface.addIndex('WorkSessions', ['userId', 'status'], {
        name: 'idx_work_sessions_user_status'
      });
      await queryInterface.addIndex('WorkSessions', ['userId', 'startAt'], {
        name: 'idx_work_sessions_user_start'
      });
    }

    // 6. WalletBreaks Table
    if (!tableNames.includes('walletbreaks')) {
      await queryInterface.createTable('WalletBreaks', {
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
          type: DataTypes.STRING(10), // Local YYYY-MM-DD
          allowNull: false
        },
        startAt: {
          type: DataTypes.DATE,
          allowNull: false
        },
        endAt: {
          type: DataTypes.DATE,
          allowNull: true
        },
        minutes: {
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

      await queryInterface.addIndex('WalletBreaks', ['userId', 'date'], {
        name: 'idx_wallet_breaks_user_date'
      });
    }

    // 7. WalletLeaves Table (Per Amendment 8: sick & travel leave)
    if (!tableNames.includes('walletleaves')) {
      await queryInterface.createTable('WalletLeaves', {
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
        type: {
          type: DataTypes.STRING(30),
          allowNull: false,
          defaultValue: 'sick' // 'sick', 'travel', 'personal'
        },
        reason: {
          type: DataTypes.TEXT,
          allowNull: true
        },
        isExceedingAllowance: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
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

      await queryInterface.addIndex('WalletLeaves', ['userId', 'date'], {
        name: 'idx_wallet_leaves_user_date',
        unique: true
      });
    }

    // 8. WalletLedgerEntries Table (Per Amendments 3, 6, 9, 13)
    if (!tableNames.includes('walletledgerentries')) {
      await queryInterface.createTable('WalletLedgerEntries', {
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
          type: DataTypes.STRING(10), // Local YYYY-MM-DD
          allowNull: false
        },
        segmentKey: {
          type: DataTypes.STRING(150),
          allowNull: false
        },
        type: {
          type: DataTypes.STRING(30),
          allowNull: false // 'earn', 'penalty', 'reward_redeem', 'reward_refund', 'adjustment', 'cap_trim', 'floor_trim'
        },
        amountPaise: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        minutes: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: 0
        },
        windowId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        sessionId: {
          type: DataTypes.INTEGER,
          allowNull: true
        },
        refId: {
          type: DataTypes.STRING(100),
          allowNull: true
        },
        reason: {
          type: DataTypes.STRING(255),
          allowNull: false
        },
        isProvisional: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false
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

      // Unique constraint on (userId, date, segmentKey) prevents double-posting in parallel tabs/requests
      await queryInterface.addIndex('WalletLedgerEntries', ['userId', 'date', 'segmentKey'], {
        name: 'idx_wallet_ledger_user_date_segment',
        unique: true
      });
      await queryInterface.addIndex('WalletLedgerEntries', ['userId', 'date'], {
        name: 'idx_wallet_ledger_user_date'
      });
    }

    // 9. WalletRewards Table
    if (!tableNames.includes('walletrewards')) {
      await queryInterface.createTable('WalletRewards', {
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
        title: {
          type: DataTypes.STRING(100),
          allowNull: false
        },
        description: {
          type: DataTypes.STRING(255),
          allowNull: true
        },
        pricePaise: {
          type: DataTypes.INTEGER,
          allowNull: false
        },
        icon: {
          type: DataTypes.STRING(50),
          allowNull: false,
          defaultValue: 'Gift'
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

      await queryInterface.addIndex('WalletRewards', ['userId', 'isActive'], {
        name: 'idx_wallet_rewards_user_active'
      });
    }

    // 10. Add 'countsAsWork' column to RoutineBlocks (Per Amendment 5)
    try {
      const routineBlocksDef = await queryInterface.describeTable('RoutineBlocks');
      if (!routineBlocksDef.countsAsWork) {
        await queryInterface.addColumn('RoutineBlocks', 'countsAsWork', {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: true
        });
      }
    } catch {
      // Ignore if table not present in tests
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('WalletRewards').catch(() => {});
    await queryInterface.dropTable('WalletLedgerEntries').catch(() => {});
    await queryInterface.dropTable('WalletLeaves').catch(() => {});
    await queryInterface.dropTable('WalletBreaks').catch(() => {});
    await queryInterface.dropTable('WorkSessions').catch(() => {});
    await queryInterface.dropTable('WorkWindows').catch(() => {});
    await queryInterface.dropTable('WorkSchedules').catch(() => {});
    await queryInterface.dropTable('WalletStates').catch(() => {});
    await queryInterface.dropTable('WalletPolicies').catch(() => {});
    try {
      await queryInterface.removeColumn('RoutineBlocks', 'countsAsWork');
    } catch {
      // Ignore
    }
  }
};
