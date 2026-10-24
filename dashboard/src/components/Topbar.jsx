import React, { useState, useEffect } from 'react';
import { Globe, ShieldCheck, Sun, Moon, Menu } from 'lucide-react';

export default function Topbar({
  title,
  currentMarket = 'UAE & GCC Region',
  onToggleMobileMenu
}) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('knotiq_theme') || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('knotiq_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleMobileMenu}
          aria-label="Toggle navigation menu"
        >
          <Menu size={22} aria-hidden="true" />
        </button>

        <h1 className="page-title">{title}</h1>

        <div className="market-badge" title="Active Focus Export Region">
          <Globe size={13} aria-hidden="true" />
          <span>Market: {currentMarket}</span>
        </div>
      </div>

      <div className="topbar-right">
        <div className="topbar-system-status" title="Safe Scraping & Compliance Engine Active">
          <ShieldCheck size={16} aria-hidden="true" />
          <span>Export Network Active</span>
        </div>

        <button
          type="button"
          className="theme-toggle-btn"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? (
            <Sun size={16} color="var(--gold-primary)" aria-hidden="true" />
          ) : (
            <Moon size={16} color="var(--gold-primary)" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
