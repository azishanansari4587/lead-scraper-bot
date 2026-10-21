import React, { useState, useEffect } from 'react';
import {
  Play,
  BookmarkPlus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Globe2,
  Layers,
  Search,
  SlidersHorizontal
} from 'lucide-react';
import { api } from '../api';

const COUNTRY_CITIES = {
  'UAE': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Ajman', 'Ras Al Khaimah'],
  'USA': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Miami', 'San Francisco', 'Dallas', 'Atlanta'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Edinburgh', 'Glasgow', 'Leeds'],
  'Germany': ['Berlin', 'Munich', 'Hamburg', 'Frankfurt', 'Cologne', 'Dusseldorf'],
  'Australia': ['Sydney', 'Melbourne', 'Brisbane', 'Perth', 'Adelaide'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Dammam', 'Khobar'],
  'Qatar': ['Doha', 'Al Rayyan', 'Al Wakrah'],
  'Kuwait': ['Kuwait City', 'Salmiya', 'Hawally']
};

const LEAD_TYPES = [
  { value: 'rug_retailer', label: 'Rug / Carpet Retailer & Showroom' },
  { value: 'rug_wholesaler', label: 'Rug & Flooring Importer / Wholesaler' },
  { value: 'interior_designer', label: 'Interior Designer / Studio' },
  { value: 'interior_contractor', label: 'Fit-out / Interior Contractor' },
  { value: 'architect', label: 'Architect / Interior Architecture Firm' },
  { value: 'home_decor', label: 'Luxury Home Decor & Furniture Store' },
  { value: 'hospitality', label: 'Hospitality & Contract Furniture Buyer' }
];

const PLATFORM_LABELS = {
  google_places: 'Google Places (Official Places API New)',
  google_maps: 'Google Maps (Web Stealth • Free)',
  yellowpages_uae: 'YellowPages UAE',
  overpass: 'OpenStreetMap Overpass (Global Tier 1)',
  indiamart: 'IndiaMart Directory',
  tradeindia: 'TradeIndia Directory',
  justdial: 'Justdial Directory',
  yelp: 'Yelp Business Directory',
  yellowpages: 'YellowPages US',
  houzz: 'Houzz Professionals',
  europages: 'Europages EU Directory',
  alibaba: 'Alibaba Suppliers'
};

const NON_UAE_ENGINES = [
  'overpass',
  'indiamart',
  'tradeindia',
  'justdial',
  'yelp',
  'yellowpages',
  'houzz',
  'europages',
  'alibaba'
];

const DEFAULT_SOURCES = Object.entries(PLATFORM_LABELS).map(([platform, name]) => ({
  platform,
  name,
  enabled: true,
  rateLimitMs: 1500,
  tier: ['overpass', 'google_places', 'google_maps'].includes(platform) ? 1 : 2
}));

export default function SearchScrape({ onNavigate }) {
  const [country, setCountry] = useState('UAE');
  const [city, setCity] = useState('Dubai');
  const [leadType, setLeadType] = useState('rug_retailer');
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState('google_places');
  const [enrichWebsites, setEnrichWebsites] = useState(true);
  const [sources, setSources] = useState(DEFAULT_SOURCES);

  const [running, setRunning] = useState(false);
  const [runResult, setRunResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  // Preset modal
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    // Sync available cities when country changes
    const cities = COUNTRY_CITIES[country] || [];
    if (cities.length > 0 && !cities.includes(city)) {
      setCity(cities[0]);
    }

    // Default-disable non-UAE engines if country is UAE
    if (country === 'UAE' && NON_UAE_ENGINES.includes(platform)) {
      setPlatform('google_places');
    }
  }, [country]);

  useEffect(() => {
    loadSources();
  }, []);

  async function loadSources() {
    try {
      const res = await api.getSources();
      if (Array.isArray(res.sources) && res.sources.length > 0) {
        setSources(res.sources);
      }
    } catch (err) {
      console.warn('Using default sources catalog');
    }
  }

  async function handleRunScrape(e) {
    e.preventDefault();
    setRunning(true);
    setRunResult(null);
    setErrorMsg(null);

    try {
      const res = await api.runScrape({
        platform,
        keyword: keyword.trim() || undefined,
        leadType,
        country,
        city,
        enrichWebsites
      });

      if (res.result) {
        setRunResult(res.result);
      } else {
        setErrorMsg('Scraper finished without returning execution data.');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Scraper execution failed');
    } finally {
      setRunning(false);
    }
  }

  async function handleSavePreset() {
    if (!presetName.trim()) return;
    try {
      await api.createPreset({
        name: presetName.trim(),
        country,
        city,
        leadType,
        source: platform,
        keyword: keyword.trim() || null,
        enrichWebsites
      });
      setShowPresetModal(false);
      setPresetName('');
      alert('Search preset saved successfully!');
    } catch (err) {
      alert(`Could not save preset: ${err.message}`);
    }
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Sparkles size={20} color="var(--gold-primary)" /> Live B2B Lead Generator
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
              Extract rug importers, luxury interior designers, and wholesale distributors globally with multi-engine intelligence.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setShowPresetModal(true)}
              title="Save current search criteria as reusable preset"
            >
              <BookmarkPlus size={14} /> Save Filter Preset
            </button>
          </div>
        </div>

        {/* Search & Scrape Form */}
        <form onSubmit={handleRunScrape}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '24px' }}>
            {/* Country Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Target Export Country
              </label>
              <select
                className="select"
                style={{ width: '100%' }}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {Object.keys(COUNTRY_CITIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* City Cascading Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                City / Region
              </label>
              <select
                className="select"
                style={{ width: '100%' }}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {(COUNTRY_CITIES[country] || []).map((cityName) => (
                  <option key={cityName} value={cityName}>{cityName}</option>
                ))}
              </select>
            </div>

            {/* Lead Type */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Target Buyer Category
              </label>
              <select
                className="select"
                style={{ width: '100%' }}
                value={leadType}
                onChange={(e) => setLeadType(e.target.value)}
              >
                {LEAD_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </select>
            </div>

            {/* Platform / Source */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Scraping Source Platform
              </label>
              <select
                className="select"
                style={{ width: '100%' }}
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                <option value="all">⚡ All Enabled Engines (Multi-Engine Run)</option>
                {sources.map((s) => {
                  const isNonUae = country === 'UAE' && NON_UAE_ENGINES.includes(s.platform);
                  return (
                    <option key={s.platform} value={s.platform} disabled={isNonUae}>
                      {PLATFORM_LABELS[s.platform] || s.name} {isNonUae ? '(Disabled for UAE)' : s.tier === 1 ? '★ Tier 1' : '• Directory'}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Keyword Override & Toggles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>
                Custom Keyword Override (Optional)
              </label>
              <input
                type="text"
                className="input"
                style={{ width: '100%' }}
                placeholder="e.g. handmade rugs, oriental carpet gallery, bespoke interiors"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '20px' }}>
              <input
                type="checkbox"
                id="enrichWebsites"
                style={{ width: '18px', height: '18px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
                checked={enrichWebsites}
                onChange={(e) => setEnrichWebsites(e.target.checked)}
              />
              <label htmlFor="enrichWebsites" style={{ fontSize: '13px', cursor: 'pointer' }}>
                <strong>Enrich Websites:</strong> Crawl homepage & contact pages for direct emails & WhatsApp (+15s)
              </label>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '20px' }}>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ minWidth: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              disabled={running}
            >
              <Play size={16} fill="currentColor" />
              {running ? 'Extracting Leads...' : platform === 'all' ? 'Run All Engines' : 'Start Scraping'}
            </button>
          </div>
        </form>
      </div>

      {/* Progress / Status Banners */}
      {running && (
        <div className="card" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'var(--indigo)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="progress-bar" style={{ width: '40px', height: '4px' }} />
            <div>
              <h3 style={{ fontSize: '14px', color: '#FFF' }}>Scraping in progress...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Querying {platform === 'all' ? 'all active engines' : platform} for {leadType} in {city}, {country}. Anti-bot stealth rotation and deduplication active.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Multi-Engine Results Breakdown */}
      {runResult && runResult.isMultiEngine && (
        <div className="card" style={{ background: 'var(--bg-surface-elevated)', borderColor: 'var(--border-subtle)' }}>
          <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '6px' }}>Multi-Engine Extraction Summary</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '16px' }}>
            Total Leads Found: <strong>{runResult.totalFound}</strong> • New: <strong>{runResult.totalNew}</strong> • Duplicates: <strong>{runResult.totalDuplicates}</strong>
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Engine</th>
                  <th>Status</th>
                  <th>Leads Found</th>
                  <th>Details / Reason</th>
                  <th>Duration</th>
                </tr>
              </thead>
              <tbody>
                {runResult.results.map((eng) => (
                  <tr key={eng.platform}>
                    <td style={{ fontWeight: 600 }}>{PLATFORM_LABELS[eng.platform] || eng.platform}</td>
                    <td>
                      <span
                        className={`badge ${
                          eng.status === 'ok'
                            ? 'badge-score-high'
                            : eng.status === 'empty'
                            ? 'badge-score-medium'
                            : 'badge-score-low'
                        }`}
                      >
                        {eng.status ? eng.status.toUpperCase() : 'UNKNOWN'}
                      </span>
                    </td>
                    <td>{eng.count ?? eng.foundCount ?? 0}</td>
                    <td style={{ maxWidth: '300px', wordBreak: 'break-word', color: 'var(--text-muted)', fontSize: '12px' }}>
                      {eng.errorMessage || (eng.status === 'ok' ? 'Extracted successfully' : 'No details')}
                    </td>
                    <td>{eng.durationMs ? `${eng.durationMs}ms` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('leads')}>
              View in Leads CRM
            </button>
          </div>
        </div>
      )}

      {/* Single Engine - Green Completed Banner (ONLY on status === 'ok') */}
      {runResult && !runResult.isMultiEngine && runResult.status === 'ok' && (
        <div className="card" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'var(--emerald)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 size={24} color="var(--emerald)" />
              <div>
                <h3 style={{ fontSize: '15px', color: '#FFF' }}>Scraper Run Completed!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  Found <strong>{runResult.foundCount ?? runResult.count ?? 0}</strong> leads • Added <strong>{runResult.newCount ?? 0}</strong> new • Detected <strong>{runResult.duplicateCount ?? 0}</strong> duplicates in {runResult.durationMs}ms
                </p>
              </div>
            </div>

            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('leads')}>
              View in Leads CRM
            </button>
          </div>
        </div>
      )}

      {/* Single Engine - Amber Notice (on status === 'empty') */}
      {runResult && !runResult.isMultiEngine && runResult.status === 'empty' && (
        <div className="card" style={{ background: 'rgba(245, 158, 11, 0.08)', borderColor: 'var(--amber)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={24} color="var(--amber)" />
            <div>
              <h3 style={{ fontSize: '14.5px', color: '#FFF' }}>No Leads Returned (Empty)</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '2px' }}>
                {runResult.errorMessage || `No results returned by ${runResult.platform} for this query.`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Single Engine - Red Warning (on status === 'error' or 'blocked') */}
      {runResult && !runResult.isMultiEngine && (runResult.status === 'error' || runResult.status === 'blocked') && (
        <div className="card" style={{ background: 'rgba(244, 63, 94, 0.08)', borderColor: 'var(--rose)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <XCircle size={24} color="var(--rose)" />
            <div>
              <h3 style={{ fontSize: '14.5px', color: '#FFF' }}>
                {runResult.status === 'blocked' ? 'Scraper Blocked by Anti-Bot / CAPTCHA' : 'Scraper Execution Error'}
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', marginTop: '2px' }}>
                {runResult.errorMessage || 'The scraper engine encountered an issue while communicating with the data source.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="card" style={{ background: 'rgba(244, 63, 94, 0.08)', borderColor: 'var(--rose)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="var(--rose)" />
            <div>
              <h3 style={{ fontSize: '14px', color: '#FFF' }}>System Notice</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{errorMsg}</p>
            </div>
          </div>
        </div>
      )}

      {/* Preset Modal */}
      {showPresetModal && (
        <div className="drawer-backdrop" onClick={() => setShowPresetModal(false)}>
          <div
            className="card"
            style={{ width: '400px', margin: 'auto', background: 'var(--bg-sidebar)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '16px', color: '#FFF', marginBottom: '12px' }}>Save Search Filter Preset</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginBottom: '16px' }}>
              Save current settings ({city}, {country} — {leadType}) for one-click recurring execution.
            </p>
            <input
              type="text"
              className="input"
              style={{ width: '100%', marginBottom: '16px' }}
              placeholder="Preset Name (e.g. Dubai Carpet Retailers)"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowPresetModal(false)}>Cancel</button>
              <button className="btn btn-primary btn-sm" onClick={handleSavePreset}>Save Preset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
