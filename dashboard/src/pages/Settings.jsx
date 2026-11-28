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
  Lock,
  Clock,
  Send,
  UserCheck,
  AlertTriangle,
  Zap,
  Award,
  Moon,
  Copy,
  Check,
  Wallet
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

  // CEO Routine & Escalation Policy state
  const [routinePolicy, setRoutinePolicy] = useState({
    enabled: true,
    escalationEnabled: true,
    focusLockEnabled: true,
    l1NudgeMinutes: 0,
    l2TelegramMinutes: 15,
    l3EmailMinutes: 30,
    l4FocusLockMinutes: 60,
    quietHoursStart: '22:00',
    quietHoursEnd: '07:00',
    maxNudgesPerHour: 2,
    maxSnoozesPerDay: 2,
    minDailyRestHours: 7,
    weeklyRestDay: null,
    supportedStakes: ['restrict_non_essential_pages', 'pledge_reminder'],
    pledgeText: 'Every knot tied in Bhadohi depends on commercial discipline in Dubai.'
  });
  const [savingRoutinePolicy, setSavingRoutinePolicy] = useState(false);
  const [partnerUsername, setPartnerUsername] = useState('');
  const [partnerInviteUrl, setPartnerInviteUrl] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);

  // Work Wallet Policy state
  const [walletPolicy, setWalletPolicy] = useState({
    enabled: true,
    earnRatePaisePerMin: 100,
    penaltyRatePaisePerMin: 100,
    overtimeMode: 'none',
    overtimeCapMinutes: 0,
    dailyBreakAllowanceMinutes: 90,
    monthlyLeaveAllowanceDays: 2,
    allowNegative: true,
    floorEnabled: false,
    walletFloorPaise: 0,
    idleCheckEnabled: true,
    idleTimeoutMinutes: 10,
    maxDailyManualMinutes: 60,
    minDailyPersonalMinutes: 120
  });
  const [walletSettlement, setWalletSettlement] = useState(null);
  const [savingWalletPolicy, setSavingWalletPolicy] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [settingsRes, optoutsRes, userSettingsRes, gateStatusRes, gateQuotesRes, routinePolicyRes, walletPolicyRes, walletStateRes] = await Promise.all([
        api.getSettings().catch(() => ({ settings: {} })),
        api.getOptOuts().catch(() => ({ optouts: [] })),
        api.getUserSettings().catch(() => ({ settings: {} })),
        api.getGateStatus().catch(() => null),
        api.getGateQuotes().catch(() => ({ quotes: [] })),
        api.getRoutinePolicy().catch(() => null),
        api.getWalletPolicy().catch(() => null),
        api.getWalletState().catch(() => null)
      ]);
      setSettings(settingsRes.settings);
      setOptouts(optoutsRes.optouts || []);
      if (walletStateRes?.settlement) {
        setWalletSettlement(walletStateRes.settlement);
      }
      if (routinePolicyRes?.policy) {
        const pol = routinePolicyRes.policy;
        setRoutinePolicy({
          ...pol,
          supportedStakes: pol.supportedStakes
            ? (typeof pol.supportedStakes === 'string' ? JSON.parse(pol.supportedStakes) : pol.supportedStakes)
            : ['restrict_non_essential_pages', 'pledge_reminder'],
          weeklyRestDay: pol.weeklyRestDay
        });
      }
      if (walletPolicyRes?.policy) {
        setWalletPolicy(walletPolicyRes.policy);
      }
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

  async function handleSaveRoutinePolicy(e) {
    e.preventDefault();
    try {
      setSavingRoutinePolicy(true);
      const res = await api.updateRoutinePolicy(routinePolicy);
      if (res.hasPendingChanges) {
        toast.info(res.message || 'Immediate updates applied. Loosened rules take effect next local day.');
      } else {
        toast.success('Routine enforcement policy updated successfully.');
      }
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update routine policy');
    } finally {
      setSavingRoutinePolicy(false);
    }
  }

  async function handleSaveWalletPolicy(e) {
    if (e) e.preventDefault();
    try {
      setSavingWalletPolicy(true);
      const res = await api.updateWalletPolicy(walletPolicy);
      if (res.policy) setWalletPolicy(res.policy);
      toast.success('Work Wallet policy and rates updated successfully.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to update wallet policy');
    } finally {
      setSavingWalletPolicy(false);
    }
  }

  const formatDualTime = (hhmm) => {
    if (!hhmm || !hhmm.includes(':')) return { uae: hhmm, ist: hhmm };
    const [h, m] = hhmm.split(':').map(Number);
    let istH = h + 1;
    let istM = m + 30;
    if (istM >= 60) {
      istH += 1;
      istM -= 60;
    }
    if (istH >= 24) istH -= 24;
    const pad = (n) => String(n).padStart(2, '0');
    return {
      uae: `${pad(h)}:${pad(m)} GST`,
      ist: `${pad(istH)}:${pad(istM)} IST`
    };
  };

  async function handleGeneratePartnerInvite() {
    try {
      setGeneratingInvite(true);
      const res = await api.createPartnerInvite(partnerUsername.trim() || undefined);
      setPartnerInviteUrl(res.deepLink);
      toast.success('Generated partner invite deep link! Copy and send to your accountability partner.');
    } catch (err) {
      toast.error(err.message || 'Failed to generate invite');
    } finally {
      setGeneratingInvite(false);
    }
  }

  async function handleStopPartner() {
    if (!window.confirm('Disconnect your accountability partner? They will no longer receive routine nudges.')) return;
    try {
      await api.stopPartnerSharing();
      toast.success('Accountability partner revoked.');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to revoke partner');
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

      {/* CEO Routine & Escalation Ladder */}
      <Card
        title="CEO Routine & Escalation Ladder"
        icon={Clock}
        subtitle="Self-configured accountability for daily must-dos: quiet hours suppression, escalation stages, and Telegram accountability partner."
      >
        <form onSubmit={handleSaveRoutinePolicy} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {/* Pending Delayed Loosening Notice if present */}
          {routinePolicy?.pendingEffectiveDate && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <AlertTriangle size={20} color="var(--gold-primary)" style={{ flexShrink: 0 }} />
              <div style={{ fontSize: '13px', color: 'var(--gold-primary)', lineHeight: '1.4' }}>
                <strong>Pending Policy Loosening:</strong> Relaxed enforcement rules take effect on <strong>{routinePolicy.pendingEffectiveDate}</strong> (start of next local day) to safeguard active daily discipline.
              </div>
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))',
              gap: '24px',
              alignItems: 'start'
            }}
          >
            {/* Left Column: Quiet Hours, Rest Day & Escalation Steps */}
            <div
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Moon size={16} /> Health Guardrails & Quiet Hours
                </div>
                <Badge variant="secondary">Immune From Nudges</Badge>
              </div>

              {/* Quiet Hours Start & End */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Field label="Quiet Hours Start (HH:MM)" id="quiet-start">
                  <div className="luxury-time-input-wrap">
                    <span className="input-icon">
                      <Moon size={15} color="var(--gold-primary)" />
                    </span>
                    <input
                      type="text"
                      value={routinePolicy.quietHoursStart || '22:00'}
                      onChange={(e) => setRoutinePolicy({ ...routinePolicy, quietHoursStart: e.target.value })}
                      pattern="^\d{2}:\d{2}$"
                      required
                      placeholder="22:00"
                    />
                  </div>
                  {/* Quick Start Presets */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['21:00', '22:00', '23:00', '00:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRoutinePolicy({ ...routinePolicy, quietHoursStart: t })}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: routinePolicy.quietHoursStart === t ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface)',
                          border: routinePolicy.quietHoursStart === t ? '1px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                          color: routinePolicy.quietHoursStart === t ? 'var(--gold-primary)' : 'var(--text-dim)',
                          cursor: 'pointer'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Quiet Hours End (HH:MM)" id="quiet-end">
                  <div className="luxury-time-input-wrap">
                    <span className="input-icon">
                      <Clock size={15} color="#38BDF8" />
                    </span>
                    <input
                      type="text"
                      value={routinePolicy.quietHoursEnd || '07:00'}
                      onChange={(e) => setRoutinePolicy({ ...routinePolicy, quietHoursEnd: e.target.value })}
                      pattern="^\d{2}:\d{2}$"
                      required
                      placeholder="07:00"
                    />
                  </div>
                  {/* Quick End Presets */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['05:00', '06:00', '07:00', '08:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setRoutinePolicy({ ...routinePolicy, quietHoursEnd: t })}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: routinePolicy.quietHoursEnd === t ? 'rgba(56, 189, 248, 0.2)' : 'var(--bg-surface)',
                          border: routinePolicy.quietHoursEnd === t ? '1px solid #38BDF8' : '1px solid var(--border-subtle)',
                          color: routinePolicy.quietHoursEnd === t ? '#38BDF8' : 'var(--text-dim)',
                          cursor: 'pointer'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Dual-Time Banner for Quiet Hours */}
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Moon size={14} color="var(--gold-primary)" />
                  <span style={{ color: 'var(--text-secondary)' }}>Quiet Window:</span>
                </div>
                <div style={{ display: 'flex', gap: '12px', fontWeight: 700 }}>
                  <span style={{ color: 'var(--gold-primary)' }}>🇦🇪 {routinePolicy.quietHoursStart || '22:00'} - {routinePolicy.quietHoursEnd || '07:00'} GST</span>
                  <span style={{ color: '#38BDF8' }}>🇮🇳 {formatDualTime(routinePolicy.quietHoursStart || '22:00').ist.replace(' IST', '')} - {formatDualTime(routinePolicy.quietHoursEnd || '07:00').ist.replace(' IST', '')} IST</span>
                </div>
              </div>

              {/* Weekly Rest Day Interactive Pills */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Weekly Rest Day (Rest days are excluded from Routine Score penalties)
                </label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[
                    { label: 'None', val: null },
                    { label: 'Sun', val: 0 },
                    { label: 'Mon', val: 1 },
                    { label: 'Tue', val: 2 },
                    { label: 'Wed', val: 3 },
                    { label: 'Thu', val: 4 },
                    { label: 'Fri', val: 5 },
                    { label: 'Sat', val: 6 }
                  ].map((item) => {
                    const isSelected = routinePolicy.weeklyRestDay === item.val;
                    return (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => setRoutinePolicy({ ...routinePolicy, weeklyRestDay: item.val })}
                        style={{
                          flex: item.label === 'None' ? '1 1 100%' : '1 1 auto',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: isSelected ? '1px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                          background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface)',
                          color: isSelected ? 'var(--gold-primary)' : 'var(--text-main)',
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Min Daily Rest Hours */}
              <Field label="Minimum Daily Rest Hours" id="min-rest-hours">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="number"
                    min="4"
                    max="12"
                    className="input"
                    value={routinePolicy.minDailyRestHours || 7}
                    onChange={(e) => setRoutinePolicy({ ...routinePolicy, minDailyRestHours: Number(e.target.value) })}
                    required
                    style={{ width: '90px', fontSize: '14px', fontWeight: 700 }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Hours required for sleep & personal recovery before triggering overload warnings.
                  </span>
                </div>
              </Field>

              {/* Escalation Steps Header & Ladder */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginTop: '10px' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Zap size={16} /> Escalation Ladder Timing
                </div>
                <Badge variant="gold">L1 &rarr; L4 Pathway</Badge>
              </div>

              {/* Ladder Visual Step Badges */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px', textAlign: 'center' }}>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', fontWeight: 700 }}>L1 IN-APP</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 600, marginTop: '2px' }}>0m overdue</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 4px' }}>
                  <div style={{ fontSize: '10px', color: '#229ED9', fontWeight: 700 }}>L2 TELEGRAM</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 600, marginTop: '2px' }}>+{routinePolicy.l2TelegramMinutes || 15}m</div>
                </div>
                <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '8px 4px' }}>
                  <div style={{ fontSize: '10px', color: '#38BDF8', fontWeight: 700 }}>L3 EMAIL</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-main)', fontWeight: 600, marginTop: '2px' }}>+{routinePolicy.l3EmailMinutes || 30}m</div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', padding: '8px 4px' }}>
                  <div style={{ fontSize: '10px', color: 'var(--danger)', fontWeight: 700 }}>L4 LOCK</div>
                  <div style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600, marginTop: '2px' }}>+{routinePolicy.l4FocusLockMinutes || 60}m</div>
                </div>
              </div>

              {/* Timing Inputs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <Field label="L2 Telegram (Min)" id="l2-mins">
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={routinePolicy.l2TelegramMinutes || 15}
                    onChange={(e) => setRoutinePolicy({ ...routinePolicy, l2TelegramMinutes: Number(e.target.value) })}
                    style={{ fontSize: '13px' }}
                  />
                </Field>
                <Field label="L3 Email (Min)" id="l3-mins">
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={routinePolicy.l3EmailMinutes || 30}
                    onChange={(e) => setRoutinePolicy({ ...routinePolicy, l3EmailMinutes: Number(e.target.value) })}
                    style={{ fontSize: '13px' }}
                  />
                </Field>
                <Field label="L4 Lock (Min)" id="l4-mins">
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={routinePolicy.l4FocusLockMinutes || 60}
                    onChange={(e) => setRoutinePolicy({ ...routinePolicy, l4FocusLockMinutes: Number(e.target.value) })}
                    style={{ fontSize: '13px' }}
                  />
                </Field>
              </div>

              {/* Rate Limits */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <Field label="Max Nudges / Hour" id="max-nudges">
                  <input
                    type="number"
                    min="1"
                    max="10"
                    className="input"
                    value={routinePolicy.maxNudgesPerHour || 2}
                    onChange={(e) => setRoutinePolicy({ ...routinePolicy, maxNudgesPerHour: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Max Snoozes / Day" id="max-snoozes">
                  <input
                    type="number"
                    min="0"
                    max="10"
                    className="input"
                    value={routinePolicy.maxSnoozesPerDay || 2}
                    onChange={(e) => setRoutinePolicy({ ...routinePolicy, maxSnoozesPerDay: Number(e.target.value) })}
                  />
                </Field>
              </div>

              {/* Interactive Toggle Cards for Escalation & Focus Lock */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '4px' }}>
                <div
                  onClick={() => setRoutinePolicy({ ...routinePolicy, escalationEnabled: !routinePolicy.escalationEnabled })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: routinePolicy.escalationEnabled ? '1px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                    background: routinePolicy.escalationEnabled ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(routinePolicy.escalationEnabled)}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--gold-primary)', pointerEvents: 'none' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', color: routinePolicy.escalationEnabled ? 'var(--gold-primary)' : 'var(--text-main)' }}>
                      Enable Escalation Ladder (L1-L4 Nudges)
                    </strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      Sends multi-channel alerts when a high-priority Must-Do block is overdue.
                    </div>
                  </div>
                </div>

                <div
                  onClick={() => setRoutinePolicy({ ...routinePolicy, focusLockEnabled: !routinePolicy.focusLockEnabled })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: routinePolicy.focusLockEnabled ? '1px solid var(--danger)' : '1px solid var(--border-subtle)',
                    background: routinePolicy.focusLockEnabled ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-surface)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={Boolean(routinePolicy.focusLockEnabled)}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--danger)', pointerEvents: 'none' }}
                  />
                  <div>
                    <strong style={{ fontSize: '13px', color: routinePolicy.focusLockEnabled ? 'var(--danger)' : 'var(--text-main)' }}>
                      Enable L4 Focus Lock Screen
                    </strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                      Locks workspace tabs when an MIT task is critically neglected until started or completed.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Supported Stakes & Accountability Partner */}
            <div
              style={{
                background: 'var(--bg-app)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-lg)',
                padding: '22px',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '12px' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Award size={16} /> Supported Stakes & Consequences
                </div>
                <Badge variant="gold">Executive Rigor</Badge>
              </div>

              {/* Stake Toggle Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  {
                    id: 'restrict_non_essential_pages',
                    label: 'Restrict Non-Essential Pages',
                    desc: 'Restricts leads & scrapers until overdue MIT block is handled (Settings & Exports remain open)',
                    icon: Shield
                  },
                  {
                    id: 'pledge_reminder',
                    label: 'Display Founder Discipline Pledge',
                    desc: 'Forces display of your core founder mantra on the lock screen',
                    icon: Award
                  },
                  {
                    id: 'partner_alert',
                    label: 'Accountability Partner Alert',
                    desc: 'Sends Telegram alert to your designated partner if an L4 breach occurs',
                    icon: Send
                  }
                ].map((stake) => {
                  const isChecked = (routinePolicy.supportedStakes || []).includes(stake.id);
                  const IconComp = stake.icon;
                  return (
                    <div
                      key={stake.id}
                      onClick={() => {
                        const current = routinePolicy.supportedStakes || [];
                        if (isChecked) {
                          setRoutinePolicy({ ...routinePolicy, supportedStakes: current.filter((x) => x !== stake.id) });
                        } else {
                          setRoutinePolicy({ ...routinePolicy, supportedStakes: [...current, stake.id] });
                        }
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '12px',
                        padding: '12px 14px',
                        borderRadius: '8px',
                        border: isChecked ? '1px solid var(--gold-primary)' : '1px solid var(--border-subtle)',
                        background: isChecked ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-surface)',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: isChecked ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isChecked ? 'var(--gold-primary)' : 'var(--text-dim)', flexShrink: 0 }}>
                        <IconComp size={14} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '13px', color: isChecked ? 'var(--gold-primary)' : 'var(--text-main)' }}>
                            {stake.label}
                          </strong>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            style={{ accentColor: 'var(--gold-primary)', pointerEvents: 'none' }}
                          />
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', lineHeight: '1.3' }}>
                          {stake.desc}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Founder Discipline Pledge Input */}
              <Field label="Founder Discipline Pledge">
                <input
                  type="text"
                  className="input"
                  value={routinePolicy.pledgeText || ''}
                  onChange={(e) => setRoutinePolicy({ ...routinePolicy, pledgeText: e.target.value })}
                  placeholder="e.g. Every knot tied in Bhadohi depends on commercial discipline in Dubai."
                  style={{ fontSize: '13px', padding: '10px 12px' }}
                />
              </Field>

              {/* Accountability Partner Section */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px', marginTop: '10px' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Send size={16} color="#229ED9" /> Accountability Partner (Telegram Link)
                </div>
                <Badge variant="secondary">Telegram Deep Link</Badge>
              </div>

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                Invite a trusted peer, mentor, or executive co-founder. They receive an expiring, cryptographically random single-use link. <strong>Zero private notes or financial figures are ever shared.</strong>
              </p>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Partner Telegram username (optional)"
                  value={partnerUsername}
                  onChange={(e) => setPartnerUsername(e.target.value)}
                  style={{ flex: 1, fontSize: '13px' }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleGeneratePartnerInvite}
                  disabled={generatingInvite}
                  style={{ borderColor: '#229ED9', color: '#229ED9', whiteSpace: 'nowrap' }}
                >
                  <Send size={14} /> {generatingInvite ? 'Generating...' : 'Generate Telegram Link'}
                </Button>
              </div>

              {partnerInviteUrl && (
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid var(--emerald-accent)',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} color="var(--emerald-accent)" />
                    <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--emerald-accent)' }}>
                      Telegram Deep Link Ready:
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="text"
                      className="input"
                      value={partnerInviteUrl}
                      readOnly
                      style={{ fontSize: '11px', flex: 1, background: 'var(--surface-color)', color: 'var(--text-main)' }}
                    />
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(partnerInviteUrl);
                        toast.success('Invite link copied to clipboard!');
                      }}
                      style={{ background: 'var(--emerald-accent)', color: '#FFFFFF', fontWeight: 700 }}
                    >
                      <Copy size={13} /> Copy
                    </Button>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                    Share this link with your partner. When they press <strong>Start</strong> in Telegram, their chat is securely paired.
                  </div>
                </div>
              )}

              {routinePolicy.partnerChatId && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 'var(--radius-md)' }}>
                  <span style={{ fontSize: '12px', color: 'var(--emerald-accent)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <UserCheck size={16} /> Partner Active (Telegram Chat ID: {routinePolicy.partnerChatId})
                  </span>
                  <Button type="button" variant="ghost" size="xs" onClick={handleStopPartner} style={{ color: 'var(--danger)' }}>
                    Revoke Partner
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <Button type="submit" variant="primary" size="md" loading={savingRoutinePolicy} style={{ padding: '10px 24px', fontWeight: 700 }}>
              Save Routine Policy & Guardrails
            </Button>
          </div>
        </form>
      </Card>

      {/* Work Wallet Engine Card */}
      <Card
        title="Work Wallet Engine & Virtual Currency"
        icon={Wallet}
        subtitle="Self-motivation virtual currency rewarding real work and penalizing scheduled gaps. Zero real financial value."
      >
        <form onSubmit={handleSaveWalletPolicy} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {walletPolicy?.pendingEffectiveDate && (
            <div style={{
              padding: '12px 16px',
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid var(--gold-primary)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: 'var(--text-main)'
            }}>
              <strong>Pending Policy Loosening:</strong> Relaxed rates take effect on <strong>{walletPolicy.pendingEffectiveDate}</strong> (start of next local day).
            </div>
          )}

          {/* Effective Daily Target & Earning Cap Display */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            padding: '16px',
            background: 'var(--surface-subtle)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-color)'
          }}>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                Effective Daily Target
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#38BDF8', margin: '4px 0' }}>
                {walletSettlement?.dailyTargetMinutes || 0} mins
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Derived from active windows minus excused breaks
              </div>
            </div>
            <div>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                Daily Earning Cap
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981', margin: '4px 0' }}>
                ₹{((((walletSettlement?.dailyTargetMinutes || 0) * (walletPolicy?.earnRatePaisePerMin || 100)) +
                  (walletPolicy?.overtimeMode !== 'none' ? (walletPolicy?.overtimeCapMinutes || 0) * (walletPolicy?.overtimeMode === 'half_rate' ? Math.floor((walletPolicy?.earnRatePaisePerMin || 100) / 2) : (walletPolicy?.earnRatePaisePerMin || 100)) : 0)) / 100).toFixed(0)}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                Maximum daily earning based on target and overtime cap
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <Field
              label="Earn Rate (Paise / minute)"
              hint={`100 paise = 1 INR / min (Current: ₹${(((walletPolicy.earnRatePaisePerMin || 100)) / 100).toFixed(2)}/min - updates immediately)`}
            >
              <input
                className="input"
                type="number"
                min="0"
                value={walletPolicy.earnRatePaisePerMin || 100}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, earnRatePaisePerMin: Number(e.target.value) })}
              />
            </Field>

            <Field
              label="Penalty Rate (Paise / unworked min)"
              hint={`Deducted for unworked schedule gaps (Current: ₹${(((walletPolicy.penaltyRatePaisePerMin || 100)) / 100).toFixed(2)}/min)`}
            >
              <input
                className="input"
                type="number"
                min="0"
                value={walletPolicy.penaltyRatePaisePerMin || 100}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, penaltyRatePaisePerMin: Number(e.target.value) })}
              />
            </Field>

            <Field label="Overtime Mode" hint="Rewards for work outside scheduled windows">
              <Select
                value={walletPolicy.overtimeMode || 'none'}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, overtimeMode: e.target.value })}
              >
                <option value="none">None (0 paise earned)</option>
                <option value="half_rate">Half Rate (50% earning rate)</option>
                <option value="full_rate">Full Rate (100% earning rate)</option>
              </Select>
            </Field>

            <Field label="Overtime Cap (Minutes)" hint="Max overtime minutes eligible for earnings">
              <input
                className="input"
                type="number"
                min="0"
                value={walletPolicy.overtimeCapMinutes || 0}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, overtimeCapMinutes: Number(e.target.value) })}
              />
            </Field>

            <Field label="Daily Break Allowance (Minutes)" hint="Excused break time per day">
              <input
                className="input"
                type="number"
                min="0"
                value={walletPolicy.dailyBreakAllowanceMinutes || 90}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, dailyBreakAllowanceMinutes: Number(e.target.value) })}
              />
            </Field>

            <Field label="Monthly Leave Allowance (Days)" hint="Paid leave days per month">
              <input
                className="input"
                type="number"
                min="0"
                value={walletPolicy.monthlyLeaveAllowanceDays || 2}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, monthlyLeaveAllowanceDays: Number(e.target.value) })}
              />
            </Field>

            <Field label="Min Daily Personal Time (Minutes)" hint="Protected non-work personal time (default 120m)">
              <input
                className="input"
                type="number"
                min="0"
                value={walletPolicy.minDailyPersonalMinutes !== undefined ? walletPolicy.minDailyPersonalMinutes : 120}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, minDailyPersonalMinutes: Number(e.target.value) })}
              />
            </Field>

            <Field label="Max Daily Manual Minutes" hint="Ceiling for manual session entries">
              <input
                className="input"
                type="number"
                min="0"
                value={walletPolicy.maxDailyManualMinutes || 60}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, maxDailyManualMinutes: Number(e.target.value) })}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={Boolean(walletPolicy.floorEnabled)}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, floorEnabled: e.target.checked })}
              />
              <span>Enable Balance Floor (Penalties will not breach floor)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px' }}>
              <input
                type="checkbox"
                checked={Boolean(walletPolicy.idleCheckEnabled)}
                onChange={(e) => setWalletPolicy({ ...walletPolicy, idleCheckEnabled: e.target.checked })}
              />
              <span>Enable 10-Minute Idle Check & Countdown Watchdog</span>
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <Button type="submit" variant="primary" size="md" loading={savingWalletPolicy} style={{ padding: '10px 24px', fontWeight: 700 }}>
              Save Work Wallet Policy
            </Button>
          </div>
        </form>
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
