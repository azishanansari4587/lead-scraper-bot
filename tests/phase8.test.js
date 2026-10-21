import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import ssrfGuard from '../src/services/ssrfGuard';
import runBackup from '../src/scripts/backup';

describe('Phase 8: Security Pass, Docker & Documentation Verification', () => {
  const rootDir = path.resolve(__dirname, '..');

  it('verifies Dockerfile structure, playwright base, and production readiness', () => {
    const dockerfilePath = path.join(rootDir, 'Dockerfile');
    expect(fs.existsSync(dockerfilePath)).toBe(true);

    const dockerfile = fs.readFileSync(dockerfilePath, 'utf8');
    expect(dockerfile).toContain('FROM mcr.microsoft.com/playwright:v1.50.1-jammy');
    expect(dockerfile).toContain('HEALTHCHECK');
    expect(dockerfile).toContain('npm');
  });

  it('verifies .dockerignore properly excludes secrets, dependencies and database files', () => {
    const dockerignorePath = path.join(rootDir, '.dockerignore');
    expect(fs.existsSync(dockerignorePath)).toBe(true);

    const dockerignore = fs.readFileSync(dockerignorePath, 'utf8');
    expect(dockerignore).toContain('node_modules/');
    expect(dockerignore).toContain('.git/');
    expect(dockerignore).toContain('.env');
    expect(dockerignore).toContain('data/*.sqlite*');
  });

  it('verifies docker-compose.yml defines MySQL 8 and application services with volumes', () => {
    const composePath = path.join(rootDir, 'docker-compose.yml');
    expect(fs.existsSync(composePath)).toBe(true);

    const compose = fs.readFileSync(composePath, 'utf8');
    expect(compose).toContain('mysql:');
    expect(compose).toContain('image: mysql:8.0');
    expect(compose).toContain('app:');
    expect(compose).toContain('depends_on:');
    expect(compose).toContain('condition: service_healthy');
    expect(compose).toContain('mysql_data:');
    expect(compose).toContain('app_data:');
  });

  it('verifies comprehensive SECURITY.md documentation exists', () => {
    const securityPath = path.join(rootDir, 'SECURITY.md');
    expect(fs.existsSync(securityPath)).toBe(true);

    const securityDoc = fs.readFileSync(securityPath, 'utf8');
    expect(securityDoc).toContain('Server-Side Request Forgery (SSRF)');
    expect(securityDoc).toContain('CSV / Excel Formula Injection');
    expect(securityDoc).toContain('LLM Prompt Injection');
    expect(securityDoc).toContain('Path Traversal');
    expect(securityDoc).toContain('169.254.169.254');
    expect(securityDoc).toContain('security@knotiqrugs.com');
  });

  it('verifies production DEPLOY.md guide exists', () => {
    const deployPath = path.join(rootDir, 'DEPLOY.md');
    expect(fs.existsSync(deployPath)).toBe(true);

    const deployDoc = fs.readFileSync(deployPath, 'utf8');
    expect(deployDoc).toContain('Docker Compose');
    expect(deployDoc).toContain('npm run migrate');
    expect(deployDoc).toContain('npm run seed');
    expect(deployDoc).toContain('Nginx Reverse Proxy');
  });

  it('verifies executive README.md documentation exists and covers Knotiq Rugs context', () => {
    const readmePath = path.join(rootDir, 'README.md');
    expect(fs.existsSync(readmePath)).toBe(true);

    const readme = fs.readFileSync(readmePath, 'utf8');
    expect(readme).toContain('Knotiq Rugs');
    expect(readme).toContain('Target B2B Buyer Categories');
    expect(readme).toContain('Platform Architecture');
    expect(readme).toContain('Multi-Engine Scraping');
    expect(readme).toContain('0–100 Scoring');
    expect(readme).toContain('Quickstart Guide');
  });

  it('verifies automated backup script executes and produces backup artifacts', async () => {
    const res = await runBackup();
    expect(res.success).toBe(true);
    expect(res.snapshotFile).toBeDefined();
    expect(fs.existsSync(res.snapshotFile)).toBe(true);
  });

  it('verifies SSRF guard strictly blocks internal IPs, metadata endpoints, and non-http schemes', async () => {
    const internalUrls = [
      'http://127.0.0.1:8080/admin',
      'http://localhost:3000',
      'http://10.0.0.1/secrets',
      'http://192.168.1.1/router',
      'http://172.16.0.5/internal',
      'http://169.254.169.254/latest/meta-data/',
      'ftp://ftp.example.com/file',
      'file:///etc/passwd'
    ];

    for (const url of internalUrls) {
      const check = await ssrfGuard.validateUrlForSsrf(url);
      expect(check.isSafe).toBe(false);
    }
  });

  it('verifies .env.example contains all required configuration keys without leaking secrets', () => {
    const examplePath = path.join(rootDir, '.env.example');
    const exampleContent = fs.readFileSync(examplePath, 'utf8');

    const requiredKeys = [
      'PORT',
      'NODE_ENV',
      'CORS_ORIGIN',
      'APP_SECRET',
      'DB_DIALECT',
      'DB_HOST',
      'DB_NAME',
      'DB_USER',
      'DB_PASS',
      'CLERK_SECRET_KEY',
      'CLERK_PUBLISHABLE_KEY',
      'GEMINI_API_KEY',
      'GOOGLE_PLACES_API_KEY',
      'TELEGRAM_BOT_TOKEN',
      'SMTP_HOST',
      'OUTREACH_DAILY_CAP'
    ];

    for (const key of requiredKeys) {
      expect(exampleContent).toContain(`${key}=`);
    }

    // Verify no live production keys in .env.example
    expect(exampleContent).not.toMatch(/AIza[0-9A-Za-z-_]{35}/); // Real Google API keys
    expect(exampleContent).not.toMatch(/sk_live_[0-9A-Za-z]+/); // Real Clerk live secret keys
  });
});
