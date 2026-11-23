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
  Server,
  ArrowUp,
  ArrowDown,
  Volume2,
  Mic,
  Lock
} from 'lucide-react';
import { api } from '../api';
import MindsetGateScreen from '../components/MindsetGateScreen';
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

  // User Settings & Daily Targets & Reminders
  const [userSettings, setUserSettings] = useState({
    timezone: 'Asia/Dubai',
    dailyTargetCalls: 15,
    dailyTargetEmails: 20,
    dailyTargetWhatsapps: 25,
    morningBriefTime: '08:30',
    eveningNudgeTime: '18:30',
    eventReminderMinutes: 15,
    remindersEnabled: true
  });
  const [savingUserSettings, setSavingUserSettings] = useState(false);

  // Mindset Gate & Founder Mantras state
  const [gateStatus, setGateStatus] = useState(null);
  const [gateQuotes, setGateQuotes] = useState([
    { text: '', author: '', language: 'en-IN' },
    { text: '', author: '', language: 'en-IN' },
    { text: '', author: '', language: 'en-IN' },
    { text: '', author: '', language: 'en-IN' },
    { text: '', author: '', language: 'en-IN' }
  ]);
  const [gateConfig, setGateConfig] = useState({
    gateMode: 'every_session',
    gateLanguage: 'en-IN',
    gateMatchThreshold: 0.8,
    gateResetHour: 0,
    gateFallbackAfterAttempts: 3,
    gateStrictnessEffectiveNextDay: true
  });
  const [savingGateConfig, setSavingGateConfig] = useState(false);
  const [savingGateQuotes, setSavingGateQuotes] = useState(false);
  const [practiceGateOpen, setPracticeGateOpen] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [settingsRes, optoutsRes, userSettingsRes, gateStatusRes, gateQuotesRes] = await Promise.all([
        api.getSettings().catch(() => ({ settings: {} })),
        api.getOptOuts().catch(() => ({ optouts: [] })),
        api.getUserSettings().catch(() => ({ settings: {} })),
        api.getGateStatus().catch(() => null),
        api.getGateQuotes().catch(() => ({ quotes: [] }))
      ]);
      setSettings(settingsRes.settings);
      setOptouts(optoutsRes.optouts || []);
      if (gateStatusRes) {
        setGateStatus(gateStatusRes);
        setGateConfig({
          gateMode: gateStatusRes.mode || 'every_session',
          gateLanguage: gateStatusRes.gateLanguage || 'en-IN',
          gateMatchThreshold: gateStatusRes.threshold ?? 0.8,
          gateResetHour: gateStatusRes.resetHour ?? 0,
          gateFallbackAfterAttempts: gateStatusRes.fallbackAfterAttempts ?? 3,
          gateStrictnessEffectiveNextDay: gateStatusRes.strictnessEffectiveNextDay ?? true
        });
      }
      const quotesList = gateQuotesRes?.quotes || [];
      const normalizedQuotes = [0, 1, 2, 3, 4].map((i) => ({
        text: quotesList[i]?.text || '',
        author: quotesList[i]?.author || '',
        language: quotesList[i]?.language || gateStatusRes?.gateLanguage || 'en-IN'
      }));
      setGateQuotes(normalizedQuotes);
      if (userSettingsRes.settings) {
        setUserSettings({
          timezone: userSettingsRes.settings.timezone || 'Asia/Dubai',
          dailyTargetCalls: userSettingsRes.settings.dailyCallTarget ?? userSettingsRes.settings.dailyTargetCalls ?? 15,
          dailyTargetEmails: userSettingsRes.settings.dailyEmailTarget ?? userSettingsRes.settings.dailyTargetEmails ?? 20,
          dailyTargetWhatsapps: userSettingsRes.settings.dailyWhatsappTarget ?? userSettingsRes.settings.dailyTargetWhatsapps ?? 25,
          morningBriefTime: userSettingsRes.settings.morningBriefTime || '08:30',
          eveningNudgeTime: userSettingsRes.settings.eveningNudgeTime || '18:30',
          eventReminderMinutes: userSettingsRes.settings.eventReminderMinutes ?? 15,
          remindersEnabled: userSettingsRes.settings.remindersEnabled ?? true
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
      await api.updateUserSettings({
        timezone: userSettings.timezone,
        dailyCallTarget: userSettings.dailyTargetCalls,
        dailyEmailTarget: userSettings.dailyTargetEmails,
        dailyWhatsappTarget: userSettings.dailyTargetWhatsapps,
        dailyTargetCalls: userSettings.dailyTargetCalls,
        dailyTargetEmails: userSettings.dailyTargetEmails,
        dailyTargetWhatsapps: userSettings.dailyTargetWhatsapps,
        morningBriefTime: userSettings.morningBriefTime,
        eveningNudgeTime: userSettings.eveningNudgeTime,
        eventReminderMinutes: userSettings.eventReminderMinutes,
        remindersEnabled: userSettings.remindersEnabled
      });
      toast.success('Founder targets and automated reminder preferences updated!');
    } catch (err) {
      toast.error(`Failed to update settings: ${err.message}`);
    } finally {
      setSavingUserSettings(false);
    }
  }

  async function handleSaveGateConfig(e) {
    e.preventDefault();
    setSavingGateConfig(true);
    try {
      const res = await api.updateGateSettings(gateConfig);
      toast.success(
        res.settings?.pendingGateMode
          ? `Settings updated! Relaxation to ${res.settings.pendingGateMode} scheduled for tomorrow (${res.settings.pendingEffectiveDate}).`
          : 'Mindset Gate configuration updated!'
      );
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update gate settings');
    } finally {
      setSavingGateConfig(false);
    }
  }

  async function handleSaveGateQuotes(e) {
    e.preventDefault();
    for (let i = 0; i < 5; i++) {
      if (!gateQuotes[i]?.text?.trim()) {
        toast.error(`Mantra #${i + 1} cannot be empty. All 5 are required.`);
        return;
      }
    }
    setSavingGateQuotes(true);
    try {
      await api.replaceGateQuotes(
        gateQuotes.slice(0, 5).map((q, idx) => ({
          text: q.text.trim(),
          author: q.author ? q.author.trim() : null,
          language: q.language || gateConfig.gateLanguage || 'en-IN',
          sortOrder: idx,
          isActive: true
        }))
      );
      toast.success('All 5 founder mantras saved successfully!');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to save mantras');
    } finally {
      setSavingGateQuotes(false);
    }
  }

  function moveQuote(index, direction) {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= gateQuotes.length) return;
    const nextQuotes = [...gateQuotes];
    const temp = nextQuotes[index];
    nextQuotes[index] = nextQuotes[targetIdx];
    nextQuotes[targetIdx] = temp;
    setGateQuotes(nextQuotes);
  }

  function updateQuoteField(index, field, value) {
    const nextQuotes = [...gateQuotes];
    nextQuotes[index] = { ...nextQuotes[index], [field]: value };
    setGateQuotes(nextQuotes);
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

            <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '10px', marginTop: '6px' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--gold-primary)', marginBottom: '8px', textTransform: 'uppercase' }}>
                Automated Founder Reminders (Telegram & Email)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <Field label="Morning Brief" id="morning-brief-time">
                  <input
                    id="morning-brief-time"
                    type="time"
                    className="input"
                    value={userSettings.morningBriefTime}
                    onChange={(e) => setUserSettings({ ...userSettings, morningBriefTime: e.target.value })}
                  />
                </Field>

                <Field label="Evening Nudge" id="evening-nudge-time">
                  <input
                    id="evening-nudge-time"
                    type="time"
                    className="input"
                    value={userSettings.eveningNudgeTime}
                    onChange={(e) => setUserSettings({ ...userSettings, eveningNudgeTime: e.target.value })}
                  />
                </Field>

                <Field label="Event Alert (min)" id="event-lead-mins">
                  <input
                    id="event-lead-mins"
                    type="number"
                    min="1"
                    max="120"
                    className="input"
                    value={userSettings.eventReminderMinutes}
                    onChange={(e) => setUserSettings({ ...userSettings, eventReminderMinutes: parseInt(e.target.value, 10) || 15 })}
                  />
                </Field>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                <input
                  type="checkbox"
                  id="reminders-enabled"
                  checked={userSettings.remindersEnabled}
                  onChange={(e) => setUserSettings({ ...userSettings, remindersEnabled: e.target.checked })}
                  style={{ accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
                />
                <label htmlFor="reminders-enabled" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Enable automated founder reminder dispatches
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
              <Button type="submit" variant="primary" size="sm" loading={savingUserSettings}>
                Save Settings & Reminders
              </Button>
            </div>
          </form>
        </Card>
      </div>

      {/* Mindset Gate & 5 Founder Mantras */}
      <Card
        title="Mindset Gate & 5 Founder Mantras"
        icon={Sparkles}
        subtitle="Mandatory daily principle recitation that locks your workspace until you speak your core mantras out loud."
      >
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 440px), 1fr))',
          gap: '28px',
          alignItems: 'start',
          marginBottom: '20px'
        }}>
          {/* Gate Policy & Configuration */}
          <div style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
              <div>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Gate Lock Policy & Enforcement
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Configure lockout frequency, reset cycle, and speech matching threshold.
                </div>
              </div>
              <Badge variant={gateConfig.gateMode === 'off' ? 'neutral' : gateConfig.gateMode === 'every_session' ? 'warning' : 'primary'}>
                {gateConfig.gateMode === 'off' ? 'Disabled' : gateConfig.gateMode === 'every_session' ? 'Strict Lock' : 'Daily Lock'}
              </Badge>
            </div>

            <form onSubmit={handleSaveGateConfig} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {gateStatus?.pendingGateMode && (
                <div style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.12)', border: '1px solid rgba(245, 158, 11, 0.35)', color: '#F59E0B', fontSize: 'var(--font-xs)', lineHeight: '1.45' }}>
                  <strong>Pending Relaxation:</strong> Gate mode change to <code>{gateStatus.pendingGateMode}</code> will take effect on <strong>{gateStatus.pendingEffectiveDate}</strong> to ensure today's discipline is maintained.
                </div>
              )}

              <Field label="Gate Frequency & Enforcement Mode" id="gate-mode" hint="Choose when the full-screen speech gate appears">
                <Select
                  id="gate-mode"
                  value={gateConfig.gateMode}
                  onChange={(e) => setGateConfig({ ...gateConfig, gateMode: e.target.value })}
                >
                  <option value="every_session">Every Session (Strict: recite on every new browser session)</option>
                  <option value="once_daily">Once Daily (Recite once per effective local day)</option>
                  <option value="off">Off (Disabled: direct dashboard access)</option>
                </Select>
              </Field>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px' }}>
                <Field label="Default Voice Language" id="gate-language">
                  <Select
                    id="gate-language"
                    value={gateConfig.gateLanguage}
                    onChange={(e) => setGateConfig({ ...gateConfig, gateLanguage: e.target.value })}
                  >
                    <option value="en-IN">English (India) — en-IN</option>
                    <option value="en-US">English (US) — en-US</option>
                    <option value="en-GB">English (UK) — en-GB</option>
                    <option value="hi-IN">Hindi (India) — hi-IN</option>
                  </Select>
                </Field>

                <Field label="Matching Strictness" id="gate-threshold">
                  <Select
                    id="gate-threshold"
                    value={gateConfig.gateMatchThreshold}
                    onChange={(e) => setGateConfig({ ...gateConfig, gateMatchThreshold: parseFloat(e.target.value) })}
                  >
                    <option value="0.7">Forgiving (70% coverage)</option>
                    <option value="0.8">Standard (80% coverage + final word)</option>
                    <option value="0.9">Strict (90% coverage + final word)</option>
                  </Select>
                </Field>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '14px' }}>
                <Field label="Daily Reset Hour" id="gate-reset-hour">
                  <Select
                    id="gate-reset-hour"
                    value={gateConfig.gateResetHour}
                    onChange={(e) => setGateConfig({ ...gateConfig, gateResetHour: parseInt(e.target.value, 10) })}
                  >
                    <option value="0">Midnight (00:00 GST)</option>
                    <option value="3">03:00 AM</option>
                    <option value="4">04:00 AM (Early Founder)</option>
                    <option value="5">05:00 AM (Dawn Routine)</option>
                  </Select>
                </Field>

                <Field label="Typed Fallback Trigger" id="gate-fallback-attempts">
                  <Select
                    id="gate-fallback-attempts"
                    value={gateConfig.gateFallbackAfterAttempts}
                    onChange={(e) => setGateConfig({ ...gateConfig, gateFallbackAfterAttempts: parseInt(e.target.value, 10) })}
                  >
                    <option value="2">After 2 voice attempts</option>
                    <option value="3">After 3 voice attempts (Default)</option>
                    <option value="5">After 5 voice attempts</option>
                  </Select>
                </Field>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-surface-elevated)',
                border: '1px solid var(--border-subtle)'
              }}>
                <input
                  type="checkbox"
                  id="gate-strictness-next-day"
                  checked={gateConfig.gateStrictnessEffectiveNextDay}
                  onChange={(e) => setGateConfig({ ...gateConfig, gateStrictnessEffectiveNextDay: e.target.checked })}
                  style={{ accentColor: 'var(--gold-primary)', cursor: 'pointer', marginTop: '3px' }}
                />
                <label htmlFor="gate-strictness-next-day" style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', cursor: 'pointer', lineHeight: '1.4' }}>
                  <strong>Next-Day Relaxation Guard:</strong> Postpone relaxing settings (turning off the gate or lowering strictness) until the next calendar day to prevent midday friction bypasses.
                </label>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '6px' }}>
                <Button type="submit" variant="primary" size="md" loading={savingGateConfig}>
                  Save Gate Policy
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  icon={Mic}
                  onClick={() => setPracticeGateOpen(true)}
                >
                  Test the Gate (Practice)
                </Button>
              </div>
            </form>
          </div>

          {/* 5 Founder Mantras Manager */}
          <div style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            <form onSubmit={handleSaveGateQuotes} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <div>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Your 5 Personalized Mantras
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginTop: '2px' }}>
                    You must recite all 5 in order each morning to access the Command Center.
                  </div>
                </div>
                <Badge variant={gateQuotes.filter((q) => q.text?.trim()).length === 5 ? 'success' : 'warning'}>
                  {gateQuotes.filter((q) => q.text?.trim()).length} / 5 Active
                </Badge>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {gateQuotes.slice(0, 5).map((q, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '14px 16px',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--gold-primary)',
                          background: 'rgba(245, 158, 11, 0.12)',
                          border: '1px solid rgba(245, 158, 11, 0.25)',
                          padding: '2px 8px',
                          borderRadius: '4px'
                        }}>
                          Mantra #{idx + 1}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-dim)', fontVariantNumeric: 'tabular-nums' }}>
                          {(q.text || '').length}/300 chars
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <select
                          value={q.language || gateConfig.gateLanguage || 'en-IN'}
                          onChange={(e) => updateQuoteField(idx, 'language', e.target.value)}
                          style={{
                            fontSize: '11px',
                            padding: '3px 8px',
                            background: 'var(--bg-app)',
                            color: 'var(--text-main)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px'
                          }}
                          aria-label={`Mantra #${idx + 1} language`}
                        >
                          <option value="en-IN">English (India)</option>
                          <option value="en-US">English (US)</option>
                          <option value="en-GB">English (UK)</option>
                          <option value="hi-IN">Hindi (India)</option>
                        </select>

                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => moveQuote(idx, -1)}
                          style={{
                            background: 'var(--bg-app)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            color: idx === 0 ? 'var(--text-dim)' : 'var(--text-main)',
                            cursor: idx === 0 ? 'default' : 'pointer',
                            padding: '4px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: idx === 0 ? 0.4 : 1
                          }}
                          title="Move Mantra Up"
                        >
                          <ArrowUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === 4}
                          onClick={() => moveQuote(idx, 1)}
                          style={{
                            background: 'var(--bg-app)',
                            border: '1px solid var(--border-subtle)',
                            borderRadius: '4px',
                            color: idx === 4 ? 'var(--text-dim)' : 'var(--text-main)',
                            cursor: idx === 4 ? 'default' : 'pointer',
                            padding: '4px 6px',
                            display: 'flex',
                            alignItems: 'center',
                            opacity: idx === 4 ? 0.4 : 1
                          }}
                          title="Move Mantra Down"
                        >
                          <ArrowDown size={13} />
                        </button>
                      </div>
                    </div>

                    <textarea
                      className="input"
                      placeholder={`Enter core founder mantra #${idx + 1} (e.g. Every knot tied in Bhadohi represents generations of heritage)...`}
                      value={q.text || ''}
                      maxLength={300}
                      required
                      rows={2}
                      onChange={(e) => updateQuoteField(idx, 'text', e.target.value)}
                      style={{
                        fontSize: '13px',
                        lineHeight: '1.45',
                        padding: '10px 12px',
                        resize: 'vertical',
                        minHeight: '56px',
                        fontFamily: 'inherit'
                      }}
                    />

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        className="input"
                        placeholder="Author or category (e.g. Founder Ritual, Commercial Discipline, Brand Positioning)"
                        value={q.author || ''}
                        onChange={(e) => updateQuoteField(idx, 'author', e.target.value)}
                        style={{ fontSize: '11px', padding: '6px 10px', color: 'var(--text-muted)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                <Button type="submit" variant="primary" size="md" loading={savingGateQuotes}>
                  Save All 5 Mantras
                </Button>
              </div>
            </form>
          </div>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: 'var(--font-xs)',
          color: 'var(--text-dim)',
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '14px',
          lineHeight: '1.5'
        }}>
          <Shield size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />
          <span>
            <strong>100% Privacy & Audio Safety:</strong> Knotiq never records, uploads, or stores your voice. Web Speech API audio processing runs directly and privately inside your browser runtime.
          </span>
        </div>
      </Card>

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

      {/* Practice Gate Modal */}
      {practiceGateOpen && (
        <MindsetGateScreen
          initialStatus={{
            required: true,
            setupRequired: gateQuotes.filter((q) => q.text?.trim()).length < 5,
            quotes: gateQuotes,
            threshold: gateConfig.gateMatchThreshold,
            gateLanguage: gateConfig.gateLanguage,
            fallbackAfterAttempts: gateConfig.gateFallbackAfterAttempts
          }}
          userId={gateStatus?.userId}
          onUnlock={() => {
            setPracticeGateOpen(false);
            toast.success('Practice recital completed!');
          }}
        />
      )}
    </div>
  );
}
