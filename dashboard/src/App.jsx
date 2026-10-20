import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Overview from './pages/Overview';
import SearchScrape from './pages/SearchScrape';
import Leads from './pages/Leads';
import PresetsSchedules from './pages/PresetsSchedules';
import Sources from './pages/Sources';
import Exports from './pages/Exports';
import Settings from './pages/Settings';
import BulkSend from './pages/BulkSend';
import { api } from './api';

const TAB_TITLES = {
  overview: 'Executive Dashboard & Overview',
  search: 'Target Search & Live Stealth Scraper',
  leads: 'B2B Leads CRM & Pipeline',
  bulk: 'Bulk Outreach & Campaign (Email & WhatsApp)',
  presets: 'Saved Presets & Recurring Schedules',
  sources: 'Scraper Engines & Source Health',
  exports: 'Export Data & Signed Dossiers',
  settings: 'System Diagnostics & Configuration'
};

export default function App() {
  const initialTab =
    typeof window !== 'undefined' && window.location.pathname.startsWith('/bulk')
      ? 'bulk'
      : 'overview';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [geminiStats, setGeminiStats] = useState(null);

  useEffect(() => {
    api.getSettings().then((data) => {
      setGeminiStats(data.settings?.geminiStats || null);
    }).catch(() => {});
  }, []);

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        geminiStats={geminiStats}
      />

      <div className="main-wrapper">
        <Topbar
          title={TAB_TITLES[activeTab] || 'Knotiq Rugs Lead Scraper'}
          currentMarket="UAE & Middle East"
        />

        <main>
          {activeTab === 'overview' && <Overview onNavigate={setActiveTab} />}
          {activeTab === 'search' && <SearchScrape onNavigate={setActiveTab} />}
          {activeTab === 'leads' && <Leads onExportRequested={() => setActiveTab('exports')} />}
          {activeTab === 'bulk' && <BulkSend />}
          {activeTab === 'presets' && <PresetsSchedules onRunPreset={() => setActiveTab('search')} />}
          {activeTab === 'sources' && <Sources />}
          {activeTab === 'exports' && <Exports />}
          {activeTab === 'settings' && <Settings />}
        </main>
      </div>
    </div>
  );
}
