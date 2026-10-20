# Data Sources & Compliance Registry (SOURCES.md)

This document provides legal, architectural, and operational notes for every data source integrated into **Knotiq Rugs Lead Scraper Bot Platform**.

---

## Source Classification Matrix

| Source Identifier | Platform Name | Tier | Type | Target Regions | Risk Level | Robots.txt Policy | Status & Fallback |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `google_places` | Google Places API | 1 | Official API | Global | **None (Zero Risk)** | API Endpoint | Preferred; requires `GOOGLE_PLACES_API_KEY`. |
| `overpass` | OpenStreetMap Overpass API | 1 | Public API | Global | **None (Zero Risk)** | Free Public API | Public query API with multi-mirror failover and offline fixture fallback. |
| `indiamart` | IndiaMART B2B Directory | 2 | Public Directory | India | **Low** | Respected | Scrapes public business listings. Backs off on block. |
| `tradeindia` | TradeIndia | 2 | Public Directory | India | **Low** | Respected | Scrapes public verified supplier pages. Backs off on block. |
| `justdial` | Justdial | 2 | Public Directory | India | **Low** | Respected | Public business listings. Non-invasive delays. |
| `yellowpages_uae` | Yellow Pages UAE | 2 | Public Directory | UAE / GCC | **Low** | Respected | Public business contact directories. |
| `yellowpages` | YellowPages (US/Global) | 2 | Public Directory | US / Global | **Low** | Respected | Public listings. Stealth headers and delays. |
| `yelp` | Yelp Business Directory | 2 | Public Directory | US, UK, CA, AU | **Medium** | Respected | Anti-bot challenge monitored. Marks `blocked` if challenged. |
| `houzz` | Houzz Pro Directory | 2 | Public Directory | Global | **Low** | Respected | Public professional profiles (architects, designers). |
| `europages` | Europages B2B | 2 | Public Directory | Europe | **Medium** | Respected | B2B supplier directory. Respects anti-bot restrictions. |
| `alibaba` | Alibaba Directory | 2 | Public Directory | Global | **Medium** | Respected | Wholesale public listings. Gracefully backs off if challenged. |
| `website_enricher` | Lead Website Crawler | 3 | Public Website Crawl | Global | **Low** | Respected per domain | Crawls up to 3 public pages (`/`, `/about`, `/contact`). Protected by SSRF Guard. |

---

## Legal & Compliance Guardrails

1. **Only Publicly Listed Business Data**:
   - The platform strictly extracts public B2B business details (Company name, business email, business phone/WhatsApp, address, domain, and product categories).
   - No personal private information is extracted. No login-walled social media profiles are scraped.

2. **Polite Crawling & Rate Limits**:
   - Random human-like delays (1.5s–4.5s) between requests.
   - Per-domain concurrency limit (1–2 requests).
   - Maximum 3 pages per lead domain during website enrichment.

3. **Robots.txt Adherence**:
   - Robots.txt is checked and cached per domain for 24 hours.
   - Any path disallowed by robots.txt is skipped immediately.

4. **Anti-Bot Graceful Degradation**:
   - Never attempts to bypass CAPTCHAs, paywalls, or login walls.
   - If a source responds with a challenge, status is recorded as `blocked` in `ScraperRun`, and the scraper exits cleanly.

5. **SSRF Guard**:
   - All website enrichment requests validate destination hostnames via DNS lookup and block loopback (`127.0.0.0/8`), private networks (`10/8`, `172.16/12`, `192.168/16`), and cloud metadata (`169.254.169.254`).
