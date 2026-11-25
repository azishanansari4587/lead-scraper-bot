import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldAlert, Play, CheckCircle2, Clock, AlertTriangle, ExternalLink, KeyRound, Award } from 'lucide-react';
import { api } from '../api';
import { Button, Card, Badge, useToast } from './ui';

export default function FocusLockModal() {
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const [lockedEntry, setLockedEntry] = useState(null);
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [emergencyReason, setEmergencyReason] = useState('');
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [snoozeReason, setSnoozeReason] = useState('');
  const [showSnoozeForm, setShowSnoozeForm] = useState(false);

  // Excluded safe routes: Settings, Exports, Mindset Gate practice
  const isSafeRoute = ['/settings', '/exports'].includes(location.pathname);

  const checkLockStatus = async () => {
    try {
      const res = await api.getRoutineToday();
      if (!res.success) return;

      const currentPolicy = res.policy || {};
      setPolicy(currentPolicy);

      // Check if focus lock is enabled
      if (!currentPolicy.focusLockEnabled) {
        setLockedEntry(null);
        return;
      }

      // Find any must-do entry with escalationLevel >= 4 and status === 'pending'
      const overdueLocked = (res.entries || []).find(
        (e) => e.isMustDo && !e.isProtected && e.status === 'pending' && e.escalationLevel >= 4
      );

      setLockedEntry(overdueLocked || null);
    } catch {
      // Fail safely
    }
  };

  useEffect(() => {
    checkLockStatus();
    const interval = setInterval(checkLockStatus, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, [location.pathname]);

  if (!lockedEntry || isSafeRoute) {
    return null;
  }

  const handleStart = async () => {
    try {
      setLoading(true);
      await api.checkInRoutineEntry(lockedEntry.id, { action: 'start' });
      toast.success('Started block! Focus Lock temporarily lifted while you work.');
      setLockedEntry(null);
    } catch (err) {
      toast.error(err.message || 'Failed to start block');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = async () => {
    try {
      setLoading(true);
      await api.checkInRoutineEntry(lockedEntry.id, { action: 'done' });
      toast.success('Marked completed! Focus Lock released.');
      setLockedEntry(null);
    } catch (err) {
      toast.error(err.message || 'Failed to complete block');
    } finally {
      setLoading(false);
    }
  };

  const handleSnooze = async (e) => {
    e.preventDefault();
    if (!snoozeReason.trim()) {
      toast.warning('Please provide a brief reason for snoozing');
      return;
    }
    try {
      setLoading(true);
      await api.snoozeRoutineEntry(lockedEntry.id, { snoozeMinutes: 15, reason: snoozeReason.trim() });
      toast.success('Snoozed for 15 minutes.');
      setShowSnoozeForm(false);
      setSnoozeReason('');
      setLockedEntry(null);
    } catch (err) {
      toast.error(err.message || 'Failed to snooze block');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyExit = async (e) => {
    e.preventDefault();
    if (emergencyReason.trim().length < 5) {
      toast.warning('A valid reason (minimum 5 characters) is required for emergency exit.');
      return;
    }
    try {
      setLoading(true);
      const res = await api.emergencyExitFocusLock(emergencyReason.trim());
      toast.success(`Emergency exit authorized. ${res.remainingThisWeek} emergency exit(s) left this week.`);
      setShowEmergencyForm(false);
      setEmergencyReason('');
      setLockedEntry(null);
    } catch (err) {
      toast.error(err.message || 'Failed to use emergency exit');
    } finally {
      setLoading(false);
    }
  };

  const hasPledgeStake = (policy?.supportedStakes || []).includes('pledge_reminder') && policy?.pledgeText;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        background: 'rgba(5, 7, 15, 0.96)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        color: 'var(--text-primary)'
      }}
    >
      <Card
        style={{
          maxWidth: '560px',
          width: '100%',
          background: 'var(--surface-color)',
          border: '2px solid rgba(239, 68, 68, 0.6)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(239, 68, 68, 0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--danger)',
              flexShrink: 0
            }}
          >
            <ShieldAlert size={26} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: 'var(--font-xl)', fontWeight: 800, color: 'var(--danger)' }}>
                FOCUS LOCK (L4 Escalation)
              </span>
              <Badge variant="danger">Mandatory MIT</Badge>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
              Your planned high-priority routine block has exceeded its escalation window without a check-in.
            </p>
          </div>
        </div>

        {/* Locked Block Details */}
        <div
          style={{
            background: 'var(--surface-subtle)',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-primary)' }}>
              {lockedEntry.blockTitle || lockedEntry.title}
            </span>
            <Badge variant="gold">
              {lockedEntry.plannedStart} - {lockedEntry.plannedEnd}
            </Badge>
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', gap: '12px' }}>
            <span>Category: <strong style={{ color: 'var(--gold-primary)' }}>{lockedEntry.category}</strong></span>
            {lockedEntry.carryCount > 0 && <span>Carried {lockedEntry.carryCount}x</span>}
          </div>
        </div>

        {/* Pledge Stake if active */}
        {hasPledgeStake && (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px dashed rgba(245, 158, 11, 0.4)',
              borderRadius: 'var(--radius-md)',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <Award size={20} color="var(--gold-primary)" style={{ flexShrink: 0 }} />
            <div style={{ fontStyle: 'italic', fontSize: '13px', color: 'var(--gold-primary)' }}>
              "{policy.pledgeText}"
            </div>
          </div>
        )}

        {/* Action Controls */}
        {!showEmergencyForm && !showSnoozeForm ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Button
                variant="primary"
                onClick={handleStart}
                disabled={loading}
                style={{ padding: '14px', justifyContent: 'center', fontWeight: 700, fontSize: '13px' }}
              >
                <Play size={16} /> Start Block Now
              </Button>
              <Button
                variant="outline"
                onClick={handleDone}
                disabled={loading}
                style={{ padding: '14px', justifyContent: 'center', borderColor: 'var(--emerald-accent)', color: 'var(--emerald-accent)', fontWeight: 700, fontSize: '13px' }}
              >
                <CheckCircle2 size={16} /> Mark as Done
              </Button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowSnoozeForm(true)}
                style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <Clock size={14} /> Snooze 15m (Requires Reason)
              </button>

              <button
                type="button"
                className="btn-ghost"
                onClick={() => setShowEmergencyForm(true)}
                style={{ fontSize: '12px', color: 'var(--danger)', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}
              >
                <AlertTriangle size={14} /> Emergency Exit
              </button>
            </div>
          </div>
        ) : showSnoozeForm ? (
          <form onSubmit={handleSnooze} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'var(--surface-subtle)', padding: '16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={16} /> 15-Minute Snooze
              </div>
              <Badge variant="gold">Postpones L4 Lock</Badge>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
              Provide a valid reason to postpone this Must-Do block. Snooze count is tracked against daily policy limits.
            </p>

            {/* Quick Snooze Reason Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                '📞 Urgent Client Call In Progress',
                '🎨 Finalizing CAD Approval',
                '🧵 Loom Master Clarification'
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSnoozeReason(reason)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: snoozeReason === reason ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-color)',
                    border: snoozeReason === reason ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                    color: snoozeReason === reason ? 'var(--gold-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="form-input"
              value={snoozeReason}
              onChange={(e) => setSnoozeReason(e.target.value)}
              placeholder="Why is this block being snoozed? (e.g. In the middle of CAD review)"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'var(--surface-color)',
                border: '1px solid var(--border-color)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
              required
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button type="button" variant="ghost" onClick={() => setShowSnoozeForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading} style={{ fontWeight: 700 }}>
                Confirm 15m Snooze
              </Button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleEmergencyExit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: 'rgba(239, 68, 68, 0.06)', padding: '16px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertTriangle size={16} /> Emergency Lock Exit
              </div>
              <Badge variant="danger">Audit Logged</Badge>
            </div>

            <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.4' }}>
              Overrules workspace lock immediately. Requires a minimum 5-character reason and is quota-limited (default 1/week).
            </p>

            {/* Quick Emergency Reason Chips */}
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {[
                '🚨 Urgent Client Crisis',
                '⚡ Showroom / Factory Power Failure',
                '🩺 Urgent Health / Medical Matter'
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setEmergencyReason(reason)}
                  style={{
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '12px',
                    background: emergencyReason === reason ? 'rgba(239, 68, 68, 0.2)' : 'var(--surface-color)',
                    border: emergencyReason === reason ? '1px solid var(--danger)' : '1px solid var(--border-color)',
                    color: emergencyReason === reason ? 'var(--danger)' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {reason}
                </button>
              ))}
            </div>

            <input
              type="text"
              className="form-input"
              value={emergencyReason}
              onChange={(e) => setEmergencyReason(e.target.value)}
              placeholder="e.g. Urgent crisis requiring immediate client communication..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                background: 'var(--surface-color)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: 'var(--text-primary)',
                fontSize: '13px'
              }}
              required
              minLength={5}
            />

            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
              <Button type="button" variant="ghost" onClick={() => setShowEmergencyForm(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="outline"
                disabled={loading}
                style={{ borderColor: 'var(--danger)', color: 'var(--danger)', fontWeight: 700 }}
              >
                Authorize Emergency Exit
              </Button>
            </div>
          </form>
        )}

        {/* Safety Footnote with Accessible Links */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            paddingTop: '14px',
            fontSize: '11px',
            color: 'var(--text-tertiary)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>Non-punitive founder discipline</span>
          <div style={{ display: 'flex', gap: '14px' }}>
            <button
              type="button"
              onClick={() => navigate('/settings')}
              style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', cursor: 'pointer', fontSize: '11px' }}
            >
              Settings & Policy <ExternalLink size={10} style={{ display: 'inline' }} />
            </button>
            <button
              type="button"
              onClick={() => navigate('/exports')}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '11px' }}
            >
              Data Exports <ExternalLink size={10} style={{ display: 'inline' }} />
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
