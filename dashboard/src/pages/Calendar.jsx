import React from 'react';
import { Calendar as CalendarIcon, Clock, ArrowRight } from 'lucide-react';
import { Card, Button } from '../components/ui';

export default function Calendar() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Schedule & Calendar
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
          Unified calendar for sales calls, follow-ups, production meetings, and daily rituals.
        </p>
      </div>

      <Card>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(245, 158, 11, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--gold-primary)'
            }}
          >
            <CalendarIcon size={32} />
          </div>
          <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Calendar & Daily Rituals Coming in Phase B
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Phase B will activate the interactive Day/Week/Month schedule, Morning Plan (3 MITs), Evening Review,
            and automated Telegram morning briefs.
          </p>
          <div style={{ display: 'inline-flex', gap: '8px', padding: '8px 16px', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', color: 'var(--gold-primary)' }}>
            <Clock size={14} /> Scheduled for immediate implementation after Phase A review
          </div>
        </div>
      </Card>
    </div>
  );
}
