const request = require('supertest');
const fs = require('fs');
const path = require('path');
const app = require('../src/api/server');

describe('Phase 6 - React + Vite Dashboard Integration', () => {
  it('serves the built React SPA index.html on root GET /', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('Knotiq Rugs');
    expect(res.text).toContain('id="root"');
  });

  it('serves static assets from dashboard/dist/assets', async () => {
    const distAssetsDir = path.resolve(__dirname, '../dashboard/dist/assets');
    const assetFiles = fs.readdirSync(distAssetsDir);
    const jsFile = assetFiles.find((f) => f.endsWith('.js'));

    expect(jsFile).toBeDefined();

    const res = await request(app).get(`/assets/${jsFile}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('javascript');
  });

  it('preserves API endpoints and does not hijack /health or /api routes', async () => {
    const healthRes = await request(app).get('/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    const apiNotFound = await request(app).get('/api/non-existent-endpoint');
    expect(apiNotFound.status).toBe(404);
    expect(apiNotFound.body.error).toBe('Not Found');
  });

  it('supports SPA client-side routing fallback for dashboard routes', async () => {
    const spaRoutes = ['/overview', '/search', '/leads', '/presets', '/sources', '/exports', '/settings'];

    for (const route of spaRoutes) {
      const res = await request(app).get(route);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('id="root"');
    }
  });
});
