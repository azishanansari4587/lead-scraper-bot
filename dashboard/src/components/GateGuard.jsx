import React, { useState, useEffect } from 'react';
import { api } from '../api';
import MindsetGateScreen from './MindsetGateScreen';

export default function GateGuard({ children }) {
  const [loading, setLoading] = useState(true);
  const [gateStatus, setGateStatus] = useState(null);
  const [isUnlocked, setIsUnlocked] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function checkGate() {
      try {
        const status = await api.getGateStatus();
        if (!isMounted) return;

        setGateStatus(status);

        // If gate is not required (e.g. mode is 'off' or 'once_daily' already completed today)
        if (!status.required) {
          setIsUnlocked(true);
          setLoading(false);
          return;
        }

        // If gate is required, check current browser session unlock token for this user
        const tokenKey = `knotiq_mindset_gate_unlocked_${status.userId || 'current'}`;
        const sessionUnlocked = sessionStorage.getItem(tokenKey);

        if (sessionUnlocked === 'true') {
          setIsUnlocked(true);
        } else {
          setIsUnlocked(false);
        }
      } catch (err) {
        console.error('Failed to query mindset gate status:', err);
        // Fail-safe: if status query fails, allow access so user is never permanently locked out by a network blip
        setIsUnlocked(true);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    checkGate();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  // Neutral dark loading state with gold spinner — strictly avoids any dashboard content flash
  if (loading) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: '#090D16',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(245, 158, 11, 0.2)',
            borderTopColor: '#F59E0B',
            animation: 'spin 0.8s linear infinite'
          }}
        />
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
      </div>
    );
  }

  // If gate is required and not yet unlocked for this user in this session, render full-screen Mindset Gate
  if (!isUnlocked && gateStatus && gateStatus.required) {
    return (
      <MindsetGateScreen
        initialStatus={gateStatus}
        userId={gateStatus.userId}
        onUnlock={handleUnlock}
      />
    );
  }

  return children;
}
