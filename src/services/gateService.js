/**
 * Mindset Gate Service
 *
 * Implements:
 * 1. Gate status resolution (setupRequired < 5 quotes, every_session, once_daily, off).
 * 2. Effective local date computation using user's timezone & gateResetHour.
 * 3. Next-day relaxation policy (postponing mode off or lower threshold until next local day).
 * 4. Idempotent in-progress log creation & completion verification.
 * 5. Multi-tenant quote CRUD enforcing max 5 active quotes.
 * 6. Consecutive day mindset streak calculation.
 */

const { Op } = require('sequelize');
const sequelize = require('../config/database');
const MindsetQuote = require('../models/MindsetQuote');
const MindsetGateLog = require('../models/MindsetGateLog');
const UserSettings = require('../models/UserSettings');
const AuditLog = require('../models/AuditLog');
const logger = require('../config/logger');

class GateService {
  /**
   * Computes the effective gate date (YYYY-MM-DD) for a given timestamp,
   * respecting the user's timezone and gateResetHour (default 0).
   * If local hour < gateResetHour, the session is attributed to the previous calendar day.
   */
  getEffectiveDate(date = new Date(), timezone = 'Asia/Dubai', resetHour = 0) {
    const d = new Date(date);

    // Format parts in user's timezone
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(d);
    let year = '';
    let month = '';
    let day = '';
    let hour = 0;

    parts.forEach((p) => {
      if (p.type === 'year') year = p.value;
      if (p.type === 'month') month = p.value;
      if (p.type === 'day') day = p.value;
      if (p.type === 'hour') hour = parseInt(p.value, 10);
    });

    // If local hour < resetHour, roll back 1 day
    if (resetHour > 0 && hour < resetHour) {
      const prevDate = new Date(`${year}-${month}-${day}T12:00:00Z`);
      prevDate.setUTCDate(prevDate.getUTCDate() - 1);
      return prevDate.toISOString().slice(0, 10);
    }

    return `${year}-${month}-${day}`;
  }

  /**
   * Evaluates and applies any pending relaxed settings whose effective date has arrived.
   */
  async reconcilePendingSettings(settings) {
    if (!settings) return settings;

    const tz = settings.timezone || 'Asia/Dubai';
    const todayStr = this.getEffectiveDate(new Date(), tz, settings.gateResetHour || 0);

    if (settings.pendingEffectiveDate && todayStr >= settings.pendingEffectiveDate) {
      const updates = {};
      if (settings.pendingGateMode) {
        updates.gateMode = settings.pendingGateMode;
        updates.pendingGateMode = null;
      }
      if (settings.pendingGateMatchThreshold !== null && settings.pendingGateMatchThreshold !== undefined) {
        updates.gateMatchThreshold = settings.pendingGateMatchThreshold;
        updates.pendingGateMatchThreshold = null;
      }
      updates.pendingEffectiveDate = null;
      await settings.update(updates);
    }

    return settings;
  }

  /**
   * Retrieves gate status for a user.
   */
  async getGateStatus(userId) {
    let settings = await UserSettings.findOne({ where: { userId } });
    if (!settings) {
      settings = await UserSettings.create({
        userId,
        timezone: 'Asia/Dubai',
        gateMode: 'every_session',
        gateResetHour: 0,
        gateLanguage: 'en-IN',
        gateMatchThreshold: 0.8,
        gateFallbackAfterAttempts: 3
      });
    }

    settings = await this.reconcilePendingSettings(settings);

    const tz = settings.timezone || 'Asia/Dubai';
    const resetHour = settings.gateResetHour || 0;
    const effectiveDate = this.getEffectiveDate(new Date(), tz, resetHour);

    // Fetch active quotes ordered by sortOrder
    const activeQuotes = await MindsetQuote.findAll({
      where: { userId, isActive: true },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']]
    });

    // Setup required if fewer than 5 active quotes
    const activeQuotesCount = activeQuotes.length;
    if (activeQuotesCount < 5) {
      return {
        required: true,
        setupRequired: true,
        activeQuotesCount,
        mode: settings.gateMode,
        effectiveDate,
        timezone: tz,
        gateLanguage: settings.gateLanguage || 'en-IN',
        threshold: settings.gateMatchThreshold || 0.8,
        fallbackAfterAttempts: settings.gateFallbackAfterAttempts || 3,
        quotes: activeQuotes
      };
    }

    // If gate mode is 'off'
    if (settings.gateMode === 'off') {
      return {
        required: false,
        setupRequired: false,
        activeQuotesCount,
        mode: 'off',
        effectiveDate,
        quotes: activeQuotes
      };
    }

    // If gate mode is 'once_daily': check if already completed for effective date
    if (settings.gateMode === 'once_daily') {
      const completedLog = await MindsetGateLog.findOne({
        where: {
          userId,
          gateDate: effectiveDate,
          completedAt: { [Op.ne]: null }
        }
      });

      if (completedLog) {
        return {
          required: false,
          setupRequired: false,
          alreadyCompletedToday: true,
          activeQuotesCount,
          mode: 'once_daily',
          effectiveDate,
          completedLogId: completedLog.id,
          quotes: activeQuotes
        };
      }
    }

    // Required (every_session or uncompleted once_daily)
    return {
      required: true,
      setupRequired: false,
      activeQuotesCount,
      mode: settings.gateMode,
      effectiveDate,
      timezone: tz,
      gateLanguage: settings.gateLanguage || 'en-IN',
      threshold: settings.gateMatchThreshold || 0.8,
      fallbackAfterAttempts: settings.gateFallbackAfterAttempts || 3,
      quotes: activeQuotes
    };
  }

  /**
   * Starts or resumes an in-progress gate session for the current effective date (idempotent).
   */
  async startGate(userId) {
    const settings = await UserSettings.findOne({ where: { userId } });
    const tz = settings?.timezone || 'Asia/Dubai';
    const resetHour = settings?.gateResetHour || 0;
    const effectiveDate = this.getEffectiveDate(new Date(), tz, resetHour);

    // Reuse existing in-progress log if one exists for this user and effective date
    let log = await MindsetGateLog.findOne({
      where: {
        userId,
        gateDate: effectiveDate,
        completedAt: null
      }
    });

    if (!log) {
      log = await MindsetGateLog.create({
        userId,
        gateDate: effectiveDate,
        startedAt: new Date(),
        completedAt: null,
        method: 'voice',
        attemptsTotal: 0,
        quotesCompleted: 0,
        quotesTyped: 0
      });
    }

    return log;
  }

  /**
   * Completes a gate session, validating ownership and preventing double-completion.
   */
  async completeGate(userId, payload) {
    const { logId, attemptsTotal = 0, quotesCompleted = 5, quotesTyped = 0 } = payload;

    const log = await MindsetGateLog.findOne({ where: { id: logId, userId } });
    if (!log) {
      const err = new Error('Gate session log not found or unauthorized');
      err.statusCode = 404;
      throw err;
    }

    if (log.completedAt) {
      const err = new Error('Gate session is already marked as completed');
      err.statusCode = 400;
      throw err;
    }

    // Derive final method: voice, typed_fallback, or mixed
    const typedCount = Number(quotesTyped) || 0;
    const completedCount = Number(quotesCompleted) || 5;

    let finalMethod = 'voice';
    if (typedCount === 0) {
      finalMethod = 'voice';
    } else if (typedCount >= completedCount) {
      finalMethod = 'typed_fallback';
    } else {
      finalMethod = 'mixed';
    }

    await log.update({
      completedAt: new Date(),
      method: finalMethod,
      attemptsTotal: Number(attemptsTotal) || 0,
      quotesCompleted: completedCount,
      quotesTyped: typedCount
    });

    await AuditLog.create({
      userId,
      entityType: 'mindset_gate',
      entityId: String(log.id),
      action: 'completed',
      details: {
        gateDate: log.gateDate,
        method: finalMethod,
        quotesCompleted: completedCount,
        quotesTyped: typedCount,
        attemptsTotal: Number(attemptsTotal) || 0
      }
    });

    return log;
  }

  /**
   * Quotes Management: Retrieve all quotes for user
   */
  async getQuotes(userId) {
    return MindsetQuote.findAll({
      where: { userId },
      order: [['sortOrder', 'ASC'], ['id', 'ASC']]
    });
  }

  /**
   * Create quote (enforces max 5 active quotes)
   */
  async createQuote(userId, payload) {
    const { text, author, language = 'en-IN', sortOrder = 0, isActive = true } = payload;

    if (!text || !text.trim()) {
      const err = new Error('Quote text is required');
      err.statusCode = 400;
      throw err;
    }

    if (text.length > 300) {
      const err = new Error('Quote text must not exceed 300 characters');
      err.statusCode = 400;
      throw err;
    }

    if (isActive) {
      const activeCount = await MindsetQuote.count({ where: { userId, isActive: true } });
      if (activeCount >= 5) {
        const err = new Error('Maximum of 5 active quotes allowed. Please edit or replace an existing quote.');
        err.statusCode = 400;
        throw err;
      }
    }

    const quote = await MindsetQuote.create({
      userId,
      text: text.trim(),
      author: author ? author.trim() : null,
      language: language || 'en-IN',
      sortOrder: Number(sortOrder) || 0,
      isActive: Boolean(isActive)
    });

    return quote;
  }

  /**
   * Update quote
   */
  async updateQuote(userId, id, updates) {
    const quote = await MindsetQuote.findOne({ where: { id, userId } });
    if (!quote) {
      const err = new Error('Quote not found');
      err.statusCode = 404;
      throw err;
    }

    if (updates.text !== undefined) {
      if (!updates.text.trim()) {
        const err = new Error('Quote text cannot be empty');
        err.statusCode = 400;
        throw err;
      }
      if (updates.text.length > 300) {
        const err = new Error('Quote text must not exceed 300 characters');
        err.statusCode = 400;
        throw err;
      }
    }

    // If activating a previously inactive quote, verify count < 5
    if (updates.isActive === true && !quote.isActive) {
      const activeCount = await MindsetQuote.count({ where: { userId, isActive: true } });
      if (activeCount >= 5) {
        const err = new Error('Cannot activate quote: Exactly 5 active quotes are allowed. Please deactivate or replace another first.');
        err.statusCode = 400;
        throw err;
      }
    }

    await quote.update(updates);
    return quote;
  }

  /**
   * Replace or bulk set the 5 active quotes in a single transaction (Amendment 5)
   */
  async replaceQuotes(userId, quotesArray) {
    if (!Array.isArray(quotesArray) || quotesArray.length !== 5) {
      const err = new Error('Exactly 5 quotes must be provided for setup/replacement');
      err.statusCode = 400;
      throw err;
    }

    for (let i = 0; i < quotesArray.length; i++) {
      const q = quotesArray[i];
      if (!q.text || !q.text.trim()) {
        const err = new Error(`Quote #${i + 1} text cannot be empty`);
        err.statusCode = 400;
        throw err;
      }
      if (q.text.length > 300) {
        const err = new Error(`Quote #${i + 1} exceeds 300 characters`);
        err.statusCode = 400;
        throw err;
      }
    }

    const t = await sequelize.transaction();
    try {
      // Deactivate all existing quotes for this user
      await MindsetQuote.update({ isActive: false }, { where: { userId }, transaction: t });

      const newQuotes = [];
      for (let i = 0; i < quotesArray.length; i++) {
        const q = quotesArray[i];
        const created = await MindsetQuote.create(
          {
            userId,
            text: q.text.trim(),
            author: q.author ? q.author.trim() : null,
            language: q.language || 'en-IN',
            sortOrder: i,
            isActive: true
          },
          { transaction: t }
        );
        newQuotes.push(created);
      }

      await t.commit();
      return newQuotes;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Delete quote
   */
  async deleteQuote(userId, id) {
    const quote = await MindsetQuote.findOne({ where: { id, userId } });
    if (!quote) {
      const err = new Error('Quote not found');
      err.statusCode = 404;
      throw err;
    }

    await quote.destroy();
    const remainingActive = await MindsetQuote.count({ where: { userId, isActive: true } });

    return {
      success: true,
      deletedId: id,
      remainingActive,
      setupRequired: remainingActive < 5
    };
  }

  /**
   * Reorder quotes
   */
  async reorderQuotes(userId, quoteIds) {
    if (!Array.isArray(quoteIds)) {
      const err = new Error('quoteIds must be an array');
      err.statusCode = 400;
      throw err;
    }

    for (let i = 0; i < quoteIds.length; i++) {
      await MindsetQuote.update({ sortOrder: i }, { where: { id: quoteIds[i], userId } });
    }

    return this.getQuotes(userId);
  }

  /**
   * Updates gate configuration in UserSettings with Next-Day relaxation protection (Amendment 12).
   */
  async updateGateSettings(userId, payload) {
    let settings = await UserSettings.findOne({ where: { userId } });
    if (!settings) {
      settings = await UserSettings.create({ userId, timezone: 'Asia/Dubai' });
    }

    const tz = settings.timezone || 'Asia/Dubai';
    const resetHour = settings.gateResetHour || 0;
    const todayStr = this.getEffectiveDate(new Date(), tz, resetHour);

    // Calculate tomorrow's date string
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = this.getEffectiveDate(tomorrow, tz, resetHour);

    const updates = {};
    const enforceNextDay = settings.gateStrictnessEffectiveNextDay !== false;

    // Gate mode change:
    // If relaxing (every_session -> once_daily or off; once_daily -> off)
    if (payload.gateMode !== undefined && payload.gateMode !== settings.gateMode) {
      const isRelaxing =
        (settings.gateMode === 'every_session' && (payload.gateMode === 'once_daily' || payload.gateMode === 'off')) ||
        (settings.gateMode === 'once_daily' && payload.gateMode === 'off');

      if (isRelaxing && enforceNextDay) {
        updates.pendingGateMode = payload.gateMode;
        updates.pendingEffectiveDate = tomorrowStr;
      } else {
        updates.gateMode = payload.gateMode;
        updates.pendingGateMode = null;
      }
    }

    // Gate threshold change:
    // If lowering threshold (relaxing strictness)
    if (payload.gateMatchThreshold !== undefined && payload.gateMatchThreshold !== settings.gateMatchThreshold) {
      const isLowering = payload.gateMatchThreshold < settings.gateMatchThreshold;

      if (isLowering && enforceNextDay) {
        updates.pendingGateMatchThreshold = payload.gateMatchThreshold;
        updates.pendingEffectiveDate = tomorrowStr;
      } else {
        updates.gateMatchThreshold = payload.gateMatchThreshold;
        updates.pendingGateMatchThreshold = null;
      }
    }

    if (payload.gateResetHour !== undefined) updates.gateResetHour = payload.gateResetHour;
    if (payload.gateLanguage !== undefined) updates.gateLanguage = payload.gateLanguage;
    if (payload.gateFallbackAfterAttempts !== undefined) updates.gateFallbackAfterAttempts = payload.gateFallbackAfterAttempts;
    if (payload.gateStrictnessEffectiveNextDay !== undefined) updates.gateStrictnessEffectiveNextDay = payload.gateStrictnessEffectiveNextDay;

    await settings.update(updates);
    return settings;
  }

  /**
   * Calculates consecutive days streak for Mindset Gate completions in user's timezone.
   */
  async calculateGateStreak(userId) {
    const settings = await UserSettings.findOne({ where: { userId } });
    const tz = settings?.timezone || 'Asia/Dubai';
    const resetHour = settings?.gateResetHour || 0;

    const completedLogs = await MindsetGateLog.findAll({
      where: {
        userId,
        completedAt: { [Op.ne]: null }
      },
      attributes: ['gateDate', 'completedAt'],
      order: [['gateDate', 'DESC']],
      raw: true
    });

    const completedDates = new Set(completedLogs.map((l) => l.gateDate));
    const now = new Date();
    const todayStr = this.getEffectiveDate(now, tz, resetHour);

    let streak = 0;
    const cursor = new Date(now);

    // If today is not completed yet, start counting from yesterday
    if (!completedDates.has(todayStr)) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (true) {
      const dStr = this.getEffectiveDate(cursor, tz, resetHour);
      if (completedDates.has(dStr)) {
        streak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      gateStreak: streak,
      isCompletedToday: completedDates.has(todayStr)
    };
  }
}

module.exports = new GateService();
