import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { ToastProvider } from './components/ui/Toast';
import Overview from './pages/Overview';
import SearchScrape from './pages/SearchScrape';
import Leads from './pages/Leads';
import PresetsSchedules from './pages/PresetsSchedules';
import Sources from './pages/Sources';
import Exports from './pages/Exports';
import Settings from './pages/Settings';
import BulkSend from './pages/BulkSend';
import { api } from './api';

const ROUTE_TITLES = {
  '/overview': 'Overview',
  '/search': 'Search & Scrape',
  '/leads': 'Leads CRM',
  '/bulk': 'Bulk Outreach',
  '/presets': 'Presets & Schedules',
  '/sources': 'Scraper Engines',
  '/exports': 'Data Exports',
  '/settings': 'Settings & Health'
};

function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [geminiStats, setGeminiStats] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    api.getSettings()
      .then((data) => {
        setGeminiStats(data.settings?.geminiStats || null);
      })
      .catch(() => {});
  }, []);

  const currentTitle = ROUTE_TITLES[location.pathname] || 'Knotiq Rugs Export Bot';

  return (
    <div className="app-container">
      <Sidebar
        geminiStats={geminiStats}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <div className="main-wrapper">
        <Topbar
          title={currentTitle}
          currentMarket="UAE & GCC Region"
          onToggleMobileMenu={() => setMobileOpen((prev) => !prev)}
        />

        <main id="main-content">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview onNavigate={navigate} />} />
            <Route path="/search" element={<SearchScrape onNavigate={navigate} />} />
            <Route path="/leads" element={<Leads onExportRequested={() => navigate('/exports')} />} />
            <Route path="/bulk" element={<BulkSend />} />
            <Route path="/presets" element={<PresetsSchedules onRunPreset={() => navigate('/search')} />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/exports" element={<Exports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <DashboardLayout />
      </BrowserRouter>
    </ToastProvider>
  );
}
