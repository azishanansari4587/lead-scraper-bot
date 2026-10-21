const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const env = require('./env');
const logger = require('./logger');

let sequelize;

const databaseUrl = process.env.DATABASE_URL || env.DATABASE_URL;

if (databaseUrl) {
  logger.info('Connecting to hosted database via DATABASE_URL');
  sequelize = new Sequelize(databaseUrl, {
    logging: env.DB_LOGGING ? (msg) => logger.debug({ msg, context: 'sequelize' }) : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else if (env.DB_DIALECT === 'sqlite') {
  const isVercel = Boolean(process.env.VERCEL);
  const targetStorage = process.env.DB_PATH || env.DB_PATH || (isVercel ? '/tmp/app.db' : env.DB_STORAGE) || './data/app.db';
  const storagePath = path.isAbsolute(targetStorage) ? targetStorage : path.resolve(process.cwd(), targetStorage);
  const dir = path.dirname(storagePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const sqliteShim = require('./sqliteShim');

  sequelize = new Sequelize({
    dialect: 'sqlite',
    dialectModule: sqliteShim,
    storage: storagePath,
    logging: env.DB_LOGGING ? (msg) => logger.debug({ msg, context: 'sequelize' }) : false
  });
} else {
  const connectTimeout = 10000; // 10s timeout for remote DB connections
  sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
    host: env.DB_HOST,
    port: env.DB_PORT || 3306,
    dialect: env.DB_DIALECT,
    logging: env.DB_LOGGING ? (msg) => logger.debug({ msg, context: 'sequelize' }) : false,
    pool: {
      max: 5,
      min: 1,
      acquire: 20000,
      idle: 10000,
      evict: 5000
    },
    dialectOptions: {
      charset: 'utf8mb4',
      connectTimeout: connectTimeout
    }
  });
}

module.exports = sequelize;
