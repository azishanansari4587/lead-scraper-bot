import React, { useState, useEffect } from 'react';
import {
  Phone,
  Mail,
  Send,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  FileText,
  User,
  Sparkles,
  PhoneCall,
  Check,
  X,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, useToast } from '../components/ui';

export default function Today({ onNavigate }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [nowTime, setNowTime] = useState(new Date());

  // Modals state
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [selectedLeadForCall, setSelectedLeadForCall] = useState(null);

  // Call form state
  const [callOutcome, setCallOutcome] = useState('connected');
  const [callDuration, setCallDuration] = useState('60');
  const [callSummary, setCallSummary] = useState('');
  const [callNextAction, setCallNextAction] = useState('');
  const [callFollowUpDate, setCallFollowUpDate] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  // Note form state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [noteTags, setNoteTags] = useState('General');
  const [savingNote, setSavingNote] = useState(false);

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcuts: Alt+C (Log Call), Alt+N (Add Note)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setCallModalOpen(true);
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setNoteModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadSummary = async () => {
    try {
      setLoading(true);
      const res = await api.getTodaySummary();
      setData(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load today dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  // Format dual timezones
  const formatTime = (date, tz) => {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).format(date);
  };

  const formatDate = (date, tz) => {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  // Actions on follow-ups
  const handleMarkFollowUpDone = async (id) => {
    try {
      await api.updateFollowUpStatus(id, 'done');
      toast.success('Follow-up marked as completed.');
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to update follow-up');
    }
  };

  const handleMarkLeadReplied = async (leadId) => {
    try {
      await api.markLeadReplied(leadId, 'Replied via Today dashboard');
      toast.success('Lead marked replied & pending follow-ups cancelled!');
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to mark replied');
    }
  };

  // Submit Call Log
  const handleLogCallSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeadForCall && (!data?.overdueFollowUps[0] && !data?.todayFollowUps[0])) {
      toast.warning('Please select a lead to log call for.');
      return;
    }

    const targetLeadId = selectedLeadForCall?.id || (data?.overdueFollowUps[0]?.lead?.id || data?.todayFollowUps[0]?.lead?.id);
    if (!targetLeadId) {
      toast.error('No lead identified for call');
      return;
    }

    try {
      setSavingCall(true);
      await api.logCall({
        leadId: targetLeadId,
        direction: 'outbound',
        durationSec: parseInt(callDuration, 10) || 0,
        outcome: callOutcome,
        summary: callSummary.trim() || undefined,
        nextAction: callNextAction.trim() || undefined,
        nextFollowUpAt: callFollowUpDate || undefined
      });

      toast.success('Call logged successfully & timeline updated.');
      setCallModalOpen(false);
      setCallSummary('');
      setCallNextAction('');
      setCallFollowUpDate('');
      setSelectedLeadForCall(null);
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to log call');
    } finally {
      setSavingCall(false);
    }
  };

  // Submit Note
  const handleCreateNoteSubmit = async (e) => {
    e.preventDefault();
    if (!noteBody.trim()) {
      toast.warning('Note body cannot be empty.');
      return;
    }

    try {
      setSavingNote(true);
      const tagsArray = noteTags.split(',').map((t) => t.trim()).filter(Boolean);
      await api.createNote({
        title: noteTitle.trim() || undefined,
        body: noteBody.trim(),
        tags: tagsArray,
        ownerType: 'general'
      });

      toast.success('Quick note saved to Notebook.');
      setNoteModalOpen(false);
      setNoteTitle('');
      setNoteBody('');
    } catch (err) {
      toast.error(err.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  const openCallModalForLead = (lead) => {
    setSelectedLeadForCall(lead);
    setCallModalOpen(true);
  };

  const targets = data?.targets || {
    emails: { logged: 0, target: 30 },
    whatsapps: { logged: 0, target: 30 },
    calls: { logged: 0, target: 20 }
  };

  const emailPct = Math.min(100, Math.round((targets.emails.logged / targets.emails.target) * 100));
  const waPct = Math.min(100, Math.round((targets.whatsapps.logged / targets.whatsapps.target) * 100));
  const callPct = Math.min(100, Math.round((targets.calls.logged / targets.calls.target) * 100));

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Header with Dual Timezones & Shortcuts */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Today's Command Center
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            One-screen founder cockpit for calls, follow-ups, and daily outreach rhythm.
          </p>
        </div>

        {/* Dual Timezone Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: 'var(--surface-elevated)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Clock size={16} color="var(--gold-primary)" />
            <div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                🇦🇪 Dubai (GST)
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                {formatTime(nowTime, 'Asia/Dubai')} <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>({formatDate(nowTime, 'Asia/Dubai')})</span>
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface-elevated)',
              padding: '8px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Clock size={16} color="var(--emerald-accent)" />
            <div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                🇮🇳 India Factory (IST)
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                {formatTime(nowTime, 'Asia/Kolkata')} <span style={{ color: 'var(--text-dim)', fontSize: '11px' }}>({formatDate(nowTime, 'Asia/Kolkata')})</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={PhoneCall}
              onClick={() => { setSelectedLeadForCall(null); setCallModalOpen(true); }}
              title="Shortcut: Alt+C"
            >
              Log Call <span style={{ fontSize: '10px', opacity: 0.6 }}>(Alt+C)</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={FileText}
              onClick={() => setNoteModalOpen(true)}
              title="Shortcut: Alt+N"
            >
              Quick Note <span style={{ fontSize: '10px', opacity: 0.6 }}>(Alt+N)</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Progress Cards: Emails, WhatsApps, Calls vs Targets */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        {/* Emails Target Card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Mail size={16} color="var(--gold-primary)" /> Daily Emails
            </span>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--gold-primary)' }}>
              {emailPct}%
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {targets.emails.logged} <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>/ {targets.emails.target} target</span>
          </div>
          <div className="progress-track" style={{ height: '6px' }}>
            <div className="progress-bar" style={{ width: `${emailPct}%`, backgroundColor: 'var(--gold-primary)' }} />
          </div>
        </Card>

        {/* WhatsApps Target Card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Send size={16} color="var(--emerald-accent)" /> Daily WhatsApps
            </span>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--emerald-accent)' }}>
              {waPct}%
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {targets.whatsapps.logged} <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>/ {targets.whatsapps.target} target</span>
          </div>
          <div className="progress-track" style={{ height: '6px' }}>
            <div className="progress-bar" style={{ width: `${waPct}%`, backgroundColor: 'var(--emerald-accent)' }} />
          </div>
        </Card>

        {/* Calls Target Card */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Phone size={16} color="#3B82F6" /> Sales Calls Logged
            </span>
            <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: '#3B82F6' }}>
              {callPct}%
            </span>
          </div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
            {targets.calls.logged} <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-dim)' }}>/ {targets.calls.target} target</span>
          </div>
          <div className="progress-track" style={{ height: '6px' }}>
            <div className="progress-bar" style={{ width: `${callPct}%`, backgroundColor: '#3B82F6' }} />
          </div>
        </Card>
      </div>

      {/* Top 3 Priorities */}
      {data?.priorities && data.priorities.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Priorities For Today
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {data.priorities.map((item, idx) => (
              <Card key={idx} style={{ borderLeft: `3px solid ${item.color || 'var(--gold-primary)'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: item.color, textTransform: 'uppercase', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                    {item.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: 'var(--font-base)', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 600 }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: '12px' }}>
                  {item.description}
                </p>
                {item.actionLink && onNavigate && (
                  <button
                    type="button"
                    onClick={() => onNavigate(item.actionLink)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--gold-primary)',
                      fontSize: 'var(--font-xs)',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    Take Action <ArrowRight size={13} />
                  </button>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Overdue Follow-ups Section (RED ALERT) */}
      {data?.overdueFollowUps && data.overdueFollowUps.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <Card
            style={{
              borderColor: 'rgba(239, 68, 68, 0.4)',
              background: 'rgba(239, 68, 68, 0.04)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle color="var(--danger)" size={20} />
                <h2 style={{ fontSize: 'var(--font-lg)', color: 'var(--danger)', margin: 0, fontWeight: 600 }}>
                  Overdue Follow-ups ({data.overdueFollowUps.length})
                </h2>
              </div>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--danger)' }}>
                Action required immediately
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.overdueFollowUps.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-elevated)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    flexWrap: 'wrap',
                    gap: '12px'
                  }}
                >
                  <div style={{ flex: 1, minWidth: '240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.lead?.businessName || 'Lead'}
                      </span>
                      {item.lead?.buyerType && (
                        <Badge variant="neutral">{item.lead.buyerType}</Badge>
                      )}
                      <span style={{ fontSize: '11px', color: 'var(--danger)', fontWeight: 600 }}>
                        {item.step ? item.step.toUpperCase() : ''} OVERDUE
                      </span>
                    </div>
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                      {item.notes || 'Automated scheduled follow-up'} • {item.lead?.city}, {item.lead?.country}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {item.lead?.phone && (
                      <a
                        href={`tel:${item.lead.phone}`}
                        className="btn btn-secondary btn-sm"
                        style={{ color: 'var(--emerald-accent)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Phone size={13} /> {item.lead.phone}
                      </a>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => openCallModalForLead(item.lead)}
                    >
                      Log Call
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => handleMarkFollowUpDone(item.id)}
                    >
                      Mark Done
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleMarkLeadReplied(item.leadId)}
                      style={{ color: 'var(--gold-primary)' }}
                    >
                      Mark Replied
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Main Grid: Calls To Make Today & Follow-ups Due Today */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))',
          gap: '24px'
        }}
      >
        {/* Calls To Make Today */}
        <Card title="Calls To Make Today" icon={PhoneCall}>
          {(!data?.todayFollowUps || data.todayFollowUps.filter((f) => f.channel === 'call').length === 0) ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
              <CheckCircle2 size={32} color="var(--emerald-accent)" style={{ margin: '0 auto 8px' }} />
              No pending phone calls scheduled for today! Great job!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.todayFollowUps
                .filter((f) => f.channel === 'call')
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: 'var(--surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                        {item.lead?.businessName || 'Lead'}
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                        {item.lead?.city} • {item.notes || 'Follow-up Call'}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {item.lead?.phone && (
                        <a
                          href={`tel:${item.lead.phone}`}
                          className="btn btn-secondary btn-sm"
                          style={{ color: '#3B82F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Phone size={13} /> Call
                        </a>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openCallModalForLead(item.lead)}
                      >
                        Log
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkFollowUpDone(item.id)}
                      >
                        <Check size={14} color="var(--emerald-accent)" />
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>

        {/* Follow-ups Due Today (Email & WhatsApp) */}
        <Card title="Today's Outreach Follow-ups" icon={Send}>
          {(!data?.todayFollowUps || data.todayFollowUps.filter((f) => f.channel !== 'call').length === 0) ? (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
              <CheckCircle2 size={32} color="var(--emerald-accent)" style={{ margin: '0 auto 8px' }} />
              All scheduled digital follow-ups for today are clear.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.todayFollowUps
                .filter((f) => f.channel !== 'call')
                .map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '12px',
                      background: 'var(--surface-elevated)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-color)',
                      flexWrap: 'wrap',
                      gap: '8px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                          {item.lead?.businessName || 'Lead'}
                        </span>
                        <Badge variant={item.channel === 'whatsapp' ? 'success' : 'primary'}>
                          {item.channel.toUpperCase()}
                        </Badge>
                      </div>
                      <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {item.notes}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleMarkFollowUpDone(item.id)}
                      >
                        Mark Done
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleMarkLeadReplied(item.leadId)}
                        style={{ color: 'var(--gold-primary)' }}
                      >
                        Replied
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* Modal: Log Phone Call */}
      <Modal
        open={callModalOpen}
        onClose={() => setCallModalOpen(false)}
        title={selectedLeadForCall ? `Log Call: ${selectedLeadForCall.businessName}` : 'Log Phone Call'}
      >
        <form onSubmit={handleLogCallSubmit}>
          {selectedLeadForCall && (
            <div style={{ padding: '8px 12px', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-sm)', marginBottom: '16px', fontSize: 'var(--font-xs)', display: 'flex', justifyContent: 'space-between' }}>
              <span>Phone: <strong>{selectedLeadForCall.phone || 'N/A'}</strong></span>
              <span>Buyer Type: <strong>{selectedLeadForCall.buyerType || 'unclassified'}</strong></span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Call Outcome">
              <Select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)}>
                <option value="connected">Connected & Spoke</option>
                <option value="interested">Interested (Wants Catalog / Price)</option>
                <option value="callback_requested">Callback Requested</option>
                <option value="no_answer">No Answer</option>
                <option value="voicemail">Left Voicemail</option>
                <option value="busy">Line Busy</option>
                <option value="not_interested">Not Interested</option>
                <option value="wrong_number">Wrong Number</option>
              </Select>
            </Field>

            <Field label="Duration (Seconds)">
              <input
                type="number"
                min="0"
                className="input"
                value={callDuration}
                onChange={(e) => setCallDuration(e.target.value)}
                placeholder="60"
              />
            </Field>
          </div>

          <Field label="Conversation Summary">
            <Textarea
              rows={3}
              value={callSummary}
              onChange={(e) => setCallSummary(e.target.value)}
              placeholder="Spoke with senior designer about upcoming villa projects..."
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Next Action">
              <input
                type="text"
                className="input"
                value={callNextAction}
                onChange={(e) => setCallNextAction(e.target.value)}
                placeholder="Send PDF catalog & yarn sample kit"
              />
            </Field>

            <Field label="Follow-up Date & Time">
              <input
                type="datetime-local"
                className="input"
                value={callFollowUpDate}
                onChange={(e) => setCallFollowUpDate(e.target.value)}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setCallModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingCall} type="submit">
              Save Call Log
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Quick Note */}
      <Modal
        open={noteModalOpen}
        onClose={() => setNoteModalOpen(false)}
        title="Create Quick Note (Notebook)"
      >
        <form onSubmit={handleCreateNoteSubmit}>
          <Field label="Title (Optional)">
            <input
              type="text"
              className="input"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="e.g. Dubai Villa Trade Fair Notes"
            />
          </Field>

          <Field label="Note Body (Markdown supported)">
            <Textarea
              rows={5}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Enter observations, specs, or meeting minutes..."
            />
          </Field>

          <Field label="Tags (Comma separated)">
            <input
              type="text"
              className="input"
              value={noteTags}
              onChange={(e) => setNoteTags(e.target.value)}
              placeholder="Production, Trade, UAE"
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setNoteModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingNote} type="submit">
              Save Note
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
