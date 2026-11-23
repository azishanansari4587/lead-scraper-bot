import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Phone,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Copy,
  BookOpen,
  Filter,
  Plus,
  ArrowRight,
  TrendingUp,
  X
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, DataTable, Pagination, EmptyState, useToast } from '../components/ui';

export default function Calls() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('history'); // 'history' | 'queue'
  const [stats, setStats] = useState(null);
  const [scripts, setScripts] = useState([]);
  const [selectedScriptType, setSelectedScriptType] = useState('designer');
  const [copiedScript, setCopiedScript] = useState(false);

  // Calls list
  const [calls, setCalls] = useState([]);
  const [totalCalls, setTotalCalls] = useState(0);
  const [page, setPage] = useState(1);
  const [outcomeFilter, setOutcomeFilter] = useState('');
  const [directionFilter, setDirectionFilter] = useState('');
  const [loadingCalls, setLoadingCalls] = useState(false);

  // Queue list
  const [queue, setQueue] = useState([]);

  // Log Call Modal
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [leadsList, setLeadsList] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState('');
  const [callDirection, setCallDirection] = useState('outbound');
  const [callOutcome, setCallOutcome] = useState('connected');
  const [callDuration, setCallDuration] = useState('60');
  const [callSummary, setCallSummary] = useState('');
  const [callNextAction, setCallNextAction] = useState('');
  const [callFollowUpDate, setCallFollowUpDate] = useState('');
  const [savingCall, setSavingCall] = useState(false);

  useEffect(() => {
    loadStats();
    loadScripts();
    loadQueue();
    // Load leads for selector
    api.getLeads({ limit: 50 }).then((res) => setLeadsList(res.leads || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadCalls();
  }, [page, outcomeFilter, directionFilter]);

  const loadStats = async () => {
    try {
      const res = await api.getCallStats();
      setStats(res);
    } catch (_) {}
  };

  const loadScripts = async () => {
    try {
      const res = await api.getCallScripts();
      setScripts(res.scripts || []);
    } catch (_) {}
  };

  const loadQueue = async () => {
    try {
      const res = await api.getCallsToday();
      setQueue(res.followUpsToCall || []);
    } catch (_) {}
  };

  const loadCalls = async () => {
    try {
      setLoadingCalls(true);
      const res = await api.getCalls({
        page,
        limit: 15,
        outcome: outcomeFilter || undefined,
        direction: directionFilter || undefined
      });
      setCalls(res.calls || []);
      setTotalCalls(res.total || 0);
    } catch (err) {
      toast.error(err.message || 'Failed to load call history');
    } finally {
      setLoadingCalls(false);
    }
  };

  const handleCopyScript = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedScript(true);
    toast.success('Call script copied to clipboard!');
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const matchedScript = scripts.find((s) => s.buyerType === selectedScriptType) || scripts[0];
  const activeScript = {
    title: matchedScript?.title || 'Standard Cold Trade Call',
    scriptText: matchedScript?.scriptText || 'Hello, this is Knotiq Rugs calling regarding custom handmade carpets.',
    objectionHandling: matchedScript?.objectionHandling || 'Offer yarn sample kit and catalog.',
    tips: matchedScript?.tips || 'Be concise and value-focused.'
  };

  const handleLogCallSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLeadId) {
      toast.warning('Please select a lead.');
      return;
    }

    try {
      setSavingCall(true);
      await api.logCall({
        leadId: parseInt(selectedLeadId, 10),
        direction: callDirection,
        durationSec: parseInt(callDuration, 10) || 0,
        outcome: callOutcome,
        summary: callSummary.trim() || undefined,
        nextAction: callNextAction.trim() || undefined,
        nextFollowUpAt: callFollowUpDate || undefined
      });

      toast.success('Call logged successfully.');
      setLogModalOpen(false);
      setCallSummary('');
      setCallNextAction('');
      setCallFollowUpDate('');
      loadCalls();
      loadStats();
      loadQueue();
    } catch (err) {
      toast.error(err.message || 'Failed to log call');
    } finally {
      setSavingCall(false);
    }
  };

  const columns = [
    {
      key: 'calledAt',
      label: 'Date & Time',
      render: (calledAt) => (calledAt ? new Date(calledAt).toLocaleString() : '—')
    },
    {
      key: 'lead',
      label: 'Buyer / Lead',
      render: (lead, row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            {lead?.businessName || (row?.leadId ? `Lead #${row.leadId}` : 'Unknown Lead')}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
            {lead?.phone || 'No phone'} • {lead?.city || lead?.country || ''}
          </div>
        </div>
      )
    },
    {
      key: 'direction',
      label: 'Direction',
      render: (direction) => (
        <Badge variant={direction === 'inbound' ? 'success' : 'neutral'}>
          {(direction || 'outbound').toUpperCase()}
        </Badge>
      )
    },
    {
      key: 'outcome',
      label: 'Outcome',
      render: (outcome) => {
        let variant = 'neutral';
        if (outcome === 'interested' || outcome === 'connected') variant = 'success';
        if (outcome === 'callback_requested') variant = 'warning';
        if (outcome === 'not_interested' || outcome === 'wrong_number') variant = 'danger';
        return <Badge variant={variant}>{(outcome || 'unknown').replace(/_/g, ' ').toUpperCase()}</Badge>;
      }
    },
    {
      key: 'durationSec',
      label: 'Duration',
      render: (durationSec) => `${Math.floor((durationSec || 0) / 60)}m ${(durationSec || 0) % 60}s`
    },
    {
      key: 'summary',
      label: 'Summary & Action',
      render: (summary, row) => (
        <div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
            {summary || '—'}
          </div>
          {row?.nextAction && (
            <div style={{ fontSize: '11px', color: 'var(--gold-primary)', marginTop: '2px' }}>
              Action: {row.nextAction}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Call Center & Tele-Outreach
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            Log direct buyer calls, view live call scripts per buyer type, and track connect conversion rates.
          </p>
        </div>

        <Button variant="primary" icon={PhoneCall} onClick={() => setLogModalOpen(true)}>
          Log New Call
        </Button>
      </div>

      {/* KPI Stats Banner */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <Card>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: '4px' }}>CALLS TODAY</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
            {stats?.callsTodayCount || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: '4px' }}>CALLS THIS WEEK</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--gold-primary)' }}>
            {stats?.callsWeekCount || 0}
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: '4px' }}>CONNECT RATE (7D)</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--emerald-accent)' }}>
            {stats?.connectRateWeek || 0}%
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: '4px' }}>SCHEDULED CALLS QUEUE</div>
          <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: '#3B82F6' }}>
            {queue.length}
          </div>
        </Card>
      </div>

      {/* Split Layout: Left Calls / Right Call Scripts */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.8fr) minmax(320px, 1.2fr)', gap: '24px', alignItems: 'start' }}>
        {/* Left: Call History / Queue */}
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button
                size="sm"
                variant={activeTab === 'history' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('history')}
              >
                Call History ({totalCalls})
              </Button>
              <Button
                size="sm"
                variant={activeTab === 'queue' ? 'primary' : 'secondary'}
                onClick={() => setActiveTab('queue')}
              >
                Queue for Today ({queue.length})
              </Button>
            </div>

            {activeTab === 'history' && (
              <div style={{ display: 'flex', gap: '8px' }}>
                <select
                  className="select select-sm"
                  value={outcomeFilter}
                  onChange={(e) => { setOutcomeFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All Outcomes</option>
                  <option value="connected">Connected</option>
                  <option value="interested">Interested</option>
                  <option value="callback_requested">Callback</option>
                  <option value="no_answer">No Answer</option>
                  <option value="voicemail">Voicemail</option>
                  <option value="not_interested">Not Interested</option>
                </select>

                <select
                  className="select select-sm"
                  value={directionFilter}
                  onChange={(e) => { setDirectionFilter(e.target.value); setPage(1); }}
                >
                  <option value="">All Directions</option>
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                </select>
              </div>
            )}
          </div>

          {activeTab === 'history' ? (
            <div>
              <DataTable
                columns={columns}
                data={calls}
                emptyContent={
                  loadingCalls ? (
                    <div style={{ textAlign: 'center', padding: '36px', color: 'var(--text-dim)' }}>
                      Loading calls...
                    </div>
                  ) : (
                    <EmptyState
                      title="No calls logged yet"
                      description="Click 'Log New Call' or dial from the Today dashboard to start logging outreach calls."
                    />
                  )
                }
              />
              {totalCalls > 15 && (
                <div style={{ marginTop: '16px' }}>
                  <Pagination
                    currentPage={page}
                    totalItems={totalCalls}
                    pageSize={15}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              {queue.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                  <CheckCircle2 size={32} color="var(--emerald-accent)" style={{ margin: '0 auto 8px' }} />
                  No calls scheduled for today!
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {queue.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        background: 'var(--surface-elevated)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-color)',
                        flexWrap: 'wrap',
                        gap: '8px'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                          {item.lead?.businessName || 'Lead'}
                        </div>
                        <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                          {item.lead?.city} • {item.notes || 'Follow-up Call'}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {item.lead?.phone && (
                          <a
                            href={`tel:${item.lead.phone}`}
                            className="btn btn-secondary btn-sm"
                            style={{ color: '#3B82F6', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Phone size={13} /> {item.lead.phone}
                          </a>
                        )}
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={() => {
                            setSelectedLeadId(String(item.leadId));
                            setLogModalOpen(true);
                          }}
                        >
                          Log Call
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Right: Interactive Call Scripts Panel */}
        <Card title="Buyer Call Scripts" icon={BookOpen}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginBottom: '6px', display: 'block' }}>
              SELECT BUYER TYPE SCRIPT:
            </label>
            <select
              className="select"
              value={selectedScriptType}
              onChange={(e) => setSelectedScriptType(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="designer">🎨 Interior Designer / Studio</option>
              <option value="importer">📦 Rug & Carpet Importer / Trader</option>
              <option value="hotel">🏨 Hotel & Hospitality FF&E</option>
              <option value="retailer">🛋️ Rug & Furniture Retailer</option>
              <option value="online_seller">🌐 E-commerce / Amazon / Noon</option>
              <option value="developer">🏗️ Real Estate Developer / Fit-out</option>
              <option value="investor">💼 Property Investor / Partner</option>
              <option value="homeowner">🏡 Bespoke Homeowner / Private</option>
            </select>
          </div>

          <div style={{ background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)', padding: '16px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--gold-primary)' }}>
                {activeScript.title}
              </span>
              <button
                type="button"
                onClick={() => handleCopyScript(activeScript.scriptText)}
                className="btn-icon btn-ghost btn-sm"
                title="Copy script"
              >
                <Copy size={14} />
              </button>
            </div>
            <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              "{activeScript.scriptText}"
            </p>
          </div>

          {activeScript.objectionHandling && (
            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: '#3B82F6', marginBottom: '4px' }}>
                🛡️ OBJECTION HANDLING
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', background: 'rgba(59, 130, 246, 0.05)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                {activeScript.objectionHandling}
              </div>
            </div>
          )}

          {activeScript.tips && (
            <div>
              <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--emerald-accent)', marginBottom: '4px' }}>
                💡 PRO TIPS
              </div>
              <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', background: 'rgba(16, 185, 129, 0.05)', padding: '10px', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                {activeScript.tips}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Log Call Modal */}
      <Modal open={logModalOpen} onClose={() => setLogModalOpen(false)} title="Log Sales Call">
        <form onSubmit={handleLogCallSubmit}>
          <Field label="Select Lead">
            <select
              className="select"
              value={selectedLeadId}
              onChange={(e) => setSelectedLeadId(e.target.value)}
              required
            >
              <option value="">-- Choose Lead --</option>
              {leadsList.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.businessName} ({l.phone || l.city || 'No Phone'}) - {l.buyerType || 'unclassified'}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Call Direction">
              <Select value={callDirection} onChange={(e) => setCallDirection(e.target.value)}>
                <option value="outbound">Outbound (I called)</option>
                <option value="inbound">Inbound (They called)</option>
              </Select>
            </Field>

            <Field label="Outcome">
              <Select value={callOutcome} onChange={(e) => setCallOutcome(e.target.value)}>
                <option value="connected">Connected & Spoke</option>
                <option value="interested">Interested (Wants Catalog / Sample)</option>
                <option value="callback_requested">Callback Requested</option>
                <option value="no_answer">No Answer</option>
                <option value="voicemail">Left Voicemail</option>
                <option value="busy">Busy</option>
                <option value="not_interested">Not Interested</option>
                <option value="wrong_number">Wrong Number</option>
              </Select>
            </Field>
          </div>

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

          <Field label="Call Summary & Notes">
            <Textarea
              rows={3}
              value={callSummary}
              onChange={(e) => setCallSummary(e.target.value)}
              placeholder="Spoke with owner regarding 8x10 hand-tufted sample swatches..."
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Next Action">
              <input
                type="text"
                className="input"
                value={callNextAction}
                onChange={(e) => setCallNextAction(e.target.value)}
                placeholder="Send price list / Follow up on Monday"
              />
            </Field>

            <Field label="Next Follow-up Date">
              <input
                type="datetime-local"
                className="input"
                value={callFollowUpDate}
                onChange={(e) => setCallFollowUpDate(e.target.value)}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
            <Button variant="secondary" onClick={() => setLogModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingCall} type="submit">
              Save Call
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
