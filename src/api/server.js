const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const hpp = require('hpp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const env = require('../config/env');
const logger = require('../config/logger');
const sequelize = require('../config/database');
const { globalLimiter } = require('./middleware/rateLimit');

const app = express();

// Security middlewares
app.use(helmet());

const configuredOrigins = (process.env.CORS_ORIGIN || env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const dashboardOrigins = (process.env.DASHBOARD_URL || env.DASHBOARD_URL || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const defaultOrigins = ['http://localhost:5173', 'http://localhost:5000', 'http://127.0.0.1:5173', 'http://127.0.0.1:5000'];
const allowedCorsOrigins = Array.from(new Set([...configuredOrigins, ...dashboardOrigins, ...defaultOrigins]));

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedCorsOrigins.includes('*')) return true;
  if (allowedCorsOrigins.includes(origin)) return true;
  return allowedCorsOrigins.some((allowed) => allowed && (origin === allowed || origin.startsWith(allowed)));
}

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin '${origin}' not allowed by CORS`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-bulk-auth', 'x-request-id', 'x-test-user-id', 'x-test-role']
  })
);
app.use(hpp());

// Body parsers with size limit
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request identification and logging
app.use((req, res, next) => {
  req.id = req.headers['x-request-id'] || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);

  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      reqId: req.id,
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration: `${duration}ms`
    });
  });
  next();
});

// Apply global rate limiter
app.use(globalLimiter);

/**
 * Health check endpoint (Public - responds to both /health and /api/health)
 * Does NOT depend on DB: returns status 200 with ok: true, db: "ok" | "error", uptime.
 */
app.get(['/health', '/api/health'], async (req, res) => {
  let dbStatus = 'ok';
  try {
    await sequelize.authenticate();
  } catch (err) {
    dbStatus = 'error';
    logger.warn({ err: err.message }, 'Database health check probe failed');
  }

  const memory = process.memoryUsage();

  res.status(200).json({
    ok: true,
    status: 'ok',
    db: dbStatus,
    uptime: Math.floor(process.uptime()),
    service: 'lead-scraper-bot-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: {
      dialect: env.DB_DIALECT,
      status: dbStatus === 'ok' ? 'connected' : 'disconnected'
    },
    memory: {
      rssMb: Math.round(memory.rss / 1024 / 1024),
      heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024)
    }
  });
});

// Require authentication middleware and API routers
const { requireAuth } = require('./middleware/auth');
const leadsRouter = require('./routes/leads');
const scrapeRouter = require('./routes/scrape');
const presetsRouter = require('./routes/presets');
const schedulesRouter = require('./routes/schedules');
const exportsRouter = require('./routes/exports');
const sourcesRouter = require('./routes/sources');
const keywordsRouter = require('./routes/keywords');
const locationsRouter = require('./routes/locations');
const outreachRouter = require('./routes/outreach');
const optoutRouter = require('./routes/optout');
const settingsRouter = require('./routes/settings');
const bulkRouter = require('./routes/bulk-send');

// Mount API routes
app.use('/api/leads', requireAuth, leadsRouter);
app.use('/api/scrape', requireAuth, scrapeRouter);
app.use('/api/presets', requireAuth, presetsRouter);
app.use('/api/schedules', requireAuth, schedulesRouter);
app.use('/api/exports', exportsRouter); // handles public token-signed download & authenticated endpoints
app.use('/api/sources', sourcesRouter);
app.use('/api/keywords', requireAuth, keywordsRouter);
app.use('/api/locations', requireAuth, locationsRouter);
app.use('/api/outreach', requireAuth, outreachRouter);
app.use('/api/optout', requireAuth, optoutRouter);
app.use('/api/settings', requireAuth, settingsRouter);
app.use('/api/bulk', bulkRouter); // handles authenticated bulk sending and progress

// Serve uploaded attachments (PDF catalogues, swatch images)
const attachmentsDir = path.resolve(process.cwd(), 'data/attachments');
if (!fs.existsSync(attachmentsDir)) {
  fs.mkdirSync(attachmentsDir, { recursive: true });
}
app.use('/api/attachments', express.static(attachmentsDir));

// Serve static React dashboard in production if built
const dashboardDist = path.resolve(__dirname, '../../dashboard/dist');
if (fs.existsSync(dashboardDist)) {
  app.use(express.static(dashboardDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(dashboardDist, 'index.html'));
  });
}

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.originalUrl}`
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  logger.error({ reqId: req.id, err: err.message, stack: err.stack }, 'Unhandled request error');

  const statusCode = err.statusCode || 500;
  const isDev = env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: isDev ? err.message : (err.message || 'An unexpected error occurred.'),
    ...(isDev && { stack: err.stack })
  });
});

let server = null;
const schedulerEngine = require('../services/scheduler/schedulerEngine');
const runMigrations = require('../scripts/runMigrations');

if (require.main === module) {
  env.validateStartupEnv();

  (async () => {
    // Authenticate database connection with friendly error handling
    try {
      await sequelize.authenticate();
      logger.info(`✅ Connected successfully to ${env.DB_DIALECT} database at ${env.DB_HOST || 'local'}:${env.DB_PORT || 3306}/${env.DB_NAME}`);
    } catch (dbErr) {
      const host = env.DB_HOST || '127.0.0.1';
      const port = env.DB_PORT || 3306;
      const user = env.DB_USER || 'unknown';
      const dbName = env.DB_NAME || 'unknown';
      const errMsg = (dbErr.original?.message || dbErr.message || '').toLowerCase();
      const errCode = dbErr.original?.code || dbErr.code || '';

      console.error('\n======================================================');
      console.error('❌ REMOTE DATABASE CONNECTION FAILED');
      console.error(`   Host: ${host} | Port: ${port} | Database: ${dbName} | User: ${user}`);
      console.error('------------------------------------------------------');

      if (errCode === 'ER_ACCESS_DENIED_ERROR' || errMsg.includes('access denied')) {
        console.error('   Cause: Access Denied. Possible reasons:');
        console.error('     1. Incorrect DB_USER or DB_PASS in .env.');
        console.error('     2. Your public IP is not whitelisted in Hostinger Remote MySQL.');
        console.error('        -> Go to Hostinger hPanel > Databases > Remote MySQL.');
        console.error('        -> Add your IP or "%" (wildcard) for user ' + user + ' to allow connections.');
      } else if (errCode === 'ETIMEDOUT' || errCode === 'ECONNREFUSED' || errMsg.includes('timed out') || errMsg.includes('connect')) {
        console.error('   Cause: Connection Timed Out / Refused. Possible reasons:');
        console.error(`     1. Host ${host}:${port} is unreachable or blocked by firewall.`);
        console.error('     2. Your public IP is not whitelisted in Hostinger Remote MySQL.');
      } else {
        console.error(`   Cause: ${dbErr.message}`);
      }
      console.error('======================================================\n');
      process.exit(1);
    }

    // Run migrations automatically at boot before app.listen (idempotent)
    try {
      logger.info('Executing automated database migrations before starting server...');
      await runMigrations();
      logger.info('Database migrations verified and up to date.');
    } catch (migErr) {
      logger.error({ err: migErr.message }, 'DATABASE MIGRATION FAILED ON BOOT. Check schema permissions.');
      process.exit(1);
    }

    const preferredPort = parseInt(process.env.PORT || env.PORT || '5000', 10);
    const bindHost = process.env.HOST || env.HOST || '127.0.0.1';

    server = app.listen(preferredPort, bindHost, async () => {
      logger.info(`🚀 Lead Scraper API server listening on http://${bindHost}:${preferredPort} [${env.NODE_ENV}]`);
      try {
        await schedulerEngine.start();
      } catch (schedErr) {
        logger.error({ schedErr: schedErr.message }, 'Failed to start scheduler engine on server boot');
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EACCES' && preferredPort === 80) {
        logger.warn('Port 80 requires elevated privileges, falling back to port 5000...');
        server = app.listen(5000, bindHost, async () => {
          logger.info(`🚀 Lead Scraper API server listening on fallback http://${bindHost}:5000`);
        });
      }
    });
  })();

  const gracefulShutdown = async (signal) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    try {
      schedulerEngine.stop();
    } catch (e) {}
    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed.');
        try {
          await sequelize.close();
          logger.info('Database connection closed.');
          process.exit(0);
        } catch (dbErr) {
          logger.error({ dbErr }, 'Error closing database connection');
          process.exit(1);
        }
      });
    } else {
      process.exit(0);
    }
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
}

module.exports = app;
