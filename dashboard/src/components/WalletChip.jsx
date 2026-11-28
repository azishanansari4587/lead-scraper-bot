import React, { useState, useEffect, useRef } from 'react';
import { Wallet, Play, Square, Coffee, ChevronRight, AlertCircle, ArrowUpRight, ArrowDownRight, Clock } from 'lucide-react';
import { api } from '../api';

export default function WalletChip() {
  const [walletData, setWalletData] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const popoverRef = useRef(null);
  const heartbeatTimerRef = useRef(null);

  const fetchWallet = async () => {
    try {
      const res = await api.getWalletState();
      if (res && res.success) {
        setWalletData(res);
        if (res.state?.activeSession) {
          setElapsedSec(res.state.activeSession.durationSeconds || 0);
        } else {
          setElapsedSec(0);
        }
      }
    } catch (err) {
      // Quiet fail in background
    }
  };

  useEffect(() => {
    fetchWallet();
    const interval = setInterval(fetchWallet, 15000); // Poll state every 15s
    return () => clearInterval(interval);
  }, []);

  // Live timer tick every second if session is running
  useEffect(() => {
    if (walletData?.state?.activeSession) {
      const timer = setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [walletData?.state?.activeSession?.id]);

  // Client heartbeat ping every 60 seconds while session is running (Amendment 1)
  useEffect(() => {
    if (walletData?.state?.activeSession?.id) {
      const ping = async () => {
        try {
          await api.sendWalletHeartbeat(walletData.state.activeSession.id, true);
        } catch {
          // Ignore transient errors
        }
      };

      heartbeatTimerRef.current = setInterval(ping, 60000);
      return () => clearInterval(heartbeatTimerRef.current);
    }
  }, [walletData?.state?.activeSession?.id]);

  // Close popover on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isOpen]);

  const handleStartTimer = async () => {
    setLoading(true);
    try {
      await api.startWalletSession({ source: 'timer', note: 'Dashboard quick timer' });
      await fetchWallet();
    } finally {
      setLoading(false);
    }
  };

  const handleStopTimer = async () => {
    setLoading(true);
    try {
      await api.stopWalletSession(walletData?.state?.activeSession?.id);
      await fetchWallet();
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBreak = async () => {
    setLoading(true);
    try {
      await api.toggleWalletBreak('toggle');
      await fetchWallet();
    } finally {
      setLoading(false);
    }
  };

  if (!walletData || walletData.policy?.enabled === false) {
    return null;
  }

  const state = walletData.state || {};
  const settlement = walletData.settlement || {};
  const isRunning = Boolean(state.activeSession);
  const isBreak = Boolean(state.activeBreak);
  const isPaused = Boolean(state.isPaused);

  // Format currency in Indian grouping
  const formatInr = (paise) => {
    const inr = Math.floor(paise) / 100;
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(inr);
  };

  // Format seconds to HH:MM:SS
  const formatTime = (totalSec) => {
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) {
      return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const targetMinutes = settlement.dailyTargetMinutes || 0;
  const workedMinutes = (settlement.workedInWindowMinutes || 0) + (settlement.overtimeWorkedMinutes || 0);
  const progressPercent = targetMinutes > 0 ? Math.min(100, Math.round((workedMinutes / targetMinutes) * 100)) : 100;

  return (
    <div className="wallet-chip-container" ref={popoverRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className={`wallet-chip-btn ${isRunning ? 'active-working' : ''} ${isBreak ? 'active-break' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        title="Work Wallet: Click for live ledger and quick actions"
        aria-label="Work Wallet"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '20px',
          background: isRunning ? 'var(--success-bg)' : 'var(--card-bg)',
          border: isRunning ? '1px solid var(--success)' : '1px solid var(--border-color)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: '0.85rem',
          boxShadow: 'var(--wallet-card-shadow)',
          transition: 'all 0.2s ease'
        }}
      >
        <span
          style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            backgroundColor: isRunning ? 'var(--success)' : (isBreak ? 'var(--warning)' : (isPaused ? 'var(--text-tertiary)' : 'var(--info)')),
            boxShadow: isRunning ? '0 0 8px var(--success)' : 'none'
          }}
        />

        <Wallet size={15} color="var(--gold-primary, #f59e0b)" />

        <span style={{ letterSpacing: '0.02em', fontWeight: 700 }}>
          {formatInr(state.balancePaise || 0)}
        </span>

        {isRunning && (
          <span style={{ fontSize: '0.75rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '2px', fontWeight: 600 }}>
            <ArrowUpRight size={13} />
            {formatTime(elapsedSec)}
          </span>
        )}

        {isBreak && (
          <span style={{ fontSize: '0.75rem', color: 'var(--warning-text, #d97706)', display: 'flex', alignItems: 'center', gap: '3px', fontWeight: 600 }}>
            <Coffee size={12} />
            Break
          </span>
        )}
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          className="wallet-popover"
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: '320px',
            background: 'var(--modal-bg)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-modal)',
            padding: '16px',
            zIndex: 9999,
            color: 'var(--text-primary)',
            backdropFilter: 'blur(8px)'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.05em', fontWeight: 600 }}>
                Work Wallet Balance
              </div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--gold-primary)', marginTop: '2px' }}>
                {formatInr(state.balancePaise || 0)}
              </div>
            </div>
            <div style={{
              background: 'var(--wallet-pill-bg)',
              border: '1px solid var(--wallet-pill-border)',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '0.7rem',
              color: 'var(--wallet-pill-color)',
              fontWeight: 700
            }}>
              Virtual Points
            </div>
          </div>

          {/* Today's Target Progress */}
          <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px', border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Today's Target</span>
              <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{workedMinutes}m / {targetMinutes}m ({progressPercent}%)</span>
            </div>
            <div style={{ width: '100%', height: '6px', background: 'var(--wallet-progress-track)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${progressPercent}%`,
                  height: '100%',
                  background: progressPercent >= 100 ? 'var(--success)' : 'var(--gold-primary)',
                  borderRadius: '3px',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
            {isRunning ? (
              <button
                type="button"
                onClick={handleStopTimer}
                disabled={loading}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  background: 'var(--danger)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                <Square size={14} /> Stop Work
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartTimer}
                disabled={loading || isPaused}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  padding: '8px',
                  background: 'var(--success)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontSize: '0.8rem',
                  cursor: 'pointer'
                }}
              >
                <Play size={14} /> Start Work
              </button>
            )}

            <button
              type="button"
              onClick={handleToggleBreak}
              disabled={loading}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                padding: '8px',
                background: isBreak ? 'var(--warning)' : 'var(--warning-bg)',
                color: isBreak ? '#fff' : 'var(--warning-text)',
                border: '1px solid var(--warning-border)',
                borderRadius: '6px',
                fontWeight: 600,
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              <Coffee size={14} /> {isBreak ? 'End Break' : 'Take Break'}
            </button>
          </div>

          {/* Hub Deep Link */}
          <a
            href="/wallet"
            className="wallet-btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '6px',
              textDecoration: 'none',
              fontSize: '0.8rem',
              fontWeight: 600,
              transition: 'background 0.2s ease'
            }}
          >
            <span>View Ledger & Schedules</span>
            <ChevronRight size={14} />
          </a>

          {/* Legal / Psychological disclaimer */}
          <div style={{ marginTop: '10px', fontSize: '0.68rem', color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.3 }}>
            Self-discipline virtual currency only. Zero financial value.
          </div>
        </div>
      )}
    </div>
  );
}
