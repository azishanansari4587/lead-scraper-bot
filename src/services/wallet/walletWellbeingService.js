/**
 * Work Wallet Wellbeing Service
 *
 * Implements:
 * 1. High work hours + short sleep alert (3 consecutive days >12h work and <6.5h sleep)
 * 2. Heavy penalties alert (5+ consecutive days >180m penalty per day)
 * 3. Unrealistic schedule insight (>40% of scheduled work missed over 7 days)
 *
 * Dispatches via Notifier with ReminderLog deduplication, quiet hours check, and DRY_RUN support.
 * One-tap accept/dismiss proposals NEVER modify settings automatically.
 */

const { Op } = require('sequelize');
const {
  WalletPolicy,
  WorkSchedule,
  WorkWindow,
  WalletLedgerEntry,
  RoutinePolicy,
  RoutineBlock,
  ReminderLog,
  AuditLog
} = require('../../models');
const walletIntervalMath = require('./walletIntervalMath');
const walletSettlementService = require('./walletSettlementService');
const notifier = require('../notifications/notifier');
const logger = require('../../config/logger');

class WalletWellbeingService {
  /**
   * Check if current time is within user quiet hours.
   */
  async isWithinQuietHours(userId, nowUtc = new Date()) {
    try {
      const routinePolicy = await RoutinePolicy.findOne({ where: { userId } });
      if (!routinePolicy || !routinePolicy.enabled) return false;

      const userTz = 'Asia/Dubai';
      const qStart = routinePolicy.quietHoursStart || '22:00';
      const qEnd = routinePolicy.quietHoursEnd || '07:00';

      const [qhStartH, qhStartM] = qStart.split(':').map(Number);
      const [qhEndH, qhEndM] = qEnd.split(':').map(Number);
      const qhStart = qhStartH * 60 + qhStartM;
      const qhEnd = qhEndH * 60 + qhEndM;

      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: userTz,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
      }).formatToParts(nowUtc);
      let curH = 0, curM = 0;
      parts.forEach(({ type, value }) => {
        if (type === 'hour') curH = Number(value === '24' ? 0 : value);
        if (type === 'minute') curM = Number(value);
      });
      const curMin = curH * 60 + curM;

      if (qhStart > qhEnd) {
        // Crosses midnight (e.g. 22:00 to 07:00)
        return curMin >= qhStart || curMin <= qhEnd;
      } else {
        return curMin >= qhStart && curMin <= qhEnd;
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to check quiet hours for wellbeing');
      return false;
    }
  }

  /**
   * Check and dispatch wellbeing alerts.
   * Deduped via ReminderLog. Respects quiet hours and DRY_RUN.
   */
  async checkWellbeingAlerts(userId, { nowUtc = new Date(), dryRun = false } = {}) {
    const isDryRun = dryRun || process.env.DRY_RUN === 'true';
    const userTz = 'Asia/Dubai';
    const todayStr = walletSettlementService.getLocalDateString(nowUtc, userTz);

    const alertsTriggered = [];

    // 1. Check quiet hours: if in quiet hours, do not disturb founder with non-emergency wellbeing alerts
    const inQuietHours = await this.isWithinQuietHours(userId, nowUtc);
    if (inQuietHours) {
      logger.debug({ userId }, 'Skipping wellbeing alert dispatch: currently in quiet hours');
      return { alertsTriggered: [], skippedQuietHours: true };
    }

    // 2. Condition 1: 3 consecutive days of high work (>12h scheduled) + short sleep (<6.5h)
    const hasOverworkPattern = await this.checkConsecutiveOverwork(userId, todayStr, 3);
    if (hasOverworkPattern) {
      const alertType = 'wellbeing_overwork';
      const refId = `overwork_${todayStr}`;

      const existing = await ReminderLog.findOne({
        where: { userId, reminderType: alertType, referenceId: refId }
      });

      if (!existing) {
        alertsTriggered.push(alertType);
        const message = `⚠️ *Wellbeing Notice*: You have scheduled >12h of work with <6.5h of sleep for 3 consecutive days. Consider scheduling a break or recovery block to protect long-term focus.`;

        if (!isDryRun) {
          try {
            await notifier.sendTelegramAlert(message);
          } catch (err) {
            logger.warn({ err: err.message }, 'Failed to send overwork telegram alert');
          }
          await ReminderLog.create({
            userId,
            reminderType: alertType,
            referenceId: refId,
            channel: 'telegram',
            sentAt: nowUtc
          });
        }
      }
    }

    // 3. Condition 2: 5+ consecutive days of heavy penalties (>180m unworked per day)
    const hasHeavyPenalties = await this.checkConsecutivePenalties(userId, todayStr, 5, 180);
    if (hasHeavyPenalties) {
      const alertType = 'wellbeing_heavy_penalties';
      const refId = `heavy_penalties_${todayStr}`;

      const existing = await ReminderLog.findOne({
        where: { userId, reminderType: alertType, referenceId: refId }
      });

      if (!existing) {
        alertsTriggered.push(alertType);
        const message = `⚠️ *Wellbeing Alert*: You have accrued >3 hours of unworked penalties daily for 5+ consecutive days. Your schedule may be unrealistic. Review your work windows in Settings.`;

        if (!isDryRun) {
          try {
            await notifier.sendTelegramAlert(message);
          } catch (err) {
            logger.warn({ err: err.message }, 'Failed to send heavy penalties telegram alert');
          }
          await ReminderLog.create({
            userId,
            reminderType: alertType,
            referenceId: refId,
            channel: 'telegram',
            sentAt: nowUtc
          });
        }
      }
    }

    return {
      alertsTriggered,
      isDryRun,
      skippedQuietHours: false
    };
  }

  /**
   * Helper: check N consecutive days of >12h scheduled and <6.5h sleep
   */
  async checkConsecutiveOverwork(userId, endDateStr, requiredDays = 3) {
    const dates = this.getPastDateStrings(endDateStr, requiredDays);
    const policy = await WalletPolicy.findOne({ where: { userId } });
    const minSleep = policy?.minDailySleepMinutes !== undefined ? policy.minDailySleepMinutes : 390;

    for (const d of dates) {
      // Calculate scheduled minutes for day d
      const schedule = await walletSettlementService.getActiveScheduleForDate(userId, d);
      if (!schedule || !schedule.windows || schedule.windows.length === 0) {
        return false;
      }

      let scheduledMins = 0;
      for (const w of schedule.windows) {
        const [sh, sm] = w.startTime.split(':').map(Number);
        const [eh, em] = w.endTime.split(':').map(Number);
        let dur = (eh * 60 + em) - (sh * 60 + sm);
        if (dur <= 0) dur += 1440;
        scheduledMins += dur;
      }

      // Check if scheduled work > 12 hours (720 min)
      if (scheduledMins < 720) {
        return false;
      }

      // Check short sleep: if policy sleep is < 390m (6.5h), or available rest < 390m
      const availableRestMins = 1440 - scheduledMins;
      const isShortSleep = (minSleep < 390) || (availableRestMins < 390);
      if (!isShortSleep) {
        return false;
      }
    }

    return true;
  }

  /**
   * Helper: check N consecutive days with > thresholdMinutes unworked penalties
   */
  async checkConsecutivePenalties(userId, endDateStr, requiredDays = 5, thresholdMinutes = 180) {
    const dates = this.getPastDateStrings(endDateStr, requiredDays);

    for (const d of dates) {
      const penaltyEntries = await WalletLedgerEntry.findAll({
        where: {
          userId,
          date: d,
          type: 'penalty'
        }
      });

      const dayPenaltyMinutes = penaltyEntries.reduce((sum, e) => sum + (e.minutes || 0), 0);
      if (dayPenaltyMinutes < thresholdMinutes) {
        return false;
      }
    }

    return true;
  }

  /**
   * Evaluate last 7 days for "unrealistic schedule" insight.
   * Triggered if >40% of scheduled minutes were missed.
   */
  async evaluateUnrealisticSchedule(userId, nowUtc = new Date()) {
    const userTz = 'Asia/Dubai';
    const todayStr = walletSettlementService.getLocalDateString(nowUtc, userTz);
    const last7Days = this.getPastDateStrings(todayStr, 7);

    let totalScheduledMin = 0;
    let totalPenaltyMin = 0;

    for (const d of last7Days) {
      const schedule = await walletSettlementService.getActiveScheduleForDate(userId, d);
      if (schedule && schedule.windows) {
        for (const w of schedule.windows) {
          const [sh, sm] = w.startTime.split(':').map(Number);
          const [eh, em] = w.endTime.split(':').map(Number);
          let dur = (eh * 60 + em) - (sh * 60 + sm);
          if (dur <= 0) dur += 1440;
          totalScheduledMin += dur;
        }
      }

      const penaltyEntries = await WalletLedgerEntry.findAll({
        where: { userId, date: d, type: 'penalty' }
      });
      totalPenaltyMin += penaltyEntries.reduce((acc, e) => acc + (e.minutes || 0), 0);
    }

    if (totalScheduledMin > 0) {
      const missedRatio = totalPenaltyMin / totalScheduledMin;
      if (missedRatio > 0.40) {
        const missedPercent = Math.round(missedRatio * 100);
        return {
          id: 'unrealistic_schedule',
          hasInsight: true,
          missedPercent,
          totalScheduledMin,
          totalPenaltyMin,
          proposal: `Your schedule missed ${missedPercent}% of planned work over the last 7 days. Consider reducing daily work windows by 20% or adjusting start times to reflect your natural rhythm.`,
          status: 'pending'
        };
      }
    }

    return {
      id: 'unrealistic_schedule',
      hasInsight: false,
      status: 'healthy'
    };
  }

  /**
   * Helper: generate past N date strings ending on endDateStr
   */
  getPastDateStrings(endDateStr, n) {
    const dates = [];
    const [y, m, d] = endDateStr.split('-').map(Number);
    for (let i = n - 1; i >= 0; i--) {
      const dt = new Date(Date.UTC(y, m - 1, d - i, 12, 0, 0));
      dates.push(dt.toISOString().slice(0, 10));
    }
    return dates;
  }
}

module.exports = new WalletWellbeingService();
