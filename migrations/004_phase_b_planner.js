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
  up: async (queryInterface) => {
    // 1. Create Tasks table
    await safeCreateTable(queryInterface, 'Tasks', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      category: {
        type: DataTypes.STRING(50),
        defaultValue: 'sales'
      },
      priority: {
        type: DataTypes.STRING(20),
        defaultValue: 'medium'
      },
      dueAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        defaultValue: 'todo'
      },
      isMIT: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      relatedLeadId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      recurrenceRule: {
        type: DataTypes.STRING(30),
        defaultValue: 'none'
      },
      recurrenceParentId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0
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

    await safeAddIndex(queryInterface, 'Tasks', ['userId', 'status', 'dueAt']);
    await safeAddIndex(queryInterface, 'Tasks', ['userId', 'isMIT']);
    await safeAddIndex(queryInterface, 'Tasks', ['relatedLeadId']);
    await safeAddIndex(queryInterface, 'Tasks', ['recurrenceParentId']);

    // 2. Create CalendarEvents table (Internal only)
    await safeCreateTable(queryInterface, 'CalendarEvents', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      startAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      endAt: {
        type: DataTypes.DATE,
        allowNull: false
      },
      type: {
        type: DataTypes.STRING(50),
        defaultValue: 'meeting'
      },
      relatedLeadId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      location: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      allDay: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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

    await safeAddIndex(queryInterface, 'CalendarEvents', ['userId', 'startAt', 'endAt']);
    await safeAddIndex(queryInterface, 'CalendarEvents', ['userId', 'type']);
    await safeAddIndex(queryInterface, 'CalendarEvents', ['relatedLeadId']);

    // 3. Create DailyPlans table
    await safeCreateTable(queryInterface, 'DailyPlans', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      date: {
        type: DataTypes.STRING(10),
        allowNull: false
      },
      mit1: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      mit2: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      mit3: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      mit1TaskId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      mit2TaskId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      mit3TaskId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      outreachTarget: {
        type: DataTypes.INTEGER,
        defaultValue: 20
      },
      callTarget: {
        type: DataTypes.INTEGER,
        defaultValue: 15
      },
      morningNote: {
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

    await safeAddIndex(queryInterface, 'DailyPlans', ['userId', 'date'], { unique: true });

    // 4. Create DailyReviews table
    await safeCreateTable(queryInterface, 'DailyReviews', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      date: {
        type: DataTypes.STRING(10),
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

    await safeAddIndex(queryInterface, 'DailyReviews', ['userId', 'date'], { unique: true });

    // 5. Create ReminderLogs table
    await safeCreateTable(queryInterface, 'ReminderLogs', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      reminderType: {
        type: DataTypes.STRING(50),
        allowNull: false
      },
      referenceId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      channel: {
        type: DataTypes.STRING(20),
        defaultValue: 'telegram'
      },
      sentAt: {
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

    await safeAddIndex(queryInterface, 'ReminderLogs', ['userId', 'reminderType', 'referenceId'], { unique: true });

    // 6. Add reminder columns to UserSettings
    await safeAddColumn(queryInterface, 'UserSettings', 'morningBriefTime', {
      type: DataTypes.STRING(10),
      defaultValue: '08:30'
    });
    await safeAddColumn(queryInterface, 'UserSettings', 'eveningNudgeTime', {
      type: DataTypes.STRING(10),
      defaultValue: '18:30'
    });
    await safeAddColumn(queryInterface, 'UserSettings', 'eventReminderMinutes', {
      type: DataTypes.INTEGER,
      defaultValue: 15
    });
    await safeAddColumn(queryInterface, 'UserSettings', 'remindersEnabled', {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    });
  },

  down: async () => {
    // Production safety: Non-destructive down migrations
  }
};
