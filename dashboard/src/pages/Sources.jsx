import React, { useState, useEffect } from 'react';
import {
  Layers,
  Zap,
  Power,
  PlayCircle,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import {
  Button,
  Card,
  Badge,
  useToast
} from '../components/ui';

const DEFAULT_SOURCES = [
  { platform: 'google_places', name: 'Google Places (Official Places API New)', enabled: true, rateLimitMs: 500, tier: 1 },
  { platform: 'google_maps', name: 'Google Maps (Web Stealth)', enabled: true, rateLimitMs: 2000, tier: 1 },
  { platform: 'overpass', name: 'OpenStreetMap Overpass (Global)', enabled: true, rateLimitMs: 1000, tier: 1 },
  { platform: 'yellowpages_uae', name: 'YellowPages UAE', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'indiamart', name: 'IndiaMart Directory', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'tradeindia', name: 'TradeIndia Directory', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'justdial', name: 'Justdial Directory', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'yelp', name: 'Yelp Business Directory', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'yellowpages', name: 'YellowPages US', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'houzz', name: 'Houzz Professionals', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'europages', name: 'Europages EU Directory', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'alibaba', name: 'Alibaba Suppliers', enabled: true, rateLimitMs: 3000, tier: 2 }
];

export default function Sources() {
  const toast = useToast();

  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState({});
  const [testResults, setTestResults] = useState({});

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    try {
      setLoading(true);
      const res = await api.getSources();
      if (Array.isArray(res.sources) && res.sources.length > 0) {
        setSources(res.sources);
      }
    } catch (err) {
      console.warn('Using default sources catalog');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(platform) {
    try {
      const res = await api.toggleSource(platform);
      setSources((prev) =>
        prev.map((s) => (s.platform === platform ? { ...s, enabled: res.enabled } : s))
      );
      toast.success(`Engine "${platform}" is now ${res.enabled ? 'Active' : 'Disabled'}.`);
    } catch (err) {
      toast.error(`Failed to toggle source: ${err.message}`);
    }
  }

  async function handleTest(platform) {
    try {
      setTesting((prev) => ({ ...prev, [platform]: true }));
      const res = await api.testSource(platform, { keyword: 'rug store', city: 'Dubai', country: 'UAE' });
      setTestResults((prev) => ({ ...prev, [platform]: res.result }));
      if (res.result?.status === 'ok') {
        toast.success(`Engine "${platform}" responded successfully.`);
      } else {
        toast.warning(`Engine "${platform}" returned: ${res.result?.status}`);
      }
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [platform]: { status: 'error', errorMessage: err.message, count: 0, durationMs: 0 }
      }));
      toast.error(`Engine test failed: ${err.message}`);
    } finally {
      setTesting((prev) => ({ ...prev, [platform]: false }));
    }
  }

  return (
    <div className="page-content">
      <Card
        title="Registered Scraper Source Engines"
        icon={Layers}
        subtitle="Multi-source scraping network with automatic failover, stealth user-agent rotation, and live engine diagnostics."
      >
        <div className="grid-responsive" style={{ marginTop: '16px' }}>
          {sources.map((s) => {
            const diag = testResults[s.platform];
            const isTesting = testing[s.platform];

            return (
              <div
                key={s.platform}
                className="card"
                style={{
                  background: 'var(--bg-surface-elevated)',
                  borderColor: s.enabled ? 'var(--border-subtle)' : 'var(--danger-border)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                  <div>
                    <h3 style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-heading)' }}>
                      {s.name}
                    </h3>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginTop: '2px' }}>
                      Engine ID: <code>{s.platform}</code>
                    </div>
                  </div>

                  <Badge variant={s.enabled ? 'success' : 'danger'}>
                    {s.enabled ? 'Active' : 'Disabled'}
                  </Badge>
                </div>

                {/* Diagnostics test result */}
                {diag && (
                  <div
                    style={{
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--font-xs)',
                      marginBottom: '12px',
                      background:
                        diag.status === 'ok'
                          ? 'var(--success-bg)'
                          : diag.status === 'empty'
                          ? 'var(--warning-bg)'
                          : 'var(--danger-bg)',
                      border: `1px solid ${
                        diag.status === 'ok'
                          ? 'var(--success-border)'
                          : diag.status === 'empty'
                          ? 'var(--warning-border)'
                          : 'var(--danger-border)'
                      }`,
                      color:
                        diag.status === 'ok'
                          ? 'var(--success)'
                          : diag.status === 'empty'
                          ? 'var(--warning-text)'
                          : 'var(--danger-text)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}>
                      {diag.status === 'ok' && <CheckCircle2 size={13} aria-hidden="true" />}
                      {diag.status === 'empty' && <AlertTriangle size={13} aria-hidden="true" />}
                      {(diag.status === 'error' || diag.status === 'blocked') && <XCircle size={13} aria-hidden="true" />}
                      <span>Diagnostic: {diag.status.toUpperCase()}</span>
                      {diag.durationMs ? <span style={{ opacity: 0.7 }}>({diag.durationMs}ms)</span> : null}
                    </div>
                    {diag.errorMessage && (
                      <div style={{ marginTop: '4px', fontSize: '11px', wordBreak: 'break-word', color: 'var(--text-muted)' }}>
                        {diag.errorMessage}
                      </div>
                    )}
                    {diag.count > 0 && (
                      <div style={{ marginTop: '2px', fontSize: '11px', color: 'var(--success)' }}>
                        Extracted {diag.count} leads
                      </div>
                    )}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--font-xs)', color: 'var(--text-muted)', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Zap size={14} color="var(--gold-primary)" aria-hidden="true" />
                    <span>Tier {s.tier || 1} • {s.rateLimitMs || 1500}ms delay</span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={isTesting}
                      onClick={() => handleTest(s.platform)}
                      aria-label={`Test ${s.name}`}
                    >
                      Test
                    </Button>

                    <Button
                      variant={s.enabled ? 'danger' : 'secondary'}
                      size="sm"
                      icon={Power}
                      onClick={() => handleToggle(s.platform)}
                    >
                      {s.enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
