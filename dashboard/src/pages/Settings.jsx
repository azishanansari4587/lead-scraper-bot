import React, { useState, useEffect } from 'react';
import {
  Sliders,
  Shield,
  Sparkles,
  Database,
  Trash2,
  PlusCircle,
  Ban,
  MapPin,
  Key,
  CheckCircle2
} from 'lucide-react';
import { api } from '../api';

export default function Settings() {
  const [settings, setSettings] = useState(null);
  const [optouts, setOptouts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Google API Key state
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [keySuccessMsg, setKeySuccessMsg] = useState('');

  // New OptOut form
  const [optType, setOptType] = useState('domain');
  const [optValue, setOptValue] = useState('');
  const [optReason, setOptReason] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function handleSaveApiKey(e) {
    e.preventDefault();
    setSavingKey(true);
    setKeySuccessMsg('');
    try {
      const res = await api.saveApiKeys({ googlePlacesApiKey: googleApiKey });
      setKeySuccessMsg(res.message || 'Key saved successfully');
      setGoogleApiKey('');
      loadData();
    } catch (err) {
      alert(`Failed to save key: ${err.message}`);
    } finally {
      setSavingKey(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);
      const [settingsRes, optoutsRes] = await Promise.all([
        api.getSettings().catch(() => ({ settings: {} })),
        api.getOptOuts().catch(() => ({ optouts: [] }))
      ]);
      setSettings(settingsRes.settings);
      setOptouts(optoutsRes.optouts || []);
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleAddOptOut(e) {
    e.preventDefault();
    if (!optValue.trim()) return;

    try {
      await api.createOptOut({
        type: optType,
        value: optValue.trim(),
        reason: optReason.trim() || undefined
      });
      setOptValue('');
      setOptReason('');
      loadData();
      alert('Suppression entry added and matching leads zeroed out!');
    } catch (err) {
      alert(`Failed to add opt-out: ${err.message}`);
    }
  }

  async function handleDeleteOptOut(id) {
    if (!window.confirm('Remove from suppression list?')) return;
    try {
      await api.deleteOptOut(id);
      setOptouts((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      alert(`Failed to delete opt-out: ${err.message}`);
    }
  }

  const gemini = settings?.geminiStats || {};

  return (
    <div className="page-content">
      {/* System Diagnostics Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Sparkles size={16} color="var(--gold-primary)" /> Gemini AI Diagnostics
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Model</span>
              <strong>gemini-1.5-flash</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Daily Usage Today</span>
              <strong>{gemini.dailyUsageCount || 0} / {gemini.dailyLimit || 500} calls</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cached Domains</span>
              <strong>{gemini.cachedDomains || 0} domains</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Prompt Injection Defense</span>
              <span className="badge badge-score-high">Enforced (&lt;untrusted_scraped_data&gt;)</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Database size={16} color="var(--gold-primary)" /> Infrastructure & Security
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Database Dialect</span>
              <strong style={{ textTransform: 'uppercase' }}>{settings?.databaseDialect || 'SQLite'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>SSRF Protection</span>
              <span className="badge badge-score-high">Active (Private Subnets Blocked)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Active Scraper Engines</span>
              <strong>{settings?.activeScrapers?.length || 0} registered</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Environment</span>
              <strong>{settings?.environment || 'development'}</strong>
            </div>
          </div>
        </div>

        {/* Google Maps & Places Integration Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <MapPin size={16} color="var(--gold-primary)" /> Google Maps & Places Connect
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Google Maps Browser Scraper</span>
              <span className="badge badge-score-high">Connected (Free • No Key Needed)</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-muted)' }}>Google Places API Key</span>
              {settings?.googlePlacesApiKeyConfigured ? (
                <span className="badge badge-score-high">
                  Active ({settings.googlePlacesApiKeyMasked})
                </span>
              ) : (
                <span className="badge badge-score-low">Unset (Optional)</span>
              )}
            </div>

            <form onSubmit={handleSaveApiKey} style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>
                {settings?.googlePlacesApiKeyConfigured ? 'Update Google Cloud Places API Key:' : 'Connect Google Places API Key:'}
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="password"
                  className="input"
                  style={{ flex: 1, fontSize: '12px' }}
                  placeholder="AIzaSy..."
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={savingKey}>
                  <Key size={13} /> {savingKey ? 'Saving...' : 'Save Key'}
                </button>
              </div>
              {keySuccessMsg && (
                <div style={{ fontSize: '11px', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <CheckCircle2 size={12} /> {keySuccessMsg}
                </div>
              )}
              <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                Tip: If you don't have an API key, you can still scrape Google Maps directly via the <strong>Google Maps (Browser)</strong> engine in Search & Scrape.
              </span>
            </form>
          </div>
        </div>
      </div>

      {/* Suppression / OptOut Manager */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Ban size={18} color="var(--rose)" /> Opt-Out & Suppression List
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              Prevents contacted businesses or unsubscribed domains from being scraped or re-targeted.
            </p>
          </div>
        </div>

        {/* Add Entry Form */}
        <form onSubmit={handleAddOptOut} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '20px', padding: '16px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
          <select className="select" value={optType} onChange={(e) => setOptType(e.target.value)}>
            <option value="domain">Domain</option>
            <option value="email">Email Address</option>
            <option value="phone">Phone Number</option>
          </select>

          <input
            type="text"
            className="input"
            style={{ flex: 1, minWidth: '200px' }}
            placeholder="Value to suppress (e.g. competitor.com or +97143390000)"
            value={optValue}
            onChange={(e) => setOptValue(e.target.value)}
            required
          />

          <input
            type="text"
            className="input"
            style={{ flex: 1, minWidth: '180px' }}
            placeholder="Reason (e.g. Competitor / Unsubscribe)"
            value={optReason}
            onChange={(e) => setOptReason(e.target.value)}
          />

          <button type="submit" className="btn btn-secondary btn-sm">
            <PlusCircle size={14} /> Add Suppression
          </button>
        </form>

        {/* Suppression Table */}
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Suppressed Value</th>
                <th>Reason</th>
                <th>Added Date</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {optouts.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    Suppression list is empty.
                  </td>
                </tr>
              ) : (
                optouts.map((opt) => (
                  <tr key={opt.id}>
                    <td>
                      <span className="badge badge-score-low" style={{ textTransform: 'uppercase' }}>
                        {opt.type}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600, color: '#FFF' }}>{opt.value}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{opt.reason || 'Manual'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                      {opt.requestedAt ? new Date(opt.requestedAt).toLocaleDateString() : 'Recent'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-danger btn-sm" onClick={() => handleDeleteOptOut(opt.id)}>
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
