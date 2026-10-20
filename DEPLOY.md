# Production Deployment Guide (DEPLOY.md)

This guide covers deploying the **Knotiq Rugs B2B Lead Scraper Platform** to production using Docker Compose, MySQL 8.0, and an optional Nginx SSL reverse proxy.

---

## 1. System Requirements & Prerequisites

- **Host OS:** Linux (Ubuntu 22.04 LTS recommended), macOS, or Windows with Docker Desktop
- **Docker Engine:** v24.0+ & Docker Compose v2.20+
- **Hardware:** 2 vCPU, 4 GB RAM, 20 GB SSD storage minimum
- **Accounts & Keys:**
  - **Clerk Authentication:** `CLERK_PUBLISHABLE_KEY` & `CLERK_SECRET_KEY`
  - **Google Gemini API:** `GEMINI_API_KEY` (for AI qualification and cold email copywriting)
  - **Google Places API (Optional):** `GOOGLE_PLACES_API_KEY`
  - **Telegram Bot (Optional):** `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID`
  - **SMTP Credentials (Optional):** SMTP Host, User, Pass for daily digest emails

---

## 2. Step-by-Step Deployment

### Step 1: Clone Repository & Create Environment Configuration
```bash
git clone https://github.com/knotiq-rugs/lead-scraper-bot.git /opt/lead-scraper-bot
cd /opt/lead-scraper-bot
cp .env.example .env
```

Edit `.env` and set production secrets:
```ini
NODE_ENV=production
PORT=5000
CORS_ORIGIN=https://leads.knotiqrugs.com
APP_SECRET=generate-a-strong-random-64-character-secret
DOWNLOAD_SIGNING_SECRET=generate-a-strong-random-download-secret

# Database
DB_DIALECT=mysql
DB_HOST=mysql
DB_PORT=3306
DB_NAME=lead_scraper_db
DB_USER=knotiq_app
DB_PASS=knotiq_super_secure_db_pass_2026
MYSQL_ROOT_PASSWORD=knotiq_super_secure_root_pass_2026

# Clerk Auth
CLERK_SECRET_KEY=sk_live_...
CLERK_PUBLISHABLE_KEY=pk_live_...
ENABLE_TEST_AUTH=false

# AI & APIs
GEMINI_API_KEY=AIzaSy...
GEMINI_DAILY_LIMIT=150
GOOGLE_PLACES_API_KEY=AIzaSy...
```

### Step 2: Build & Start Services with Docker Compose
```bash
docker compose up -d --build
```

Monitor service startup:
```bash
docker compose ps
docker compose logs -f app
```

### Step 3: Run Database Migrations
Initialize all 10 core tables idempotently in MySQL:
```bash
docker compose exec app npm run migrate
```

### Step 4: Seed International Target Locations & Multilingual Keywords
Seed 65 international export cities (Dubai, Abu Dhabi, London, New York, Riyadh, Sydney, Frankfurt, etc.) and trade keywords:
```bash
docker compose exec app npm run seed
```

### Step 5: Verify Deployment Health
Check the public health endpoint:
```bash
curl -i http://localhost:5000/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "lead-scraper-bot-api",
  "version": "1.0.0",
  "database": {
    "dialect": "mysql",
    "status": "connected"
  }
}
```

---

## 3. Production Nginx Reverse Proxy with SSL (Let's Encrypt)

Place this configuration in `/etc/nginx/sites-available/leads.knotiqrugs.com`:

```nginx
server {
    listen 80;
    server_name leads.knotiqrugs.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name leads.knotiqrugs.com;

    ssl_certificate /etc/letsencrypt/live/leads.knotiqrugs.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/leads.knotiqrugs.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Client upload size (covers custom CSV/imports if enabled)
    client_max_body_size 10M;

    # Gzip Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 4. Automated Backups & Maintenance

### Daily Database Backups
Add a host cron job to execute the built-in backup script daily at 2:00 AM:
```bash
0 2 * * * cd /opt/lead-scraper-bot && docker compose exec -T app npm run backup >> /var/log/knotiq_backup.log 2>&1
```

### Checking Scraper Engine Health
You can run automated self-checks across all Tier 1 & Tier 2 scrapers at any time:
```bash
docker compose exec app npm run check:scrapers
```

### Container Updates & Rolling Restarts
```bash
git pull origin main
docker compose up -d --build
docker compose exec app npm run migrate
```
