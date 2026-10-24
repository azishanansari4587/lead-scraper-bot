import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Search,
  Users,
  BookmarkCheck,
  Download,
  Sliders,
  Sparkles,
  Layers,
  Send,
  X
} from 'lucide-react';

const NAV_GROUPS = [
  {
    title: 'Workspace',
    items: [
      { path: '/overview', label: 'Overview', icon: LayoutDashboard },
      { path: '/search', label: 'Search & Scrape', icon: Search },
      { path: '/leads', label: 'Leads CRM', icon: Users }
    ]
  },
  {
    title: 'Outreach',
    items: [
      { path: '/bulk', label: 'Bulk Send', icon: Send },
      { path: '/presets', label: 'Presets & Schedules', icon: BookmarkCheck },
      { path: '/exports', label: 'Data Exports', icon: Download }
    ]
  },
  {
    title: 'System',
    items: [
      { path: '/sources', label: 'Scraper Engines', icon: Layers },
      { path: '/settings', label: 'Settings & Health', icon: Sliders }
    ]
  }
];

export default function Sidebar({ geminiStats, mobileOpen, setMobileOpen }) {
  const dailyLimit = geminiStats?.dailyLimit || 500;
  const usedCount = geminiStats?.dailyUsageCount || 0;
  const quotaPct = Math.min(100, Math.round((usedCount / dailyLimit) * 100));

  const closeMobile = () => {
    if (setMobileOpen) setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="sidebar-backdrop"
          onClick={closeMobile}
          aria-hidden="true"
        />
      )}

      <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Sidebar Navigation">
        <div className="brand-header">
          <img src="/favicon.png" alt="Knotiq Rugs Logo" className="brand-icon" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="brand-name">KNOTIQ RUGS</div>
            <div className="brand-subtitle">Export Lead Intelligence</div>
          </div>
          {mobileOpen && (
            <button
              type="button"
              className="btn-icon btn-ghost btn-sm"
              onClick={closeMobile}
              aria-label="Close navigation menu"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        <nav className="nav-section" aria-label="Main Navigation">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="nav-group">
              <div className="nav-group-title">{group.title}</div>
              <div className="nav-group-items">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={closeMobile}
                      className={({ isActive }) =>
                        `nav-link ${isActive ? 'active' : ''}`
                      }
                      aria-current={({ isActive }) => (isActive ? 'page' : undefined)}
                    >
                      <Icon size={18} aria-hidden="true" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="quota-indicator">
            <div className="quota-label">
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={13} color="var(--gold-primary)" aria-hidden="true" /> AI Extraction Quota
              </span>
              <span>{usedCount} / {dailyLimit}</span>
            </div>
            <div className="progress-track" role="progressbar" aria-valuenow={quotaPct} aria-valuemin="0" aria-valuemax="100" aria-label="AI Daily Quota">
              <div className="progress-bar" style={{ width: `${quotaPct}%` }} />
            </div>
          </div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', textAlign: 'center' }}>
            Target Markets: UAE • GCC • US • UK • EU
          </div>
        </div>
      </aside>
    </>
  );
}
