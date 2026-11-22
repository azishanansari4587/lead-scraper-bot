/**
 * Founder Reminder Service
 * Sends automated Telegram and Email digests/nudges directly to the founder.
 * Never contacts leads. Persists markers in ReminderLog to prevent duplicate sends across restarts.
 */

const { Op } = require('sequelize');
const UserSettings = require('../../models/UserSettings');
const DailyPlan = require('../../models/DailyPlan');
const DailyReview = require('../../models/DailyReview');
const Task = require('../../models/Task');
const FollowUp = require('../../models/FollowUp');
const CalendarEvent = require('../../models/CalendarEvent');
const ReminderLog = require('../../models/ReminderLog');
const Lead = require('../../models/Lead');
const notifier = require('../notifications/notifier');
const env = require('../../config/env');
const logger = require('../../config/logger');

class FounderReminderService {
  /**
   * Main ticker method - runs on cron (e.g. every 1 or 5 minutes)
   */
  async checkAndDispatchReminders() {
    try {
      // Find all user settings with reminders enabled
      const allSettings = await UserSettings.findAll({
        where: { remindersEnabled: true }
      });

      for (const settings of allSettings) {
        await this.processUserReminders(settings);
      }
      return { success: true, checkedCount: allSettings.length };
    } catch (err) {
      logger.error({ err: err.message }, 'Error during founder reminder check');
      return { success: false, checkedCount: 0, error: err.message };
    }
  }

  /**
   * Process reminders for a single founder
   */
  async processUserReminders(settings) {
    const userId = settings.userId;
    const tz = settings.timezone || 'Asia/Dubai';

    // Compute current local time string in founder's timezone (HH:mm)
    const now = new Date();
    const localTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(now);

    const localDateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(now); // YYYY-MM-DD

    // 1. Check Morning Brief
    const morningTime = settings.morningBriefTime || '08:30';
    if (localTimeStr === morningTime) {
      await this.sendMorningBrief(userId, localDateStr, settings);
    }

    // 2. Check Evening Nudge
    const eveningTime = settings.eveningNudgeTime || '18:30';
    if (localTimeStr === eveningTime) {
      await this.sendEveningNudge(userId, localDateStr, settings);
    }

    // 3. Check Event Reminders (N minutes before startAt)
    const leadMinutes = settings.eventReminderMinutes || 15;
    await this.checkUpcomingEvents(userId, leadMinutes, settings);
  }

  /**
   * Sends morning brief of MITs, events, calls, follow-ups
   */
  async sendMorningBrief(userId, dateStr, settings) {
    // Idempotency: check if already sent today
    const existing = await ReminderLog.findOne({
      where: { userId, reminderType: 'morning_brief', referenceId: dateStr }
    });

    if (existing) {
      return;
    }

    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const [plan, mits, events, followUps] = await Promise.all([
      DailyPlan.findOne({ where: { userId, date: dateStr } }),
      Task.findAll({ where: { userId, isMIT: true, status: ['todo', 'doing'] } }),
      CalendarEvent.findAll({
        where: {
          userId,
          startAt: { [Op.between]: [startOfDay, endOfDay] }
        },
        order: [['startAt', 'ASC']]
      }),
      FollowUp.findAll({
        where: {
          userId,
          status: 'pending',
          dueAt: { [Op.between]: [startOfDay, endOfDay] }
        },
        include: [{ model: Lead, as: 'lead', attributes: ['businessName'] }]
      })
    ]);

    const callsCount = followUps.filter((f) => f.channel === 'call').length;
    const emailsCount = followUps.filter((f) => f.channel === 'email').length;

    let msg = `☀️ *KNOTIQ RUGS — MORNING BRIEF (${dateStr})*\n\n`;
    msg += `🎯 *Today's Focus:*\n`;

    if (mits.length > 0) {
      mits.forEach((m, idx) => {
        msg += `${idx + 1}. ${m.title}\n`;
      });
    } else if (plan?.mit1 || plan?.mit2 || plan?.mit3) {
      if (plan.mit1) msg += `1. ${plan.mit1}\n`;
      if (plan.mit2) msg += `2. ${plan.mit2}\n`;
      if (plan.mit3) msg += `3. ${plan.mit3}\n`;
    } else {
      msg += `_No MITs set yet. Open Today Hub to set priorities!_\n`;
    }

    msg += `\n📅 *Schedule & Actions:*\n`;
    msg += `• *Events:* ${events.length} scheduled\n`;
    msg += `• *Calls to make:* ${callsCount}\n`;
    msg += `• *Pending follow-ups:* ${followUps.length} (${emailsCount} email, ${callsCount} call)\n`;

    if (events.length > 0) {
      msg += `\n*Upcoming Events:*\n`;
      events.slice(0, 3).forEach((ev) => {
        const time = new Date(ev.startAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: settings.timezone || 'Asia/Dubai' });
        msg += `• ${time} - ${ev.title}\n`;
      });
    }

    await this.dispatchNotification(userId, 'morning_brief', dateStr, msg, `Morning Brief (${dateStr})`);
  }

  /**
   * Sends evening review nudge if review not yet completed
   */
  async sendEveningNudge(userId, dateStr) {
    const existingLog = await ReminderLog.findOne({
      where: { userId, reminderType: 'evening_nudge', referenceId: dateStr }
    });

    if (existingLog) {
      return;
    }

    const review = await DailyReview.findOne({
      where: { userId, date: dateStr }
    });

    if (review) {
      // Review already completed! No nudge needed
      return;
    }

    const msg = `🌙 *KNOTIQ RUGS — EVENING REVIEW PENDING*\n\n` +
      `Hey Founder! Your daily review for *${dateStr}* is waiting.\n\n` +
      `Take 2 minutes to record today's wins, lessons, and auto-plan tomorrow to protect your momentum streak! 🔥\n\n` +
      `👉 Open: Knotiq Today Hub -> Evening Review`;

    await this.dispatchNotification(userId, 'evening_nudge', dateStr, msg, `Evening Review Nudge (${dateStr})`);
  }

  /**
   * Checks upcoming events starting in ~leadMinutes
   */
  async checkUpcomingEvents(userId, leadMinutes, settings) {
    const now = new Date();
    const windowStart = new Date(now.getTime() + (leadMinutes - 1) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (leadMinutes + 2) * 60 * 1000);

    const upcomingEvents = await CalendarEvent.findAll({
      where: {
        userId,
        startAt: { [Op.between]: [windowStart, windowEnd] }
      }
    });

    for (const event of upcomingEvents) {
      const startAtMs = new Date(event.startAt).getTime();
      const refId = `event_${event.id}_${startAtMs}`;
      const existing = await ReminderLog.findOne({
        where: { userId, reminderType: 'event_reminder', referenceId: refId }
      });

      if (!existing) {
        const timeStr = new Date(event.startAt).toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: settings.timezone || 'Asia/Dubai'
        });

        const msg = `⏰ *UPCOMING EVENT REMINDER (${leadMinutes} min)*\n\n` +
          `*${event.title}*\n` +
          `Time: ${timeStr} (GST)\n` +
          (event.location ? `Location: ${event.location}\n` : '') +
          (event.notes ? `Notes: ${event.notes}\n` : '');

        await this.dispatchNotification(userId, 'event_reminder', refId, msg, `Event Reminder: ${event.title}`);
      }
    }
  }

  /**
   * Helper to dispatch and log sent reminder
   */
  async dispatchNotification(userId, reminderType, referenceId, message, subject) {
    if (env.DRY_RUN) {
      logger.info({ userId, reminderType, referenceId }, '🧪 [DRY_RUN] Simulating founder reminder dispatch');
    } else {
      await Promise.allSettled([
        notifier.sendTelegramAlert(message),
        notifier.sendEmailAlert({ subject, text: message })
      ]);
    }

    // Persist into ReminderLog so duplicate alerts are never sent
    await ReminderLog.create({
      userId,
      reminderType,
      referenceId,
      channel: 'both',
      sentAt: new Date()
    }).catch(() => {});
  }
}

module.exports = new FounderReminderService();
