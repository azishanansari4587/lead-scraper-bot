const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const env = require('./env');
const logger = require('./logger');

let sequelize;

function isLocalHost(host) {
  if (!host) return true;
  const clean = String(host).trim().toLowerCase();
  return clean === 'localhost' || clean === '127.0.0.1' || clean === '::1';
}

function validateHostSafety(host) {
  // Check process.env explicitly first so runtime switches and test overrides take precedence
  const allowRemote = process.env.ALLOW_REMOTE_DB !== undefined
    ? process.env.ALLOW_REMOTE_DB === 'true'
    : env.ALLOW_REMOTE_DB === true;

  if (!isLocalHost(host) && !allowRemote) {
    const errorMsg = `[SAFETY GUARD] Refusing database connection to remote host "${host}". Set ALLOW_REMOTE_DB=true to connect to non-local databases.`;
    logger.error({ host }, errorMsg);
    throw new Error(errorMsg);
  }
}

const isTestEnv = process.env.NODE_ENV === 'test';
const databaseUrl = !isTestEnv ? (process.env.DATABASE_URL || env.DATABASE_URL) : '';
const effectiveDialect = isTestEnv ? 'sqlite' : env.DB_DIALECT;

if (databaseUrl) {
  try {
    const parsed = new URL(databaseUrl);
    validateHostSafety(parsed.hostname);
  } catch (urlErr) {
    if (urlErr.message.includes('[SAFETY GUARD]')) throw urlErr;
  }

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
} else if (effectiveDialect === 'sqlite') {
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
  // Validate non-local MySQL connection host
  validateHostSafety(env.DB_HOST);

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

sequelize.isLocalHost = isLocalHost;
sequelize.validateHostSafety = validateHostSafety;

module.exports = sequelize;
