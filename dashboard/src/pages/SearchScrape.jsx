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
  SlidersHorizontal,
  ArrowUpRight
} from 'lucide-react';
import { api } from '../api';
import {
  Button,
  Field,
  Select,
  Card,
  Modal,
  Badge,
  EmptyState,
  useToast
} from '../components/ui';

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
  const toast = useToast();

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
    const cities = COUNTRY_CITIES[country] || [];
    if (cities.length > 0 && !cities.includes(city)) {
      setCity(cities[0]);
    }

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
        toast.success(`Scrape complete! Extracted ${res.result.newLeadsCount || res.result.scrapedCount || 0} leads.`);
      } else {
        setErrorMsg('Scraper finished without returning execution data.');
        toast.warning('Scraper completed without returning data.');
      }
    } catch (err) {
      const msg = err.message || 'Scraper execution failed';
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setRunning(false);
    }
  }

  async function handleSavePreset() {
    if (!presetName.trim()) {
      toast.warning('Please enter a name for the search preset.');
      return;
    }
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
      toast.success('Search preset saved successfully.');
    } catch (err) {
      toast.error(`Could not save preset: ${err.message}`);
    }
  }

  return (
    <div className="page-content">
      {/* Header */}
      <Card
        title="Live B2B Lead Generator & Stealth Scraper"
        icon={Sparkles}
        subtitle="Extract rug importers, luxury interior designers, and wholesale distributors globally with multi-engine intelligence."
        action={
          <Button
            variant="secondary"
            size="sm"
            icon={BookmarkPlus}
            onClick={() => setShowPresetModal(true)}
          >
            Save Search Preset
          </Button>
        }
      >
        <form onSubmit={handleRunScrape}>
          <div className="grid-responsive" style={{ marginBottom: '20px' }}>
            {/* Country Selector */}
            <Field label="Target Export Country" id="scrape-country">
              <Select
                id="scrape-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
              >
                {Object.keys(COUNTRY_CITIES).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>

            {/* City Selector */}
            <Field label="City / Region" id="scrape-city">
              <Select
                id="scrape-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                {(COUNTRY_CITIES[country] || []).map((cityName) => (
                  <option key={cityName} value={cityName}>{cityName}</option>
                ))}
              </Select>
            </Field>

            {/* Lead Type */}
            <Field label="Target Buyer Category" id="scrape-lead-type">
              <Select
                id="scrape-lead-type"
                value={leadType}
                onChange={(e) => setLeadType(e.target.value)}
              >
                {LEAD_TYPES.map((lt) => (
                  <option key={lt.value} value={lt.value}>{lt.label}</option>
                ))}
              </Select>
            </Field>

            {/* Scraping Source Platform */}
            <Field label="Scraper Engine" id="scrape-platform">
              <Select
                id="scrape-platform"
                value={platform}
                onChange={(e) => setPlatform(e.target.value)}
              >
                {sources.map((s) => (
                  <option key={s.platform} value={s.platform}>
                    {s.name} {!s.enabled ? '(Disabled)' : ''}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {/* Search Term & Enrichment Toggle */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '16px', alignItems: 'center', marginBottom: '20px' }}>
            <Field
              label="Custom Search Query (Optional)"
              hint="Overrides standard category query (e.g. 'handmade silk carpet showroom')"
              id="scrape-query"
            >
              <input
                id="scrape-query"
                className="input"
                placeholder="e.g. handmade custom rugs, luxury carpet store"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </Field>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-sm)', color: 'var(--text-main)', marginTop: '16px' }}>
              <input
                type="checkbox"
                checked={enrichWebsites}
                onChange={(e) => setEnrichWebsites(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
              />
              <span>Deep Website Crawl (Extract emails, phones & rug keywords)</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={Play}
              loading={running}
            >
              Launch Live Scraper
            </Button>
          </div>
        </form>
      </Card>

      {/* Execution Results */}
      {runResult && (
        <Card title="Scraper Execution Summary" icon={CheckCircle2}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '20px' }}>
            <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div className="tabular-nums" style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--gold-primary)' }}>
                +{runResult.newLeadsCount || runResult.scrapedCount || 0}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Qualified Leads Extracted
              </div>
            </div>

            <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div className="tabular-nums" style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--success)' }}>
                {runResult.enrichedCount || 0}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Deep Enriched Sites
              </div>
            </div>

            <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)' }}>
              <div className="tabular-nums" style={{ fontSize: 'var(--font-xl)', fontWeight: 700 }}>
                {runResult.durationMs ? `${(runResult.durationMs / 1000).toFixed(1)}s` : '1.2s'}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                Execution Time
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="primary" onClick={() => onNavigate('/leads')}>
              View in Leads CRM <ArrowUpRight size={14} aria-hidden="true" />
            </Button>
          </div>
        </Card>
      )}

      {/* Error state if failed */}
      {errorMsg && (
        <Card style={{ borderColor: 'var(--danger-border)', background: 'var(--danger-bg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--danger-text)' }}>
            <AlertTriangle size={20} aria-hidden="true" />
            <div>
              <strong>Scrape Error:</strong> {errorMsg}
            </div>
          </div>
        </Card>
      )}

      {/* Save Preset Modal */}
      <Modal
        isOpen={showPresetModal}
        onClose={() => setShowPresetModal(false)}
        title="Save Search Preset"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPresetModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSavePreset}>
              Save Preset
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            Save this query configuration to reuse for recurring automated schedules or 1-click runs:
          </p>

          <Field label="Preset Name" required id="preset-name">
            <input
              id="preset-name"
              className="input"
              placeholder="e.g. Dubai Luxury Rug Importers"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
            />
          </Field>

          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
            <div>• Target: {city}, {country}</div>
            <div>• Category: {leadType.replace(/_/g, ' ')}</div>
            <div>• Engine: {platform}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
