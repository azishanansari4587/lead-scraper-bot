/**
 * Work Wallet Settlement Service
 *
 * Implements transaction-safe, idempotent minute-by-minute segment settlement:
 * - Per-user mutex lock + DB transaction
 * - Ledger unique constraint (userId, date, segmentKey)
 * - Contiguous segment ledger entries with minutes and segment keys
 * - Floor protection & floor_trim entries
 * - Overtime cap trimming
 * - State reconciliation (WalletState.balancePaise & settledUpTo)
 */

const { sequelize, WalletPolicy, WalletState, WalletLedgerEntry, WorkSchedule, WorkWindow, WorkSession, WalletBreak, WalletLeave, RoutinePolicy, RoutineBlock } = require('../../models');
const walletIntervalMath = require('./walletIntervalMath');

// In-process mutex queue per user to serialize concurrent requests
const userLocks = new Map();

async function withUserLock(userId, fn) {
  while (userLocks.has(userId)) {
    await userLocks.get(userId);
  }

  let resolveLock;
  const lockPromise = new Promise((resolve) => { resolveLock = resolve; });
  userLocks.set(userId, lockPromise);

  try {
    return await fn();
  } finally {
    userLocks.delete(userId);
    resolveLock();
  }
}

class WalletSettlementService {
  /**
   * Settle a specific user's wallet up to nowUtc.
   * Runs inside an isolated mutex lock per user and database transaction.
   */
  async settleUserWallet(userId, { dateStr = null, nowUtc = new Date(), forceFinalize = false } = {}) {
    return withUserLock(userId, async () => {
      const now = nowUtc instanceof Date ? nowUtc : new Date(nowUtc);

      // Ensure policy and state exist
      let [policy] = await WalletPolicy.findOrCreate({
        where: { userId },
        defaults: { userId, enabled: true }
      });

      let [state] = await WalletState.findOrCreate({
        where: { userId },
        defaults: { userId, balancePaise: 0, isPaused: false }
      });

      if (!policy.enabled) {
        return { settled: false, reason: 'policy_disabled', state };
      }

      // Determine local date string if not provided
      const userTz = 'Asia/Dubai'; // Or fetch from UserSettings
      const localDate = dateStr || this.getLocalDateString(now, userTz);

      // Fetch active work schedule for this date
      const schedule = await this.getActiveScheduleForDate(userId, localDate);
      const windows = schedule?.windows || [];

      // Fetch routine policy for quiet hours & protected blocks
      const routinePolicy = await RoutinePolicy.findOne({ where: { userId } });
      const quietHours = routinePolicy?.quietHoursJson
        ? (typeof routinePolicy.quietHoursJson === 'string' ? JSON.parse(routinePolicy.quietHoursJson) : routinePolicy.quietHoursJson)
        : null;

      const protectedBlocks = await RoutineBlock.findAll({
        where: { userId, isProtected: true, isActive: true }
      });

      // Check for rest day or active leave
      const isLeave = await WalletLeave.findOne({ where: { userId, date: localDate } });
      const dayOfWeek = this.getLocalDateDayOfWeek(localDate);
      const isRestDay = policy.weeklyRestDay !== null && policy.weeklyRestDay === dayOfWeek;

      // Fetch sessions and breaks for this date window
      // Expand boundary by 1 day back and forward to encompass overnight spans
      const boundaryStart = walletIntervalMath.convertLocalTimeToUtc(localDate, '00:00', userTz, false);
      const boundaryEnd = walletIntervalMath.convertLocalTimeToUtc(localDate, '23:59', userTz, true);

      const sessions = await WorkSession.findAll({
        where: {
          userId,
          startAt: { [sequelize.Sequelize.Op.lte]: boundaryEnd }
        }
      });
      // Filter sessions that overlap boundary
      const relevantSessions = sessions.filter((s) => {
        const sStart = new Date(s.startAt).getTime();
        const sEnd = s.endAt ? new Date(s.endAt).getTime() : now.getTime();
        return sEnd >= boundaryStart.getTime() && sStart <= boundaryEnd.getTime();
      });

      const breaks = await WalletBreak.findAll({
        where: { userId, date: localDate }
      });

      // Compute mathematical interval breakdown
      const breakdown = walletIntervalMath.calculateDayBreakdown({
        dateStr: localDate,
        timezone: userTz,
        windows,
        sessions: relevantSessions,
        breaks,
        isRestDay,
        isLeaveDay: Boolean(isLeave),
        isPaused: state.isPaused,
        policy,
        quietHours,
        protectedBlocks,
        nowUtc: now
      });

      // Check day close: is current time beyond local midnight + dayCloseGraceHours?
      const dayCloseHour = policy.dayCloseGraceHours || 6;
      const dayCloseUtc = walletIntervalMath.convertLocalTimeToUtc(localDate, `${String(dayCloseHour).padStart(2, '0')}:00`, userTz, true);
      const isDayClosed = forceFinalize || now.getTime() >= dayCloseUtc.getTime();

      // Post segments inside a database transaction
      const t = await sequelize.transaction();
      try {
        // Confirm settlement locks WalletState row on MySQL (SELECT ... FOR UPDATE) to serialize concurrent transactions
        await WalletState.findOne({
          where: { userId },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        // 1. Post In-Window Worked Segments (Earn)
        for (const iv of breakdown.workedInWindowIntervals) {
          const minutes = Math.floor((iv.end - iv.start) / 60000);
          if (minutes <= 0) continue;
          const segmentKey = `seg_work_${localDate}_${iv.start}_${iv.end}`;
          const amountPaise = minutes * policy.earnRatePaisePerMin;

          await WalletLedgerEntry.findOrCreate({
            where: { userId, date: localDate, segmentKey },
            defaults: {
              userId,
              date: localDate,
              segmentKey,
              type: 'earn',
              amountPaise,
              minutes,
              reason: `Worked in-window: ${minutes}m`,
              isProvisional: false
            },
            transaction: t
          });
        }

        // 2. Post Overtime Segments (Earn or Cap Trim)
        if (breakdown.overtimeWorkedMinutes > 0 && policy.overtimeMode !== 'none') {
          for (const iv of breakdown.overtimeWorkedIntervals) {
            const minutes = Math.floor((iv.end - iv.start) / 60000);
            if (minutes <= 0) continue;
            const segmentKey = `seg_ot_${localDate}_${iv.start}_${iv.end}`;
            const rate = policy.overtimeMode === 'half_rate'
              ? Math.floor(policy.earnRatePaisePerMin / 2)
              : policy.earnRatePaisePerMin;
            const amountPaise = minutes * rate;

            await WalletLedgerEntry.findOrCreate({
              where: { userId, date: localDate, segmentKey },
              defaults: {
                userId,
                date: localDate,
                segmentKey,
                type: 'earn',
                amountPaise,
                minutes,
                reason: `Overtime worked (${policy.overtimeMode}): ${minutes}m`,
                isProvisional: false
              },
              transaction: t
            });
          }
        }

        // 3. Post Overtime Cap Trim if overtime was trimmed
        if (breakdown.capTrimMinutes > 0) {
          const segmentKey = `seg_captrim_${localDate}`;
          await WalletLedgerEntry.findOrCreate({
            where: { userId, date: localDate, segmentKey },
            defaults: {
              userId,
              date: localDate,
              segmentKey,
              type: 'cap_trim',
              amountPaise: 0,
              minutes: breakdown.capTrimMinutes,
              reason: `Overtime trimmed by cap (${breakdown.capTrimMinutes}m)`,
              isProvisional: false
            },
            transaction: t
          });
        }

        // 4. Post Unworked Scheduled Window Penalties (Past intervals only)
        for (const iv of breakdown.unworkedPastIntervals) {
          const minutes = Math.floor((iv.end - iv.start) / 60000);
          if (minutes <= 0) continue;
          const segmentKey = `seg_pen_${localDate}_${iv.start}_${iv.end}`;
          let penaltyAmount = minutes * policy.penaltyRatePaisePerMin;

          // Check if entry already exists
          const existing = await WalletLedgerEntry.findOne({
            where: { userId, date: localDate, segmentKey },
            transaction: t
          });

          if (!existing) {
            // Check floor protection if floorEnabled
            if (policy.floorEnabled) {
              const currentBalance = await this.calculateCurrentBalance(userId, t);
              if (currentBalance - penaltyAmount < policy.walletFloorPaise) {
                const allowablePenalty = Math.max(0, currentBalance - policy.walletFloorPaise);
                const trimmedPenalty = penaltyAmount - allowablePenalty;

                if (allowablePenalty > 0) {
                  await WalletLedgerEntry.create({
                    userId,
                    date: localDate,
                    segmentKey,
                    type: 'penalty',
                    amountPaise: -allowablePenalty,
                    minutes,
                    reason: `Unworked schedule penalty (floor-constrained): ${minutes}m`,
                    isProvisional: !isDayClosed
                  }, { transaction: t });
                }

                // Record floor trim entry
                const floorSegmentKey = `seg_floortrim_${localDate}_${iv.start}_${iv.end}`;
                await WalletLedgerEntry.create({
                  userId,
                  date: localDate,
                  segmentKey: floorSegmentKey,
                  type: 'floor_trim',
                  amountPaise: 0,
                  minutes,
                  reason: `Penalty trimmed by floor protection (saved ₹${(trimmedPenalty / 100).toFixed(2)})`,
                  isProvisional: !isDayClosed
                }, { transaction: t });

                continue;
              }
            }

            // Normal penalty (negative amount)
            await WalletLedgerEntry.create({
              userId,
              date: localDate,
              segmentKey,
              type: 'penalty',
              amountPaise: -penaltyAmount,
              minutes,
              reason: `Unworked scheduled time: ${minutes}m`,
              isProvisional: !isDayClosed
            }, { transaction: t });
          } else if (isDayClosed && existing.isProvisional) {
            // Finalize provisional penalty upon day close
            await existing.update({ isProvisional: false }, { transaction: t });
          }
        }

        // 5. Reconcile total balance & settledUpTo on WalletState
        const totalBalance = await this.calculateCurrentBalance(userId, t);
        await state.update({
          balancePaise: totalBalance,
          settledUpTo: now
        }, { transaction: t });

        await t.commit();

        return {
          settled: true,
          dateStr: localDate,
          breakdown,
          balancePaise: totalBalance,
          settledUpTo: now,
          isDayClosed
        };
      } catch (err) {
        await t.rollback();
        throw err;
      }
    });
  }

  /**
   * Helper to sum all ledger entries for a user inside an active transaction.
   */
  async calculateCurrentBalance(userId, transaction = null) {
    const result = await WalletLedgerEntry.sum('amountPaise', {
      where: { userId },
      transaction
    });
    return result || 0;
  }

  /**
   * Post an explicit reversal adjustment entry for an idle-pruned session.
   */
  async reverseSessionMinutes(userId, { sessionId, minutes, reason = 'Idle check prune' }) {
    return withUserLock(userId, async () => {
      const policy = await WalletPolicy.findOne({ where: { userId } });
      const earnRate = policy?.earnRatePaisePerMin || 100;
      const reversedPaise = minutes * earnRate;

      const t = await sequelize.transaction();
      try {
        const entry = await WalletLedgerEntry.create({
          userId,
          date: new Date().toISOString().slice(0, 10),
          segmentKey: `reversal_session_${sessionId}_${Date.now()}`,
          type: 'adjustment',
          amountPaise: -reversedPaise,
          minutes,
          sessionId,
          reason,
          isProvisional: false
        }, { transaction: t });

        const newBalance = await this.calculateCurrentBalance(userId, t);
        await WalletState.update({
          balancePaise: newBalance
        }, {
          where: { userId },
          transaction: t
        });

        await t.commit();
        return entry;
      } catch (err) {
        await t.rollback();
        throw err;
      }
    });
  }

  /**
   * Fetch active work schedule and its active windows for the user on a date.
   */
  async getActiveScheduleForDate(userId, dateStr) {
    const schedules = await WorkSchedule.findAll({
      where: { userId, isActive: true },
      include: [{ model: WorkWindow, as: 'windows', where: { isActive: true }, required: false }]
    });

    if (schedules.length === 0) return null;

    // Check travel/special date ranges first
    for (const s of schedules) {
      if (s.travelStartDate && s.travelEndDate) {
        if (dateStr >= s.travelStartDate && dateStr <= s.travelEndDate) {
          return s;
        }
      }
    }

    // Check day of week matching (0=Sun..6=Sat)
    const dayOfWeek = this.getLocalDateDayOfWeek(dateStr);
    for (const s of schedules) {
      const days = typeof s.assignedDays === 'string' ? JSON.parse(s.assignedDays || '[]') : s.assignedDays;
      if (Array.isArray(days) && days.includes(dayOfWeek)) {
        return s;
      }
    }

    // Default schedule fallback
    return schedules.find((s) => s.isDefault) || schedules[0];
  }

  getLocalDateString(date = new Date(), timezone = 'Asia/Dubai') {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // YYYY-MM-DD
  }

  getLocalDateDayOfWeek(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    return date.getUTCDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  }
}

module.exports = new WalletSettlementService();
