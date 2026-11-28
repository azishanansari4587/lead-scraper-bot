import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import { ToastProvider } from './components/ui/Toast';
import { ErrorBoundary } from './components/ui';

// Lazy-loaded routes for optimal bundle code-splitting
const Today = lazy(() => import('./pages/Today'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Routine = lazy(() => import('./pages/Routine'));
const RoutineReview = lazy(() => import('./pages/RoutineReview'));
const Leads = lazy(() => import('./pages/Leads'));
const Calls = lazy(() => import('./pages/Calls'));
const Notes = lazy(() => import('./pages/Notes'));
const Calendar = lazy(() => import('./pages/Calendar'));
const Marketing = lazy(() => import('./pages/Marketing'));
const Google = lazy(() => import('./pages/Google'));
const Reports = lazy(() => import('./pages/Reports'));
const SearchScrape = lazy(() => import('./pages/SearchScrape'));
const PresetsSchedules = lazy(() => import('./pages/PresetsSchedules'));
const Sources = lazy(() => import('./pages/Sources'));
const Exports = lazy(() => import('./pages/Exports'));
const Settings = lazy(() => import('./pages/Settings'));
const BulkSend = lazy(() => import('./pages/BulkSend'));
const Mindmap = lazy(() => import('./pages/Mindmap'));
const Mindmaps = lazy(() => import('./pages/Mindmaps'));
const MindmapEditor = lazy(() => import('./pages/MindmapEditor'));
const WalletPage = lazy(() => import('./pages/Wallet'));

import { api } from './api';
// import GateGuard from './components/GateGuard'; // Mindset Gate temporarily commented out
import FocusLockModal from './components/FocusLockModal';
import IdleCheckModal from './components/IdleCheckModal';

const ROUTE_TITLES = {
  '/today': 'Today Command Center',
  '/wallet': 'Work Wallet Hub',
  '/routine': 'CEO Routine Engine',
  '/routine/review': 'Routine Weekly Review & Analytics',
  '/tasks': 'Tasks & Priority MITs',
  '/leads': 'Leads Pipeline & Outreach',
  '/calls': 'Call System & Buyer Scripts',
  '/notes': 'Founder Notebook',
  '/calendar': 'Calendar & Meeting Scheduler',
  '/marketing': 'Marketing & Multi-Channel Campaigns',
  '/mindmap': 'Strategy & Growth Mindmap',
  '/growth-mindmap': 'Strategy & Growth Mindmap',
  '/mindmaps': 'Goal Mindmaps',
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

        <FocusLockModal />
        <IdleCheckModal />

        <main id="main-content">
          <ErrorBoundary>
            <Suspense fallback={
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--text-tertiary)', fontSize: '14px', gap: '8px' }}>
                <span className="spinner" /> Loading Command Center module...
              </div>
            }>
              <Routes>
                <Route path="/" element={<Navigate to="/today" replace />} />
                <Route path="/today" element={<Today />} />
                <Route path="/wallet" element={<WalletPage />} />
                <Route path="/routine" element={<Routine />} />
                <Route path="/routine/review" element={<RoutineReview />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/leads" element={<Leads onExportRequested={() => navigate('/exports')} />} />
                <Route path="/calls" element={<Calls />} />
                <Route path="/notes" element={<Notes />} />
                <Route path="/calendar" element={<Calendar />} />
                <Route path="/marketing" element={<Marketing />} />
                <Route path="/growth-mindmap" element={<Mindmap />} />
                <Route path="/mindmap" element={<Mindmap />} />
                <Route path="/mindmaps" element={<Mindmaps />} />
                <Route path="/mindmaps/:id" element={<MindmapEditor />} />
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
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        {/* Mindset Gate temporarily commented out */}
        {/* <GateGuard> */}
          <DashboardLayout />
        {/* </GateGuard> */}
      </BrowserRouter>
    </ToastProvider>
  );
}
