import React, { useState, useEffect, useRef } from 'react';
import { AlertTriangle, CheckCircle, Pause } from 'lucide-react';
import { api } from '../api';

export default function IdleCheckModal({ activeSession, onIdleTimeout }) {
  const [showModal, setShowModal] = useState(false);
  const [countdown, setCountdown] = useState(120); // 2 minutes countdown
  const lastActiveRef = useRef(Date.now());
  const countdownTimerRef = useRef(null);

  // 10 minutes inactivity timeout
  const IDLE_THRESHOLD_MS = 10 * 60 * 1000;

  useEffect(() => {
    const handleActivity = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('click', handleActivity);
    window.addEventListener('scroll', handleActivity);

    // Watchdog check every 10 seconds
    const interval = setInterval(() => {
      if (activeSession && !showModal) {
        const idleDuration = Date.now() - lastActiveRef.current;
        if (idleDuration >= IDLE_THRESHOLD_MS) {
          setShowModal(true);
          setCountdown(120);
        }
      }
    }, 10000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('scroll', handleActivity);
      clearInterval(interval);
    };
  }, [activeSession, showModal]);

  // Handle 120s countdown when modal is open
  useEffect(() => {
    if (showModal) {
      countdownTimerRef.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(countdownTimerRef.current);
            handleAutoPause();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownTimerRef.current);
    }
  }, [showModal]);

  const handleStillWorking = async () => {
    setShowModal(false);
    lastActiveRef.current = Date.now();
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (activeSession?.id) {
      try {
        await api.sendWalletHeartbeat(activeSession.id, true);
      } catch {}
    }
  };

  const handleAutoPause = async () => {
    setShowModal(false);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    if (activeSession?.id) {
      try {
        await api.stopWalletSession(activeSession.id);
        if (onIdleTimeout) onIdleTimeout();
      } catch {}
    }
  };

  if (!showModal) return null;

  const minutes = Math.floor(countdown / 60);
  const seconds = countdown % 60;

  return (
    <div
      className="idle-modal-backdrop"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000
      }}
    >
      <div
        className="idle-modal-card wallet-modal-card"
        style={{
          width: '90%',
          maxWidth: '440px',
          background: 'var(--modal-bg)',
          border: '2px solid var(--gold-primary)',
          borderRadius: '16px',
          padding: '24px',
          color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-modal)',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'var(--warning-bg)',
            border: '1px solid var(--warning-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}
        >
          <AlertTriangle size={32} color="var(--gold-primary)" />
        </div>

        <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '0 0 8px', color: 'var(--text-primary)' }}>
          Are You Still Working?
        </h3>

        <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 20px' }}>
          No keyboard or mouse activity detected for 10 minutes.
          If no response is received, your session timer will automatically stop to maintain accurate ledger integrity.
        </p>

        {/* Big Countdown Timer */}
        <div
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            fontVariantNumeric: 'tabular-nums',
            color: countdown <= 30 ? 'var(--danger)' : 'var(--gold-primary)',
            marginBottom: '24px'
          }}
        >
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            type="button"
            onClick={handleStillWorking}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              background: 'var(--success, #10b981)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <CheckCircle size={18} /> Yes, I'm Working
          </button>

          <button
            type="button"
            onClick={handleAutoPause}
            className="wallet-btn-secondary"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px 16px',
              fontSize: '0.9rem',
              cursor: 'pointer'
            }}
          >
            <Pause size={18} /> I Stepped Away
          </button>
        </div>
      </div>
    </div>
  );
}
