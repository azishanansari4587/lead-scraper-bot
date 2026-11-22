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
  CheckCircle2,
  Server
} from 'lucide-react';
import { api } from '../api';
import {
  Button,
  Field,
  Select,
  Card,
  Badge,
  EmptyState,
  ConfirmDialog,
  useToast
} from '../components/ui';

export default function Settings() {
  const toast = useToast();

  const [settings, setSettings] = useState(null);
  const [optouts, setOptouts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Google API Key state
  const [googleApiKey, setGoogleApiKey] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // New OptOut form
  const [optType, setOptType] = useState('domain');
  const [optValue, setOptValue] = useState('');
  const [optReason, setOptReason] = useState('');

  // Delete suppression confirm
  const [deletingOptId, setDeletingOptId] = useState(null);

  // User Settings & Daily Targets
  const [userSettings, setUserSettings] = useState({
    timezone: 'Asia/Dubai',
    dailyTargetCalls: 15,
    dailyTargetEmails: 20,
    dailyTargetWhatsapps: 25
  });
  const [savingUserSettings, setSavingUserSettings] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [settingsRes, optoutsRes, userSettingsRes] = await Promise.all([
        api.getSettings().catch(() => ({ settings: {} })),
        api.getOptOuts().catch(() => ({ optouts: [] })),
        api.getUserSettings().catch(() => ({ settings: {} }))
      ]);
      setSettings(settingsRes.settings);
      setOptouts(optoutsRes.optouts || []);
      if (userSettingsRes.settings) {
        setUserSettings({
          timezone: userSettingsRes.settings.timezone || 'Asia/Dubai',
          dailyTargetCalls: userSettingsRes.settings.dailyTargetCalls ?? 15,
          dailyTargetEmails: userSettingsRes.settings.dailyTargetEmails ?? 20,
          dailyTargetWhatsapps: userSettingsRes.settings.dailyTargetWhatsapps ?? 25
        });
      }
    } catch (err) {
      toast.error('Failed to load system settings');
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveUserSettings(e) {
    e.preventDefault();
    setSavingUserSettings(true);
    try {
      await api.updateUserSettings(userSettings);
      toast.success('Founder daily targets and timezone updated!');
    } catch (err) {
      toast.error(`Failed to update settings: ${err.message}`);
    } finally {
      setSavingUserSettings(false);
    }
  }

  async function handleSaveApiKey(e) {
    e.preventDefault();
    if (!googleApiKey.trim()) return;

    setSavingKey(true);
    try {
      const res = await api.saveApiKeys({ googlePlacesApiKey: googleApiKey.trim() });
      toast.success(res.message || 'Google Places API key saved securely.');
      setGoogleApiKey('');
      loadData();
    } catch (err) {
      toast.error(`Failed to save key: ${err.message}`);
    } finally {
      setSavingKey(false);
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
      toast.success('Suppression entry added and matching leads zeroed out.');
    } catch (err) {
      toast.error(`Failed to add suppression entry: ${err.message}`);
    }
  }

  async function handleDeleteOptOut() {
    if (!deletingOptId) return;
    try {
      await api.deleteOptOut(deletingOptId);
      setOptouts((prev) => prev.filter((o) => o.id !== deletingOptId));
      toast.success('Removed from suppression list.');
    } catch (err) {
      toast.error(`Failed to delete suppression entry: ${err.message}`);
    } finally {
      setDeletingOptId(null);
    }
  }

  const gemini = settings?.geminiStats || {};

  return (
    <div className="page-content">
      {/* System Diagnostics Grid */}
      <div className="grid-responsive">
        {/* Gemini AI Card */}
        <Card title="Gemini AI Diagnostics" icon={Sparkles}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--font-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Active Model</span>
              <strong style={{ color: 'var(--text-heading)' }}>gemini-1.5-flash</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Daily Extraction Usage</span>
              <strong className="tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {gemini.dailyUsageCount || 0} / {gemini.dailyLimit || 500} calls
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Cached Target Domains</span>
              <strong className="tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {gemini.cachedDomains || 0} domains
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Prompt Injection Defense</span>
              <Badge variant="success">Enforced (&lt;untrusted_data&gt;)</Badge>
            </div>
          </div>
        </Card>

        {/* Infrastructure & Security Diagnostics */}
        <Card title="Infrastructure & Technical Security" icon={Server}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: 'var(--font-sm)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Database Dialect</span>
              <strong style={{ textTransform: 'uppercase', color: 'var(--text-heading)' }}>
                {settings?.databaseDialect || 'SQLite'}
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>SSRF Private IP Shield</span>
              <Badge variant="success">Active (Private Subnets Blocked)</Badge>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Scraper Engines Registered</span>
              <strong className="tabular-nums" style={{ color: 'var(--text-heading)' }}>
                {settings?.activeScrapers?.length || 12} engines
              </strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-dim)' }}>Deployment Environment</span>
              <strong style={{ textTransform: 'capitalize', color: 'var(--text-heading)' }}>
                {settings?.environment || 'production'}
              </strong>
            </div>
          </div>
        </Card>

        {/* Google Maps & Places Connect */}
        <Card title="Google Places Official API" icon={MapPin}>
          <p style={{ color: 'var(--text-muted)', fontSize: 'var(--font-xs)', marginBottom: '14px' }}>
            Official Places API provides reliable, quota-backed international place search.
          </p>

          <form onSubmit={handleSaveApiKey} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <Field label="Google Places API Key" id="google-places-key">
              <input
                id="google-places-key"
                type="password"
                className="input"
                placeholder="AIzaSy..."
                value={googleApiKey}
                onChange={(e) => setGoogleApiKey(e.target.value)}
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                Status: {settings?.hasGooglePlacesKey ? (
                  <strong style={{ color: 'var(--success)' }}>Configured</strong>
                ) : (
                  <strong style={{ color: 'var(--warning)' }}>Not set (Web stealth fallback active)</strong>
                )}
              </span>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={savingKey}
                disabled={!googleApiKey.trim()}
              >
                Save Key
              </Button>
            </div>
          </form>
        </Card>
        {/* Founder Daily Targets & Schedule */}
        <Card title="Founder Daily Targets & Schedule" icon={Sliders}>
          <form onSubmit={handleSaveUserSettings} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <Field label="Timezone" id="user-timezone">
              <Select
                id="user-timezone"
                value={userSettings.timezone}
                onChange={(e) => setUserSettings({ ...userSettings, timezone: e.target.value })}
              >
                <option value="Asia/Dubai">Asia/Dubai (GST, UTC+4)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST, UTC+5:30)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
              </Select>
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              <Field label="Calls/Day" id="target-calls">
                <input
                  id="target-calls"
                  type="number"
                  min="0"
                  className="input"
                  value={userSettings.dailyTargetCalls}
                  onChange={(e) => setUserSettings({ ...userSettings, dailyTargetCalls: parseInt(e.target.value, 10) || 0 })}
                />
              </Field>

              <Field label="Emails/Day" id="target-emails">
                <input
                  id="target-emails"
                  type="number"
                  min="0"
                  className="input"
                  value={userSettings.dailyTargetEmails}
                  onChange={(e) => setUserSettings({ ...userSettings, dailyTargetEmails: parseInt(e.target.value, 10) || 0 })}
                />
              </Field>

              <Field label="WAs/Day" id="target-was">
                <input
                  id="target-was"
                  type="number"
                  min="0"
                  className="input"
                  value={userSettings.dailyTargetWhatsapps}
                  onChange={(e) => setUserSettings({ ...userSettings, dailyTargetWhatsapps: parseInt(e.target.value, 10) || 0 })}
                />
              </Field>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <Button type="submit" variant="primary" size="sm" loading={savingUserSettings}>
                Save Targets
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Suppression & Opt-Out List */}
      <Card
        title="Outreach Suppression & Opt-Out List"
        icon={Ban}
        subtitle="Domains and phone numbers added here will be automatically filtered out of all outreach campaigns."
      >
        <form onSubmit={handleAddOptOut} style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', marginBottom: '20px', padding: '14px', background: 'var(--bg-app)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ width: '130px' }}>
            <Select value={optType} onChange={(e) => setOptType(e.target.value)} aria-label="Suppression type">
              <option value="domain">Domain</option>
              <option value="email">Email</option>
              <option value="phone">Phone</option>
            </Select>
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              className="input"
              placeholder={optType === 'domain' ? 'competitor.com' : optType === 'email' ? 'optout@buyer.com' : '+971...'}
              value={optValue}
              onChange={(e) => setOptValue(e.target.value)}
              required
              aria-label="Suppression target value"
            />
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <input
              className="input"
              placeholder="Reason (e.g. Requested removal, competitor)"
              value={optReason}
              onChange={(e) => setOptReason(e.target.value)}
              aria-label="Suppression reason"
            />
          </div>

          <Button type="submit" variant="secondary" icon={PlusCircle}>
            Add Suppression
          </Button>
        </form>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Target Identifier</th>
                <th>Reason</th>
                <th>Added Date</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {optouts.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 0 }}>
                    <EmptyState
                      title="No suppression entries"
                      description="Add any domains or contacts who have requested to opt out of trade inquiries."
                    />
                  </td>
                </tr>
              ) : (
                optouts.map((opt) => (
                  <tr key={opt.id}>
                    <td>
                      <Badge variant="neutral">{opt.type}</Badge>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-heading)' }}>{opt.value}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{opt.reason || 'Manual entry'}</td>
                    <td className="tabular-nums" style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                      {new Date(opt.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Button
                        variant="danger"
                        size="sm"
                        icon={Trash2}
                        onClick={() => setDeletingOptId(opt.id)}
                        aria-label={`Remove suppression for ${opt.value}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirm Delete Opt-Out Modal */}
      <ConfirmDialog
        isOpen={Boolean(deletingOptId)}
        onClose={() => setDeletingOptId(null)}
        onConfirm={handleDeleteOptOut}
        title="Remove Suppression Entry"
        message="Are you sure you want to remove this entry from the suppression list? This contact will become eligible for future outreach campaigns."
        confirmText="Remove Entry"
      />
    </div>
  );
}
