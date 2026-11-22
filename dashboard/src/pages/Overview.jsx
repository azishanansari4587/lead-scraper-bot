import React, { useEffect, useState } from 'react';
import {
  Users,
  Award,
  Sparkles,
  ArrowUpRight,
  TrendingUp,
  Clock,
  Layers,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../api';
import { Card, Button, Badge, Skeleton, SkeletonCard, EmptyState } from '../components/ui';

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
        <div className="kpi-grid">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid-responsive" style={{ marginTop: '24px' }}>
          <div className="card" style={{ height: '240px' }}><Skeleton height="100%" /></div>
          <div className="card" style={{ height: '240px' }}><Skeleton height="100%" /></div>
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
      <section aria-label="Key Performance Indicators" className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Qualified Leads</span>
            <div className="kpi-icon-wrap"><Users size={16} aria-hidden="true" /></div>
          </div>
          <div className="kpi-value tabular-nums">{total}</div>
          <div className="kpi-subtitle">Across UAE, GCC, US, UK, EU markets</div>
        </div>

        <div className="kpi-card emerald">
          <div className="kpi-header">
            <span className="kpi-title">High-Fit B2B Targets (≥70)</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--success)' }}>
              <Award size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="kpi-value tabular-nums" style={{ color: 'var(--success)' }}>{highFit}</div>
          <div className="kpi-subtitle">
            {total > 0 ? Math.round((highFit / total) * 100) : 0}% prime export fit
          </div>
        </div>

        <div className="kpi-card indigo">
          <div className="kpi-header">
            <span className="kpi-title">Verified Rug Buyers</span>
            <div className="kpi-icon-wrap" style={{ color: 'var(--info)' }}>
              <Sparkles size={16} aria-hidden="true" />
            </div>
          </div>
          <div className="kpi-value tabular-nums" style={{ color: 'var(--info)' }}>{rugsVerified}</div>
          <div className="kpi-subtitle">Confirmed carpet / rug retail signals</div>
        </div>

        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Average Fit Score</span>
            <div className="kpi-icon-wrap"><TrendingUp size={16} aria-hidden="true" /></div>
          </div>
          <div className="kpi-value tabular-nums">
            {avgScore} <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>/ 100</span>
          </div>
          <div className="kpi-subtitle">Rule evaluation & AI qualification</div>
        </div>
      </section>

      {/* Main Grid: Breakdown & Recent Runs */}
      <div className="grid-responsive">
        {/* Category & Market Distribution */}
        <Card
          title="Lead Category Breakdown"
          icon={Layers}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onNavigate('/leads')}
            >
              View All <ArrowUpRight size={14} aria-hidden="true" />
            </Button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {Object.entries(stats?.byLeadType || {}).length === 0 ? (
              <EmptyState
                title="No lead breakdown yet"
                description="Run your first scrape to discover importers and retailers."
                action={
                  <Button variant="primary" size="sm" onClick={() => onNavigate('/search')}>
                    Start Scraper
                  </Button>
                }
              />
            ) : (
              Object.entries(stats?.byLeadType || {}).map(([type, count]) => {
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', marginBottom: '5px' }}>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                        {type.replace(/_/g, ' ')}
                      </span>
                      <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {count} ({pct}%)
                      </span>
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
            <h4 style={{ fontSize: 'var(--font-xs)', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '10px' }}>
              Top Export Destinations
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {Object.entries(stats?.byCountry || {}).map(([country, count]) => (
                <Badge key={country} variant="warning">
                  {country}: <strong className="tabular-nums" style={{ marginLeft: '3px' }}>{count}</strong>
                </Badge>
              ))}
            </div>
          </div>
        </Card>

        {/* Recent Scraper Runs */}
        <Card
          title="Recent Scraper Activity"
          icon={Clock}
          action={
            <Button
              variant="primary"
              size="sm"
              onClick={() => onNavigate('/search')}
            >
              New Scrape
            </Button>
          }
        >
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
                    <td colSpan="4" style={{ padding: 0 }}>
                      <EmptyState
                        title="No scraping runs recorded"
                        description="Launch a search to extract leads from global platforms."
                      />
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
                        <Badge variant={run.status === 'completed' ? 'success' : 'danger'}>
                          {run.status}
                        </Badge>
                      </td>
                      <td className="tabular-nums" style={{ fontWeight: 700, color: 'var(--gold-primary)' }}>
                        +{run.newCount || 0}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Quick Actions Footer Card */}
      <Card
        className="card-cta"
        style={{
          background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08), rgba(16, 185, 129, 0.04))',
          borderColor: 'var(--border-accent)'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-heading)' }}>
              Ready to expand Knotiq Rugs B2B export partnerships?
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-sm)', marginTop: '2px' }}>
              Search new luxury targets across UAE & global markets, or generate a signed dossier.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button variant="secondary" onClick={() => onNavigate('/search')}>
              Search Targets
            </Button>
            <Button variant="primary" icon={FileSpreadsheet} onClick={() => onNavigate('/exports')}>
              Export Dossier
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
