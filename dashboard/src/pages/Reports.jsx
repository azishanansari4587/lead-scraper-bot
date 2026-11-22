import React from 'react';
import { BarChart3, PieChart, FileSpreadsheet, Bot } from 'lucide-react';
import { Card } from '../components/ui';

export default function Reports() {
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '8px' }}>
          Executive Reports & Analytics
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
          Conversion funnels, buyer performance, weekly reviews, and Gemini AI assistant insights.
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
            <BarChart3 size={32} />
          </div>
          <h2 style={{ fontSize: 'var(--font-xl)', color: 'var(--text-primary)', marginBottom: '12px' }}>
            Executive Reports & AI Assistant Coming in Phase E
          </h2>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '560px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            Phase E completes the platform with full conversion funnel analytics (contacted $\to$ replied $\to$ sample $\to$ quotation $\to$ won), Excel KPI export workbook, and Gemini next-best-action advisory.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PieChart size={14} /> Funnel Conversion
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <FileSpreadsheet size={14} /> Multi-Tab Excel Dossier
            </span>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Bot size={14} /> Gemini Sales Copilot
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
