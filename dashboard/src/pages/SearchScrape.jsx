import React, { useState, useEffect } from 'react';
import {
  Play,
  BookmarkPlus,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
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
  google_maps: 'Google Maps (Web Stealth • Free)',
  google_places: 'Google Places (Official API Key)',
  overpass: 'OpenStreetMap Overpass (Global Tier 1)',
  indiamart: 'IndiaMart Directory',
  tradeindia: 'TradeIndia Directory',
  justdial: 'Justdial Directory',
  yellowpages_uae: 'YellowPages UAE',
  yelp: 'Yelp Business Directory',
  yellowpages: 'YellowPages US',
  houzz: 'Houzz Professionals',
  europages: 'Europages EU Directory',
  alibaba: 'Alibaba Suppliers'
};

export default function SearchScrape({ onNavigate }) {
  const [country, setCountry] = useState('UAE');
  const [city, setCity] = useState('Dubai');
  const [leadType, setLeadType] = useState('rug_retailer');
  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState('overpass');
  const [enrichWebsites, setEnrichWebsites] = useState(true);
  const [sources, setSources] = useState([]);

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
  }, [country]);

  useEffect(() => {
    api.getSources().then((data) => {
      setSources(data.sources || []);
    }).catch(() => {});
  }, []);

  async function handleLaunchScraper(e) {
    e.preventDefault();
    setRunning(true);
    setRunResult(null);
    setErrorMsg(null);

    try {
      const res = await api.runScrape({
        platform,
        country,
        city,
        leadType,
        keyword: keyword.trim() || undefined,
        enrichWebsites
      });
      setRunResult(res.result);
    } catch (err) {
      setErrorMsg(err.message || 'Scraping run encountered an error.');
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
        leadTypes: [leadType],
        customKeyword: keyword.trim() || undefined
      });
      setShowPresetModal(false);
      setPresetName('');
      alert('Search preset saved successfully!');
    } catch (err) {
      alert(`Failed to save preset: ${err.message}`);
    }
  }

  return (
    <div className="page-content">
      {/* Search Configuration Card */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <SlidersHorizontal size={18} color="var(--gold-primary)" /> B2B Target Query Configuration
          </h2>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setShowPresetModal(true)}
          >
            <BookmarkPlus size={14} /> Save as Preset
          </button>
        </div>

        <form onSubmit={handleLaunchScraper}>
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
                {sources.map((s) => (
                  <option key={s.platform} value={s.platform}>
                    {PLATFORM_LABELS[s.platform] || s.name} {s.tier === 1 ? '★ Tier 1' : '• Directory'}
                  </option>
                ))}
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

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={running}
              style={{ padding: '10px 24px', fontSize: '14px' }}
            >
              {running ? (
                <>Launching Stealth Scraper...</>
              ) : (
                <>
                  <Play size={16} /> Execute Live Scraper
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Progress / Result Banner */}
      {running && (
        <div className="card" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'var(--indigo)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="progress-bar" style={{ width: '40px', height: '4px' }} />
            <div>
              <h3 style={{ fontSize: '14px', color: '#FFF' }}>Scraping in progress...</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Querying {platform} for {leadType} in {city}, {country}. Anti-bot stealth rotation and deduplication engine active.
              </p>
            </div>
          </div>
        </div>
      )}

      {runResult && (
        <div className="card" style={{ background: 'rgba(16, 185, 129, 0.08)', borderColor: 'var(--emerald)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle2 size={24} color="var(--emerald)" />
              <div>
                <h3 style={{ fontSize: '15px', color: '#FFF' }}>Scraper Run Completed!</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
                  Found <strong>{runResult.foundCount}</strong> leads • Added <strong>{runResult.newCount}</strong> new • Detected <strong>{runResult.duplicateCount}</strong> duplicates in {runResult.durationMs}ms
                </p>
              </div>
            </div>

            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('leads')}>
              View in Leads CRM
            </button>
          </div>
        </div>
      )}

      {errorMsg && (
        <div className="card" style={{ background: 'var(--rose-bg)', borderColor: 'var(--rose)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <AlertTriangle size={20} color="var(--rose)" />
            <div>
              <h3 style={{ fontSize: '14px', color: '#FFF' }}>Scraping Notice</h3>
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
