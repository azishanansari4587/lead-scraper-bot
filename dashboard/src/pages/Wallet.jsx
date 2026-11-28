import React, { useState, useEffect } from 'react';
import {
  Wallet, Play, Square, Coffee, Download, Plus, Trash2, RotateCcw,
  Clock, Shield, AlertTriangle, CheckCircle, Info, ChevronLeft, ChevronRight, Gift, Settings
} from 'lucide-react';
import { api } from '../api';

export default function WalletPage() {
  const [walletState, setWalletState] = useState(null);
  const [ledgerData, setLedgerData] = useState({ entries: [], total: 0, page: 1, totalPages: 1 });
  const [schedules, setSchedules] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [activeTab, setActiveTab] = useState('ledger');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [sessionNote, setSessionNote] = useState('');
  const [page, setPage] = useState(1);
  const [msg, setMsg] = useState({ text: '', type: '' });

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: 'Standard Working Hours',
    assignedDays: [1, 2, 3, 4, 5],
    isDefault: true,
    windows: [{ startTime: '09:00', endTime: '18:00', daysOfWeek: [] }]
  });

  const [showRewardModal, setShowRewardModal] = useState(false);
  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    pricePaise: 50000,
    icon: 'Gift'
  });
  const [policyForm, setPolicyForm] = useState(null);

  const formatRatePerMin = (paise) => {
    const rupees = (paise || 0) / 100;
    return Number.isInteger(rupees) ? rupees.toString() : rupees.toFixed(2);
  };

  const loadData = async () => {
    try {
      const [sRes, lRes, schRes, rewRes, polRes] = await Promise.all([
        api.getWalletState(),
        api.getWalletLedger({ page, limit: 15 }),
        api.getWalletSchedules(),
        api.getWalletRewards(),
        api.getWalletPolicy()
      ]);

      if (sRes?.success) setWalletState(sRes);
      if (lRes?.success) setLedgerData(lRes);
      if (schRes?.success) setSchedules(schRes.schedules || []);
      if (rewRes?.success) setRewards(rewRes.rewards || []);
      if (polRes?.success) {
        setPolicy(polRes.policy);
        setPolicyForm((prev) => (prev ? { ...polRes.policy, ...prev } : polRes.policy));
      }
    } catch (err) {
      setMsg({ text: err.message || 'Failed to load wallet data', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 20000);
    return () => clearInterval(interval);
  }, [page]);

  const handleStartSession = async () => {
    setActionLoading(true);
    try {
      await api.startWalletSession({ source: 'timer', note: sessionNote || null });
      setSessionNote('');
      setMsg({ text: 'Work timer started! Real-time earning active.', type: 'success' });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleStopSession = async () => {
    setActionLoading(true);
    try {
      await api.stopWalletSession(walletState?.state?.activeSession?.id);
      setMsg({ text: 'Work session completed and settled.', type: 'success' });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleBreak = async () => {
    setActionLoading(true);
    try {
      const res = await api.toggleWalletBreak('toggle');
      setMsg({
        text: res.isBreakActive ? 'Break started. Running work sessions paused.' : 'Break ended.',
        type: 'success'
      });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRedeemReward = async (rewardId) => {
    if (!window.confirm('Redeem this virtual reward from your wallet points?')) return;
    setActionLoading(true);
    try {
      await api.redeemWalletReward(rewardId);
      setMsg({ text: 'Reward redeemed successfully!', type: 'success' });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleRefundReward = async (ledgerEntryId) => {
    if (!window.confirm('Refund this redemption and return the points to your wallet?')) return;
    setActionLoading(true);
    try {
      await api.refundWalletReward(ledgerEntryId);
      setMsg({ text: 'Redemption refunded. Points returned to balance.', type: 'success' });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createWalletSchedule(newSchedule);
      setShowScheduleModal(false);
      setMsg({ text: 'Schedule created successfully.', type: 'success' });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSchedule = async (id) => {
    if (!window.confirm('Delete this work schedule?')) return;
    try {
      await api.deleteWalletSchedule(id);
      setMsg({ text: 'Schedule deleted.', type: 'success' });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    }
  };

  const handleCreateReward = async (e) => {
    e.preventDefault();
    setActionLoading(true);
    try {
      await api.createWalletReward(newReward);
      setShowRewardModal(false);
      setNewReward({ title: '', description: '', pricePaise: 50000, icon: 'Gift' });
      setMsg({ text: 'Reward catalog item created.', type: 'success' });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePolicy = async (updates) => {
    setActionLoading(true);
    try {
      const res = await api.updateWalletPolicy(updates);
      if (res?.policy) {
        setPolicy(res.policy);
        setPolicyForm(res.policy);
      }
      setMsg({
        text: 'Policy and rates updated successfully! Earn rate changes are active immediately.',
        type: 'success'
      });
      await loadData();
    } catch (err) {
      setMsg({ text: err.message, type: 'error' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleSavePolicyForm = async (e) => {
    if (e) e.preventDefault();
    if (!policyForm) return;
    await handleUpdatePolicy(policyForm);
  };

  const formatInr = (paise) => {
    const inr = Math.floor(paise || 0) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(inr);
  };

  const state = walletState?.state || {};
  const settlement = walletState?.settlement || {};
  const isWorking = Boolean(state.activeSession);
  const isBreak = Boolean(state.activeBreak);

  if (loading) {
    return <div className="loading-state">Loading Work Wallet Engine...</div>;
  }

  return (
    <div className="page-container wallet-page" style={{ padding: '24px', maxWidth: '1280px', margin: '0 auto' }}>
      {/* Top Banner Alert / Notice */}
      {msg.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: msg.type === 'error' ? 'var(--danger-bg)' : 'var(--success-bg)',
          border: `1px solid ${msg.type === 'error' ? 'var(--danger-border)' : 'var(--success-border)'}`,
          color: msg.type === 'error' ? 'var(--danger-text)' : 'var(--success-text)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{msg.text}</span>
          <button type="button" onClick={() => setMsg({ text: '', type: '' })} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>×</button>
        </div>
      )}

      {/* Hero Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Wallet size={28} color="var(--gold-primary, #f59e0b)" />
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-heading)' }}>Work Wallet Hub</h1>
          </div>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem' }}>
            Virtual accountability currency rewarding productive work and penalizing scheduled gaps.
          </p>
        </div>

        <div className="wallet-pill-notice">
          <Info size={14} /> Self-Motivation Tool • Virtual Points Only • Zero Real Money
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        {/* Balance Card */}
        <div className="wallet-card wallet-card-balance" style={{ padding: '20px', position: 'relative' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--wallet-balance-sub, #78350F)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Virtual Balance
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--wallet-balance-color, #B45309)', margin: '4px 0' }}>
            {formatInr(state.balancePaise || 0)}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--wallet-balance-sub, #78350F)', opacity: 0.9 }}>
            {(state.balancePaise || 0).toLocaleString()} minor paise
          </div>
        </div>

        {/* Today's Target & Earning Cap */}
        <div className="wallet-card wallet-card-target" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target & Earning Cap
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--success, #059669)', fontWeight: 700, background: 'var(--success-bg)', padding: '2px 8px', borderRadius: '12px', border: '1px solid var(--success-border)' }}>
              Cap: ₹{Math.floor(((((settlement.dailyTargetMinutes || 0) * (policy?.earnRatePaisePerMin || 100)) +
                (policy?.overtimeMode !== 'none' ? (policy?.overtimeCapMinutes || 0) * (policy?.overtimeMode === 'half_rate' ? Math.floor((policy?.earnRatePaisePerMin || 100) / 2) : (policy?.earnRatePaisePerMin || 100)) : 0)) / 100))}
            </span>
          </div>
          <div style={{ fontSize: '2.2rem', fontWeight: 800, color: 'var(--wallet-target-color, #0284C7)', margin: '4px 0' }}>
            {(settlement.workedInWindowMinutes || 0) + (settlement.overtimeWorkedMinutes || 0)}m
            <span style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-secondary, #475569)' }}> / {settlement.dailyTargetMinutes || 0}m</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)' }}>
            Effective daily target derived from active work windows
          </div>
        </div>

        {/* Earning & Penalty Rates */}
        <div className="wallet-card wallet-card-rates" style={{ padding: '20px' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Configured Rates
          </div>
          <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success, #059669)' }}>
                +₹{formatRatePerMin(policy?.earnRatePaisePerMin)}/m
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #64748b)' }}>
                Earn Rate ({policy?.earnRatePaisePerMin ?? 100}p/m)
              </div>
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--danger, #e11d48)' }}>
                -₹{formatRatePerMin(policy?.penaltyRatePaisePerMin)}/m
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary, #64748b)' }}>
                Missed Gap Rate ({policy?.penaltyRatePaisePerMin ?? 100}p/m)
              </div>
            </div>
          </div>
        </div>

        {/* Session Status */}
        <div className="wallet-card" style={{
          padding: '20px',
          border: isWorking ? '1px solid var(--success, #059669)' : (isBreak ? '1px solid var(--warning, #d97706)' : '1px solid var(--border-color)')
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #334155)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Current Status
          </div>
          <div style={{ fontSize: '1.4rem', fontWeight: 700, color: isWorking ? 'var(--success, #059669)' : (isBreak ? 'var(--warning, #d97706)' : 'var(--text-secondary, #64748b)'), margin: '6px 0' }}>
            {isWorking ? '🟢 Working' : (isBreak ? '☕ On Break' : '⚪ Standby / Idle')}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary, #64748b)' }}>
            {isWorking ? 'Timer running • Heartbeat active' : 'Start work to begin earning points'}
          </div>
        </div>
      </div>

      {/* Live Timer Control Bar */}
      <div className="wallet-card" style={{
        padding: '16px 20px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
          <input
            type="text"
            className="wallet-input"
            placeholder="What are you working on? (Optional note)"
            value={sessionNote}
            onChange={(e) => setSessionNote(e.target.value)}
            disabled={isWorking}
            style={{
              flex: 1,
              padding: '10px 14px',
              fontSize: '0.9rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          {isWorking ? (
            <button
              type="button"
              onClick={handleStopSession}
              disabled={actionLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'var(--danger, #e11d48)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <Square size={16} /> Stop Working
            </button>
          ) : (
            <button
              type="button"
              onClick={handleStartSession}
              disabled={actionLoading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 20px',
                background: 'var(--success, #059669)',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.9rem',
                cursor: 'pointer'
              }}
            >
              <Play size={16} /> Start Working
            </button>
          )}

          <button
            type="button"
            onClick={handleToggleBreak}
            disabled={actionLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: isBreak ? 'var(--warning, #d97706)' : 'var(--warning-bg)',
              color: isBreak ? '#fff' : 'var(--warning-text, #92400e)',
              border: '1px solid var(--warning-border)',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <Coffee size={16} /> {isBreak ? 'End Break' : 'Take Break'}
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', gap: '8px' }}>
        {[
          { key: 'ledger', label: 'Transaction Ledger' },
          { key: 'schedules', label: 'Work Schedules & Windows' },
          { key: 'rewards', label: 'Rewards Catalog' },
          { key: 'policy', label: 'Policy Configuration' }
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`wallet-tab-btn ${activeTab === tab.key ? 'active' : ''}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: LEDGER */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Ledger Entries ({ledgerData.total})</h3>
            <a
              href="/api/wallet/export"
              target="_blank"
              rel="noreferrer"
              className="wallet-btn-secondary"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                textDecoration: 'none',
                fontSize: '0.85rem'
              }}
            >
              <Download size={14} /> Export CSV
            </a>
          </div>

          <div className="wallet-table-container">
            <table className="wallet-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Minutes</th>
                  <th>Amount</th>
                  <th>Reason</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {ledgerData.entries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>
                      <span style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        background: entry.amountPaise > 0 ? 'var(--success-bg)' : (entry.type === 'reward_redeem' ? 'var(--warning-bg)' : 'var(--danger-bg)'),
                        color: entry.amountPaise > 0 ? 'var(--success-text)' : (entry.type === 'reward_redeem' ? 'var(--warning-text)' : 'var(--danger-text)'),
                        border: `1px solid ${entry.amountPaise > 0 ? 'var(--success-border)' : (entry.type === 'reward_redeem' ? 'var(--warning-border)' : 'var(--danger-border)')}`
                      }}>
                        {entry.type.toUpperCase()}
                      </span>
                    </td>
                    <td>{entry.minutes ? `${entry.minutes}m` : '-'}</td>
                    <td style={{ fontWeight: 700, color: entry.amountPaise >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                      {entry.amountPaise >= 0 ? '+' : ''}{formatInr(entry.amountPaise)}
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>{entry.reason}</td>
                    <td>
                      {entry.type === 'reward_redeem' && (
                        <button
                          type="button"
                          onClick={() => handleRefundReward(entry.id)}
                          className="wallet-btn-secondary"
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <RotateCcw size={12} /> Refund
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {ledgerData.entries.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
                      No ledger transactions found. Start working to generate your first entry.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {ledgerData.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="wallet-btn-secondary"
                style={{ padding: '6px 12px' }}
              >
                <ChevronLeft size={16} />
              </button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 8px', fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                Page {ledgerData.page} of {ledgerData.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= ledgerData.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="wallet-btn-secondary"
                style={{ padding: '6px 12px' }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SCHEDULES */}
      {activeTab === 'schedules' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Active Work Schedules</h3>
            <button
              type="button"
              onClick={() => setShowScheduleModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                background: 'var(--success, #059669)',
                color: '#fff',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Plus size={15} /> Add Work Schedule
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {schedules.map((sch) => (
              <div
                key={sch.id}
                className="wallet-card"
                style={{ padding: '18px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 4px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{sch.name}</h4>
                    {sch.isDefault && (
                      <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '4px', background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)', fontWeight: 600 }}>
                        Default Schedule
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSchedule(sch.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--danger, #ef4444)', cursor: 'pointer' }}
                    title="Delete schedule"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--text-primary)' }}>Scheduled Windows:</div>
                  {(sch.windows || []).map((win, idx) => (
                    <div key={win.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0' }}>
                      <Clock size={13} color="var(--success, #10b981)" />
                      <span>{win.startTime} - {win.endTime}</span>
                      {win.isOvernight && (
                        <span style={{ fontSize: '0.65rem', background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)', padding: '1px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          Overnight
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: REWARDS CATALOG */}
      {activeTab === 'rewards' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>Virtual Rewards Catalog</h3>
            <button
              type="button"
              onClick={() => setShowRewardModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '6px',
                background: 'var(--gold-primary, #f59e0b)',
                color: 'var(--primary-contrast, #fff)',
                border: 'none',
                fontWeight: 700,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              <Plus size={15} /> Add Reward Item
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
            {rewards.map((rew) => {
              const canAfford = (state.balancePaise || 0) >= rew.pricePaise;
              return (
                <div
                  key={rew.id}
                  className="wallet-card"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                      <Gift size={20} color="var(--gold-primary, #f59e0b)" />
                      <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rew.title}</h4>
                    </div>
                    <p style={{ margin: '0 0 16px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {rew.description || 'Self-reward motivation item.'}
                    </p>
                  </div>

                  <div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--gold-primary, #f59e0b)', marginBottom: '10px' }}>
                      {formatInr(rew.pricePaise)}
                    </div>
                    <button
                      type="button"
                      disabled={!canAfford || actionLoading}
                      onClick={() => handleRedeemReward(rew.id)}
                      style={{
                        width: '100%',
                        padding: '10px',
                        borderRadius: '8px',
                        background: canAfford ? 'var(--success, #10b981)' : 'var(--wallet-btn-secondary-bg)',
                        color: canAfford ? '#fff' : 'var(--text-tertiary, #64748b)',
                        border: canAfford ? 'none' : '1px solid var(--border-color)',
                        fontWeight: 600,
                        fontSize: '0.85rem',
                        cursor: canAfford ? 'pointer' : 'not-allowed'
                      }}
                    >
                      {canAfford ? 'Redeem Reward' : 'Insufficient Points'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: POLICY */}
      {activeTab === 'policy' && policy && (
        <div className="wallet-card" style={{ padding: '24px', maxWidth: '720px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--text-primary)' }}>Policy & Rate Settings</h3>
              <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>
                Customize your reward multiplier and accountability penalties. Earn rates update immediately.
              </p>
            </div>
            {policy?.pendingEffectiveDate && (
              <span style={{
                fontSize: '0.75rem',
                color: 'var(--gold-primary)',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid var(--gold-primary)',
                padding: '4px 10px',
                borderRadius: '12px',
                fontWeight: 600
              }}>
                Pending Loosening: {policy.pendingEffectiveDate}
              </span>
            )}
          </div>

          <form onSubmit={handleSavePolicyForm} style={{ display: 'grid', gap: '20px' }}>
            <div style={{ background: 'var(--surface-subtle)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Earn Rate (Paise per minute)
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--success, #059669)', background: 'var(--success-bg)', padding: '2px 8px', borderRadius: '6px' }}>
                  = ₹{formatRatePerMin(policyForm?.earnRatePaisePerMin ?? policy.earnRatePaisePerMin)} / min
                </span>
              </div>
              <input
                type="number"
                min="0"
                className="wallet-input"
                value={policyForm?.earnRatePaisePerMin ?? policy.earnRatePaisePerMin ?? 100}
                onChange={(e) => setPolicyForm({ ...(policyForm || policy), earnRatePaisePerMin: Number(e.target.value) })}
                style={{ width: '100%', padding: '10px 12px', fontSize: '1rem', fontWeight: 600 }}
              />
              <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                100 paise = ₹1.00 / min. Example: 10000 paise = ₹100.00 / min. Applies immediately to all active and future sessions.
              </span>
            </div>

            <div style={{ background: 'var(--surface-subtle)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Penalty Rate (Paise per unworked minute)
                </label>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--danger, #e11d48)', background: 'var(--danger-bg, rgba(225, 29, 72, 0.1))', padding: '2px 8px', borderRadius: '6px' }}>
                  = ₹{formatRatePerMin(policyForm?.penaltyRatePaisePerMin ?? policy.penaltyRatePaisePerMin)} / min
                </span>
              </div>
              <input
                type="number"
                min="0"
                className="wallet-input"
                value={policyForm?.penaltyRatePaisePerMin ?? policy.penaltyRatePaisePerMin ?? 100}
                onChange={(e) => setPolicyForm({ ...(policyForm || policy), penaltyRatePaisePerMin: Number(e.target.value) })}
                style={{ width: '100%', padding: '10px 12px', fontSize: '1rem', fontWeight: 600 }}
              />
              <span style={{ display: 'block', marginTop: '6px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Deducted for unworked schedule gaps during work windows.
              </span>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                Overtime Mode
              </label>
              <select
                value={policyForm?.overtimeMode ?? policy.overtimeMode ?? 'none'}
                className="wallet-input select"
                onChange={(e) => setPolicyForm({ ...(policyForm || policy), overtimeMode: e.target.value })}
                style={{ width: '100%', padding: '10px 12px' }}
              >
                <option value="none">None (Zero points for overtime)</option>
                <option value="half_rate">Half Rate (50% earning rate)</option>
                <option value="full_rate">Full Rate (100% earning rate)</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
                Daily Break Allowance (Minutes)
              </label>
              <input
                type="number"
                min="0"
                className="wallet-input"
                value={policyForm?.dailyBreakAllowanceMinutes ?? policy.dailyBreakAllowanceMinutes ?? 90}
                onChange={(e) => setPolicyForm({ ...(policyForm || policy), dailyBreakAllowanceMinutes: Number(e.target.value) })}
                style={{ width: '100%', padding: '10px 12px' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
              <button
                type="submit"
                disabled={actionLoading}
                className="wallet-btn-primary"
                style={{
                  padding: '10px 24px',
                  borderRadius: '8px',
                  background: 'var(--gold-primary)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: actionLoading ? 'not-allowed' : 'pointer',
                  border: 'none',
                  boxShadow: 'var(--gold-shadow)'
                }}
              >
                {actionLoading ? 'Saving Rates...' : 'Save Policy & Rates'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE SCHEDULE MODAL */}
      {showScheduleModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleCreateSchedule} className="wallet-modal-card" style={{
            padding: '24px', width: '90%', maxWidth: '480px'
          }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Create Work Schedule</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-primary)', fontWeight: 600 }}>Schedule Name</label>
              <input
                type="text"
                className="wallet-input"
                value={newSchedule.name}
                onChange={(e) => setNewSchedule({ ...newSchedule, name: e.target.value })}
                required
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-primary)', fontWeight: 600 }}>Start Time (HH:MM)</label>
                <input
                  type="text"
                  className="wallet-input"
                  value={newSchedule.windows[0].startTime}
                  onChange={(e) => setNewSchedule({
                    ...newSchedule,
                    windows: [{ ...newSchedule.windows[0], startTime: e.target.value }]
                  })}
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-primary)', fontWeight: 600 }}>End Time (HH:MM)</label>
                <input
                  type="text"
                  className="wallet-input"
                  value={newSchedule.windows[0].endTime}
                  onChange={(e) => setNewSchedule({
                    ...newSchedule,
                    windows: [{ ...newSchedule.windows[0], endTime: e.target.value }]
                  })}
                  style={{ width: '100%', padding: '8px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowScheduleModal(false)} className="wallet-btn-secondary" style={{ padding: '8px 14px' }}>Cancel</button>
              <button type="submit" disabled={actionLoading} style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--success, #059669)', border: 'none', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Create Schedule</button>
            </div>
          </form>
        </div>
      )}

      {/* CREATE REWARD MODAL */}
      {showRewardModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <form onSubmit={handleCreateReward} className="wallet-modal-card" style={{
            padding: '24px', width: '90%', maxWidth: '440px'
          }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--text-primary)' }}>Add Reward Item</h3>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-primary)', fontWeight: 600 }}>Title</label>
              <input
                type="text"
                className="wallet-input"
                placeholder="e.g. Weekend Coffee & Pastry"
                value={newReward.title}
                onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                required
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '4px', color: 'var(--text-primary)', fontWeight: 600 }}>Cost in Rupees (₹)</label>
              <input
                type="number"
                className="wallet-input"
                placeholder="500"
                value={newReward.pricePaise / 100}
                onChange={(e) => setNewReward({ ...newReward, pricePaise: Math.round(Number(e.target.value) * 100) })}
                required
                style={{ width: '100%', padding: '8px' }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowRewardModal(false)} className="wallet-btn-secondary" style={{ padding: '8px 14px' }}>Cancel</button>
              <button type="submit" disabled={actionLoading} style={{ padding: '8px 16px', borderRadius: '6px', background: 'var(--gold-primary, #f59e0b)', border: 'none', color: 'var(--primary-contrast, #fff)', fontWeight: 700, cursor: 'pointer' }}>Save Reward</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
