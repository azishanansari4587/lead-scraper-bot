/**
 * Migration 007: Mindmap Module & Dynamic Schema Expansion
 *
 * Safe & Idempotent across both SQLite and MySQL:
 * 1. Creates Mindmaps table.
 * 2. Creates MindmapNodes table with hierarchical indexes.
 * 3. Adds relatedMindmapNodeId to Tasks table.
 * 4. Safely expands Notes.ownerType ENUM on MySQL by reading current column definition
 *    from information_schema, appending 'mindmap_node', and preserving charset/collation/nullability.
 */

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
    const db = sequelize || queryInterface.sequelize;
    const dialect = db?.getDialect ? db.getDialect() : (queryInterface.sequelize?.options?.dialect || 'sqlite');

    // 1. Create Mindmaps Table
    await safeCreateTable(queryInterface, 'Mindmaps', {
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
      goalText: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      targetValue: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      targetUnit: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      deadline: {
        type: DataTypes.DATE,
        allowNull: true
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'active' // 'active', 'archived'
      },
      layoutPref: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'radial' // 'radial', 'horizontal', 'vertical'
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

    await safeAddIndex(queryInterface, 'Mindmaps', ['userId', 'status']);
    await safeAddIndex(queryInterface, 'Mindmaps', ['userId', 'createdAt']);

    // 2. Create MindmapNodes Table
    await safeCreateTable(queryInterface, 'MindmapNodes', {
      id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      userId: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      mindmapId: {
        type: DataTypes.INTEGER,
        allowNull: false
      },
      parentId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: false
      },
      summary: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      why: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      how: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      dueDate: {
        type: DataTypes.DATE,
        allowNull: true
      },
      owner: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      kpiLabel: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      kpiTarget: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true
      },
      kpiCurrent: {
        type: DataTypes.DECIMAL(12, 2),
        defaultValue: 0.00
      },
      priority: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'now' // 'now', 'next', 'later'
      },
      status: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'todo' // 'todo', 'doing', 'done'
      },
      color: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      icon: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      tags: {
        type: DataTypes.JSON,
        defaultValue: []
      },
      collapsed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
      },
      sortOrder: {
        type: DataTypes.INTEGER,
        defaultValue: 0
      },
      linkedTaskId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      linkedCampaignId: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      linkedLeadId: {
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

    await safeAddIndex(queryInterface, 'MindmapNodes', ['userId', 'mindmapId']);
    await safeAddIndex(queryInterface, 'MindmapNodes', ['mindmapId', 'parentId', 'sortOrder']);
    await safeAddIndex(queryInterface, 'MindmapNodes', ['userId', 'dueDate']);
    await safeAddIndex(queryInterface, 'MindmapNodes', ['linkedTaskId']);
    await safeAddIndex(queryInterface, 'MindmapNodes', ['mindmapId']);

    // 3. Add relatedMindmapNodeId to Tasks
    await safeAddColumn(queryInterface, 'Tasks', 'relatedMindmapNodeId', {
      type: DataTypes.INTEGER,
      allowNull: true
    });
    await safeAddIndex(queryInterface, 'Tasks', ['relatedMindmapNodeId']);

    // 4. Dynamic MySQL Notes.ownerType ENUM expansion (strictly preserving original column attributes)
    if (dialect === 'mysql') {
      try {
        const [rows] = await db.query(`
          SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, CHARACTER_SET_NAME, COLLATION_NAME
          FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'Notes' AND COLUMN_NAME = 'ownerType'
        `);

        if (rows && rows.length > 0) {
          const col = rows[0];
          const currentType = String(col.COLUMN_TYPE || '');
          if (col.DATA_TYPE === 'enum' && !currentType.toLowerCase().includes("'mindmap_node'")) {
            const enumMatch = currentType.match(/^enum\((.*)\)$/i);
            if (enumMatch) {
              const existingValues = enumMatch[1];
              const newEnumDef = `ENUM(${existingValues}, 'mindmap_node')`;
              const nullClause = col.IS_NULLABLE === 'NO' ? 'NOT NULL' : 'NULL';
              const defaultClause = col.COLUMN_DEFAULT !== null ? `DEFAULT '${col.COLUMN_DEFAULT}'` : '';
              const charsetClause = col.CHARACTER_SET_NAME ? `CHARACTER SET ${col.CHARACTER_SET_NAME}` : '';
              const collateClause = col.COLLATION_NAME ? `COLLATE ${col.COLLATION_NAME}` : '';

              await db.query(`
                ALTER TABLE Notes
                MODIFY COLUMN ownerType ${newEnumDef} ${charsetClause} ${collateClause} ${nullClause} ${defaultClause};
              `);
            }
          }
        }
      } catch (err) {
        // Log non-fatal error if information_schema query fails in test stubs
        console.warn('Migration 007 MySQL Notes.ownerType inspection notice:', err.message);
      }
    }
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('MindmapNodes').catch(() => {});
    await queryInterface.dropTable('Mindmaps').catch(() => {});
  }
};
