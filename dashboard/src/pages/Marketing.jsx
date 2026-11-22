import React from 'react';
import { Megaphone, Mail, Calendar, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui';

export default function Marketing() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Marketing Hub
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
          Trade campaigns, content calendar, and attribution tracking for Knotiq Rugs exports.
        </p>
      </div>

      <Card>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--emerald-accent)'
            }}
          >
            <Megaphone size={32} />
          </div>
          <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Marketing Hub Coming in Phase C
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '540px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Phase C will unlock the multi-platform content calendar (Instagram, LinkedIn, trade newsletters), campaign attribution, and email drip campaign tracker with strict OptOut safety.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Calendar size={14} /> Content Calendar
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Mail size={14} /> Campaign Tracker
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <TrendingUp size={14} /> Lead Attribution
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
