const { Op } = require('sequelize');
const { Lead, ScraperRun, OptOut } = require('../models');
const logger = require('../config/logger');
const { generateDedupeKey, stringSimilarity, mergeLeadData } = require('../services/dedupe');
const { calculateLeadScore } = require('../services/scoring');

const GooglePlacesSource = require('./GooglePlacesSource');
const GoogleMapsScraper = require('./GoogleMapsScraper');
const OverpassSource = require('./OverpassSource');
const IndiaMartScraper = require('./IndiaMartScraper');
const TradeIndiaScraper = require('./TradeIndiaScraper');
const JustdialScraper = require('./JustdialScraper');
const YellowPagesUaeScraper = require('./YellowPagesUaeScraper');
const YelpScraper = require('./YelpScraper');
const YellowPagesScraper = require('./YellowPagesScraper');
const HouzzScraper = require('./HouzzScraper');
const EuropagesScraper = require('./EuropagesScraper');
const AlibabaScraper = require('./AlibabaScraper');
const WebsiteEnricher = require('./WebsiteEnricher');

class ScraperManager {
  constructor() {
    this.scrapers = new Map();
    this.enricher = new WebsiteEnricher();

    // Register all tier 1 & 2 sources
    this.registerScraper(new GooglePlacesSource());
    this.registerScraper(new GoogleMapsScraper());
    this.registerScraper(new OverpassSource());
    this.registerScraper(new IndiaMartScraper());
    this.registerScraper(new TradeIndiaScraper());
    this.registerScraper(new JustdialScraper());
    this.registerScraper(new YellowPagesUaeScraper());
    this.registerScraper(new YelpScraper());
    this.registerScraper(new YellowPagesScraper());
    this.registerScraper(new HouzzScraper());
    this.registerScraper(new EuropagesScraper());
    this.registerScraper(new AlibabaScraper());
  }

  registerScraper(scraperInstance) {
    this.scrapers.set(scraperInstance.name, scraperInstance);
    logger.debug(`Registered scraper: ${scraperInstance.name}`);
  }

  getScraper(name) {
    return this.scrapers.get(name);
  }

  listScrapers() {
    return Array.from(this.scrapers.values()).map((s) => ({
      name: s.name,
      enabled: s.enabled
    }));
  }

  toggleScraper(name, enabled) {
    const s = this.scrapers.get(name);
    if (s) {
      s.enabled = Boolean(enabled);
      return true;
    }
    return false;
  }

  /**
   * Checks if lead is present in the OptOut suppression list (batched query)
   * @param {object} lead
   * @returns {Promise<boolean>}
   */
  async isOptedOut(lead) {
    const orConditions = [];
    if (lead.email) orConditions.push({ type: 'email', value: lead.email });
    if (lead.email2) orConditions.push({ type: 'email', value: lead.email2 });
    if (lead.domain) orConditions.push({ type: 'domain', value: lead.domain });
    if (lead.phone) orConditions.push({ type: 'phone', value: lead.phone });

    if (orConditions.length === 0) return false;

    const match = await OptOut.findOne({
      where: {
        [Op.or]: orConditions
      },
      attributes: ['id']
    });
    return !!match;
  }

  /**
   * Enriches a lead with website information
   */
  async enrichLead(lead) {
    try {
      const enrichment = await this.enricher.enrichLead(lead);
      if (Object.keys(enrichment).length > 0) {
        // Recalculate score after enrichment
        const updatedLeadData = { ...lead.toJSON(), ...enrichment };
        const scoreResult = calculateLeadScore(updatedLeadData);

        await lead.update({
          ...enrichment,
          score: scoreResult.score,
          scoreReason: scoreResult.scoreReason
        });
        logger.info({ id: lead.id, businessName: lead.businessName, score: scoreResult.score }, 'Lead enriched and re-scored');
        return enrichment;
      }
    } catch (err) {
      logger.warn({ id: lead.id, err: err.message }, 'Failed to enrich lead');
    }
    return {};
  }

  /**
   * Processes and persists a scraped lead with deduplication, scoring, and suppression checks
   */
  async saveOrMergeLead(userId, rawLead, context = {}) {
    // 1. Opt-out check
    if (await this.isOptedOut(rawLead)) {
      logger.info({ businessName: rawLead.businessName }, 'Lead is on OptOut suppression list. Skipping.');
      return { status: 'opted_out' };
    }

    const dedupeKey = rawLead.dedupeKey || generateDedupeKey(rawLead);

    // 2. Exact match by dedupeKey
    let existingLead = await Lead.findOne({
      where: {
        userId,
        dedupeKey
      }
    });

    // 3. Fuzzy match check in same city if no exact dedupeKey match
    if (!existingLead && rawLead.businessName && rawLead.city) {
      const candidates = await Lead.findAll({
        where: {
          userId,
          city: rawLead.city
        },
        attributes: ['id', 'businessName', 'userId', 'dedupeKey', 'city'],
        limit: 50
      });

      for (const candidate of candidates) {
        const similarity = stringSimilarity(candidate.businessName, rawLead.businessName);
        if (similarity >= 0.88) {
          existingLead = await Lead.findByPk(candidate.id);
          logger.debug({ candidate: candidate.businessName, newName: rawLead.businessName, similarity }, 'Fuzzy match found');
          break;
        }
      }
    }

    // 4. Update or Insert
    if (existingLead) {
      const updates = mergeLeadData(existingLead, rawLead);
      const scoreResult = calculateLeadScore({ ...existingLead.toJSON(), ...updates });
      updates.score = scoreResult.score;
      updates.scoreReason = scoreResult.scoreReason;

      await existingLead.update(updates);
      return { status: 'duplicate', lead: existingLead };
    } else {
      const scoreResult = calculateLeadScore(rawLead);
      const created = await Lead.create({
        ...rawLead,
        source: rawLead.source || context.platform || 'manual',
        score: scoreResult.score,
        scoreReason: scoreResult.scoreReason,
        userId,
        dedupeKey,
        firstSeenAt: new Date(),
        lastSeenAt: new Date()
      });
      return { status: 'new', lead: created };
    }
  }

  /**
   * Executes a scraper run for a given platform, keyword, and location
   */
  async runScraper({
    userId = 'dev_user_knotiq',
    platform = 'overpass',
    keyword,
    leadType = 'rug_retailer',
    country = 'UAE',
    state = null,
    city = 'Dubai',
    enrichWebsites = false,
    onProgress = null
  }) {
    const scraper = this.scrapers.get(platform);
    if (!scraper) {
      const errorMsg = `Scraper platform '${platform}' is not registered`;
      logger.error({ platform }, errorMsg);
      return {
        status: 'error',
        count: 0,
        errorMessage: errorMsg,
        foundCount: 0,
        newCount: 0,
        duplicateCount: 0,
        errorCount: 1
      };
    }

    if (!scraper.enabled) {
      const errorMsg = `Scraper engine '${platform}' is disabled`;
      logger.warn({ platform }, errorMsg);
      return {
        status: 'error',
        count: 0,
        errorMessage: errorMsg,
        foundCount: 0,
        newCount: 0,
        duplicateCount: 0,
        errorCount: 0
      };
    }

    const startTime = Date.now();
    logger.info({ platform, keyword, country, city, leadType }, 'Starting scraper run...');

    // Create ScraperRun log entry
    const runLog = await ScraperRun.create({
      userId,
      platform,
      keyword: keyword || leadType,
      country,
      state,
      city,
      status: 'running'
    });

    let foundCount = 0;
    let newCount = 0;
    let duplicateCount = 0;
    let errorCount = 0;
    let errorMessage = null;

    scraper.lastError = null;
    scraper.isBlocked = false;

    try {
      const rawLeads = await scraper.scrape({
        keyword,
        country,
        state,
        city,
        leadType
      });

      foundCount = rawLeads.length;

      for (const raw of rawLeads) {
        try {
          const result = await this.saveOrMergeLead(userId, raw, { country, state, city, leadType, platform });
          if (result.status === 'new') {
            newCount++;
            if (enrichWebsites && result.lead?.website) {
              await this.enrichLead(result.lead);
            }
          } else if (result.status === 'duplicate') {
            duplicateCount++;
          }

          if (onProgress) {
            onProgress({
              foundCount,
              newCount,
              duplicateCount,
              currentLead: raw.businessName
            });
          }
        } catch (leadErr) {
          errorCount++;
          logger.error({ leadErr: leadErr.message, name: raw.businessName }, 'Error saving lead');
        }
      }

      const durationMs = Date.now() - startTime;
      let status = foundCount > 0 ? 'ok' : 'empty';
      if (foundCount === 0) {
        if (scraper.isBlocked) {
          status = 'blocked';
          errorMessage = scraper.lastError || `Scraper engine '${platform}' was blocked by anti-bot challenge`;
        } else if (scraper.lastError) {
          status = 'error';
          errorMessage = scraper.lastError;
        } else if (!errorMessage) {
          errorMessage = `No leads found by ${platform} for query "${keyword || leadType}" in ${city}, ${country}`;
        }
      }
      scraper.lastError = null;
      scraper.isBlocked = false;

      await runLog.update({
        status,
        foundCount,
        newCount,
        duplicateCount,
        errorCount,
        errorMessage: errorMessage || null,
        durationMs
      });

      logger.info({ platform, status, foundCount, newCount, duplicateCount, durationMs }, 'Scraper run completed');
      return {
        runId: runLog.id,
        platform,
        status,
        count: foundCount,
        errorMessage: errorMessage || null,
        foundCount,
        newCount,
        duplicateCount,
        errorCount,
        durationMs
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      errorMessage = err.message;
      const isBlocked = /blocked|captcha|403|cloudflare|perimeterx|challenge/i.test(errorMessage) || scraper.isBlocked;
      const status = isBlocked ? 'blocked' : 'error';

      await runLog.update({
        status,
        foundCount,
        newCount,
        duplicateCount,
        errorCount: errorCount + 1,
        errorMessage,
        durationMs
      });

      logger.error({ err: errorMessage, platform }, 'Scraper run failed');
      return {
        runId: runLog.id,
        platform,
        status,
        count: foundCount,
        errorMessage,
        foundCount,
        newCount,
        duplicateCount,
        errorCount: errorCount + 1,
        durationMs
      };
    }
  }

  /**
   * Runs all enabled scrapers for a single query and aggregates per-engine results
   */
  async runAllScrapers({
    userId,
    keyword,
    leadType = 'rug_retailer',
    country = 'UAE',
    state = null,
    city = 'Dubai',
    enrichWebsites = false,
    onProgress
  }) {
    const enabledPlatforms = Array.from(this.scrapers.entries())
      .filter(([_, s]) => s.enabled)
      .map(([name]) => name);

    logger.info({ count: enabledPlatforms.length, platforms: enabledPlatforms }, 'Running all enabled scraper engines...');

    const engineResults = [];
    let totalFound = 0;
    let totalNew = 0;
    let totalDuplicates = 0;

    for (const platform of enabledPlatforms) {
      try {
        const result = await this.runScraper({
          userId,
          platform,
          keyword,
          leadType,
          country,
          state,
          city,
          enrichWebsites,
          onProgress
        });
        engineResults.push(result);
        totalFound += result.count ?? result.foundCount ?? 0;
        totalNew += result.newCount ?? 0;
        totalDuplicates += result.duplicateCount ?? 0;
      } catch (err) {
        engineResults.push({
          platform,
          status: 'error',
          count: 0,
          errorMessage: err.message,
          foundCount: 0,
          newCount: 0,
          duplicateCount: 0,
          errorCount: 1,
          durationMs: 0
        });
      }
    }

    return {
      isMultiEngine: true,
      totalFound,
      totalNew,
      totalDuplicates,
      results: engineResults
    };
  }

  /**
   * Tests a single scraper engine connectivity and returns diagnostic status
   */
  async testScraper(platform, options = {}) {
    const scraper = this.scrapers.get(platform);
    if (!scraper) {
      return { platform, status: 'error', errorMessage: `Unknown scraper platform: ${platform}`, count: 0, durationMs: 0 };
    }

    const startTime = Date.now();
    scraper.lastError = null;
    scraper.isBlocked = false;

    try {
      const sample = await scraper.scrape({
        keyword: options.keyword || 'rug store',
        country: options.country || 'UAE',
        city: options.city || 'Dubai',
        leadType: options.leadType || 'rug_retailer'
      });

      const durationMs = Date.now() - startTime;
      const count = sample.length;
      let status = count > 0 ? 'ok' : 'empty';
      let errorMessage = null;

      if (count === 0) {
        if (scraper.isBlocked) {
          status = 'blocked';
          errorMessage = scraper.lastError || `Engine ${platform} is blocked by anti-bot challenge`;
        } else if (scraper.lastError) {
          status = 'error';
          errorMessage = scraper.lastError;
        } else {
          status = 'empty';
          errorMessage = `Engine ${platform} returned 0 results for test query`;
        }
      }

      return {
        platform,
        status,
        count,
        durationMs,
        errorMessage,
        sampleLead: count > 0 ? { businessName: sample[0].businessName, phone: sample[0].phone, city: sample[0].city } : null
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const isBlocked = /blocked|captcha|403|cloudflare|perimeterx|challenge/i.test(err.message) || scraper.isBlocked;
      return {
        platform,
        status: isBlocked ? 'blocked' : 'error',
        count: 0,
        durationMs,
        errorMessage: err.message,
        sampleLead: null
      };
    }
  }
}

module.exports = new ScraperManager();
