const rateLimit = require('express-rate-limit');
const env = require('../../config/env');

const isTest = env.NODE_ENV === 'test';

// Global API rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 10000 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});

// Stricter limiter for trigger scraping routes
const scrapeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Scraping request limit reached. Please wait before triggering more runs.'
  }
});

// Limiter for export generation
const exportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'Export limit reached. Please wait before requesting additional exports.'
  }
});

// Limiter for AI generation routes
const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isTest ? 1000 : 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too Many Requests',
    message: 'AI request limit reached. Please wait before requesting additional AI drafts.'
  }
});

module.exports = {
  globalLimiter,
  scrapeLimiter,
  exportLimiter,
  aiLimiter
};
