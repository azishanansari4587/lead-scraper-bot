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
const corsOrigins = [
  ...((process.env.DASHBOARD_URL || env.DASHBOARD_URL || env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean)),
  'http://localhost:5173',
  'http://localhost:5000'
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (corsOrigins.some((allowed) => allowed === '*' || origin === allowed || origin.startsWith(allowed))) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']
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
 * Health check endpoint (Public)
 */
app.get('/health', async (req, res) => {
  let dbStatus = 'connected';
  try {
    await sequelize.authenticate();
  } catch (err) {
    dbStatus = 'disconnected';
  }

  const memory = process.memoryUsage();

  res.status(dbStatus === 'connected' ? 200 : 503).json({
    status: dbStatus === 'connected' ? 'ok' : 'degraded',
    service: 'lead-scraper-bot-api',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    database: {
      dialect: env.DB_DIALECT,
      status: dbStatus
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
app.use('/api/sources', requireAuth, sourcesRouter);
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
  logger.error({ reqId: req.id, err }, 'Unhandled request error');

  const statusCode = err.statusCode || 500;
  const isDev = env.NODE_ENV === 'development';

  res.status(statusCode).json({
    error: err.name || 'InternalServerError',
    message: isDev ? err.message : 'An unexpected error occurred.',
    ...(isDev && { stack: err.stack })
  });
});

let server = null;
const schedulerEngine = require('../services/scheduler/schedulerEngine');

if (require.main === module) {
  server = app.listen(env.PORT, async () => {
    logger.info(`🚀 Lead Scraper API server listening on port ${env.PORT} [${env.NODE_ENV}]`);
    try {
      await schedulerEngine.start();
    } catch (schedErr) {
      logger.error({ schedErr: schedErr.message }, 'Failed to start scheduler engine on server boot');
    }
  });

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
