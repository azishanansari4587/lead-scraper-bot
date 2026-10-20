import React, { useEffect, useState } from 'react';
import {
  Users,
  Award,
  Sparkles,
  Mail,
  Phone,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../api';

export default function Overview({ onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recentRuns, setRecentRuns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [statsData, runsData] = await Promise.all([
          api.getLeadStats(),
          api.getScrapeRuns().catch(() => ({ runs: [] }))
        ]);
        setStats(statsData);
        setRecentRuns(runsData.runs?.slice(0, 5) || []);
      } catch (err) {
        console.error('Failed to load overview data', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="page-content">
        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '60px' }}>
          Loading lead intelligence overview...
        </div>
      </div>
    );
  }

  const total = stats?.total || 0;
  const highFit = stats?.highFit || 0;
  const rugsVerified = stats?.rugsVerified || 0;
  const avgScore = stats?.avgScore || 0;

  return (
    <div className="page-content">
      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Qualified Leads</span>
            <div className="kpi-icon-wrap"><Users size={16} /></div>
          </div>
          <div className="kpi-value">{total}</div>
          <div className="kpi-subtitle">Across UAE, US, UK, GCC markets</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-header">
            <span className="kpi-title">High-Fit B2B Targets (≥70)</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--emerald)' }}><Award size={16} /></div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{highFit}</div>
          <div className="kpi-subtitle">
            {total > 0 ? Math.round((highFit / total) * 100) : 0}% prime conversion fit
          </div>
        </div>

        <div className="kpi-card indigo">
          <div className="kpi-header">
            <span className="kpi-title">Sells Rugs Verified</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--indigo)' }}><Sparkles size={16} /></div>
          </div>
          <div className="kpi-value" style={{ color: 'var(--indigo)' }}>{rugsVerified}</div>
          <div className="kpi-subtitle">Carpet / Rug signals confirmed</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Average Fit Score</span>
            <div className="kpi-icon-wrap"><TrendingUp size={16} /></div>
          </div>
          <div className="kpi-value">{avgScore} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>/ 100</span></div>
          <div className="kpi-subtitle">Rule + Gemini 1.5 AI evaluation</div>
        </div>
      </div>

      {/* Main Grid: Breakdown & Recent Runs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '24px' }}>
        {/* Category & Market Distribution */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><Layers size={18} color="var(--gold-primary)" /> Lead Category Breakdown</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('leads')}>
              View All <ArrowUpRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(stats?.byLeadType || {}).length === 0 ? (
              <div style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>No lead data yet.</div>
            ) : (
              Object.entries(stats?.byLeadType || {}).map(([type, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '5px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span style={{ color: 'var(--text-muted)' }}>{count} ({pct}%)</span>
                    </div>
                    <div className="progress-track" style={{ height: '6px' }}>
                      <div className="progress-bar" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px' }}>
              Top Export Markets
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(stats?.byCountry || {}).map(([country, count]) => (
                <span key={country} className="badge badge-score-med" style={{ fontSize: '12px', padding: '5px 10px' }}>
                  {country}: {count}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Scraper Runs */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title"><Clock size={18} color="var(--gold-primary)" /> Recent Scraper Activity</h2>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('search')}>
              New Scrape
            </button>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>New Leads</th>
                </tr>
              </thead>
              <tbody>
                {recentRuns.length === 0 ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-dim)', padding: '30px' }}>
                      No recent scraping runs recorded.
                    </td>
                  </tr>
                ) : (
                  recentRuns.map((run) => (
                    <tr key={run.id}>
                      <td style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                        {run.platform?.replace(/_/g, ' ')}
                      </td>
                      <td>{run.city}, {run.country}</td>
                      <td>
                        <span className={`badge ${run.status === 'completed' ? 'badge-score-high' : 'badge-score-low'}`}>
                          {run.status}
                        </span>
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--gold-primary)' }}>
                        +{run.newCount || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Quick Actions Footer */}
      <div className="card" style={{ background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(16, 185, 129, 0.05))', borderColor: 'var(--border-accent)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#FFF' }}>
              Ready to expand Knotiq Rugs B2B reach?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              Generate an executive Excel or PDF lead dossier to initiate buyer outreach.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={() => onNavigate('search')}>
              Search Targets
            </button>
            <button className="btn btn-primary" onClick={() => onNavigate('exports')}>
              <FileSpreadsheet size={16} /> Export Dossier
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
