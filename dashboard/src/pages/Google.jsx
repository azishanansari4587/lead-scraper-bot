import React from 'react';
import { Globe, Search, Star, ShieldCheck } from 'lucide-react';
import { Card } from '../components/ui';

export default function Google() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Google Intelligence Hub
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
          Google Search Console organic performance & Google Business Profile review tracking.
        </p>
      </div>

      <Card>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'rgba(59, 130, 246, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              color: '#3B82F6'
            }}
          >
            <Globe size={32} />
          </div>
          <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Google Search Console & Business Profile Coming in Phase D
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Phase D integrates read-only GSC OAuth with AES-256 encrypted tokens to cache queries, clicks, CTR and keyword opportunities (positions 8-20), plus GBP review logs and profile completeness checklist.
          </p>
          <div style={{ display: 'inline-flex', gap: '8px', padding: '8px 16px', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
            <ShieldCheck size={14} color="var(--emerald-accent)" /> Read-only scopes & encrypted credentials at rest
          </div>
        </div>
      </Card>
    </div>
  );
}
