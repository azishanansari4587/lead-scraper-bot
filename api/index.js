/**
 * Vercel Serverless Function Entrypoint for Knotiq Rugs Lead Scraper
 * Exports the Express app instance directly for Vercel Fluid Compute.
 */

const app = require('../src/api/server');

module.exports = app;
