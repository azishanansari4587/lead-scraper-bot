const path = require('path');
const fs = require('fs');
const { Sequelize } = require('sequelize');
const env = require('./env');
const logger = require('./logger');

let sequelize;

if (env.DB_DIALECT === 'sqlite') {
  const storagePath = path.resolve(process.cwd(), env.DB_STORAGE);
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
  sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASS, {
    host: env.DB_HOST,
    port: env.DB_PORT,
    dialect: env.DB_DIALECT,
    logging: env.DB_LOGGING ? (msg) => logger.debug({ msg, context: 'sequelize' }) : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    dialectOptions: {
      charset: 'utf8mb4'
    }
  });
}

module.exports = sequelize;
