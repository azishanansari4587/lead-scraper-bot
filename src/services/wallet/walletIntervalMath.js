/**
 * Work Wallet Interval Math
 *
 * Provides pure, deterministic interval arithmetic:
 * - Interval merging (union)
 * - Interval intersection
 * - Interval difference (subtraction)
 * - Timezone-aware local time to UTC instant conversions
 * - Derived daily target minutes
 * - Schedule validation against quiet hours, protected blocks, and min sleep/meals
 *
 * All money is in integer paise; all time comparisons are UTC millisecond timestamps.
 */

/**
 * Convert local dateStr (YYYY-MM-DD) and timeStr (HH:MM) to a UTC Date object.
 * Correctly handles overnight day boundaries when isNextDay is true.
 */
function convertLocalTimeToUtc(dateStr, timeStr, timezone = 'Asia/Dubai', isNextDay = false) {
  if (!dateStr || !timeStr) return null;
  const [hh, mm] = timeStr.split(':').map(Number);
  const [year, month, day] = dateStr.split('-').map(Number);

  // UTC anchor for the target local calendar day
  const anchor = new Date(Date.UTC(year, month - 1, isNextDay ? day + 1 : day, hh, mm, 0, 0));

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
 * Compute UTC start and end instants for a time window on a local date.
 */
function computeWindowInstants(dateStr, startTime, endTime, timezone = 'Asia/Dubai') {
  const startAt = convertLocalTimeToUtc(dateStr, startTime, timezone, false);
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);

  const isOvernight = (endH < startH) || (endH === startH && endM < startM);
  const endAt = convertLocalTimeToUtc(dateStr, endTime, timezone, isOvernight);

  return { startAt, endAt, isOvernight };
}

/**
 * Normalize and merge overlapping or contiguous intervals: [{ start, end, ... }]
 * Returns disjoint sorted intervals: [{ start, end }]
 */
function mergeIntervals(intervals) {
  if (!Array.isArray(intervals) || intervals.length === 0) return [];

  // Filter invalid intervals and convert to ms numbers
  const valid = intervals
    .map((iv) => {
      const start = typeof iv.start === 'number' ? iv.start : new Date(iv.start).getTime();
      const end = typeof iv.end === 'number' ? iv.end : new Date(iv.end).getTime();
      return { ...iv, start, end };
    })
    .filter((iv) => !isNaN(iv.start) && !isNaN(iv.end) && iv.end > iv.start)
    .sort((a, b) => a.start - b.start);

  if (valid.length === 0) return [];

  const merged = [ { start: valid[0].start, end: valid[0].end } ];

  for (let i = 1; i < valid.length; i++) {
    const current = valid[i];
    const prev = merged[merged.length - 1];

    if (current.start <= prev.end) {
      // Overlapping or contiguous
      prev.end = Math.max(prev.end, current.end);
    } else {
      merged.push({ start: current.start, end: current.end });
    }
  }

  return merged;
}

/**
 * Intersect two lists of disjoint intervals (A ∩ B)
 */
function intersectIntervals(intervalsA, intervalsB) {
  const a = mergeIntervals(intervalsA);
  const b = mergeIntervals(intervalsB);
  const result = [];

  let i = 0;
  let j = 0;

  while (i < a.length && j < b.length) {
    const start = Math.max(a[i].start, b[j].start);
    const end = Math.min(a[i].end, b[j].end);

    if (start < end) {
      result.push({ start, end });
    }

    if (a[i].end < b[j].end) {
      i++;
    } else {
      j++;
    }
  }

  return result;
}

/**
 * Subtract intervalsB from intervalsA (A \ B)
 */
function subtractIntervals(intervalsA, intervalsB) {
  const base = mergeIntervals(intervalsA);
  const toRemove = mergeIntervals(intervalsB);

  if (toRemove.length === 0) return base;
  if (base.length === 0) return [];

  const result = [];

  for (const item of base) {
    let currentStart = item.start;
    const currentEnd = item.end;

    for (const rem of toRemove) {
      if (rem.end <= currentStart) continue; // rem is before current
      if (rem.start >= currentEnd) break;    // rem is after current

      if (rem.start > currentStart) {
        result.push({ start: currentStart, end: rem.start });
      }

      currentStart = Math.max(currentStart, rem.end);
      if (currentStart >= currentEnd) break;
    }

    if (currentStart < currentEnd) {
      result.push({ start: currentStart, end: currentEnd });
    }
  }

  return result;
}

/**
 * Sum total integer minutes of an interval list
 */
function sumIntervalMinutes(intervals) {
  if (!Array.isArray(intervals)) return 0;
  return intervals.reduce((acc, iv) => {
    const durationMs = iv.end - iv.start;
    return acc + Math.floor(Math.max(0, durationMs) / 60000);
  }, 0);
}

/**
 * Validate proposed schedule against health constraints, protected blocks, and quiet hours
 */
function validateScheduleConstraints({
  windows,
  quietHours,
  protectedBlocks = [],
  minDailySleepMinutes = 390,
  minDailyMealMinutes = 60,
  minDailyPersonalMinutes = 120
}) {
  const errors = [];
  const warnings = [];

  // Helper to test if two interval minute-spans [s1, e1] and [s2, e2] in a 24h circle overlap
  function timeSpansOverlap(s1, e1, s2, e2) {
    const segs1 = e1 > s1 ? [{ s: s1, e: e1 }] : [{ s: s1, e: 1440 }, { s: 0, e: e1 }];
    const segs2 = e2 > s2 ? [{ s: s2, e: e2 }] : [{ s: s2, e: 1440 }, { s: 0, e: e2 }];
    for (const a of segs1) {
      for (const b of segs2) {
        if (Math.max(a.s, b.s) < Math.min(a.e, b.e)) return true;
      }
    }
    return false;
  }

  // 1. Calculate total scheduled minutes in a single day
  let totalScheduledMin = 0;
  for (const win of windows) {
    const [sh, sm] = win.startTime.split(':').map(Number);
    const [eh, em] = win.endTime.split(':').map(Number);
    let dur = (eh * 60 + em) - (sh * 60 + sm);
    if (dur <= 0) dur += 1440; // overnight
    totalScheduledMin += dur;
  }

  const maxAllowedWorkMin = 1440 - minDailySleepMinutes - minDailyMealMinutes - minDailyPersonalMinutes;
  if (totalScheduledMin > maxAllowedWorkMin) {
    errors.push(
      `Total scheduled work (${totalScheduledMin} mins) exceeds maximum allowed (${maxAllowedWorkMin} mins) to guarantee minimum sleep (${minDailySleepMinutes} mins), meals (${minDailyMealMinutes} mins), and personal time (${minDailyPersonalMinutes} mins).`
    );
  }

  // 2. Check overlap with quiet hours if present
  if (quietHours && quietHours.enabled) {
    const [qhStartH, qhStartM] = (quietHours.start || '22:00').split(':').map(Number);
    const [qhEndH, qhEndM] = (quietHours.end || '07:00').split(':').map(Number);
    const qhStart = qhStartH * 60 + qhStartM;
    const qhEnd = qhEndH * 60 + qhEndM;

    for (const win of windows) {
      const [wStartH, wStartM] = win.startTime.split(':').map(Number);
      const [wEndH, wEndM] = win.endTime.split(':').map(Number);
      const wStart = wStartH * 60 + wStartM;
      const wEnd = wEndH * 60 + wEndM;

      if (timeSpansOverlap(wStart, wEnd, qhStart, qhEnd)) {
        errors.push(`Work window ${win.startTime}-${win.endTime} overlaps with configured quiet hours (${quietHours.start || '22:00'}-${quietHours.end || '07:00'}).`);
      }
    }
  }

  // 3. Check overlap with protected routine blocks
  if (Array.isArray(protectedBlocks) && protectedBlocks.length > 0) {
    for (const block of protectedBlocks) {
      if (!block.startTime || !block.endTime) continue;
      const [pbStartH, pbStartM] = block.startTime.split(':').map(Number);
      const [pbEndH, pbEndM] = block.endTime.split(':').map(Number);
      const pbStart = pbStartH * 60 + pbStartM;
      const pbEnd = pbEndH * 60 + pbEndM;

      for (const win of windows) {
        const [wStartH, wStartM] = win.startTime.split(':').map(Number);
        const [wEndH, wEndM] = win.endTime.split(':').map(Number);
        const wStart = wStartH * 60 + wStartM;
        const wEnd = wEndH * 60 + wEndM;

        if (timeSpansOverlap(wStart, wEnd, pbStart, pbEnd)) {
          errors.push(`Work window ${win.startTime}-${win.endTime} overlaps with protected routine block '${block.title || 'Protected Block'}' (${block.startTime}-${block.endTime}).`);
        }
      }
    }
  }

  return { isValid: errors.length === 0, errors, warnings, totalScheduledMin };
}

/**
 * Process a day's raw intervals:
 * - Computes excused intervals from breaks (up to allowance), quiet hours, protected routine blocks
 * - Derives effective windows and daily target minutes
 * - Merges verified work sessions (respecting heartbeat and max length)
 * - Computes in-window worked, overtime worked, and unworked scheduled past intervals
 */
function calculateDayBreakdown({
  dateStr,
  timezone = 'Asia/Dubai',
  windows = [],
  sessions = [],
  breaks = [],
  isRestDay = false,
  isLeaveDay = false,
  isPaused = false,
  policy = {},
  quietHours = null,
  protectedBlocks = [],
  nowUtc = new Date()
}) {
  const nowMs = nowUtc.getTime();
  const maxSessionMs = (policy.maxSessionLengthMinutes || 480) * 60000;
  const breakAllowanceMin = policy.dailyBreakAllowanceMinutes !== undefined ? policy.dailyBreakAllowanceMinutes : 90;

  // If rest day, leave day, or paused, target is 0 and no windows penalize
  if (isRestDay || isLeaveDay || isPaused) {
    return {
      dateStr,
      dailyTargetMinutes: 0,
      workedInWindowMinutes: 0,
      overtimeWorkedMinutes: 0,
      unworkedPastScheduledMinutes: 0,
      futureScheduledMinutes: 0,
      baseEarnPaise: 0,
      overtimeEarnPaise: 0,
      penaltyPaise: 0,
      capTrimMinutes: 0,
      isRestDay,
      isLeaveDay,
      isPaused,
      effectiveWindows: [],
      mergedSessions: [],
      workedInWindowIntervals: [],
      overtimeWorkedIntervals: [],
      unworkedPastIntervals: [],
      futureScheduledIntervals: []
    };
  }

  // 1. Convert windows to UTC intervals
  const rawWindowIntervals = windows.map((w) => {
    const { startAt, endAt } = computeWindowInstants(dateStr, w.startTime, w.endTime, timezone);
    return {
      start: startAt.getTime(),
      end: endAt.getTime(),
      windowId: w.id
    };
  });
  const mergedWindows = mergeIntervals(rawWindowIntervals);

  // 2. Excused mask:
  // a) Breaks within dailyBreakAllowanceMinutes
  const excusedBreaks = [];
  let accumulatedBreakMin = 0;
  const sortedBreaks = [...breaks].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

  for (const brk of sortedBreaks) {
    const bStart = new Date(brk.startAt).getTime();
    const bEnd = brk.endAt ? new Date(brk.endAt).getTime() : nowMs;
    const durMin = Math.floor(Math.max(0, bEnd - bStart) / 60000);

    if (durMin <= 0) continue;

    if (accumulatedBreakMin + durMin <= breakAllowanceMin) {
      // Entire break is within allowance
      excusedBreaks.push({ start: bStart, end: bEnd });
      accumulatedBreakMin += durMin;
    } else if (accumulatedBreakMin < breakAllowanceMin) {
      // Partial break within allowance
      const allowedMin = breakAllowanceMin - accumulatedBreakMin;
      const partialEnd = bStart + allowedMin * 60000;
      excusedBreaks.push({ start: bStart, end: partialEnd });
      accumulatedBreakMin = breakAllowanceMin;
    }
  }

  // b) Quiet hours
  const quietIntervals = [];
  if (quietHours && quietHours.enabled) {
    const { startAt: qStart, endAt: qEnd } = computeWindowInstants(
      dateStr,
      quietHours.start || '22:00',
      quietHours.end || '07:00',
      timezone
    );
    quietIntervals.push({ start: qStart.getTime(), end: qEnd.getTime() });
  }

  // c) Protected routine blocks
  const protectedIntervals = protectedBlocks.map((b) => {
    const { startAt, endAt } = computeWindowInstants(dateStr, b.startTime, b.endTime, timezone);
    return { start: startAt.getTime(), end: endAt.getTime() };
  });

  const fullExcusedMask = mergeIntervals([...excusedBreaks, ...quietIntervals, ...protectedIntervals]);

  // 3. Effective windows (Window \ Excused)
  const effectiveWindows = subtractIntervals(mergedWindows, fullExcusedMask);
  const dailyTargetMinutes = sumIntervalMinutes(effectiveWindows);

  // 4. Verified sessions
  const sessionIntervals = [];
  for (const s of sessions) {
    const startMs = new Date(s.startAt).getTime();
    let endMs;

    if (s.status === 'completed' && s.endAt) {
      endMs = new Date(s.endAt).getTime();
    } else if (s.status === 'running') {
      // Liveness rule: session only earns up to confirmed heartbeat + 60s, capped at nowMs
      const hbMs = s.lastHeartbeatAt ? new Date(s.lastHeartbeatAt).getTime() : startMs;
      endMs = Math.min(nowMs, hbMs + 60000);
    } else {
      endMs = s.endAt ? new Date(s.endAt).getTime() : startMs;
    }

    // Cap max session length
    endMs = Math.min(endMs, startMs + maxSessionMs);

    if (endMs > startMs) {
      sessionIntervals.push({
        start: startMs,
        end: endMs,
        sessionId: s.id
      });
    }
  }
  const mergedSessions = mergeIntervals(sessionIntervals);

  // 5. In-window worked vs Overtime worked
  const workedInWindowIntervals = intersectIntervals(mergedSessions, effectiveWindows);
  const workedInWindowMinutes = sumIntervalMinutes(workedInWindowIntervals);

  const overtimeWorkedIntervals = subtractIntervals(mergedSessions, effectiveWindows);
  const overtimeWorkedMinutes = sumIntervalMinutes(overtimeWorkedIntervals);

  // 6. Unworked scheduled windows
  const unworkedScheduledIntervals = subtractIntervals(effectiveWindows, mergedSessions);

  // Separate past unworked (penalizable) from future unworked (upcoming)
  const unworkedPastIntervals = [];
  const futureScheduledIntervals = [];

  for (const iv of unworkedScheduledIntervals) {
    if (iv.end <= nowMs) {
      // Wholly in the past
      unworkedPastIntervals.push(iv);
    } else if (iv.start < nowMs && iv.end > nowMs) {
      // Partially in the past, split at nowMs
      unworkedPastIntervals.push({ start: iv.start, end: nowMs });
      futureScheduledIntervals.push({ start: nowMs, end: iv.end });
    } else {
      // Wholly in the future
      futureScheduledIntervals.push(iv);
    }
  }

  const unworkedPastScheduledMinutes = sumIntervalMinutes(unworkedPastIntervals);
  const futureScheduledMinutes = sumIntervalMinutes(futureScheduledIntervals);

  // 7. Rates and Earning / Penalty calculations
  const earnRate = policy.earnRatePaisePerMin || 100;
  const penaltyRate = policy.penaltyRatePaisePerMin || 100;
  const baseEarnPaise = workedInWindowMinutes * earnRate;

  let overtimeEarnPaise = 0;
  let capTrimMinutes = 0;
  let eligibleOvertimeMinutes = overtimeWorkedMinutes;
  const overtimeMode = policy.overtimeMode || 'none';
  const overtimeCapMin = policy.overtimeCapMinutes || 0;

  if (overtimeMode === 'full_rate') {
    eligibleOvertimeMinutes = overtimeCapMin > 0 ? Math.min(overtimeWorkedMinutes, overtimeCapMin) : overtimeWorkedMinutes;
    overtimeEarnPaise = eligibleOvertimeMinutes * earnRate;
    capTrimMinutes = Math.max(0, overtimeWorkedMinutes - eligibleOvertimeMinutes);
  } else if (overtimeMode === 'half_rate') {
    eligibleOvertimeMinutes = overtimeCapMin > 0 ? Math.min(overtimeWorkedMinutes, overtimeCapMin) : overtimeWorkedMinutes;
    const halfRate = Math.floor(earnRate / 2);
    overtimeEarnPaise = eligibleOvertimeMinutes * halfRate;
    capTrimMinutes = Math.max(0, overtimeWorkedMinutes - eligibleOvertimeMinutes);
  } else {
    // 'none'
    eligibleOvertimeMinutes = 0;
    overtimeEarnPaise = 0;
    capTrimMinutes = overtimeWorkedMinutes;
  }

  const penaltyPaise = unworkedPastScheduledMinutes * penaltyRate;

  return {
    dateStr,
    dailyTargetMinutes,
    workedInWindowMinutes,
    overtimeWorkedMinutes: eligibleOvertimeMinutes,
    rawOvertimeWorkedMinutes: overtimeWorkedMinutes,
    unworkedPastScheduledMinutes,
    futureScheduledMinutes,
    baseEarnPaise,
    overtimeEarnPaise,
    penaltyPaise,
    capTrimMinutes,
    isRestDay: false,
    isLeaveDay: false,
    isPaused: false,
    effectiveWindows,
    mergedSessions,
    workedInWindowIntervals,
    overtimeWorkedIntervals,
    unworkedPastIntervals,
    futureScheduledIntervals
  };
}

module.exports = {
  convertLocalTimeToUtc,
  computeWindowInstants,
  mergeIntervals,
  intersectIntervals,
  subtractIntervals,
  sumIntervalMinutes,
  validateScheduleConstraints,
  calculateDayBreakdown
};
