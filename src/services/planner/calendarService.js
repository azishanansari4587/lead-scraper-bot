/**
 * Calendar Merging & Conflict Detection Engine
 * Merges CalendarEvents, Tasks (dueAt), pending FollowUps, and Call queues
 */

const { Op } = require('sequelize');
const CalendarEvent = require('../../models/CalendarEvent');
const Task = require('../../models/Task');
const FollowUp = require('../../models/FollowUp');
const ContentPost = require('../../models/ContentPost');
const Lead = require('../../models/Lead');
const MindmapNode = require('../../models/MindmapNode');
const Mindmap = require('../../models/Mindmap');
const RoutineEntry = require('../../models/RoutineEntry');
const WorkSchedule = require('../../models/WorkSchedule');
const WorkWindow = require('../../models/WorkWindow');
const walletIntervalMath = require('../wallet/walletIntervalMath');
const logger = require('../../config/logger');

class CalendarService {
  /**
   * Get merged items between from and to dates (ISO)
   * Detects overlaps between CalendarEvents
   */
  async getMergedCalendar(userIdOrOptions, fromDate, toDate) {
    let userId = userIdOrOptions;
    let from = fromDate;
    let to = toDate;

    if (typeof userIdOrOptions === 'object' && userIdOrOptions !== null) {
      userId = userIdOrOptions.userId;
      from = userIdOrOptions.from || fromDate;
      to = userIdOrOptions.to || toDate;
    }

    const startFrom = from ? new Date(from) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const endTo = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [events, tasks, followUps, posts, mindmapNodes, routineEntries] = await Promise.all([
      CalendarEvent.findAll({
        where: {
          userId,
          [Op.and]: [
            { startAt: { [Op.lte]: endTo } },
            { endAt: { [Op.gte]: startFrom } }
          ]
        },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'businessName', 'city', 'country', 'phone', 'whatsapp'] }],
        order: [['startAt', 'ASC']]
      }),
      Task.findAll({
        where: {
          userId,
          status: { [Op.in]: ['todo', 'doing'] },
          dueAt: { [Op.between]: [startFrom, endTo] }
        },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'businessName'] }],
        order: [['dueAt', 'ASC']]
      }),
      FollowUp.findAll({
        where: {
          userId,
          status: 'pending',
          dueAt: { [Op.between]: [startFrom, endTo] }
        },
        include: [{ model: Lead, as: 'lead', attributes: ['id', 'businessName', 'phone', 'whatsapp', 'email', 'city'] }],
        order: [['dueAt', 'ASC']]
      }),
      ContentPost.findAll({
        where: {
          userId,
          scheduledAt: { [Op.between]: [startFrom, endTo] }
        },
        order: [['scheduledAt', 'ASC']]
      }),
      MindmapNode.findAll({
        where: {
          userId,
          status: { [Op.in]: ['todo', 'doing'] },
          dueDate: { [Op.between]: [startFrom, endTo] }
        },
        include: [{ model: Mindmap, as: 'mindmap', attributes: ['id', 'title'] }],
        order: [['dueDate', 'ASC']]
      }),
      RoutineEntry.findAll({
        where: {
          userId,
          plannedStartAt: { [Op.lte]: endTo },
          plannedEndAt: { [Op.gte]: startFrom }
        },
        order: [['plannedStartAt', 'ASC']]
      })
    ]);

    // 1. Conflict Detection across CalendarEvents
    // Two events conflict if startA < endB and endA > startB
    const conflictMap = new Map();
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        const a = events[i];
        const b = events[j];
        if (!a.allDay && !b.allDay) {
          const aStart = new Date(a.startAt).getTime();
          const aEnd = new Date(a.endAt).getTime();
          const bStart = new Date(b.startAt).getTime();
          const bEnd = new Date(b.endAt).getTime();

          if (aStart < bEnd && aEnd > bStart) {
            // Overlap detected!
            if (!conflictMap.has(a.id)) conflictMap.set(a.id, []);
            if (!conflictMap.has(b.id)) conflictMap.set(b.id, []);
            conflictMap.get(a.id).push({ id: b.id, title: b.title });
            conflictMap.get(b.id).push({ id: a.id, title: a.title });
          }
        }
      }
    }

    // 2. Format Events
    const formattedEvents = events.map((ev) => {
      const conflicts = conflictMap.get(ev.id) || [];
      return {
        id: ev.id,
        rawId: ev.id,
        feedId: `event_${ev.id}`,
        itemType: 'event',
        title: ev.title,
        startAt: ev.startAt,
        endAt: ev.endAt,
        allDay: Boolean(ev.allDay),
        type: ev.type,
        category: ev.type,
        location: ev.location,
        notes: ev.notes,
        lead: ev.lead,
        hasConflict: conflicts.length > 0,
        conflicts: conflicts.map((c) => c.id),
        conflictWith: conflicts,
        color: this.getEventColor(ev.type)
      };
    });

    // 3. Format Tasks
    const formattedTasks = tasks.map((t) => {
      const taskDue = new Date(t.dueAt);
      const endAt = new Date(taskDue.getTime() + 30 * 60 * 1000); // 30 min block
      return {
        id: t.id,
        rawId: t.id,
        feedId: `task_${t.id}`,
        itemType: 'task',
        title: `Task: ${t.title}`,
        startAt: t.dueAt,
        endAt: endAt.toISOString(),
        allDay: false,
        category: t.category,
        priority: t.priority,
        isMIT: Boolean(t.isMIT),
        lead: t.lead,
        hasConflict: false,
        conflicts: [],
        color: 'var(--gold-primary)'
      };
    });

    // 4. Format FollowUps
    const formattedFollowUps = followUps.map((f) => {
      const fDue = new Date(f.dueAt);
      const endAt = new Date(fDue.getTime() + 15 * 60 * 1000); // 15 min block
      const isCall = f.channel === 'call';
      return {
        id: f.id,
        rawId: f.id,
        feedId: `followup_${f.id}`,
        itemType: isCall ? 'call' : 'followup',
        title: `${isCall ? 'Call to Make' : 'Follow-up'}: ${f.lead?.businessName || 'Lead'}`,
        startAt: f.dueAt,
        endAt: endAt.toISOString(),
        allDay: false,
        channel: f.channel,
        step: f.step,
        lead: f.lead,
        hasConflict: false,
        conflicts: [],
        color: isCall ? '#8b5cf6' : '#10b981'
      };
    });

    // 5. Format ContentPosts (Phase C Marketing Hub)
    const nowMs = Date.now();
    const formattedPosts = posts.map((p) => {
      const pStart = new Date(p.scheduledAt);
      const endAt = new Date(pStart.getTime() + 30 * 60 * 1000);
      const isMissed = p.status !== 'posted' && pStart.getTime() < nowMs;
      return {
        id: p.id,
        rawId: p.id,
        feedId: `post_${p.id}`,
        itemType: 'post',
        title: `Post: ${p.topic} (${p.platform})`,
        startAt: p.scheduledAt,
        endAt: endAt.toISOString(),
        allDay: false,
        platform: p.platform,
        status: p.status,
        isMissed,
        assetLink: p.assetLink,
        hasConflict: false,
        conflicts: [],
        color: isMissed ? '#ef4444' : '#ec4899' // Red if missed, pink for social marketing
      };
    });

    // 6. Format Mindmap Actions (Business Mindmap Engine)
    const formattedMindmapNodes = (mindmapNodes || []).map((node) => {
      const nodeDue = new Date(node.dueDate);
      const endAt = new Date(nodeDue.getTime() + 45 * 60 * 1000); // 45 min block
      return {
        id: node.id,
        rawId: node.id,
        feedId: `mindmap_${node.id}`,
        itemType: 'mindmap_action',
        title: `Action: ${node.title}`,
        startAt: node.dueDate,
        endAt: endAt.toISOString(),
        allDay: false,
        type: 'mindmap_action',
        category: 'mindmap',
        priority: node.priority,
        status: node.status,
        mindmapId: node.mindmapId,
        mindmapTitle: node.mindmap?.title || 'Goal Mindmap',
        deepLink: `/mindmaps/${node.mindmapId}#node-${node.id}`,
        hasConflict: false,
        conflicts: [],
        color: node.priority === 'now' ? '#F59E0B' : (node.priority === 'next' ? '#38BDF8' : '#94A3B8')
      };
    });

    // 7. Format RoutineEntries (CEO Routine Engine)
    const formattedRoutineEntries = (routineEntries || []).map((r) => {
      const isMissed = r.status === 'missed';
      return {
        id: r.id,
        rawId: r.id,
        feedId: `routine_${r.id}`,
        itemType: 'routine',
        title: `Routine: ${r.title}${r.isMustDo ? ' ⭐' : ''}`,
        startAt: r.plannedStartAt,
        endAt: r.plannedEndAt,
        allDay: false,
        type: 'routine',
        category: r.category,
        status: r.status,
        isMustDo: Boolean(r.isMustDo),
        isProtected: Boolean(r.isProtected),
        hasConflict: false,
        conflicts: [],
        color: isMissed ? '#ef4444' : (r.isMustDo ? '#F59E0B' : '#10B981')
      };
    });

    // 8. Format WorkWindows (Work Wallet Engine)
    const formattedWorkWindows = [];
    try {
      const workSchedules = await WorkSchedule.findAll({
        where: { userId, isActive: true },
        include: [{ model: WorkWindow, as: 'windows', where: { isActive: true }, required: false }]
      });

      if (workSchedules.length > 0) {
        const cur = new Date(startFrom);
        while (cur <= endTo) {
          const dateStr = cur.toISOString().slice(0, 10);
          const dayOfWeek = cur.getUTCDay();

          const activeSched = workSchedules.find((s) => {
            if (s.travelStartDate && s.travelEndDate) {
              return dateStr >= s.travelStartDate && dateStr <= s.travelEndDate;
            }
            const days = typeof s.assignedDays === 'string' ? JSON.parse(s.assignedDays || '[]') : s.assignedDays;
            return Array.isArray(days) && days.includes(dayOfWeek);
          }) || workSchedules.find((s) => s.isDefault) || workSchedules[0];

          if (activeSched && activeSched.windows) {
            for (const win of activeSched.windows) {
              const { startAt, endAt } = walletIntervalMath.computeWindowInstants(dateStr, win.startTime, win.endTime, 'Asia/Dubai');
              formattedWorkWindows.push({
                id: `work_window_${win.id}_${dateStr}`,
                rawId: win.id,
                feedId: `work_window_${win.id}_${dateStr}`,
                itemType: 'work_window',
                title: `Work Window: ${win.startTime} - ${win.endTime}`,
                startAt: startAt.toISOString(),
                endAt: endAt.toISOString(),
                allDay: false,
                type: 'work_window',
                category: 'work',
                hasConflict: false,
                conflicts: [],
                color: '#10B981'
              });
            }
          }
          cur.setDate(cur.getDate() + 1);
        }
      }
    } catch (err) {
      logger.warn({ err: err.message }, 'Failed to compute calendar work windows');
    }

    // Merge and sort chronologically
    const allItems = [
      ...formattedEvents,
      ...formattedTasks,
      ...formattedFollowUps,
      ...formattedPosts,
      ...formattedMindmapNodes,
      ...formattedRoutineEntries,
      ...formattedWorkWindows
    ].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

    return {
      success: true,
      from: startFrom.toISOString(),
      to: endTo.toISOString(),
      total: allItems.length,
      conflictCount: conflictMap.size,
      items: allItems
    };
  }

  getEventColor(type) {
    switch (type) {
      case 'meeting':
        return '#3b82f6'; // Blue
      case 'call_block':
        return '#6366f1'; // Indigo
      case 'work_block':
        return '#8b5cf6'; // Purple
      case 'production':
        return '#d97706'; // Amber
      case 'shipping':
        return '#059669'; // Emerald
      default:
        return '#64748b'; // Slate
    }
  }
}

const instance = new CalendarService();
module.exports = instance;
module.exports.getMergedCalendar = instance.getMergedCalendar.bind(instance);
module.exports.CalendarService = CalendarService;
