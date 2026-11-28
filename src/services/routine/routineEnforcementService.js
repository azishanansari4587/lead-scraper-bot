/**
 * CEO Routine Engine - Enforcement & Escalation Service
 * Handles escalation ladder (L1 In-App, L2 Telegram, L3 Email, L4 Focus Lock),
 * quiet hours & protected block suppression, delayed policy loosening,
 * emergency exits, and cryptographic accountability partner opt-in.
 */

const crypto = require('crypto');
const { Op } = require('sequelize');
const RoutinePolicy = require('../../models/RoutinePolicy');
const RoutineEntry = require('../../models/RoutineEntry');
const ReminderLog = require('../../models/ReminderLog');
const UserSettings = require('../../models/UserSettings');
const notifier = require('../notifications/notifier');
const env = require('../../config/env');
const logger = require('../../config/logger');

class RoutineEnforcementService {
  /**
   * Helper: check if a time is within quiet hours (handles overnight spans e.g. 22:00 to 07:00)
   */
  isWithinQuietHours(currentTimeStr, quietStart = '22:00', quietEnd = '07:00') {
    const [curH, curM] = currentTimeStr.split(':').map(Number);
    const curMinutes = curH * 60 + curM;

    const [startH, startM] = quietStart.split(':').map(Number);
    const [endH, endM] = quietEnd.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes > endMinutes) {
      // Overnight quiet window (e.g. 22:00 to 07:00)
      return curMinutes >= startMinutes || curMinutes < endMinutes;
    } else {
      // Same-day quiet window
      return curMinutes >= startMinutes && curMinutes < endMinutes;
    }
  }

  /**
   * Helper: get current local time string (HH:MM)
   */
  getCurrentLocalTimeStr(now = new Date(), timezone = 'Asia/Dubai') {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);
  }

  /**
   * Helper: get current local date string (YYYY-MM-DD)
   */
  getCurrentLocalDateStr(now = new Date(), timezone = 'Asia/Dubai') {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now);
  }

  // ---------------------------------------------------------------------------
  // POLICY & DELAYED LOOSENING (Amendment 5)
  // ---------------------------------------------------------------------------

  /**
   * Reconcile any pending policy changes whose effective date has arrived
   */
  async getOrCreatePolicy(userId) {
    let policy = await RoutinePolicy.findOne({ where: { userId } });
    if (!policy) {
      policy = await RoutinePolicy.create({
        userId,
        enabled: true,
        escalationEnabled: false,
        quietHoursStart: '22:00',
        quietHoursEnd: '07:00',
        maxNudgesPerHour: 2,
        maxSnoozesPerDay: 3,
        focusLockEnabled: false,
        minDailyRestHours: 7.0,
        weeklyRestDay: null
      });
      return policy;
    }

    // Check if pending policy is ready to apply
    if (policy.pendingPolicy && policy.pendingEffectiveDate) {
      const s = await UserSettings.findOne({ where: { userId } });
      const tz = s?.timezone || 'Asia/Dubai';
      const todayStr = this.getCurrentLocalDateStr(new Date(), tz);

      if (todayStr >= policy.pendingEffectiveDate) {
        try {
          const updates = JSON.parse(policy.pendingPolicy);
          updates.pendingPolicy = null;
          updates.pendingEffectiveDate = null;
          await policy.update(updates);
          logger.info({ userId, effectiveDate: todayStr }, 'Applied pending loosened routine policy');
        } catch (err) {
          logger.warn({ err, userId }, 'Failed to parse pending policy');
        }
      }
    }

    return policy;
  }

  /**
   * Update policy with strict delayed-loosening guard (Amendment 5)
   * Loosening: disabling focus lock, raising snooze limit, shortening quiet hours, removing stakes
   * takes effect from NEXT local day. Tightening is IMMEDIATE.
   */
  async updatePolicy(userId, payload) {
    const policy = await this.getOrCreatePolicy(userId);
    const s = await UserSettings.findOne({ where: { userId } });
    const tz = s?.timezone || 'Asia/Dubai';
    const now = new Date();
    const tomorrowStr = this.getCurrentLocalDateStr(new Date(now.getTime() + 24 * 60 * 60 * 1000), tz);

    const immediateUpdates = {};
    const pendingUpdates = {};

    // Helper: is loosening
    const checkLoosening = (field, newVal, isLooseningCondition) => {
      if (newVal !== undefined && newVal !== policy[field]) {
        if (isLooseningCondition(newVal, policy[field])) {
          pendingUpdates[field] = newVal;
        } else {
          immediateUpdates[field] = newVal;
        }
      }
    };

    // 1. focusLockEnabled (turning off = loosening)
    if (payload.focusLockEnabled !== undefined && payload.focusLockEnabled !== policy.focusLockEnabled) {
      if (!payload.focusLockEnabled) {
        pendingUpdates.focusLockEnabled = false;
      } else {
        immediateUpdates.focusLockEnabled = true;
      }
    }

    // 2. escalationEnabled (turning off = loosening)
    if (payload.escalationEnabled !== undefined && payload.escalationEnabled !== policy.escalationEnabled) {
      if (!payload.escalationEnabled) {
        pendingUpdates.escalationEnabled = false;
      } else {
        immediateUpdates.escalationEnabled = true;
      }
    }

    // 3. maxSnoozesPerDay (increasing = loosening)
    checkLoosening('maxSnoozesPerDay', payload.maxSnoozesPerDay, (n, old) => n > old);

    // 4. maxNudgesPerHour (decreasing = loosening)
    checkLoosening('maxNudgesPerHour', payload.maxNudgesPerHour, (n, old) => n < old);

    // 5. weeklyRestDay (adding/changing rest day = loosening)
    if (payload.weeklyRestDay !== undefined && payload.weeklyRestDay !== policy.weeklyRestDay) {
      if (payload.weeklyRestDay !== null && policy.weeklyRestDay === null) {
        pendingUpdates.weeklyRestDay = payload.weeklyRestDay;
      } else {
        immediateUpdates.weeklyRestDay = payload.weeklyRestDay;
      }
    }

    // 6. Direct fields: quietHours, minDailyRestHours, ladder steps, stakes
    const directFields = ['quietHoursStart', 'quietHoursEnd', 'minDailyRestHours', 'l1NudgeMinutes', 'l2TelegramMinutes', 'l3EmailMinutes', 'l4FocusLockMinutes', 'pledgeText'];
    directFields.forEach((k) => {
      if (payload[k] !== undefined) immediateUpdates[k] = payload[k];
    });

    if (payload.supportedStakes !== undefined) {
      const stakesArr = Array.isArray(payload.supportedStakes) ? payload.supportedStakes : JSON.parse(payload.supportedStakes || '[]');
      immediateUpdates.supportedStakes = JSON.stringify(stakesArr);
    }

    if (Object.keys(pendingUpdates).length > 0) {
      immediateUpdates.pendingPolicy = JSON.stringify(pendingUpdates);
      immediateUpdates.pendingEffectiveDate = tomorrowStr;
    }

    await policy.update(immediateUpdates);
    return {
      policy,
      hasPendingRelaxations: Object.keys(pendingUpdates).length > 0,
      pendingEffectiveDate: immediateUpdates.pendingEffectiveDate || null
    };
  }

  /**
   * Emergency Exit from Focus Lock (Amendment 5)
   */
  async useEmergencyExit(userId, reason) {
    if (!reason || reason.trim() === '') {
      throw new Error('A reason is mandatory for emergency exit from Focus Lock');
    }

    const policy = await this.getOrCreatePolicy(userId);
    const maxExits = policy.emergencyExitsMaxPerWeek || 2;

    // Reset weekly exits if last exit was > 7 days ago
    const now = new Date();
    if (policy.lastEmergencyExitAt) {
      const diffDays = (now.getTime() - new Date(policy.lastEmergencyExitAt).getTime()) / (24 * 60 * 60 * 1000);
      if (diffDays >= 7) {
        await policy.update({ emergencyExitsUsed: 0 });
        policy.emergencyExitsUsed = 0;
      }
    }

    if (policy.emergencyExitsUsed >= maxExits) {
      throw new Error(`Emergency exit limit reached (${maxExits} used this week). Please complete or reschedule the task.`);
    }

    await policy.update({
      emergencyExitsUsed: policy.emergencyExitsUsed + 1,
      lastEmergencyExitAt: now
    });

    return {
      success: true,
      remainingExits: maxExits - (policy.emergencyExitsUsed),
      message: 'Emergency exit granted. Focus lock temporarily deactivated.'
    };
  }

  // ---------------------------------------------------------------------------
  // ESCALATION ENGINE TICKER (Amendment 3, 5, 6)
  // ---------------------------------------------------------------------------

  /**
   * Evaluates active must-do entries for escalation
   * Runs on cron and on-demand.
   */
  async evaluateEscalations(userId) {
    const policy = await this.getOrCreatePolicy(userId);
    if (!policy.enabled || !policy.escalationEnabled) {
      return { escalatedCount: 0, suppressed: true, reason: 'Escalation disabled' };
    }

    const s = await UserSettings.findOne({ where: { userId } });
    const tz = s?.timezone || 'Asia/Dubai';
    const now = new Date();
    const todayStr = this.getCurrentLocalDateStr(now, tz);
    const currentTimeStr = this.getCurrentLocalTimeStr(now, tz);

    // 1. Guardrail: Quiet hours suppression
    if (this.isWithinQuietHours(currentTimeStr, policy.quietHoursStart, policy.quietHoursEnd)) {
      return { escalatedCount: 0, suppressed: true, reason: 'Within quiet hours' };
    }

    // 2. Guardrail: Weekly rest day suppression
    const dayOfWeek = new Date(`${todayStr}T12:00:00Z`).getDay();
    if (policy.weeklyRestDay !== null && dayOfWeek === policy.weeklyRestDay) {
      return { escalatedCount: 0, suppressed: true, reason: 'Weekly rest day' };
    }

    // 3. Find pending must-do entries for today that have arrived/passed plannedStartAt
    const pendingMustDos = await RoutineEntry.findAll({
      where: {
        userId,
        date: todayStr,
        isMustDo: true,
        isProtected: false, // Immune per non-negotiable health guardrail
        status: 'pending', // Amendment 6: Nudges STOP once in_progress or done
        plannedStartAt: { [Op.lte]: now }
      }
    });

    let escalatedCount = 0;

    for (const entry of pendingMustDos) {
      const startMs = new Date(entry.plannedStartAt).getTime();
      const endMs = new Date(entry.plannedEndAt).getTime();
      const blockDurationMinutes = Math.max(15, Math.round((endMs - startMs) / (60 * 1000)));

      const elapsedMinutes = Math.floor((now.getTime() - startMs) / (60 * 1000));

      // Cap step timings relative to block length (Amendment 6)
      const l2Threshold = Math.min(policy.l2TelegramMinutes, Math.round(blockDurationMinutes * 0.5));
      const l3Threshold = Math.min(policy.l3EmailMinutes, Math.round(blockDurationMinutes * 0.75));
      const l4Threshold = Math.min(policy.l4FocusLockMinutes, blockDurationMinutes);

      // Check max nudges per hour cap for this entry (Amendment 5)
      const lastNudgeMs = entry.lastNudgeAt ? new Date(entry.lastNudgeAt).getTime() : 0;
      const minIntervalMs = (60 / Math.max(1, policy.maxNudgesPerHour)) * 60 * 1000;
      const canNudgeNow = (now.getTime() - lastNudgeMs) >= minIntervalMs;

      // Escalation Ladder
      if (elapsedMinutes >= l4Threshold && policy.focusLockEnabled) {
        if (entry.escalationLevel < 4) {
          await entry.update({ escalationLevel: 4, lastNudgeAt: now });
          escalatedCount++;
        }
      } else if (elapsedMinutes >= l3Threshold) {
        if (entry.escalationLevel < 3 && canNudgeNow) {
          await this.dispatchEmailNudge(userId, entry);
          await entry.update({ escalationLevel: 3, lastNudgeAt: now });
          escalatedCount++;
        }
      } else if (elapsedMinutes >= l2Threshold) {
        if (entry.escalationLevel < 2 && canNudgeNow) {
          await this.dispatchTelegramNudge(userId, entry);
          await entry.update({ escalationLevel: 2, lastNudgeAt: now });
          escalatedCount++;
        }
      } else if (elapsedMinutes >= policy.l1NudgeMinutes) {
        if (entry.escalationLevel < 1) {
          await entry.update({ escalationLevel: 1 });
          escalatedCount++;
        }
      }
    }

    return { escalatedCount, suppressed: false };
  }

  async dispatchTelegramNudge(userId, entry) {
    const refId = `routine_tg_${entry.id}_${entry.date}`;
    const alreadySent = await ReminderLog.findOne({ where: { userId, reminderType: 'event_reminder', referenceId: refId } });
    if (alreadySent) return;

    const msg = `⚡ *Routine Must-Do Alert*\n"${entry.title}" was scheduled for ${entry.plannedStart} and is waiting for you.\nOpen Command Center to Start: ${process.env.DASHBOARD_URL || env.DASHBOARD_URL || 'http://localhost:5173'}`;
    await notifier.sendTelegramAlert(msg);

    await ReminderLog.create({
      userId,
      reminderType: 'event_reminder',
      referenceId: refId,
      channel: 'telegram',
      sentAt: new Date()
    });
  }

  async dispatchEmailNudge(userId, entry) {
    const refId = `routine_em_${entry.id}_${entry.date}`;
    const alreadySent = await ReminderLog.findOne({ where: { userId, reminderType: 'event_reminder', referenceId: refId } });
    if (alreadySent) return;

    const html = `<div style="font-family: Arial, sans-serif; max-width: 500px;"><h3 style="color: #D97706;">Commitment Reminder</h3><p>Your must-do block <strong>${entry.title}</strong> is pending start (scheduled: ${entry.plannedStart}).</p></div>`;
    await notifier.sendEmailAlert({
      subject: `[Knotiq Action Required] Must-Do: ${entry.title}`,
      html
    });

    await ReminderLog.create({
      userId,
      reminderType: 'event_reminder',
      referenceId: refId,
      channel: 'email',
      sentAt: new Date()
    });
  }

  // ---------------------------------------------------------------------------
  // ACCOUNTABILITY PARTNER FLOW (Amendment 4)
  // ---------------------------------------------------------------------------

  /**
   * Generates a single-use, cryptographically random, expiring partner invitation link
   */
  async createPartnerInvite(userId, partnerUsername) {
    const policy = await this.getOrCreatePolicy(userId);
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48-hour expiration

    await policy.update({
      partnerTelegramUsername: partnerUsername || null,
      partnerOptInStatus: 'pending',
      partnerOptInTokenHash: tokenHash,
      partnerTokenExpiresAt: expiresAt
    });

    const botUsername = process.env.TELEGRAM_BOT_USERNAME || 'KnotiqAlertsBot';
    const deepLink = `https://t.me/${botUsername}?start=routine_${rawToken}`;

    return {
      deepLink,
      expiresAt,
      message: 'Send this deep link to your partner. When they press Start, accountability sharing will activate.'
    };
  }

  /**
   * Confirm partner opt-in via token (single-use, hashed verification)
   */
  async confirmPartnerOptIn(rawToken, chatId) {
    if (!rawToken || !chatId) {
      throw new Error('Token and chat ID are required for partner verification');
    }

    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const now = new Date();

    const policy = await RoutinePolicy.findOne({
      where: {
        partnerOptInTokenHash: tokenHash,
        partnerOptInStatus: 'pending',
        partnerTokenExpiresAt: { [Op.gt]: now }
      }
    });

    if (!policy) {
      throw new Error('Invalid, already used, or expired partner invitation link');
    }

    await policy.update({
      partnerTelegramChatId: String(chatId),
      partnerOptInStatus: 'confirmed',
      partnerOptInTokenHash: null, // Single-use consumption
      partnerConsentedAt: now,
      partnerRevokedAt: null,
      partnerDailySummaryEnabled: true
    });

    return {
      success: true,
      userId: policy.userId,
      message: 'Accountability partnership confirmed successfully.'
    };
  }

  /**
   * Revoke partner sharing (either founder in-app or partner sending /stop)
   */
  async revokePartner(userIdOrChatId) {
    const where = typeof userIdOrChatId === 'string' && userIdOrChatId.startsWith('user_')
      ? { userId: userIdOrChatId }
      : { partnerTelegramChatId: String(userIdOrChatId) };

    const policy = await RoutinePolicy.findOne({ where });
    if (!policy) throw new Error('Accountability partnership not found');

    await policy.update({
      partnerOptInStatus: 'stopped',
      partnerDailySummaryEnabled: false,
      partnerRevokedAt: new Date()
    });

    return { success: true, message: 'Accountability sharing stopped' };
  }
}

module.exports = new RoutineEnforcementService();
