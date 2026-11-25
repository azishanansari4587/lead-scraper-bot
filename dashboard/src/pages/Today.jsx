import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  Mail,
  Send,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  Plus,
  Play,
  FileText,
  User,
  Sparkles,
  PhoneCall,
  Check,
  X,
  RefreshCw,
  Flame,
  Target,
  Sun,
  Moon,
  Star,
  CheckSquare,
  ChevronRight,
  ExternalLink,
  Network
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, useToast } from '../components/ui';

export default function Today({ onNavigate }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [nowTime, setNowTime] = useState(new Date());

  // Modals state
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [morningModalOpen, setMorningModalOpen] = useState(false);
  const [eveningModalOpen, setEveningModalOpen] = useState(false);
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

  // Morning Plan form state
  const [mit1, setMit1] = useState('');
  const [mit2, setMit2] = useState('');
  const [mit3, setMit3] = useState('');
  const [mit1TaskId, setMit1TaskId] = useState('');
  const [mit2TaskId, setMit2TaskId] = useState('');
  const [mit3TaskId, setMit3TaskId] = useState('');
  const [outreachTarget, setOutreachTarget] = useState(30);
  const [callTarget, setCallTarget] = useState(20);
  const [morningNote, setMorningNote] = useState('');
  const [availableTasks, setAvailableTasks] = useState([]);
  const [savingMorningPlan, setSavingMorningPlan] = useState(false);

  // Evening Review form state
  const [eveningSummary, setEveningSummary] = useState(null);
  const [win, setWin] = useState('');
  const [lesson, setLesson] = useState('');
  const [tomorrowNotes, setTomorrowNotes] = useState('');
  const [tomorrowDraft, setTomorrowDraft] = useState(null);
  const [savingEveningReview, setSavingEveningReview] = useState(false);

  // Update live clock every second
  useEffect(() => {
    const timer = setInterval(() => setNowTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Keyboard shortcuts: Alt+C (Log Call), Alt+N (Add Note), Alt+M (Morning Plan)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        setCallModalOpen(true);
      } else if (e.altKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        setNoteModalOpen(true);
      } else if (e.altKey && (e.key === 'm' || e.key === 'M')) {
        e.preventDefault();
        openMorningModal();
      } else if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        navigate('/routine');
      } else if (e.altKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        navigate('/routine');
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

      if (res.dailyPlan) {
        setMit1(res.dailyPlan.mit1 || '');
        setMit2(res.dailyPlan.mit2 || '');
        setMit3(res.dailyPlan.mit3 || '');
        setMorningNote(res.dailyPlan.morningNote || '');
      }
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

      toast.success('Call logged successfully!');
      setCallModalOpen(false);
      setCallSummary('');
      setCallNextAction('');
      setCallFollowUpDate('');
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to log call');
    } finally {
      setSavingCall(false);
    }
  };

  // Submit Quick Note
  const handleCreateNoteSubmit = async (e) => {
    e.preventDefault();
    if (!noteBody.trim()) {
      toast.warning('Note body cannot be empty');
      return;
    }

    try {
      setSavingNote(true);
      const parsedTags = noteTags.split(',').map((t) => t.trim()).filter(Boolean);
      await api.createNote({
        title: noteTitle.trim() || undefined,
        body: noteBody.trim(),
        ownerType: 'general',
        tags: parsedTags.length > 0 ? parsedTags : ['General']
      });

      toast.success('Note saved to notebook!');
      setNoteModalOpen(false);
      setNoteTitle('');
      setNoteBody('');
    } catch (err) {
      toast.error(err.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  };

  // Open Morning Plan Modal
  const openMorningModal = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [planRes, tasksRes] = await Promise.all([
        api.getDailyPlan(todayStr),
        api.getTasks({ status: 'todo,doing', all: 'true' })
      ]);

      setAvailableTasks(tasksRes.tasks || []);

      if (planRes.plan) {
        setMit1(planRes.plan.mit1 || '');
        setMit2(planRes.plan.mit2 || '');
        setMit3(planRes.plan.mit3 || '');
        setMit1TaskId(planRes.plan.mit1TaskId ? String(planRes.plan.mit1TaskId) : '');
        setMit2TaskId(planRes.plan.mit2TaskId ? String(planRes.plan.mit2TaskId) : '');
        setMit3TaskId(planRes.plan.mit3TaskId ? String(planRes.plan.mit3TaskId) : '');
        setOutreachTarget(planRes.plan.outreachTarget || data?.targets?.emails?.target || 30);
        setCallTarget(planRes.plan.callTarget || data?.targets?.calls?.target || 20);
        setMorningNote(planRes.plan.morningNote || '');
      } else {
        setOutreachTarget(data?.targets?.emails?.target || 30);
        setCallTarget(data?.targets?.calls?.target || 20);
      }

      setMorningModalOpen(true);
    } catch (err) {
      toast.error(err.message || 'Failed to prepare morning plan');
    }
  };

  const handleSaveMorningPlan = async (e) => {
    e.preventDefault();
    try {
      setSavingMorningPlan(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      await api.saveDailyPlan({
        date: todayStr,
        mit1: mit1.trim() || null,
        mit2: mit2.trim() || null,
        mit3: mit3.trim() || null,
        mit1TaskId: mit1TaskId ? parseInt(mit1TaskId, 10) : null,
        mit2TaskId: mit2TaskId ? parseInt(mit2TaskId, 10) : null,
        mit3TaskId: mit3TaskId ? parseInt(mit3TaskId, 10) : null,
        outreachTarget: parseInt(outreachTarget, 10) || 30,
        callTarget: parseInt(callTarget, 10) || 20,
        morningNote: morningNote.trim() || null
      });

      toast.success('Morning Plan saved! Go execute your day.');
      setMorningModalOpen(false);
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to save morning plan');
    } finally {
      setSavingMorningPlan(false);
    }
  };

  // Open Evening Review Modal
  const openEveningModal = async () => {
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      const [summaryRes, draftRes] = await Promise.all([
        api.getDailyReviewSummary(todayStr),
        api.getTomorrowDraft(todayStr)
      ]);

      setEveningSummary(summaryRes);
      setTomorrowDraft(draftRes.draft);
      if (summaryRes.review) {
        setWin(summaryRes.review.win || '');
        setLesson(summaryRes.review.lesson || '');
        setTomorrowNotes(summaryRes.review.tomorrowNotes || '');
      }
      setEveningModalOpen(true);
    } catch (err) {
      toast.error(err.message || 'Failed to generate evening review');
    }
  };

  const handleSaveEveningReview = async (e) => {
    e.preventDefault();
    try {
      setSavingEveningReview(true);
      const todayStr = new Date().toISOString().slice(0, 10);
      await api.saveDailyReview({
        date: todayStr,
        win: win.trim() || null,
        lesson: lesson.trim() || null,
        tomorrowNotes: tomorrowNotes.trim() || null
      });

      toast.success('Evening Review completed! Consistency streak updated 🔥');
      setEveningModalOpen(false);
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to save evening review');
    } finally {
      setSavingEveningReview(false);
    }
  };

  // Toggle task done directly from dashboard
  const handleToggleTaskDone = async (taskId, currentStatus) => {
    try {
      const newStatus = currentStatus === 'done' ? 'todo' : 'done';
      await api.updateTask(taskId, { status: newStatus });
      toast.success(newStatus === 'done' ? 'Task checked off!' : 'Task reopened');
      loadSummary();
    } catch (err) {
      toast.error(err.message || 'Failed to update task');
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
      {/* Top Header with Dual Timezones, Consistency Streaks & Shortcuts */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '20px'
        }}
      >
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '4px' }}>
            Today's Command Center
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            One-screen founder cockpit for calls, 3 MITs, calendar, and daily outreach rhythm.
          </p>
        </div>

        {/* Streaks & Dual Timezone Banner */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Consistency Streaks */}
          {data?.streaks && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                padding: '6px 14px',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
              title="Daily consistency streaks: review completion & outreach targets"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-xs)', color: 'var(--gold-primary)', fontWeight: 700 }}>
                <Flame size={16} fill="var(--gold-primary)" /> {data.streaks.reviewStreak} Day Review Streak
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-xs)', color: 'var(--emerald-accent)', fontWeight: 700 }}>
                <Target size={16} /> {data.streaks.targetStreak} Day Target Hit
              </div>
              {data.streaks.gateStreak !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-xs)', color: '#A78BFA', fontWeight: 700 }} title="Daily Mindset Gate recitation streak">
                  <Sparkles size={16} /> {data.streaks.gateStreak} Day Mindset Streak
                </div>
              )}
              {data.streaks.routineStreak !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-xs)', color: 'var(--gold-primary)', fontWeight: 700 }} title="Daily Routine consistency streak">
                  <Clock size={16} /> {data.streaks.routineStreak} Day Routine Streak
                </div>
              )}
            </div>
          )}

          {/* Dual Timezone Cards */}
          <div
            style={{
              background: 'var(--surface-elevated)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Clock size={15} color="var(--gold-primary)" />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                🇦🇪 Dubai (GST)
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-xs)' }}>
                {formatTime(nowTime, 'Asia/Dubai')}
              </div>
            </div>
          </div>

          <div
            style={{
              background: 'var(--surface-elevated)',
              padding: '6px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Clock size={15} color="var(--emerald-accent)" />
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                🇮🇳 Bhadohi (IST)
              </div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: 'var(--font-xs)' }}>
                {formatTime(nowTime, 'Asia/Kolkata')}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <Button
              variant="secondary"
              size="sm"
              icon={Sun}
              onClick={openMorningModal}
              title="Shortcut: Alt+M"
            >
              Morning Plan
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={Moon}
              onClick={openEveningModal}
            >
              Evening Review
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={PhoneCall}
              onClick={() => { setSelectedLeadForCall(null); setCallModalOpen(true); }}
              title="Shortcut: Alt+C"
            >
              Log Call
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={FileText}
              onClick={() => setNoteModalOpen(true)}
              title="Shortcut: Alt+N"
            >
              Note
            </Button>
          </div>
        </div>
      </div>

      {/* Ritual Prompt Banner (Dynamic based on time of day and completion) */}
      {data?.rituals?.needsMorningPlan && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(245, 158, 11, 0.15), rgba(18, 26, 45, 0.8))',
            border: '1px solid var(--gold-primary)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sun size={22} color="var(--gold-primary)" />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                Morning Ritual: Lock in Your 3 MITs
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
                Focus your day on what moves the needle for Knotiq Rugs before diving into incoming messages.
              </div>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={openMorningModal}>
            Complete Morning Plan →
          </Button>
        </div>
      )}

      {data?.rituals?.needsEveningReview && (
        <div
          style={{
            background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15), rgba(18, 26, 45, 0.8))',
            border: '1px solid var(--emerald-accent)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 18px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Moon size={22} color="var(--emerald-accent)" />
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 'var(--font-sm)' }}>
                Evening Ritual: Review Today & Lock in Streak
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
                Celebrate your wins, record key lessons, and preview tomorrow's auto-generated agenda.
              </div>
            </div>
          </div>
          <Button variant="primary" size="sm" onClick={openEveningModal}>
            Complete Evening Review →
          </Button>
        </div>
      )}

      {/* CEO Routine: Now and Next Strip */}
      {data?.routineNowNext && (data.routineNowNext.now || data.routineNowNext.next) && (
        <Card
          style={{
            marginBottom: '20px',
            padding: '14px 18px',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.05) 0%, rgba(18, 26, 45, 0.8) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
            borderLeft: '4px solid var(--gold-primary)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            {/* Left: NOW BLOCK */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '8px',
                  background: 'rgba(245, 158, 11, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold-primary)',
                  fontWeight: 800,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  flexShrink: 0
                }}
              >
                NOW
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {data.routineNowNext.now ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                        {data.routineNowNext.now.title || data.routineNowNext.now.blockTitle}
                      </span>
                      <Badge variant={data.routineNowNext.now.status === 'in_progress' ? 'gold' : data.routineNowNext.now.status === 'done' ? 'success' : 'secondary'}>
                        {data.routineNowNext.now.plannedStart} - {data.routineNowNext.now.plannedEnd}
                      </Badge>
                      {data.routineNowNext.now.isMustDo && <Badge variant="gold">Must-Do</Badge>}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Category: {data.routineNowNext.now.category} | Status: <strong style={{ color: 'var(--gold-primary)' }}>{data.routineNowNext.now.status}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                    No scheduled routine block active right now.
                  </div>
                )}
              </div>
            </div>

            {/* Middle: NEXT BLOCK */}
            {data.routineNowNext.next && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px', borderLeft: '1px solid var(--border-color)', borderRight: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 700 }}>
                  NEXT
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
                    {data.routineNowNext.next.title || data.routineNowNext.next.blockTitle}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                    Starts at {data.routineNowNext.next.plannedStart}
                  </div>
                </div>
              </div>
            )}

            {/* Right: Quick Check-in Actions & Open Routine */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {data.routineNowNext.now && data.routineNowNext.now.status !== 'done' && (
                <>
                  {data.routineNowNext.now.status !== 'in_progress' && (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={async () => {
                        await api.checkInRoutineEntry(data.routineNowNext.now.id, { action: 'start' });
                        toast.success('Started routine block!');
                        loadSummary();
                      }}
                    >
                      <Play size={12} /> Start
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={async () => {
                      await api.checkInRoutineEntry(data.routineNowNext.now.id, { action: 'done' });
                      toast.success('Completed routine block!');
                      loadSummary();
                    }}
                  >
                    <CheckCircle2 size={12} /> Done
                  </Button>
                </>
              )}

              <Button
                variant="ghost"
                size="xs"
                onClick={() => navigate('/routine')}
                style={{ color: 'var(--gold-primary)' }}
              >
                Routine Hub (Alt+R) <ArrowRight size={12} />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* 3 MITs (Most Important Tasks) Showcase Widget */}
      <Card style={{ marginBottom: '20px', padding: '16px 20px', borderLeft: '4px solid var(--gold-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Star size={18} fill="var(--gold-primary)" color="var(--gold-primary)" />
            <h2 style={{ fontSize: 'var(--font-md)', color: 'var(--text-primary)', margin: 0, fontWeight: 700 }}>
              Today's 3 Most Important Tasks (MITs)
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {data?.dailyPlan?.morningNote && (
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', fontStyle: 'italic', maxWidth: '340px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                "{data.dailyPlan.morningNote}"
              </span>
            )}
            <Button variant="ghost" size="xs" onClick={openMorningModal}>
              {data?.dailyPlan ? 'Edit MITs' : 'Set Today\'s MITs'}
            </Button>
          </div>
        </div>

        {!data?.dailyPlan ? (
          <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            No MITs set for today yet.{' '}
            <button
              type="button"
              onClick={openMorningModal}
              style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              Start Morning Plan now
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
            {/* MIT 1 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: data.dailyPlan.mit1Status ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}
            >
              <button
                type="button"
                onClick={() => data.dailyPlan.mit1TaskId && handleToggleTaskDone(data.dailyPlan.mit1TaskId, data.dailyPlan.mit1Status ? 'done' : 'todo')}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: data.dailyPlan.mit1Status ? '2px solid var(--emerald-accent)' : '2px solid var(--border-color)',
                  background: data.dailyPlan.mit1Status ? 'var(--emerald-accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: data.dailyPlan.mit1TaskId ? 'pointer' : 'default',
                  color: '#fff',
                  flexShrink: 0
                }}
              >
                {data.dailyPlan.mit1Status && <Check size={12} strokeWidth={3} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  MIT #1
                </div>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: data.dailyPlan.mit1Status ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: data.dailyPlan.mit1Status ? 'line-through' : 'none' }}>
                  {data.dailyPlan.mit1 || 'Not specified'}
                </div>
              </div>
            </div>

            {/* MIT 2 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: data.dailyPlan.mit2Status ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}
            >
              <button
                type="button"
                onClick={() => data.dailyPlan.mit2TaskId && handleToggleTaskDone(data.dailyPlan.mit2TaskId, data.dailyPlan.mit2Status ? 'done' : 'todo')}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: data.dailyPlan.mit2Status ? '2px solid var(--emerald-accent)' : '2px solid var(--border-color)',
                  background: data.dailyPlan.mit2Status ? 'var(--emerald-accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: data.dailyPlan.mit2TaskId ? 'pointer' : 'default',
                  color: '#fff',
                  flexShrink: 0
                }}
              >
                {data.dailyPlan.mit2Status && <Check size={12} strokeWidth={3} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  MIT #2
                </div>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: data.dailyPlan.mit2Status ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: data.dailyPlan.mit2Status ? 'line-through' : 'none' }}>
                  {data.dailyPlan.mit2 || 'Not specified'}
                </div>
              </div>
            </div>

            {/* MIT 3 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                background: data.dailyPlan.mit3Status ? 'rgba(16, 185, 129, 0.1)' : 'var(--surface-subtle)',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)'
              }}
            >
              <button
                type="button"
                onClick={() => data.dailyPlan.mit3TaskId && handleToggleTaskDone(data.dailyPlan.mit3TaskId, data.dailyPlan.mit3Status ? 'done' : 'todo')}
                style={{
                  width: '20px',
                  height: '20px',
                  borderRadius: '4px',
                  border: data.dailyPlan.mit3Status ? '2px solid var(--emerald-accent)' : '2px solid var(--border-color)',
                  background: data.dailyPlan.mit3Status ? 'var(--emerald-accent)' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: data.dailyPlan.mit3TaskId ? 'pointer' : 'default',
                  color: '#fff',
                  flexShrink: 0
                }}
              >
                {data.dailyPlan.mit3Status && <Check size={12} strokeWidth={3} />}
              </button>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', color: 'var(--gold-primary)', fontWeight: 700, textTransform: 'uppercase' }}>
                  MIT #3
                </div>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: data.dailyPlan.mit3Status ? 'var(--text-tertiary)' : 'var(--text-primary)', textDecoration: data.dailyPlan.mit3Status ? 'line-through' : 'none' }}>
                  {data.dailyPlan.mit3 || 'Not specified'}
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>

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

      {/* Grid: Calendar Events Today & Tasks Due Today */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px', marginBottom: '24px' }}>
        {/* Calendar Events Today */}
        <Card
          title="Today's Schedule (UAE & India)"
          icon={CalendarIcon}
          action={
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('/calendar') : window.location.assign('/calendar')}
              style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              Full Calendar <ExternalLink size={12} />
            </button>
          }
        >
          {(!data?.calendarEventsToday || data.calendarEventsToday.length === 0) ? (
            <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
              No meetings or time blocks scheduled for today.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.calendarEventsToday.map((ev) => {
                const startD = new Date(ev.startAt);
                const uaeTime = startD.toLocaleTimeString('en-GB', { timeZone: 'Asia/Dubai', hour: '2-digit', minute: '2-digit', hour12: true });
                const istTime = startD.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

                return (
                  <div
                    key={ev.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '8px 12px',
                      background: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid var(--primary-color)',
                      fontSize: 'var(--font-xs)'
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{ev.title}</div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px' }}>
                        {ev.location || 'Online'} • {ev.lead?.businessName ? `Lead: ${ev.lead.businessName}` : 'General'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, color: 'var(--gold-primary)' }}>{uaeTime} GST</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>{istTime} IST</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Tasks Due Today */}
        <Card
          title="Tasks Due Today"
          icon={CheckSquare}
          action={
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('/tasks') : window.location.assign('/tasks')}
              style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              All Tasks <ExternalLink size={12} />
            </button>
          }
        >
          {(!data?.tasksDueToday || data.tasksDueToday.length === 0) ? (
            <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
              No tasks due today. Everything on schedule!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.tasksDueToday.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    background: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    borderLeft: t.isMIT ? '3px solid var(--gold-primary)' : '3px solid var(--border-color)',
                    fontSize: 'var(--font-xs)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => handleToggleTaskDone(t.id, t.status)}
                    style={{
                      width: '18px',
                      height: '18px',
                      borderRadius: '4px',
                      border: '2px solid var(--border-color)',
                      background: 'transparent',
                      cursor: 'pointer',
                      flexShrink: 0
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {t.title}
                    </div>
                    <div style={{ color: 'var(--text-dim)', fontSize: '11px', textTransform: 'capitalize' }}>
                      {t.category} • {t.priority} priority
                    </div>
                  </div>
                  {t.isMIT && (
                    <span style={{ fontSize: '9px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--gold-primary)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                      MIT
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Mindmap Actions Due This Week */}
      <div style={{ marginBottom: '24px' }}>
        <Card
          title="Mindmap Actions Due This Week"
          icon={Network}
          action={
            <button
              type="button"
              onClick={() => onNavigate ? onNavigate('/mindmaps') : window.location.assign('/mindmaps')}
              style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              All Mindmaps <ExternalLink size={12} />
            </button>
          }
        >
          {(!data?.mindmapActionsDueThisWeek || data.mindmapActionsDueThisWeek.length === 0) ? (
            <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
              No strategic mindmap actions due this week.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '12px' }}>
              {data.mindmapActionsDueThisWeek.map((action) => {
                const priorityColor = action.priority === 'now' ? 'var(--gold-primary)' : action.priority === 'next' ? '#38BDF8' : '#94A3B8';
                return (
                  <div
                    key={action.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 14px',
                      background: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: action.isOverdue ? '3px solid var(--danger)' : `3px solid ${priorityColor}`,
                      fontSize: 'var(--font-xs)',
                      gap: '12px'
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {action.title}
                        </span>
                        {action.isOverdue && (
                          <span style={{ fontSize: '9px', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', padding: '1px 5px', borderRadius: '3px', fontWeight: 700 }}>
                            OVERDUE
                          </span>
                        )}
                      </div>
                      <div style={{ color: 'var(--text-dim)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                        <span>Map: {action.mindmapTitle}</span>
                        {action.dueDate && <span>• Due: {action.dueDate}</span>}
                        {action.kpiTarget && <span>• Target: {action.kpiCurrent || 0}/{action.kpiTarget}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '10px',
                          textTransform: 'uppercase',
                          fontWeight: 700,
                          color: priorityColor,
                          background: `${priorityColor}15`,
                          padding: '2px 6px',
                          borderRadius: '4px'
                        }}
                      >
                        {action.priority}
                      </span>
                      <a
                        href={`/mindmaps/${action.mindmapId}#node-${action.id}`}
                        onClick={(e) => {
                          if (onNavigate) {
                            e.preventDefault();
                            onNavigate(`/mindmaps/${action.mindmapId}`);
                          }
                        }}
                        style={{
                          color: 'var(--gold-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          textDecoration: 'none'
                        }}
                        title="Open in Mindmap Editor"
                      >
                        <ChevronRight size={16} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Top 3 Priorities */}
      {data?.priorities && data.priorities.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ fontSize: 'var(--font-md)', color: 'var(--text-secondary)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Top Strategic Priorities
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

      {/* Modal: Morning Plan (3 MITs & Targets) */}
      <Modal
        open={morningModalOpen}
        onClose={() => setMorningModalOpen(false)}
        title="☀️ Founder Morning Plan & 3 MITs"
      >
        <form onSubmit={handleSaveMorningPlan} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', margin: 0 }}>
            Choose up to 3 Most Important Tasks for today. You can pick an existing task or type a new one.
          </p>

          <Field label="★ MIT #1 (Top Priority)">
            <input
              type="text"
              className="input"
              placeholder="e.g. Call 10 luxury villa interior designers in Dubai"
              value={mit1}
              onChange={(e) => setMit1(e.target.value)}
              required
            />
            {availableTasks.length > 0 && (
              <select
                className="select"
                style={{ marginTop: '4px', fontSize: '11px', height: '30px' }}
                value={mit1TaskId}
                onChange={(e) => {
                  setMit1TaskId(e.target.value);
                  const t = availableTasks.find((x) => String(x.id) === e.target.value);
                  if (t) setMit1(t.title);
                }}
              >
                <option value="">Or select from open tasks...</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                ))}
              </select>
            )}
          </Field>

          <Field label="★ MIT #2">
            <input
              type="text"
              className="input"
              placeholder="e.g. Approve custom wool dyeing batch at Bhadohi mill"
              value={mit2}
              onChange={(e) => setMit2(e.target.value)}
            />
            {availableTasks.length > 0 && (
              <select
                className="select"
                style={{ marginTop: '4px', fontSize: '11px', height: '30px' }}
                value={mit2TaskId}
                onChange={(e) => {
                  setMit2TaskId(e.target.value);
                  const t = availableTasks.find((x) => String(x.id) === e.target.value);
                  if (t) setMit2(t.title);
                }}
              >
                <option value="">Or select from open tasks...</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                ))}
              </select>
            )}
          </Field>

          <Field label="★ MIT #3">
            <input
              type="text"
              className="input"
              placeholder="e.g. Send 5 hotel procurement quotations with yarn swatches"
              value={mit3}
              onChange={(e) => setMit3(e.target.value)}
            />
            {availableTasks.length > 0 && (
              <select
                className="select"
                style={{ marginTop: '4px', fontSize: '11px', height: '30px' }}
                value={mit3TaskId}
                onChange={(e) => {
                  setMit3TaskId(e.target.value);
                  const t = availableTasks.find((x) => String(x.id) === e.target.value);
                  if (t) setMit3(t.title);
                }}
              >
                <option value="">Or select from open tasks...</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
                ))}
              </select>
            )}
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Daily Outreach Target">
              <input
                type="number"
                min="0"
                className="input"
                value={outreachTarget}
                onChange={(e) => setOutreachTarget(e.target.value)}
              />
            </Field>

            <Field label="Daily Call Target">
              <input
                type="number"
                min="0"
                className="input"
                value={callTarget}
                onChange={(e) => setCallTarget(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Morning Intention / Note">
            <Textarea
              rows={2}
              placeholder="Today's focus: Quality conversations over quantity..."
              value={morningNote}
              onChange={(e) => setMorningNote(e.target.value)}
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setMorningModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingMorningPlan} type="submit">
              Save Morning Plan
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Evening Review */}
      <Modal
        open={eveningModalOpen}
        onClose={() => setEveningModalOpen(false)}
        title="🌙 Founder Evening Review & Debrief"
      >
        <form onSubmit={handleSaveEveningReview} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Day Metrics Auto-Summary */}
          {eveningSummary && (
            <div style={{ padding: '12px', background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '6px' }}>
                Today's Results Summary
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center' }}>
                <div style={{ padding: '6px', background: 'var(--surface-subtle)', borderRadius: '4px' }}>
                  <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: '#3B82F6' }}>{eveningSummary.metrics?.callsLogged || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Calls</div>
                </div>
                <div style={{ padding: '6px', background: 'var(--surface-subtle)', borderRadius: '4px' }}>
                  <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--gold-primary)' }}>{eveningSummary.metrics?.emailsSent || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Emails</div>
                </div>
                <div style={{ padding: '6px', background: 'var(--surface-subtle)', borderRadius: '4px' }}>
                  <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--emerald-accent)' }}>{eveningSummary.metrics?.whatsappsSent || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>WhatsApp</div>
                </div>
                <div style={{ padding: '6px', background: 'var(--surface-subtle)', borderRadius: '4px' }}>
                  <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-primary)' }}>{eveningSummary.metrics?.tasksCompleted || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>Tasks Done</div>
                </div>
              </div>
            </div>
          )}

          <Field label="🏆 Biggest Win of the Day">
            <input
              type="text"
              className="input"
              placeholder="e.g. Secured initial sample order for 5 custom rugs with Oberoi hotel procurement"
              value={win}
              onChange={(e) => setWin(e.target.value)}
              required
            />
          </Field>

          <Field label="💡 Lesson / What to improve tomorrow">
            <input
              type="text"
              className="input"
              placeholder="e.g. WhatsApp follow-ups in afternoon get 2x faster replies than morning emails"
              value={lesson}
              onChange={(e) => setLesson(e.target.value)}
            />
          </Field>

          {/* Tomorrow Auto-Draft Preview */}
          {tomorrowDraft && (
            <div style={{ padding: '10px 14px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 600, color: 'var(--gold-primary)', marginBottom: '4px' }}>
                Tomorrow's Pipeline Auto-Draft:
              </div>
              <div>• {tomorrowDraft.followUpsCount || 0} follow-ups scheduled</div>
              <div>• {tomorrowDraft.tasksCount || 0} task deadlines</div>
              <div>• {tomorrowDraft.eventsCount || 0} calendar events</div>
            </div>
          )}

          <Field label="Notes for Tomorrow / Brain Dump">
            <Textarea
              rows={3}
              placeholder="Add key items, reminder thoughts, or intentions for tomorrow..."
              value={tomorrowNotes}
              onChange={(e) => setTomorrowNotes(e.target.value)}
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="secondary" onClick={() => setEveningModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingEveningReview} type="submit">
              Complete Evening Review
            </Button>
          </div>
        </form>
      </Modal>

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
