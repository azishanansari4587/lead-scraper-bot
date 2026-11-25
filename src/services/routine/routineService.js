/**
 * CEO Routine Engine - Core Service
 * Manages routine templates, block definitions, day entry generation,
 * check-ins, carry-forward rules, task synchronization, and evidence aggregation.
 */

const { Op } = require('sequelize');
const RoutineTemplate = require('../../models/RoutineTemplate');
const RoutineBlock = require('../../models/RoutineBlock');
const RoutineEntry = require('../../models/RoutineEntry');
const RoutinePolicy = require('../../models/RoutinePolicy');
const Task = require('../../models/Task');
const Call = require('../../models/Call');
const OutreachLog = require('../../models/OutreachLog');
const FollowUp = require('../../models/FollowUp');
const UserSettings = require('../../models/UserSettings');
const logger = require('../../config/logger');

class RoutineService {
  /**
   * Helper: compute user local date string YYYY-MM-DD
   */
  getLocalDateStr(date = new Date(), timezone = 'Asia/Dubai') {
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
   * Helper: compute day of week (0=Sunday..6=Saturday) in user's timezone
   */
  getLocalDayOfWeek(date = new Date(), timezone = 'Asia/Dubai') {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short'
      }).format(new Date(date));
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return map[parts] !== undefined ? map[parts] : new Date(date).getDay();
    } catch {
      return new Date(date).getDay();
    }
  }

  /**
   * Helper: convert local date + HH:MM to exact UTC Date instant
   * Supports overnight spans (e.g. 23:00 to 06:00: end is on next day)
   */
  convertLocalTimeToUtc(dateStr, timeStr, timezone = 'Asia/Dubai', isNextDay = false) {
    const [hh, mm] = timeStr.split(':').map(Number);
    const [year, month, day] = dateStr.split('-').map(Number);

    // Create anchor in UTC for the target local calendar day
    const anchor = new Date(Date.UTC(year, month - 1, isNextDay ? day + 1 : day, hh, mm, 0, 0));

    // Get time zone offset difference between UTC and target timezone
    // Format anchor in target timezone to find actual hour/minute seen
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });

    const parts = formatter.formatToParts(anchor);
    const p = {};
    parts.forEach(({ type, value }) => { p[type] = value; });

    const localYear = Number(p.year);
    const localMonth = Number(p.month);
    const localDay = Number(p.day);
    const localHh = Number(p.hour === '24' ? 0 : p.hour);
    const localMm = Number(p.minute);

    const targetLocalMs = Date.UTC(localYear, localMonth - 1, localDay, localHh, localMm, 0, 0);
    const diffMs = anchor.getTime() - targetLocalMs;

    return new Date(anchor.getTime() + diffMs);
  }

  /**
   * Compute UTC instants for plannedStart and plannedEnd on a date
   * Correctly handles overnight blocks (e.g. 23:00 to 06:00)
   */
  computePlannedInstants(dateStr, startTime, endTime, timezone = 'Asia/Dubai') {
    const startAt = this.convertLocalTimeToUtc(dateStr, startTime, timezone, false);

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const isOvernight = (endH < startH) || (endH === startH && endM < startM);
    const endAt = this.convertLocalTimeToUtc(dateStr, endTime, timezone, isOvernight);

    return { plannedStartAt: startAt, plannedEndAt: endAt, isOvernight };
  }

  /**
   * Fetch user timezone
   */
  async getUserTimezone(userId) {
    const s = await UserSettings.findOne({ where: { userId } });
    return s?.timezone || 'Asia/Dubai';
  }

  // ---------------------------------------------------------------------------
  // TEMPLATES & BLOCKS MANAGEMENT
  // ---------------------------------------------------------------------------

  async listTemplates(userId) {
    return RoutineTemplate.findAll({
      where: { userId, isActive: true },
      include: [{ model: RoutineBlock, as: 'blocks', where: { isActive: true }, required: false }],
      order: [['isDefault', 'DESC'], ['name', 'ASC'], [{ model: RoutineBlock, as: 'blocks' }, 'sortOrder', 'ASC']]
    });
  }

  /**
   * Validate that no two active templates share the same weekday (Amendment 9)
   */
  async validateWeekdayAssignments(userId, templateIdToExclude, assignedDaysArray) {
    if (!Array.isArray(assignedDaysArray) || assignedDaysArray.length === 0) return;

    const existingTemplates = await RoutineTemplate.findAll({
      where: {
        userId,
        isActive: true,
        ...(templateIdToExclude ? { id: { [Op.ne]: templateIdToExclude } } : {})
      }
    });

    const conflictDays = [];
    for (const t of existingTemplates) {
      let days = [];
      try { days = JSON.parse(t.assignedDays || '[]'); } catch {}
      for (const d of assignedDaysArray) {
        if (days.includes(d)) {
          conflictDays.push({ day: d, conflictingTemplate: t.name });
        }
      }
    }

    if (conflictDays.length > 0) {
      const daysList = conflictDays.map((c) => `Day ${c.day} (assigned to "${c.conflictingTemplate}")`).join(', ');
      throw new Error(`Template weekday conflict: only one active template allowed per weekday. Conflict on: ${daysList}`);
    }
  }

  async createTemplate(userId, payload) {
    const { name, description, isDefault, assignedDays, travelStartDate, travelEndDate } = payload;
    const daysArray = Array.isArray(assignedDays) ? assignedDays : (assignedDays ? JSON.parse(assignedDays) : []);

    await this.validateWeekdayAssignments(userId, null, daysArray);

    if (isDefault) {
      await RoutineTemplate.update({ isDefault: false }, { where: { userId } });
    }

    return RoutineTemplate.create({
      userId,
      name,
      description,
      isDefault: Boolean(isDefault),
      assignedDays: JSON.stringify(daysArray),
      travelStartDate: travelStartDate || null,
      travelEndDate: travelEndDate || null,
      isActive: true
    });
  }

  async updateTemplate(userId, templateId, payload) {
    const template = await RoutineTemplate.findOne({ where: { id: templateId, userId } });
    if (!template) throw new Error('Routine template not found');

    const updates = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.travelStartDate !== undefined) updates.travelStartDate = payload.travelStartDate;
    if (payload.travelEndDate !== undefined) updates.travelEndDate = payload.travelEndDate;

    if (payload.assignedDays !== undefined) {
      const daysArray = Array.isArray(payload.assignedDays) ? payload.assignedDays : JSON.parse(payload.assignedDays || '[]');
      await this.validateWeekdayAssignments(userId, template.id, daysArray);
      updates.assignedDays = JSON.stringify(daysArray);
    }

    if (payload.isDefault !== undefined) {
      if (payload.isDefault) {
        await RoutineTemplate.update({ isDefault: false }, { where: { userId, id: { [Op.ne]: template.id } } });
      }
      updates.isDefault = Boolean(payload.isDefault);
    }

    return template.update(updates);
  }

  async deleteTemplate(userId, templateId) {
    const template = await RoutineTemplate.findOne({ where: { id: templateId, userId } });
    if (!template) throw new Error('Routine template not found');
    await RoutineBlock.update({ isActive: false }, { where: { templateId: template.id } });
    return template.update({ isActive: false });
  }

  /**
   * Overload check: checks overlaps & waking hours (Amendment 12)
   */
  checkOverload(blocks, minDailyRestHours = 7.0) {
    const warnings = [];
    if (!blocks || blocks.length === 0) return { hasWarnings: false, warnings: [] };

    // 1. Time overlap check between non-protected blocks
    const sorted = [...blocks].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (let i = 0; i < sorted.length; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        const b1 = sorted[i];
        const b2 = sorted[j];
        if (b1.startTime < b2.endTime && b1.endTime > b2.startTime) {
          warnings.push(`Overlap detected between "${b1.title}" (${b1.startTime}-${b1.endTime}) and "${b2.title}" (${b2.startTime}-${b2.endTime})`);
        }
      }
    }

    // 2. Compute total planned rest from protected blocks
    let totalRestMinutes = 0;
    blocks.forEach((b) => {
      if (b.isProtected) {
        const [sh, sm] = b.startTime.split(':').map(Number);
        const [eh, em] = b.endTime.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60; // Overnight rest/sleep
        totalRestMinutes += diff;
      }
    });

    const plannedRestHours = totalRestMinutes / 60;
    if (plannedRestHours < minDailyRestHours && blocks.some((b) => b.isProtected)) {
      warnings.push(`Total protected rest (${plannedRestHours.toFixed(1)}h) is below your minimum daily rest allowance of ${minDailyRestHours}h`);
    }

    return {
      hasWarnings: warnings.length > 0,
      warnings,
      plannedRestHours
    };
  }

  async addBlock(userId, payload) {
    const { templateId, title, category, startTime, endTime, daysOfWeek, isMustDo, isProtected, linkedTaskId, notes, sortOrder } = payload;
    const template = await RoutineTemplate.findOne({ where: { id: templateId, userId, isActive: true } });
    if (!template) throw new Error('Routine template not found or inactive');

    if (linkedTaskId) {
      const task = await Task.findOne({ where: { id: linkedTaskId, userId } });
      if (!task) throw new Error('Linked task not found or does not belong to you');
    }

    const daysArray = Array.isArray(daysOfWeek) ? daysOfWeek : (daysOfWeek ? JSON.parse(daysOfWeek) : []);

    const block = await RoutineBlock.create({
      userId,
      templateId,
      title,
      category: category || 'deep_work',
      startTime,
      endTime,
      daysOfWeek: JSON.stringify(daysArray),
      isMustDo: Boolean(isMustDo),
      isProtected: Boolean(isProtected),
      linkedTaskId: linkedTaskId || null,
      notes: notes || null,
      sortOrder: sortOrder || 0,
      isActive: true
    });

    const allBlocks = await RoutineBlock.findAll({ where: { templateId, isActive: true } });
    const policy = await RoutinePolicy.findOne({ where: { userId } });
    const overload = this.checkOverload(allBlocks, policy?.minDailyRestHours || 7.0);

    return { block, overload };
  }

  async updateBlock(userId, blockId, payload) {
    const block = await RoutineBlock.findOne({ where: { id: blockId, userId } });
    if (!block) throw new Error('Routine block not found');

    if (payload.linkedTaskId) {
      const task = await Task.findOne({ where: { id: payload.linkedTaskId, userId } });
      if (!task) throw new Error('Linked task not found or does not belong to you');
    }

    const updates = {};
    const allowed = ['title', 'category', 'startTime', 'endTime', 'isMustDo', 'isProtected', 'linkedTaskId', 'notes', 'sortOrder'];
    allowed.forEach((k) => {
      if (payload[k] !== undefined) updates[k] = payload[k];
    });

    if (payload.daysOfWeek !== undefined) {
      const arr = Array.isArray(payload.daysOfWeek) ? payload.daysOfWeek : JSON.parse(payload.daysOfWeek || '[]');
      updates.daysOfWeek = JSON.stringify(arr);
    }

    await block.update(updates);

    const allBlocks = await RoutineBlock.findAll({ where: { templateId: block.templateId, isActive: true } });
    const policy = await RoutinePolicy.findOne({ where: { userId } });
    const overload = this.checkOverload(allBlocks, policy?.minDailyRestHours || 7.0);

    return { block, overload };
  }

  async deleteBlock(userId, blockId) {
    const block = await RoutineBlock.findOne({ where: { id: blockId, userId } });
    if (!block) throw new Error('Routine block not found');
    await block.update({ isActive: false });
    return { success: true };
  }

  // ---------------------------------------------------------------------------
  // DAY ENTRY RESOLUTION & GENERATION
  // ---------------------------------------------------------------------------

  /**
   * Determine the active template for a given local date:
   * 1. Travel range override (travelStartDate <= dateStr <= travelEndDate)
   * 2. Weekday specific assignment
   * 3. Default template
   */
  async getActiveTemplateForDate(userId, dateStr) {
    const templates = await RoutineTemplate.findAll({
      where: { userId, isActive: true },
      include: [{ model: RoutineBlock, as: 'blocks', where: { isActive: true }, required: false }],
      order: [['isDefault', 'DESC']]
    });

    if (templates.length === 0) return null;

    // 1. Travel override check
    const travelTemplate = templates.find((t) => t.travelStartDate && t.travelEndDate && dateStr >= t.travelStartDate && dateStr <= t.travelEndDate);
    if (travelTemplate) return travelTemplate;

    // 2. Day of week check
    const tz = await this.getUserTimezone(userId);
    const dayOfWeek = this.getLocalDayOfWeek(new Date(`${dateStr}T12:00:00Z`), tz);

    const weekdayTemplate = templates.find((t) => {
      try {
        const days = JSON.parse(t.assignedDays || '[]');
        return Array.isArray(days) && days.includes(dayOfWeek);
      } catch {
        return false;
      }
    });

    if (weekdayTemplate) return weekdayTemplate;

    // 3. Default or first template
    return templates.find((t) => t.isDefault) || templates[0];
  }

  /**
   * Slot choice algorithm for carried must-do items (Amendment 1):
   * Never into a protected block, never into quiet hours, placed in the first open daytime slot.
   */
  findFirstAvailableSlot(existingEntries, policy, timezone = 'Asia/Dubai') {
    const quietStart = policy?.quietHoursStart || '22:00';
    const quietEnd = policy?.quietHoursEnd || '07:00';

    // candidate start hours from quietEnd to quietStart in 30-min increments
    const [startH, startM] = quietEnd.split(':').map(Number);
    const [endH, endM] = quietStart.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = (endH > startH ? endH : 22) * 60 + endM;

    for (let m = startMinutes; m + 30 <= endMinutes; m += 30) {
      const slotStartH = String(Math.floor(m / 60)).padStart(2, '0');
      const slotStartM = String(m % 60).padStart(2, '0');
      const slotEndH = String(Math.floor((m + 30) / 60)).padStart(2, '0');
      const slotEndM = String((m + 30) % 60).padStart(2, '0');

      const slotStart = `${slotStartH}:${slotStartM}`;
      const slotEnd = `${slotEndH}:${slotEndM}`;

      const collides = existingEntries.some((e) => {
        // Protected blocks or existing entries overlap
        return (slotStart < e.plannedEnd && slotEnd > e.plannedStart);
      });

      if (!collides) {
        return { startTime: slotStart, endTime: slotEnd };
      }
    }

    // Fallback: slot at quietEnd
    return { startTime: quietEnd, endTime: '08:00' };
  }

  /**
   * Idempotently generates day's entries from active template & carried must-dos
   * (Amendment 1: only one-off or task-linked must-dos carry over; recurring habits do not)
   */
  async generateDayEntries(userId, dateStr) {
    const tz = await this.getUserTimezone(userId);

    // 1. Check if entries already generated for today
    let existing = await RoutineEntry.findAll({
      where: { userId, date: dateStr },
      include: [{ model: Task, as: 'linkedTask' }],
      order: [['plannedStartAt', 'ASC']]
    });

    if (existing.length > 0) {
      // Lazy catch-up on existing entries
      await this.autoMarkMissed(userId, dateStr, tz);
      return RoutineEntry.findAll({
        where: { userId, date: dateStr },
        include: [{ model: Task, as: 'linkedTask' }],
        order: [['plannedStartAt', 'ASC']]
      });
    }

    // 2. Resolve active template
    const template = await this.getActiveTemplateForDate(userId, dateStr);
    const policy = await RoutinePolicy.findOne({ where: { userId } });
    const dayOfWeek = this.getLocalDayOfWeek(new Date(`${dateStr}T12:00:00Z`), tz);

    const createdEntries = [];

    if (template && template.blocks) {
      // Filter blocks applicable to today's day of week
      const applicableBlocks = template.blocks.filter((b) => {
        try {
          const days = JSON.parse(b.daysOfWeek || '[]');
          return days.length === 0 || days.includes(dayOfWeek);
        } catch {
          return true;
        }
      });

      for (const b of applicableBlocks) {
        const { plannedStartAt, plannedEndAt } = this.computePlannedInstants(dateStr, b.startTime, b.endTime, tz);
        const entry = await RoutineEntry.create({
          userId,
          date: dateStr,
          blockId: b.id,
          title: b.title,
          category: b.category,
          isMustDo: b.isMustDo,
          isProtected: b.isProtected,
          linkedTaskId: b.linkedTaskId,
          plannedStart: b.startTime,
          plannedEnd: b.endTime,
          plannedStartAt,
          plannedEndAt,
          status: 'pending',
          carryCount: 0
        });
        createdEntries.push(entry);
      }
    }

    // 3. Carry-Forward Rule (Amendment 1):
    // Scrutinize previous local day for incomplete must-do items:
    // Only one-off must-dos (blockId: null) or task-linked must-dos (linkedTaskId != null) carry over.
    // Recurring routine habit blocks (blockId != null && linkedTaskId == null) record a miss ONLY.
    const [y, m, d] = dateStr.split('-').map(Number);
    const prevDate = new Date(Date.UTC(y, m - 1, d - 1));
    const prevDateStr = prevDate.toISOString().slice(0, 10);

    const prevUnfinishedMustDos = await RoutineEntry.findAll({
      where: {
        userId,
        date: prevDateStr,
        isMustDo: true,
        status: { [Op.in]: ['pending', 'in_progress', 'missed'] },
        [Op.or]: [
          { blockId: null }, // One-off unplanned must-do
          { linkedTaskId: { [Op.ne]: null } } // Task-linked must-do
        ]
      }
    });

    for (const prev of prevUnfinishedMustDos) {
      // Find open non-protected, non-quiet slot
      const slot = this.findFirstAvailableSlot(createdEntries, policy, tz);
      const { plannedStartAt, plannedEndAt } = this.computePlannedInstants(dateStr, slot.startTime, slot.endTime, tz);

      const carriedEntry = await RoutineEntry.create({
        userId,
        date: dateStr,
        blockId: prev.blockId,
        title: prev.title,
        category: prev.category,
        isMustDo: true,
        isProtected: false,
        linkedTaskId: prev.linkedTaskId,
        plannedStart: slot.startTime,
        plannedEnd: slot.endTime,
        plannedStartAt,
        plannedEndAt,
        status: 'pending',
        carriedFromEntryId: prev.id,
        carryCount: (prev.carryCount || 0) + 1
      });

      createdEntries.push(carriedEntry);

      // Make sure previous entry is left recorded as 'missed' if it was pending
      if (prev.status === 'pending' || prev.status === 'in_progress') {
        await prev.update({ status: 'missed' });
      }
    }

    // 4. Lazy catch-up immediately after creation
    await this.autoMarkMissed(userId, dateStr, tz);

    return RoutineEntry.findAll({
      where: { userId, date: dateStr },
      include: [{ model: Task, as: 'linkedTask' }],
      order: [['plannedStartAt', 'ASC']]
    });
  }

  // ---------------------------------------------------------------------------
  // CHECK-INS, TASK SYNC & DECISIONS
  // ---------------------------------------------------------------------------

  /**
   * One-tap Start entry (Amendment 6: in_progress state)
   */
  async startEntry(userId, entryId) {
    const entry = await RoutineEntry.findOne({ where: { id: entryId, userId } });
    if (!entry) throw new Error('Routine entry not found');

    const now = new Date();
    await entry.update({
      actualStart: entry.actualStart || now,
      status: 'in_progress'
    });
    return entry;
  }

  /**
   * One-tap Done entry with explicit Task sync (Amendment 2)
   */
  async doneEntry(userId, entryId, options = {}) {
    const { completeLinkedTask = false, note } = options;
    const entry = await RoutineEntry.findOne({ where: { id: entryId, userId } });
    if (!entry) throw new Error('Routine entry not found');

    const now = new Date();
    await entry.update({
      actualEnd: now,
      completedAt: now,
      status: 'done',
      note: note || entry.note
    });

    // Task sync: complete linked task if requested or configured
    if (entry.linkedTaskId && completeLinkedTask) {
      const task = await Task.findOne({ where: { id: entry.linkedTaskId, userId } });
      if (task && task.status !== 'done') {
        await task.update({ status: 'done', completedAt: now });
      }
    }

    return entry;
  }

  /**
   * Sync entry completion when a Task is completed elsewhere (Amendment 2)
   */
  async syncFromCompletedTask(userId, taskId) {
    const tz = await this.getUserTimezone(userId);
    const todayStr = this.getLocalDateStr(new Date(), tz);

    const entries = await RoutineEntry.findAll({
      where: {
        userId,
        date: todayStr,
        linkedTaskId: taskId,
        status: { [Op.in]: ['pending', 'in_progress'] }
      }
    });

    const now = new Date();
    for (const entry of entries) {
      await entry.update({
        actualEnd: now,
        completedAt: now,
        status: 'done'
      });
    }

    return entries.length;
  }

  /**
   * One-tap Partial entry
   */
  async partialEntry(userId, entryId, note) {
    const entry = await RoutineEntry.findOne({ where: { id: entryId, userId } });
    if (!entry) throw new Error('Routine entry not found');

    const now = new Date();
    await entry.update({
      actualEnd: now,
      completedAt: now,
      status: 'partial',
      note: note || entry.note
    });
    return entry;
  }

  /**
   * One-tap Skip entry (Amendment 1: reason mandatory for must-do)
   */
  async skipEntry(userId, entryId, skipReason) {
    const entry = await RoutineEntry.findOne({ where: { id: entryId, userId } });
    if (!entry) throw new Error('Routine entry not found');

    if (entry.isMustDo && (!skipReason || skipReason.trim() === '')) {
      throw new Error('A skip reason is strictly mandatory for must-do blocks');
    }

    await entry.update({
      status: 'skipped',
      skipReason: skipReason ? skipReason.trim() : null
    });
    return entry;
  }

  /**
   * Quick-add unplanned work
   */
  async addUnplannedEntry(userId, payload) {
    const tz = await this.getUserTimezone(userId);
    const { title, category, startTime, endTime, isMustDo, note } = payload;
    const dateStr = payload.date || this.getLocalDateStr(new Date(), tz);

    const { plannedStartAt, plannedEndAt } = this.computePlannedInstants(dateStr, startTime, endTime, tz);

    return RoutineEntry.create({
      userId,
      date: dateStr,
      blockId: null, // Unplanned
      title,
      category: category || 'deep_work',
      isMustDo: Boolean(isMustDo),
      isProtected: false,
      linkedTaskId: null,
      plannedStart: startTime,
      plannedEnd: endTime,
      plannedStartAt,
      plannedEndAt,
      status: 'done', // Unplanned logged after the fact
      actualStart: plannedStartAt,
      actualEnd: plannedEndAt,
      completedAt: new Date(),
      note: note || null,
      carryCount: 0
    });
  }

  /**
   * Snooze overdue entry
   */
  async snoozeEntry(userId, entryId, snoozeMinutes = 15, reason) {
    const entry = await RoutineEntry.findOne({ where: { id: entryId, userId } });
    if (!entry) throw new Error('Routine entry not found');

    if (entry.isMustDo && (!reason || reason.trim() === '')) {
      throw new Error('A reason is mandatory to snooze a must-do block');
    }

    const policy = await RoutinePolicy.findOne({ where: { userId } });
    const maxSnoozes = policy?.maxSnoozesPerDay || 3;

    if ((entry.snoozeCount || 0) >= maxSnoozes) {
      throw new Error(`Snooze limit reached: you cannot snooze this entry more than ${maxSnoozes} times today`);
    }

    const newPlannedEndAt = new Date(new Date(entry.plannedEndAt).getTime() + snoozeMinutes * 60 * 1000);
    const tz = await this.getUserTimezone(userId);

    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const newEndTimeStr = formatter.format(newPlannedEndAt);

    await entry.update({
      plannedEnd: newEndTimeStr,
      plannedEndAt: newPlannedEndAt,
      snoozeCount: (entry.snoozeCount || 0) + 1,
      lastSnoozeAt: new Date(),
      note: reason ? `${entry.note ? entry.note + '\n' : ''}[Snoozed ${snoozeMinutes}m: ${reason}]` : entry.note
    });

    return entry;
  }

  /**
   * Forced Decision at carryCount >= 3 (Amendment 1)
   * Actions: 'break_tasks', 'change_priority', 'delete'
   */
  async resolveCarryDecision(userId, entryId, action, payload = {}) {
    const entry = await RoutineEntry.findOne({ where: { id: entryId, userId } });
    if (!entry) throw new Error('Routine entry not found');

    if (action === 'break_tasks') {
      const { subtasks } = payload; // Array of titles
      if (!Array.isArray(subtasks) || subtasks.length === 0) {
        throw new Error('Please provide at least one subtask title');
      }

      for (const title of subtasks) {
        await Task.create({
          userId,
          title,
          category: 'sales',
          priority: 'high',
          status: 'todo',
          dueAt: new Date()
        });
      }

      await entry.update({ status: 'done', note: `Broken into ${subtasks.length} smaller subtasks` });
      return { success: true, message: `Broken into ${subtasks.length} subtasks` };
    }

    if (action === 'change_priority') {
      await entry.update({ isMustDo: false, note: `${entry.note ? entry.note + '\n' : ''}[Demoted from must-do]` });
      return { success: true, message: 'Demoted from must-do' };
    }

    if (action === 'delete') {
      const { reason } = payload;
      if (!reason || reason.trim() === '') {
        throw new Error('A written reason is required to delete an item carried 3+ times');
      }
      await entry.update({ status: 'skipped', skipReason: `Deleted after 3 carries: ${reason.trim()}` });
      return { success: true, message: 'Item deleted with documented reason' };
    }

    throw new Error(`Unknown action: ${action}`);
  }

  // ---------------------------------------------------------------------------
  // LAZY CATCH-UP & AUTO-MARK MISSED
  // ---------------------------------------------------------------------------

  /**
   * Auto-marks missed entries after grace period (Amendment 6 & 10)
   * If status is in_progress, flags needsStillWorkingCheck instead of marking missed.
   */
  async autoMarkMissed(userId, dateStr, timezone = 'Asia/Dubai', graceMinutes = 15) {
    const now = new Date();
    const graceCutoff = new Date(now.getTime() - graceMinutes * 60 * 1000);

    const overdueEntries = await RoutineEntry.findAll({
      where: {
        userId,
        date: dateStr,
        status: { [Op.in]: ['pending', 'in_progress'] },
        plannedEndAt: { [Op.lt]: graceCutoff }
      }
    });

    for (const e of overdueEntries) {
      if (e.status === 'in_progress') {
        // Do not blindly mark missed if founder clicked Start!
        // The UI will show "Still working?" check
        continue;
      }
      await e.update({ status: 'missed' });
    }
  }

  // ---------------------------------------------------------------------------
  // EVIDENCE AGGREGATION FOR DAY TIMELINE (Amendment 13)
  // ---------------------------------------------------------------------------

  async getDayTimelineWithEvidence(userId, dateStr) {
    const tz = await this.getUserTimezone(userId);

    // Ensure entries generated and caught up
    const entries = await this.generateDayEntries(userId, dateStr);

    if (entries.length === 0) {
      return { date: dateStr, entries: [], evidenceCount: 0 };
    }

    // Find overall day time boundary (min plannedStartAt and max plannedEndAt)
    let minStart = entries[0].plannedStartAt;
    let maxEnd = entries[0].plannedEndAt;

    entries.forEach((e) => {
      if (e.plannedStartAt < minStart) minStart = e.plannedStartAt;
      if (e.plannedEndAt > maxEnd) maxEnd = e.plannedEndAt;
    });

    // One fast pass indexed query across models for the day
    const [calls, outreach, followups, tasks] = await Promise.all([
      Call.findAll({
        where: { userId, calledAt: { [Op.between]: [minStart, maxEnd] } },
        attributes: ['id', 'leadId', 'durationSec', 'calledAt', 'outcome'],
        raw: true
      }),
      OutreachLog.findAll({
        where: { userId, sentAt: { [Op.between]: [minStart, maxEnd] } },
        attributes: ['id', 'leadId', 'channel', 'sentAt', 'outcome'],
        raw: true
      }),
      FollowUp.findAll({
        where: { userId, status: 'done', updatedAt: { [Op.between]: [minStart, maxEnd] } },
        attributes: ['id', 'leadId', 'channel', 'updatedAt'],
        raw: true
      }),
      Task.findAll({
        where: { userId, status: 'done', completedAt: { [Op.between]: [minStart, maxEnd] } },
        attributes: ['id', 'title', 'category', 'completedAt'],
        raw: true
      })
    ]);

    // Map evidence into each entry's specific window
    const enrichedEntries = entries.map((e) => {
      const eStart = new Date(e.actualStart || e.plannedStartAt).getTime();
      const eEnd = new Date(e.actualEnd || e.plannedEndAt).getTime();

      const blockCalls = calls.filter((c) => {
        const t = new Date(c.calledAt).getTime();
        return t >= eStart && t <= eEnd;
      });

      const blockOutreach = outreach.filter((o) => {
        const t = new Date(o.sentAt).getTime();
        return t >= eStart && t <= eEnd;
      });

      const blockFollowUps = followups.filter((f) => {
        const t = new Date(f.updatedAt).getTime();
        return t >= eStart && t <= eEnd;
      });

      const blockTasks = tasks.filter((tk) => {
        const t = new Date(tk.completedAt).getTime();
        return t >= eStart && t <= eEnd;
      });

      const evidence = {
        callsCount: blockCalls.length,
        outreachCount: blockOutreach.length,
        followUpsCount: blockFollowUps.length,
        tasksCount: blockTasks.length,
        tasks: blockTasks.map((t) => t.title),
        hasEvidence: (blockCalls.length + blockOutreach.length + blockFollowUps.length + blockTasks.length) > 0
      };

      const json = e.toJSON();
      json.evidence = evidence;
      return json;
    });

    return {
      date: dateStr,
      entries: enrichedEntries,
      evidenceSummary: {
        totalCalls: calls.length,
        totalOutreach: outreach.length,
        totalTasksDone: tasks.length
      }
    };
  }

  /**
   * Now & Next calculation for Today page strip
   */
  async getNowAndNext(userId, dateStr) {
    const tz = await this.getUserTimezone(userId);
    const entries = await this.generateDayEntries(userId, dateStr);

    const now = new Date();
    const nowMs = now.getTime();

    let currentBlock = null;
    let nextBlock = null;

    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      const startMs = new Date(e.plannedStartAt).getTime();
      const endMs = new Date(e.plannedEndAt).getTime();

      if (nowMs >= startMs && nowMs <= endMs) {
        currentBlock = e;
        nextBlock = entries[i + 1] || null;
        break;
      } else if (nowMs < startMs && !nextBlock) {
        nextBlock = e;
      }
    }

    return {
      current: currentBlock,
      next: nextBlock,
      totalEntries: entries.length,
      completedEntries: entries.filter((e) => e.status === 'done').length
    };
  }
}

module.exports = new RoutineService();
