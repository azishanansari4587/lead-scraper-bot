const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

// Load environment variables from .env file
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  DASHBOARD_URL: z.string().optional().default(''),
  APP_SECRET: z.string().min(16, 'APP_SECRET must be at least 16 characters').default('super-secure-default-app-secret-32-chars'),
  
  // Database settings
  DB_DIALECT: z.enum(['mysql', 'sqlite', 'postgres', 'mariadb']).default('mysql'),
  DB_HOST: z.string().default('127.0.0.1'),
  DB_PORT: z.coerce.number().default(3306),
  DB_NAME: z.string().default('lead_scraper_db'),
  DB_USER: z.string().default('root'),
  DB_PASS: z.string().default(''),
  DB_STORAGE: z.string().default('./data/dev.sqlite'),
  DB_LOGGING: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),

  // Auth (Clerk)
  CLERK_SECRET_KEY: z.string().optional().default(''),
  CLERK_PUBLISHABLE_KEY: z.string().optional().default(''),
  ENABLE_TEST_AUTH: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),

  // Tier 1 Google Places API
  GOOGLE_PLACES_API_KEY: z.string().optional().default(''),

  // Gemini AI
  GEMINI_API_KEY: z.string().optional().default(''),
  GEMINI_DAILY_LIMIT: z.coerce.number().default(100),

  // Scraper Settings
  SCRAPER_CONCURRENCY: z.coerce.number().min(1).max(10).default(2),
  SCRAPER_HEADLESS: z.preprocess((val) => val !== 'false' && val !== false, z.boolean()).default(true),
  SCRAPER_PROXY_URL: z.string().optional().default(''),
  DOWNLOAD_SIGNING_SECRET: z.string().default('signing-secret-random-32chars-min-key'),

  // Notifications
  TELEGRAM_BOT_TOKEN: z.string().optional().default(''),
  TELEGRAM_CHAT_ID: z.string().optional().default(''),
  SMTP_HOST: z.string().optional().default(''),
  SMTP_PORT: z.coerce.number().optional().default(465),
  SMTP_USER: z.string().optional().default(''),
  SMTP_PASS: z.string().optional().default(''),
  SMTP_FROM: z.string().default('"Knotiq Rugs" <info@knotiqrugs.com>'),
  SENDER_PHONE: z.string().default('+971 582549695'),
  SENDER_WHATSAPP: z.string().default('+971582549695'),

  // WhatsApp Cloud API
  WHATSAPP_TOKEN: z.string().optional().default(''),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional().default(''),
  WHATSAPP_TEMPLATE_NAME: z.string().optional().default(''),
  WHATSAPP_TEMPLATE_LANG: z.string().default('en_US'),

  // Bulk Send Settings & Guardrails
  DAILY_LIMIT: z.coerce.number().default(50),
  DELAY_MS: z.coerce.number().default(3000),
  DEFAULT_COUNTRY_CODE: z.string().default('91'),
  BULK_PASSWORD: z.string().default('knotiq2026'),
  DRY_RUN: z.preprocess((val) => val === 'true' || val === true, z.boolean()).default(false),

  // Guardrails
  OUTREACH_DAILY_CAP: z.coerce.number().default(30),
  DATA_RETENTION_MONTHS: z.coerce.number().default(12),
  DISK_SPACE_THRESHOLD_MB: z.coerce.number().default(500)
});

let parsedEnv;
try {
  parsedEnv = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('❌ Environment validation failed with errors:');
    error.errors.forEach((err) => {
      console.error(`   - ${err.path.join('.')}: ${err.message}`);
    });
    process.exit(1);
  }
  throw error;
}

module.exports = parsedEnv;
