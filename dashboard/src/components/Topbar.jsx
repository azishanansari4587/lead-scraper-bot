import React from 'react';
import { Globe, ShieldCheck } from 'lucide-react';

export default function Topbar({ title, currentMarket = 'UAE & Gulf Region' }) {
  return (
    <header className="topbar">
      <div className="topbar-left">
        <h1 className="page-title">{title}</h1>
        <div className="market-badge">
          <Globe size={14} />
          <span>Active Market: {currentMarket}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--emerald)' }}>
          <ShieldCheck size={16} />
          <span>SSRF Guard & Anti-Bot Active</span>
        </div>
      </div>
    </header>
  );
}
