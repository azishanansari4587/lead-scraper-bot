import React from 'react';
import {
  LayoutDashboard,
  Search,
  Users,
  BookmarkCheck,
  Globe2,
  Download,
  Sliders,
  Sparkles,
  Layers,
  Send
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'search', label: 'Search & Scrape', icon: Search },
  { id: 'leads', label: 'Leads CRM', icon: Users },
  { id: 'bulk', label: 'Bulk Send', icon: Send },
  { id: 'presets', label: 'Presets & Schedules', icon: BookmarkCheck },
  { id: 'sources', label: 'Scraper Sources', icon: Layers },
  { id: 'exports', label: 'Data Exports', icon: Download },
  { id: 'settings', label: 'System Diagnostics', icon: Sliders }
];

export default function Sidebar({ activeTab, setActiveTab, geminiStats }) {
  const dailyLimit = geminiStats?.dailyLimit || 500;
  const usedCount = geminiStats?.dailyUsageCount || 0;
  const quotaPct = Math.min(100, Math.round((usedCount / dailyLimit) * 100));

  return (
    <aside className="sidebar">
      <div className="brand-header">
        <img src="/favicon.png" alt="LSB" className="brand-icon" style={{ objectFit: 'cover' }} />
        <div>
          <div className="brand-name">KNOTIQ RUGS</div>
          <div className="brand-subtitle">Export Lead Engine</div>
        </div>
      </div>

      <nav className="nav-section">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              className={`nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setActiveTab(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="quota-indicator">
          <div className="quota-label">
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Sparkles size={12} color="var(--gold-primary)" /> Gemini AI Quota
            </span>
            <span>{usedCount} / {dailyLimit}</span>
          </div>
          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${quotaPct}%` }} />
          </div>
        </div>
        <div style={{ fontSize: '11px', color: 'var(--text-dim)', textAlign: 'center' }}>
          Target: UAE • US • UK • EU • GCC
        </div>
      </div>
    </aside>
  );
}
