import React, { useState, useEffect } from 'react';
import { Layers, ShieldCheck, Zap, Power } from 'lucide-react';
import { api } from '../api';

const DEFAULT_SOURCES = [
  { platform: 'google_maps', name: 'Google Maps (Web Stealth)', enabled: true, rateLimitMs: 2000, tier: 1 },
  { platform: 'google_places', name: 'Google Places (Official API)', enabled: true, rateLimitMs: 500, tier: 1 },
  { platform: 'overpass', name: 'OpenStreetMap Overpass (Global)', enabled: true, rateLimitMs: 1000, tier: 1 },
  { platform: 'indiamart', name: 'IndiaMart Directory', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'tradeindia', name: 'TradeIndia Directory', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'justdial', name: 'Justdial Directory', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'yellowpages_uae', name: 'YellowPages UAE', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'yelp', name: 'Yelp Business Directory', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'yellowpages', name: 'YellowPages US', enabled: true, rateLimitMs: 2000, tier: 2 },
  { platform: 'houzz', name: 'Houzz Professionals', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'europages', name: 'Europages EU Directory', enabled: true, rateLimitMs: 2500, tier: 2 },
  { platform: 'alibaba', name: 'Alibaba Suppliers', enabled: true, rateLimitMs: 3000, tier: 2 }
];

export default function Sources() {
  const [sources, setSources] = useState(DEFAULT_SOURCES);
  const [loading, setLoading] = useState(false);

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
      console.error('Failed to load sources', err);
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
    } catch (err) {
      alert(`Failed to toggle source: ${err.message}`);
    }
  }

  return (
    <div className="page-content">
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Layers size={18} color="var(--gold-primary)" /> Registered Scraper Source Engines
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Multi-source scraping network with automatic failover, stealth user-agent rotation, and polite delay throttles.
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {sources.map((s) => (
            <div
              key={s.platform}
              className="card"
              style={{
                background: 'var(--bg-surface-elevated)',
                borderColor: s.enabled ? 'var(--border-subtle)' : 'rgba(244, 63, 94, 0.2)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#FFF' }}>{s.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', marginTop: '2px' }}>
                    Engine ID: <code>{s.platform}</code>
                  </div>
                </div>

                <span className={`badge ${s.enabled ? 'badge-score-high' : 'badge-score-low'}`}>
                  {s.enabled ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Zap size={14} color="var(--gold-primary)" />
                  <span>Tier {s.tier} • {s.rateLimitMs}ms delay</span>
                </div>

                <button
                  className={`btn btn-sm ${s.enabled ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => handleToggle(s.platform)}
                >
                  <Power size={12} /> {s.enabled ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
