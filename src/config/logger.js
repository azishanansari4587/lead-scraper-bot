const pino = require('pino');
const env = require('./env');

const isDev = env.NODE_ENV === 'development';

const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'secret',
      'token',
      'key',
      'apiKey',
      'CLERK_SECRET_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_PLACES_API_KEY',
      'SMTP_PASS'
    ],
    censor: '[REDACTED]'
  },
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      }
    : undefined
});

module.exports = logger;
