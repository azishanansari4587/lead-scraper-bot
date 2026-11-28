/**
 * Work Wallet Core Service
 *
 * Implements:
 * - Session lifecycle (start, stop, heartbeat watchdog, manual sessions)
 * - Break management (stopping running sessions, allowance enforcement)
 * - Leave & pause mode (sick leave allowance bypass with reason)
 * - Reward redemption and refunds (floor protection)
 * - Policy management (immediate tightening, next-day queued loosening)
 * - Schedule validation & derived target minutes
 * - Wellbeing checks & ReminderLog deduped alerts
 * - Routine service integration hooks
 */

const {
  sequelize,
  WalletPolicy,
  WalletState,
  WorkSchedule,
  WorkWindow,
  WorkSession,
  WalletBreak,
  WalletLeave,
  WalletLedgerEntry,
  WalletReward,
  RoutinePolicy,
  RoutineBlock,
  ReminderLog,
  AuditLog
} = require('../../models');

const walletIntervalMath = require('./walletIntervalMath');
const walletSettlementService = require('./walletSettlementService');

class WalletService {
  /**
   * Helper: get or create policy and state for a user.
   * Also applies pending policy changes if effective date has arrived.
   */
  async getOrCreateUserWallet(userId, localDate = null) {
    let [policy] = await WalletPolicy.findOrCreate({
      where: { userId },
      defaults: { userId, enabled: true }
    });

    let [state] = await WalletState.findOrCreate({
      where: { userId },
      defaults: { userId, balancePaise: 0, isPaused: false }
    });

    // Check if pending policy should be activated
    const todayStr = localDate || walletSettlementService.getLocalDateString(new Date());
    if (policy.pendingPolicyJson && policy.pendingEffectiveDate && todayStr >= policy.pendingEffectiveDate) {
      try {
        const pendingChanges = JSON.parse(policy.pendingPolicyJson);
        await policy.update({
          ...pendingChanges,
          pendingPolicyJson: null,
          pendingEffectiveDate: null
        });
      } catch {
        // Clear corrupt pending json
        await policy.update({ pendingPolicyJson: null, pendingEffectiveDate: null });
      }
    }

    return { policy, state };
  }

  /**
   * Get user's live wallet state, today's interval breakdown, and active timers.
   */
  async getWalletState(userId, { nowUtc = new Date(), fastClockMultiplier = 1 } = {}) {
    const now = nowUtc instanceof Date ? nowUtc : new Date(nowUtc);
    const { policy, state } = await this.getOrCreateUserWallet(userId);

    // Watchdog check: auto-stop stale active session if heartbeat missed > 3 mins
    await this.checkStaleSessions(userId, now);

    // Settle wallet up to current time
    const settlement = await walletSettlementService.settleUserWallet(userId, { nowUtc: now });

    // Refresh state after settlement
    await state.reload();

    // Fetch active session / break
    const activeSession = state.activeSessionId
      ? await WorkSession.findOne({ where: { id: state.activeSessionId, userId } })
      : null;

    const activeBreak = state.activeBreakId
      ? await WalletBreak.findOne({ where: { id: state.activeBreakId, userId } })
      : null;

    // Calculate live session running duration in seconds
    let activeSessionSeconds = 0;
    if (activeSession && activeSession.status === 'running') {
      const startMs = new Date(activeSession.startAt).getTime();
      activeSessionSeconds = Math.max(0, Math.floor((now.getTime() - startMs) / 1000));
    }

    return {
      policy,
      state: {
        id: state.id,
        userId: state.userId,
        balancePaise: state.balancePaise,
        balanceInr: (state.balancePaise / 100).toFixed(2),
        settledUpTo: state.settledUpTo,
        isPaused: state.isPaused,
        activeSession: activeSession ? {
          id: activeSession.id,
          startAt: activeSession.startAt,
          lastHeartbeatAt: activeSession.lastHeartbeatAt,
          source: activeSession.source,
          linkedTaskId: activeSession.linkedTaskId,
          linkedRoutineEntryId: activeSession.linkedRoutineEntryId,
          durationSeconds: activeSessionSeconds
        } : null,
        activeBreak: activeBreak ? {
          id: activeBreak.id,
          startAt: activeBreak.startAt,
          minutes: Math.floor((now.getTime() - new Date(activeBreak.startAt).getTime()) / 60000)
        } : null
      },
      settlement: settlement.breakdown || null,
      disclaimer: 'Virtual self-motivation currency (points). Not real money.'
    };
  }

  /**
   * Watchdog: inspects active sessions for user. If lastHeartbeatAt is older than 3 minutes,
   * cleanly stops the session at the last heartbeat time.
   */
  async checkStaleSessions(userId, nowUtc = new Date()) {
    const nowMs = (nowUtc instanceof Date ? nowUtc : new Date(nowUtc)).getTime();
    const runningSessions = await WorkSession.findAll({
      where: { userId, status: 'running' }
    });

    for (const s of runningSessions) {
      const hbMs = new Date(s.lastHeartbeatAt).getTime();
      const startMs = new Date(s.startAt).getTime();
      const policy = await WalletPolicy.findOne({ where: { userId } });
      const maxSessionMs = (policy?.maxSessionLengthMinutes || 480) * 60000;

      // 1. Check max session length
      if (nowMs - startMs > maxSessionMs) {
        const endAt = new Date(startMs + maxSessionMs);
        await s.update({
          status: 'completed',
          endAt,
          note: s.note ? `${s.note} [Auto-stopped: max session length]` : '[Auto-stopped: max session length]'
        });
        await WalletState.update({ activeSessionId: null }, { where: { userId, activeSessionId: s.id } });
        continue;
      }

      // 2. Check 3-minute heartbeat timeout (180,000 ms)
      if (nowMs - hbMs > 180000) {
        // Stopped at last recorded heartbeat
        await s.update({
          status: 'completed',
          endAt: s.lastHeartbeatAt,
          note: s.note ? `${s.note} [Auto-stopped: missed heartbeat]` : '[Auto-stopped: missed heartbeat]'
        });
        await WalletState.update({ activeSessionId: null }, { where: { userId, activeSessionId: s.id } });
      }
    }
  }

  /**
   * Start a work session.
   * Enforces 1 active session per user and cleanly terminates running breaks.
   */
  async startSession(userId, { source = 'timer', linkedTaskId = null, linkedRoutineEntryId = null, note = null, nowUtc = new Date() } = {}) {
    const now = nowUtc instanceof Date ? nowUtc : new Date(nowUtc);
    const { policy, state } = await this.getOrCreateUserWallet(userId);

    if (!policy.enabled) {
      throw new Error('Work Wallet is disabled in settings.');
    }
    if (state.isPaused) {
      throw new Error('Work Wallet is currently paused.');
    }

    // If a break is running, stop it
    if (state.activeBreakId) {
      await this.toggleBreak(userId, { action: 'stop', nowUtc: now });
    }

    // If an existing session is running, return it or stop it if requested
    const existing = await WorkSession.findOne({
      where: { userId, status: 'running' }
    });

    if (existing) {
      // Already running
      return existing;
    }

    const session = await WorkSession.create({
      userId,
      startAt: now,
      lastHeartbeatAt: now,
      source,
      status: 'running',
      linkedTaskId,
      linkedRoutineEntryId,
      note
    });

    await state.update({ activeSessionId: session.id });

    // Settle up to now
    await walletSettlementService.settleUserWallet(userId, { nowUtc: now });

    return session;
  }

  /**
   * Stop an active work session.
   */
  async stopSession(userId, { sessionId = null, nowUtc = new Date() } = {}) {
    const now = nowUtc instanceof Date ? nowUtc : new Date(nowUtc);
    const state = await WalletState.findOne({ where: { userId } });

    const targetSessionId = sessionId || state?.activeSessionId;
    if (!targetSessionId) {
      return null;
    }

    const session = await WorkSession.findOne({
      where: { id: targetSessionId, userId, status: 'running' }
    });

    if (!session) {
      return null;
    }

    // Enforce endAt = nowUtc (or capped at lastHeartbeatAt + 60s if server heartbeat missed)
    const hbMs = new Date(session.lastHeartbeatAt).getTime();
    const effectiveEnd = (now.getTime() - hbMs > 180000) ? session.lastHeartbeatAt : now;

    await session.update({
      status: 'completed',
      endAt: effectiveEnd
    });

    await WalletState.update({ activeSessionId: null }, { where: { userId } });

    // Trigger settlement
    await walletSettlementService.settleUserWallet(userId, { nowUtc: now });

    return session;
  }

  /**
   * Record client heartbeat ping (every 60s).
   */
  async recordHeartbeat(userId, { sessionId, isActive = true, nowUtc = new Date() } = {}) {
    const now = nowUtc instanceof Date ? nowUtc : new Date(nowUtc);

    const session = await WorkSession.findOne({
      where: { id: sessionId, userId, status: 'running' }
    });

    if (!session) {
      return { ok: false, reason: 'session_not_found_or_not_running' };
    }

    const hbMs = new Date(session.lastHeartbeatAt).getTime();

    // If missed heartbeat > 3 mins, auto-stop at last heartbeat
    if (now.getTime() - hbMs > 180000) {
      await session.update({
        status: 'completed',
        endAt: session.lastHeartbeatAt,
        note: session.note ? `${session.note} [Auto-stopped: missed heartbeat]` : '[Auto-stopped: missed heartbeat]'
      });
      await WalletState.update({ activeSessionId: null }, { where: { userId } });
      return { ok: false, reason: 'session_stopped_stale_heartbeat' };
    }

    // If active flag is true, update lastHeartbeatAt
    if (isActive) {
      await session.update({ lastHeartbeatAt: now });
    }

    return { ok: true, lastHeartbeatAt: now };
  }

  /**
   * Log a manual work session, enforcing daily manual minutes limit.
   */
  async addManualSession(userId, { startAt, endAt, note = null, linkedTaskId = null }) {
    const sDate = new Date(startAt);
    const eDate = new Date(endAt);

    if (isNaN(sDate.getTime()) || isNaN(eDate.getTime()) || eDate <= sDate) {
      throw new Error('Invalid start or end time for manual session.');
    }

    const durationMin = Math.floor((eDate.getTime() - sDate.getTime()) / 60000);
    const { policy } = await this.getOrCreateUserWallet(userId);
    const maxDailyManual = policy.maxDailyManualMinutes || 60;

    // Check manual sessions logged today
    const localDate = walletSettlementService.getLocalDateString(sDate);
    const todayStart = walletIntervalMath.convertLocalTimeToUtc(localDate, '00:00', 'Asia/Dubai', false);
    const todayEnd = walletIntervalMath.convertLocalTimeToUtc(localDate, '23:59', 'Asia/Dubai', true);

    const manualSessions = await WorkSession.findAll({
      where: {
        userId,
        source: 'manual',
        startAt: {
          [sequelize.Sequelize.Op.gte]: todayStart,
          [sequelize.Sequelize.Op.lte]: todayEnd
        }
      }
    });

    const usedManualMin = manualSessions.reduce((acc, ms) => {
      if (ms.endAt) {
        return acc + Math.floor((new Date(ms.endAt).getTime() - new Date(ms.startAt).getTime()) / 60000);
      }
      return acc;
    }, 0);

    if (usedManualMin + durationMin > maxDailyManual) {
      throw new Error(
        `Manual session duration (${durationMin}m) exceeds remaining daily manual allowance (${Math.max(0, maxDailyManual - usedManualMin)}m of ${maxDailyManual}m).`
      );
    }

    const session = await WorkSession.create({
      userId,
      startAt: sDate,
      endAt: eDate,
      lastHeartbeatAt: eDate,
      source: 'manual',
      status: 'completed',
      linkedTaskId,
      note
    });

    await walletSettlementService.settleUserWallet(userId, { dateStr: localDate });

    return session;
  }

  /**
   * Toggle or manage break state.
   */
  async toggleBreak(userId, { action = 'toggle', nowUtc = new Date() } = {}) {
    const now = nowUtc instanceof Date ? nowUtc : new Date(nowUtc);
    const localDate = walletSettlementService.getLocalDateString(now);
    const state = await WalletState.findOne({ where: { userId } });

    const activeBreak = state?.activeBreakId
      ? await WalletBreak.findOne({ where: { id: state.activeBreakId, userId, endAt: null } })
      : null;

    if (action === 'stop' || (action === 'toggle' && activeBreak)) {
      if (activeBreak) {
        const startMs = new Date(activeBreak.startAt).getTime();
        const minutes = Math.floor(Math.max(0, now.getTime() - startMs) / 60000);
        await activeBreak.update({
          endAt: now,
          minutes
        });
      }
      await WalletState.update({ activeBreakId: null }, { where: { userId } });
      await walletSettlementService.settleUserWallet(userId, { nowUtc: now });
      return { isBreakActive: false, break: activeBreak };
    } else {
      // Start break: stop any running work session first!
      if (state?.activeSessionId) {
        await this.stopSession(userId, { sessionId: state.activeSessionId, nowUtc: now });
      }

      const newBreak = await WalletBreak.create({
        userId,
        date: localDate,
        startAt: now,
        endAt: null,
        minutes: 0
      });

      await WalletState.update({ activeBreakId: newBreak.id }, { where: { userId } });
      await walletSettlementService.settleUserWallet(userId, { nowUtc: now });
      return { isBreakActive: true, break: newBreak };
    }
  }

  /**
   * Log Leave (sick, travel, personal).
   * Sick leave may exceed monthly allowance with reason and is flagged.
   */
  async logLeave(userId, { date, type = 'sick', reason = null }) {
    if (!date) throw new Error('Leave date is required (YYYY-MM-DD).');

    const { policy } = await this.getOrCreateUserWallet(userId);
    const [year, month] = date.split('-');
    const monthPrefix = `${year}-${month}`;

    // Count existing leaves this month
    const monthLeaves = await WalletLeave.findAll({
      where: {
        userId,
        date: { [sequelize.Sequelize.Op.like]: `${monthPrefix}%` }
      }
    });

    let isExceedingAllowance = monthLeaves.length >= policy.monthlyLeaveAllowanceDays;

    if (isExceedingAllowance && type !== 'sick') {
      throw new Error(`Monthly leave allowance (${policy.monthlyLeaveAllowanceDays} days) exceeded. Only sick leave with a reason may exceed allowance.`);
    }

    const [leave, created] = await WalletLeave.findOrCreate({
      where: { userId, date },
      defaults: {
        userId,
        date,
        type,
        reason,
        isExceedingAllowance
      }
    });

    if (!created) {
      await leave.update({ type, reason, isExceedingAllowance });
    }

    await walletSettlementService.settleUserWallet(userId, { dateStr: date });
    return leave;
  }

  /**
   * Toggle pause mode for travel or vacation.
   */
  async togglePause(userId, { isPaused }) {
    const { state } = await this.getOrCreateUserWallet(userId);
    await state.update({ isPaused: Boolean(isPaused) });
    await walletSettlementService.settleUserWallet(userId);
    return { isPaused: Boolean(isPaused) };
  }

  /**
   * Redeem Reward catalog item.
   */
  async redeemReward(userId, rewardId) {
    const reward = await WalletReward.findOne({
      where: { id: rewardId, userId, isActive: true }
    });

    if (!reward) throw new Error('Reward not found or inactive.');

    const { policy, state } = await this.getOrCreateUserWallet(userId);

    // Check balance & floor
    if (state.balancePaise < reward.pricePaise) {
      throw new Error(`Insufficient wallet balance (₹${(state.balancePaise / 100).toFixed(2)}) for reward (₹${(reward.pricePaise / 100).toFixed(2)}).`);
    }

    if (policy.floorEnabled && (state.balancePaise - reward.pricePaise < policy.walletFloorPaise)) {
      throw new Error(`Redemption would breach wallet floor of ₹${(policy.walletFloorPaise / 100).toFixed(2)}.`);
    }

    const t = await sequelize.transaction();
    try {
      const entry = await WalletLedgerEntry.create({
        userId,
        date: walletSettlementService.getLocalDateString(new Date()),
        segmentKey: `redeem_${reward.id}_${Date.now()}`,
        type: 'reward_redeem',
        amountPaise: -reward.pricePaise,
        minutes: 0,
        refId: String(reward.id),
        reason: `Redeemed reward: ${reward.title}`,
        isProvisional: false
      }, { transaction: t });

      const newBalance = await walletSettlementService.calculateCurrentBalance(userId, t);
      await state.update({ balancePaise: newBalance }, { transaction: t });

      await t.commit();
      return { entry, balancePaise: newBalance };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Refund a previously redeemed reward.
   */
  async refundReward(userId, ledgerEntryId) {
    const originalEntry = await WalletLedgerEntry.findOne({
      where: { id: ledgerEntryId, userId, type: 'reward_redeem' }
    });

    if (!originalEntry) throw new Error('Redemption ledger entry not found.');

    // Check if already refunded
    const existingRefund = await WalletLedgerEntry.findOne({
      where: {
        userId,
        type: 'reward_refund',
        refId: String(ledgerEntryId)
      }
    });

    if (existingRefund) {
      throw new Error('This reward redemption has already been refunded.');
    }

    const refundAmount = Math.abs(originalEntry.amountPaise);
    const t = await sequelize.transaction();
    try {
      const refundEntry = await WalletLedgerEntry.create({
        userId,
        date: walletSettlementService.getLocalDateString(new Date()),
        segmentKey: `refund_${ledgerEntryId}_${Date.now()}`,
        type: 'reward_refund',
        amountPaise: refundAmount,
        minutes: 0,
        refId: String(ledgerEntryId),
        reason: `Refunded redemption: ${originalEntry.reason}`,
        isProvisional: false
      }, { transaction: t });

      const newBalance = await walletSettlementService.calculateCurrentBalance(userId, t);
      await WalletState.update({ balancePaise: newBalance }, { where: { userId }, transaction: t });

      await t.commit();
      return refundEntry;
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Update Wallet Policy with queued loosening and immediate tightening.
   */
  async updatePolicy(userId, updates = {}) {
    const { policy } = await this.getOrCreateUserWallet(userId);
    const todayStr = walletSettlementService.getLocalDateString(new Date());

    // Compute tomorrow's local date
    const [y, m, d] = todayStr.split('-').map(Number);
    const tomorrow = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0));
    const tomorrowStr = tomorrow.toISOString().slice(0, 10);

    const immediateUpdates = {};
    const queuedLoosening = {};

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined) continue;

      let isLoosening = false;

      // Determine loosening vs tightening
      // NOTE: earnRatePaisePerMin is the user's custom reward rate - it is ALWAYS applied immediately.
      if (key === 'penaltyRatePaisePerMin' && val < policy.penaltyRatePaisePerMin) isLoosening = true;
      if (key === 'dailyBreakAllowanceMinutes' && val > policy.dailyBreakAllowanceMinutes) isLoosening = true;
      if (key === 'monthlyLeaveAllowanceDays' && val > policy.monthlyLeaveAllowanceDays) isLoosening = true;
      if (key === 'floorEnabled' && !val && policy.floorEnabled) isLoosening = true;
      if (key === 'walletFloorPaise' && val < policy.walletFloorPaise) isLoosening = true;
      if (key === 'allowNegative' && val && !policy.allowNegative) isLoosening = true;

      if (isLoosening) {
        queuedLoosening[key] = val;
      } else {
        immediateUpdates[key] = val;
      }
    }

    // Clean up any pending loosened settings that are overridden by immediate updates
    let existingPending = policy.pendingPolicyJson ? JSON.parse(policy.pendingPolicyJson) : {};
    for (const key of Object.keys(immediateUpdates)) {
      if (existingPending[key] !== undefined) {
        delete existingPending[key];
      }
    }

    const mergedPending = { ...existingPending, ...queuedLoosening };
    if (Object.keys(mergedPending).length > 0) {
      immediateUpdates.pendingPolicyJson = JSON.stringify(mergedPending);
      immediateUpdates.pendingEffectiveDate = tomorrowStr;
    } else if (policy.pendingPolicyJson) {
      immediateUpdates.pendingPolicyJson = null;
      immediateUpdates.pendingEffectiveDate = null;
    }

    // Apply immediate updates (including any cleaned/updated pending queue)
    if (Object.keys(immediateUpdates).length > 0) {
      await policy.update(immediateUpdates);
    }

    await policy.reload();
    return policy;
  }
}

module.exports = new WalletService();
