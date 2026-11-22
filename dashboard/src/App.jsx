import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { ToastProvider } from './components/ui/Toast';

import Today from './pages/Today';
import Tasks from './pages/Tasks';
import Leads from './pages/Leads';
import Calls from './pages/Calls';
import Notes from './pages/Notes';
import Calendar from './pages/Calendar';
import Marketing from './pages/Marketing';
import Google from './pages/Google';
import Reports from './pages/Reports';
import SearchScrape from './pages/SearchScrape';
import PresetsSchedules from './pages/PresetsSchedules';
import Sources from './pages/Sources';
import Exports from './pages/Exports';
import Settings from './pages/Settings';
import BulkSend from './pages/BulkSend';
import Mindmap from './pages/Mindmap';

import { api } from './api';

const ROUTE_TITLES = {
  '/today': 'Today Command Center',
  '/tasks': 'Tasks & Priority MITs',
  '/leads': 'Leads Pipeline & Outreach',
  '/calls': 'Call System & Buyer Scripts',
  '/notes': 'Founder Notebook',
  '/calendar': 'Calendar & Meeting Scheduler',
  '/marketing': 'Marketing & Multi-Channel Campaigns',
  '/mindmap': 'Strategy & Growth Mindmap',
  '/search': 'Search & Scrape Discovery',
  '/bulk': 'Bulk Outreach & Sequences',
  '/google': 'Google Search Console & Business Profile',
  '/reports': 'Reports & Financial Intelligence',
  '/presets': 'Presets & Automated Schedules',
  '/sources': 'Scraper Engines & Connectors',
  '/exports': 'Data Exports & Reports',
  '/settings': 'Settings, Targets & System Health'
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
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<Today />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/leads" element={<Leads onExportRequested={() => navigate('/exports')} />} />
            <Route path="/calls" element={<Calls />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/marketing" element={<Marketing />} />
            <Route path="/mindmap" element={<Mindmap />} />
            <Route path="/google" element={<Google />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/search" element={<SearchScrape onNavigate={navigate} />} />
            <Route path="/bulk" element={<BulkSend />} />
            <Route path="/presets" element={<PresetsSchedules onRunPreset={() => navigate('/search')} />} />
            <Route path="/sources" element={<Sources />} />
            <Route path="/exports" element={<Exports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
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
