/**
 * Today Command Center Router
 * Delivers ultra-fast (<2s) aggregation of:
 * - Dual timezone (GST & IST)
 * - User targets and daily metrics (Calls, WhatsApps, Emails vs targets)
 * - Overdue follow-ups (flagged red)
 * - Today's calls to make
 * - Today's follow-ups
 * - Top 3 strategic priorities
 */

const express = require('express');
const { Op } = require('sequelize');
const Lead = require('../../models/Lead');
const Call = require('../../models/Call');
const FollowUp = require('../../models/FollowUp');
const OutreachLog = require('../../models/OutreachLog');
const UserSettings = require('../../models/UserSettings');

const router = express.Router();

/**
 * GET /api/today/summary - High-performance dashboard payload
 */
router.get('/summary', async (req, res, next) => {
  const startTime = Date.now();
  try {
    const userId = req.userId;

    const now = new Date();
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setUTCHours(23, 59, 59, 999);

    // Parallel optimized query executions
    const [
      settings,
      overdueFollowUps,
      todayFollowUps,
      callsLoggedToday,
      emailsSentToday,
      whatsappsSentToday,
      hotPriorityLeads
    ] = await Promise.all([
      // 1. User settings
      UserSettings.findOne({ where: { userId } }).then((s) => s || {
        timezone: 'Asia/Dubai',
        dailyEmailTarget: 30,
        dailyWhatsappTarget: 30,
        dailyCallTarget: 20
      }),

      // 2. Overdue follow-ups
      FollowUp.findAll({
        where: {
          userId,
          status: 'pending',
          dueAt: { [Op.lt]: now }
        },
        limit: 20,
        order: [['dueAt', 'ASC']],
        include: [
          {
            model: Lead,
            as: 'lead',
            attributes: ['id', 'businessName', 'phone', 'whatsapp', 'email', 'buyerType', 'priority', 'city', 'country']
          }
        ]
      }),

      // 3. Today's follow-ups
      FollowUp.findAll({
        where: {
          userId,
          status: 'pending',
          dueAt: {
            [Op.gte]: now,
            [Op.lte]: endOfDay
          }
        },
        limit: 30,
        order: [['dueAt', 'ASC']],
        include: [
          {
            model: Lead,
            as: 'lead',
            attributes: ['id', 'businessName', 'phone', 'whatsapp', 'email', 'buyerType', 'priority', 'city', 'country']
          }
        ]
      }),

      // 4. Calls logged today
      Call.count({
        where: {
          userId,
          calledAt: { [Op.gte]: startOfDay }
        }
      }),

      // 5. Emails sent today
      OutreachLog.count({
        where: {
          userId,
          channel: 'email',
          sentAt: { [Op.gte]: startOfDay },
          outcome: { [Op.in]: ['sent', 'delivered', 'read'] }
        }
      }),

      // 6. WhatsApps sent today
      OutreachLog.count({
        where: {
          userId,
          channel: 'whatsapp',
          sentAt: { [Op.gte]: startOfDay },
          outcome: { [Op.in]: ['sent', 'delivered', 'read'] }
        }
      }),

      // 7. Top hot leads needing action
      Lead.findAll({
        where: {
          userId,
          priority: 'hot',
          status: { [Op.notIn]: ['won', 'lost', 'not_interested'] }
        },
        limit: 5,
        order: [['score', 'DESC']]
      })
    ]);

    // Top 3 Priorities compilation
    const priorities = [];

    // Priority 1: Overdue items
    if (overdueFollowUps.length > 0) {
      priorities.push({
        type: 'overdue',
        badge: 'Critical Overdue',
        color: 'var(--danger)',
        title: `Clear ${overdueFollowUps.length} overdue follow-up${overdueFollowUps.length > 1 ? 's' : ''}`,
        description: `Earliest: ${overdueFollowUps[0]?.lead?.businessName || 'Lead'} (${overdueFollowUps[0]?.channel})`,
        actionLink: '/today'
      });
    }

    // Priority 2: Hot leads
    if (hotPriorityLeads.length > 0) {
      priorities.push({
        type: 'hot_lead',
        badge: 'Hot Buyer',
        color: 'var(--gold-primary)',
        title: `Engage ${hotPriorityLeads[0].businessName}`,
        description: `${hotPriorityLeads[0].buyerType || 'Buyer'} in ${hotPriorityLeads[0].city} (Score: ${hotPriorityLeads[0].score})`,
        actionLink: `/leads?id=${hotPriorityLeads[0].id}`
      });
    }

    // Priority 3: Today's scheduled calls
    const todayCalls = todayFollowUps.filter((f) => f.channel === 'call');
    if (todayCalls.length > 0) {
      priorities.push({
        type: 'calls',
        badge: 'Calls Queue',
        color: 'var(--primary-color)',
        title: `${todayCalls.length} sales call${todayCalls.length > 1 ? 's' : ''} scheduled for today`,
        description: `Next: ${todayCalls[0]?.lead?.businessName || 'Lead'}`,
        actionLink: '/calls'
      });
    }

    // Fill up to 3 priorities if needed
    if (priorities.length < 3) {
      priorities.push({
        type: 'daily_target',
        badge: 'Outreach Target',
        color: 'var(--emerald-accent)',
        title: `Reach today's target: ${settings.dailyEmailTarget} emails & ${settings.dailyWhatsappTarget} WhatsApps`,
        description: `Current progress: ${emailsSentToday + whatsappsSentToday} sent so far`,
        actionLink: '/leads'
      });
    }

    const durationMs = Date.now() - startTime;

    res.json({
      success: true,
      durationMs,
      timezones: {
        current: settings.timezone || 'Asia/Dubai',
        dubaiUtcOffset: '+04:00',
        indiaUtcOffset: '+05:30'
      },
      targets: {
        emails: { logged: emailsSentToday, target: settings.dailyEmailTarget || 30 },
        whatsapps: { logged: whatsappsSentToday, target: settings.dailyWhatsappTarget || 30 },
        calls: { logged: callsLoggedToday, target: settings.dailyCallTarget || 20 }
      },
      overdueFollowUps,
      todayFollowUps,
      priorities: priorities.slice(0, 3)
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
