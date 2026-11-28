/**
 * Daily Planner Service
 * Rituals for Morning Plan, Evening Review, Auto-Draft Tomorrow, and Streaks
 */

const { Op } = require('sequelize');
const DailyPlan = require('../../models/DailyPlan');
const DailyReview = require('../../models/DailyReview');
const Task = require('../../models/Task');
const Call = require('../../models/Call');
const FollowUp = require('../../models/FollowUp');
const OutreachLog = require('../../models/OutreachLog');
const CalendarEvent = require('../../models/CalendarEvent');
const UserSettings = require('../../models/UserSettings');
const Lead = require('../../models/Lead');
const MindsetGateLog = require('../../models/MindsetGateLog');
const RoutineEntry = require('../../models/RoutineEntry');
const gateService = require('../gateService');
const logger = require('../../config/logger');

class PlannerService {
  /**
   * Fetch morning plan for a given date (YYYY-MM-DD)
   */
  async getDailyPlan(userId, dateStr) {
    let plan = await DailyPlan.findOne({
      where: { userId, date: dateStr }
    });

    if (!plan) {
      // Get user default targets from UserSettings
      const settings = await UserSettings.findOne({ where: { userId } });
      plan = {
        date: dateStr,
        mit1: '',
        mit2: '',
        mit3: '',
        mit1TaskId: null,
        mit2TaskId: null,
        mit3TaskId: null,
        outreachTarget: settings ? (settings.dailyEmailTarget || 20) : 20,
        callTarget: settings ? (settings.dailyCallTarget || 15) : 15,
        morningNote: '',
        isNew: true
      };
    }

    return plan;
  }

  /**
   * Save or update morning plan
   */
  async saveDailyPlan(userId, payload) {
    const { date, mit1, mit2, mit3, mit1TaskId, mit2TaskId, mit3TaskId, outreachTarget, callTarget, morningNote } = payload;

    const [plan, created] = await DailyPlan.findOrCreate({
      where: { userId, date },
      defaults: {
        userId,
        date,
        mit1,
        mit2,
        mit3,
        mit1TaskId,
        mit2TaskId,
        mit3TaskId,
        outreachTarget: outreachTarget || 20,
        callTarget: callTarget || 15,
        morningNote
      }
    });

    if (!created) {
      await plan.update({
        mit1,
        mit2,
        mit3,
        mit1TaskId,
        mit2TaskId,
        mit3TaskId,
        outreachTarget: outreachTarget || plan.outreachTarget,
        callTarget: callTarget || plan.callTarget,
        morningNote
      });
    }

    // Reset old MITs for today and tag the new task IDs as isMIT: true
    await Task.update({ isMIT: false }, { where: { userId, isMIT: true } });
    const mitIds = [mit1TaskId, mit2TaskId, mit3TaskId].filter(Boolean);
    if (mitIds.length > 0) {
      await Task.update({ isMIT: true }, { where: { userId, id: { [Op.in]: mitIds } } });
    }

    logger.info({ userId, date }, 'Saved daily morning plan');
    return plan;
  }

  /**
   * Auto-summarizes today's progress for Evening Review
   */
  async getEveningSummary(userId, dateStr) {
    const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
    const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);

    const [
      callsLogged,
      emailsSent,
      whatsappsSent,
      tasksCompleted,
      followUpsDone,
      followUpsMissed,
      plan,
      existingReview,
      completedGate,
      routineEntries
    ] = await Promise.all([
      Call.count({
        where: {
          userId,
          calledAt: { [Op.between]: [startOfDay, endOfDay] }
        }
      }),
      OutreachLog.count({
        where: {
          userId,
          channel: 'email',
          sentAt: { [Op.between]: [startOfDay, endOfDay] },
          outcome: { [Op.in]: ['sent', 'delivered', 'read'] }
        }
      }),
      OutreachLog.count({
        where: {
          userId,
          channel: 'whatsapp',
          sentAt: { [Op.between]: [startOfDay, endOfDay] },
          outcome: { [Op.in]: ['sent', 'delivered', 'read'] }
        }
      }),
      Task.findAll({
        where: {
          userId,
          completedAt: { [Op.between]: [startOfDay, endOfDay] }
        },
        attributes: ['id', 'title', 'category', 'isMIT']
      }),
      FollowUp.count({
        where: {
          userId,
          status: 'done',
          updatedAt: { [Op.between]: [startOfDay, endOfDay] }
        }
      }),
      FollowUp.count({
        where: {
          userId,
          status: 'pending',
          dueAt: { [Op.lt]: new Date() }
        }
      }),
      DailyPlan.findOne({ where: { userId, date: dateStr } }),
      DailyReview.findOne({ where: { userId, date: dateStr } }),
      MindsetGateLog.findOne({
        where: {
          userId,
          gateDate: dateStr,
          completedAt: { [Op.ne]: null }
        },
        order: [['completedAt', 'DESC']]
      }),
      RoutineEntry.findAll({
        where: { userId, date: dateStr }
      })
    ]);

    const routineCompletedCount = (routineEntries || []).filter((e) => e.status === 'done').length;
    const routineCarriedCount = (routineEntries || []).filter((e) => (e.carryCount || 0) > 0).length;
    const routineMissedCount = (routineEntries || []).filter((e) => e.status === 'missed').length;

    // Unfinished MITs check
    const mits = [];
    if (plan?.mit1) mits.push({ title: plan.mit1, taskId: plan.mit1TaskId });
    if (plan?.mit2) mits.push({ title: plan.mit2, taskId: plan.mit2TaskId });
    if (plan?.mit3) mits.push({ title: plan.mit3, taskId: plan.mit3TaskId });

    const unfinishedMits = [];
    for (const mit of mits) {
      if (mit.taskId) {
        const t = await Task.findByPk(mit.taskId);
        if (t && t.status !== 'done') {
          unfinishedMits.push(t);
        }
      } else {
        // Free-text MIT
        unfinishedMits.push({ title: mit.title, isFreeText: true });
      }
    }

    return {
      date: dateStr,
      metrics: {
        callsLogged,
        emailsSent,
        whatsappsSent,
        totalOutreach: emailsSent + whatsappsSent,
        tasksCompleted: tasksCompleted.length,
        tasksCompletedCount: tasksCompleted.length,
        followUpsDone,
        followUpsMissed,
        gateCompleted: Boolean(completedGate),
        gateMethod: completedGate ? completedGate.method : null,
        routineCompletedCount,
        routineTotalCount: (routineEntries || []).length,
        routineCarriedCount,
        routineMissedCount
      },
      routineEntries: routineEntries || [],
      tasksCompleted,
      unfinishedMits,
      plan,
      existingReview
    };
  }

  /**
   * Auto-generate "Tomorrow's Plan" draft from pending tasks, events, and follow-ups
   */
  async generateTomorrowPlanDraft(userId, tomorrowDateStr) {
    const startOfTomorrow = new Date(`${tomorrowDateStr}T00:00:00.000Z`);
    const endOfTomorrow = new Date(`${tomorrowDateStr}T23:59:59.999Z`);

    const [tasksDue, eventsTomorrow, followUpsTomorrow] = await Promise.all([
      Task.findAll({
        where: {
          userId,
          status: ['todo', 'doing'],
          dueAt: { [Op.between]: [startOfTomorrow, endOfTomorrow] }
        },
        order: [['priority', 'ASC'], ['sortOrder', 'ASC']]
      }),
      CalendarEvent.findAll({
        where: {
          userId,
          startAt: { [Op.between]: [startOfTomorrow, endOfTomorrow] }
        },
        order: [['startAt', 'ASC']]
      }),
      FollowUp.findAll({
        where: {
          userId,
          status: 'pending',
          dueAt: { [Op.between]: [startOfTomorrow, endOfTomorrow] }
        },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'businessName', 'city'] }]
      })
    ]);

    return {
      tomorrowDate: tomorrowDateStr,
      targetDate: tomorrowDateStr,
      summary: {
        tasksCount: tasksDue.length,
        eventsCount: eventsTomorrow.length,
        followUpsCount: followUpsTomorrow.length
      },
      tasks: tasksDue,
      events: eventsTomorrow,
      followUps: followUpsTomorrow,
      suggestedTasks: tasksDue,
      scheduledEvents: eventsTomorrow,
      scheduledFollowUps: followUpsTomorrow,
      suggestedMit1: tasksDue[0]?.title || '',
      suggestedMit1TaskId: tasksDue[0]?.id || null,
      suggestedMit2: tasksDue[1]?.title || '',
      suggestedMit2TaskId: tasksDue[1]?.id || null,
      suggestedMit3: tasksDue[2]?.title || ''
    };
  }

  /**
   * Save Daily Review and optional carryover of unfinished MITs
   */
  async saveDailyReview(userId, payload) {
    const { date, doneSummary, win, lesson, tomorrowNotes, carryOverMits } = payload;

    const [review, created] = await DailyReview.findOrCreate({
      where: { userId, date },
      defaults: {
        userId,
        date,
        doneSummary,
        win,
        lesson,
        tomorrowNotes,
        completedAt: new Date()
      }
    });

    if (!created) {
      await review.update({
        doneSummary,
        win,
        lesson,
        tomorrowNotes,
        completedAt: new Date()
      });
    }

    // Carry over selected MITs to tomorrow as new or rescheduled tasks
    if (Array.isArray(carryOverMits) && carryOverMits.length > 0) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setUTCHours(9, 0, 0, 0);

      for (const item of carryOverMits) {
        if (item.taskId) {
          await Task.update({ dueAt: tomorrow, isMIT: true }, { where: { id: item.taskId, userId } });
        } else if (item.title) {
          await Task.create({
            userId,
            title: item.title,
            priority: 'high',
            dueAt: tomorrow,
            isMIT: true,
            status: 'todo'
          });
        }
      }
    }

    logger.info({ userId, date }, 'Saved daily evening review');
    return review;
  }

  /**
   * Helper to format a Date into YYYY-MM-DD in the user's timezone
   */
  getLocalDateStr(date, timezone = 'Asia/Dubai') {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(new Date(date));
    } catch {
      return new Date(date).toISOString().slice(0, 10);
    }
  }

  /**
   * Calculate consecutive day streaks for Review and Targets in user's timezone
   */
  async calculateStreaks(userId) {
    const settings = await UserSettings.findOne({ where: { userId } });
    const tz = settings?.timezone || 'Asia/Dubai';
    const targetOutreach = settings?.dailyEmailTarget || 20;
    const targetCalls = settings?.dailyCallTarget || 15;

    const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

    const [reviews, calls, outreachLogs] = await Promise.all([
      DailyReview.findAll({
        where: { userId },
        attributes: ['date', 'completedAt'],
        order: [['date', 'DESC']],
        raw: true
      }),
      Call.findAll({
        where: {
          userId,
          calledAt: { [Op.gte]: sixtyDaysAgo }
        },
        attributes: ['calledAt', 'createdAt'],
        raw: true
      }),
      OutreachLog.findAll({
        where: {
          userId,
          sentAt: { [Op.gte]: sixtyDaysAgo },
          outcome: { [Op.in]: ['sent', 'delivered', 'read'] }
        },
        attributes: ['sentAt', 'createdAt'],
        raw: true
      })
    ]);

    // 1. Calculate Review Streak (using date strings or completedAt formatted in user's timezone)
    const reviewDates = new Set();
    reviews.forEach((r) => {
      if (r.date) reviewDates.add(r.date);
      if (r.completedAt) reviewDates.add(this.getLocalDateStr(r.completedAt, tz));
    });

    const now = new Date();
    const todayLocalStr = this.getLocalDateStr(now, tz);

    let reviewStreak = 0;
    const reviewCursor = new Date(now);

    // If today's review is not done yet, start counting from yesterday
    if (!reviewDates.has(todayLocalStr)) {
      reviewCursor.setDate(reviewCursor.getDate() - 1);
    }

    while (true) {
      const dStr = this.getLocalDateStr(reviewCursor, tz);
      if (reviewDates.has(dStr)) {
        reviewStreak++;
        reviewCursor.setDate(reviewCursor.getDate() - 1);
      } else {
        break;
      }
    }

    // 2. Calculate Target Hit Streak
    const dailyCalls = new Map();
    calls.forEach((c) => {
      const dStr = this.getLocalDateStr(c.calledAt || c.createdAt, tz);
      dailyCalls.set(dStr, (dailyCalls.get(dStr) || 0) + 1);
    });

    const dailyOutreach = new Map();
    outreachLogs.forEach((o) => {
      const dStr = this.getLocalDateStr(o.sentAt || o.createdAt, tz);
      dailyOutreach.set(dStr, (dailyOutreach.get(dStr) || 0) + 1);
    });

    const isDayTargetHit = (dStr) => {
      const dayCalls = dailyCalls.get(dStr) || 0;
      const dayOutreach = dailyOutreach.get(dStr) || 0;
      return (dayCalls >= targetCalls) || (dayOutreach >= targetOutreach);
    };

    let targetStreak = 0;
    const targetCursor = new Date(now);

    // If today's target is not yet met, start counting from yesterday
    if (!isDayTargetHit(todayLocalStr)) {
      targetCursor.setDate(targetCursor.getDate() - 1);
    }

    while (true) {
      const dStr = this.getLocalDateStr(targetCursor, tz);
      if (isDayTargetHit(dStr)) {
        targetStreak++;
        targetCursor.setDate(targetCursor.getDate() - 1);
      } else {
        break;
      }
    }

    let gateStreak = 0;
    let isGateCompletedToday = false;
    try {
      const gateRes = await gateService.calculateGateStreak(userId);
      gateStreak = gateRes.gateStreak;
      isGateCompletedToday = gateRes.isCompletedToday;
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to calculate gate streak in plannerService');
    }

    // 4. Calculate Routine Streak
    let routineStreak = 0;
    try {
      const routineCompletedEntries = await RoutineEntry.findAll({
        where: {
          userId,
          status: 'done',
          createdAt: { [Op.gte]: sixtyDaysAgo }
        },
        attributes: ['date'],
        raw: true
      });
      const routineDates = new Set(routineCompletedEntries.map((r) => r.date));
      const routineCursor = new Date(now);
      if (!routineDates.has(todayLocalStr)) {
        routineCursor.setDate(routineCursor.getDate() - 1);
      }
      while (true) {
        const dStr = this.getLocalDateStr(routineCursor, tz);
        if (routineDates.has(dStr)) {
          routineStreak++;
          routineCursor.setDate(routineCursor.getDate() - 1);
        } else {
          break;
        }
      }
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to calculate routine streak');
    }

    return {
      reviewStreak,
      targetStreak,
      routineStreak,
      targetOutreach,
      targetCalls,
      timezone: tz,
      gateStreak,
      isGateCompletedToday
    };
  }
}

const instance = new PlannerService();
module.exports = instance;
module.exports.getDailyPlan = instance.getDailyPlan.bind(instance);
module.exports.saveDailyPlan = instance.saveDailyPlan.bind(instance);
module.exports.getEveningSummary = instance.getEveningSummary.bind(instance);
module.exports.generateTomorrowPlanDraft = instance.generateTomorrowPlanDraft.bind(instance);
module.exports.saveDailyReview = instance.saveDailyReview.bind(instance);
module.exports.calculateStreaks = instance.calculateStreaks.bind(instance);
module.exports.getLocalDateStr = instance.getLocalDateStr.bind(instance);
module.exports.PlannerService = PlannerService;
