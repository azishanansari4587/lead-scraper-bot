import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Calendar,
  Plus,
  Play,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Shield,
  Layers,
  Sparkles,
  Award,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  X,
  RotateCcw,
  Timer,
  Edit2,
  Trash2,
  ExternalLink,
  PhoneCall,
  Mail,
  Send,
  CheckSquare,
  Palette,
  Briefcase,
  HeartPulse,
  BookOpen,
  Home,
  Moon,
  Zap,
  Star,
  Activity
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, useToast } from '../components/ui';

const CATEGORIES = [
  { value: 'deep_work', label: 'Deep Work', subtitle: 'CAD & Custom Design', color: '#F59E0B', icon: Palette, bg: 'rgba(245, 158, 11, 0.12)' },
  { value: 'sales', label: 'Sales & Outreach', subtitle: 'Dubai Architects & Designers', color: '#10B981', icon: Briefcase, bg: 'rgba(16, 185, 129, 0.12)' },
  { value: 'calls', label: 'Client Calls', subtitle: 'FF&E Procurement Dialogues', color: '#3B82F6', icon: PhoneCall, bg: 'rgba(59, 130, 246, 0.12)' },
  { value: 'team', label: 'Loom Coordination', subtitle: 'Bhadohi Master Looms', color: '#8B5CF6', icon: Activity, bg: 'rgba(139, 92, 246, 0.12)' },
  { value: 'health', label: 'Health & Workout', subtitle: 'Fitness & Mental Clarity', color: '#EC4899', icon: HeartPulse, bg: 'rgba(236, 72, 153, 0.12)' },
  { value: 'learning', label: 'Market Intel', subtitle: 'Trends, Materials & Auctions', color: '#6366F1', icon: BookOpen, bg: 'rgba(99, 102, 241, 0.12)' },
  { value: 'family', label: 'Personal & Family', subtitle: 'Recharge & Harmony', color: '#14B8A6', icon: Home, bg: 'rgba(20, 184, 166, 0.12)' },
  { value: 'rest', label: 'Protected Sleep', subtitle: 'Immune Rest Hours', color: '#64748B', icon: Moon, bg: 'rgba(100, 116, 139, 0.12)' },
  { value: 'admin', label: 'Admin & Logistics', subtitle: 'Cargo, Invoices & Banking', color: '#94A3B8', icon: CheckSquare, bg: 'rgba(148, 163, 184, 0.12)' }
];

const ROUTE_PRESETS = [
  {
    title: '🎨 CAD Rug Design & Swatch Approvals',
    category: 'deep_work',
    startTime: '09:00',
    endTime: '11:00',
    isMustDo: true,
    isProtected: false,
    notes: 'Focus on luxury bespoke rug CAD approvals for UAE design studios.'
  },
  {
    title: '📞 Dubai Luxury Trade Outreach',
    category: 'sales',
    startTime: '11:30',
    endTime: '13:00',
    isMustDo: true,
    isProtected: false,
    notes: 'Direct outreach to Business Bay fit-out & Downtown villa architects.'
  },
  {
    title: '🧵 Bhadohi Artisan Loom Sync',
    category: 'team',
    startTime: '14:30',
    endTime: '15:30',
    isMustDo: true,
    isProtected: false,
    notes: 'Check loom weaving speed, wool dye master batch, washed abrash finish.'
  },
  {
    title: '🏃 Morning Vitality & Workout',
    category: 'health',
    startTime: '06:30',
    endTime: '07:30',
    isMustDo: false,
    isProtected: true,
    notes: 'Physical training and mental clarity before commercial day.'
  },
  {
    title: '🌙 Founder Rest & Deep Sleep',
    category: 'rest',
    startTime: '23:00',
    endTime: '06:30',
    isMustDo: false,
    isProtected: true,
    notes: 'Protected non-negotiable sleep block.'
  }
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' }
];

export default function Routine() {
  const toast = useToast();
  const navigate = useNavigate();

  // Tab mode: 'timeline' (Today's Trace) | 'planner' (Templates & Blocks)
  const [activeTab, setActiveTab] = useState('timeline');
  const [loading, setLoading] = useState(true);

  // Today trace data
  const [todayData, setTodayData] = useState(null);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));

  // Focus Timer state (25m / 50m)
  const [activeTimerEntryId, setActiveTimerEntryId] = useState(null);
  const [timerSecondsLeft, setTimerSecondsLeft] = useState(null);
  const [timerSessionLength, setTimerSessionLength] = useState(25);

  // Modals state
  const [unplannedModalOpen, setUnplannedModalOpen] = useState(false);
  const [skipModalOpen, setSkipModalOpen] = useState(false);
  const [targetEntryForSkip, setTargetEntryForSkip] = useState(null);
  const [skipReason, setSkipReason] = useState('');
  const [decisionModalOpen, setDecisionModalOpen] = useState(false);
  const [targetEntryForDecision, setTargetEntryForDecision] = useState(null);
  const [decisionAction, setDecisionAction] = useState('break_tasks');
  const [decisionSubtasks, setDecisionSubtasks] = useState('');

  // Planner state (templates & blocks)
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(null);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState(null);

  // Template Form fields
  const [tmplName, setTmplName] = useState('');
  const [tmplDesc, setTmplDesc] = useState('');
  const [tmplDays, setTmplDays] = useState([1, 2, 3, 4, 5]);
  const [tmplIsDefault, setTmplIsDefault] = useState(false);
  const [tmplTravelStart, setTmplTravelStart] = useState('');
  const [tmplTravelEnd, setTmplTravelEnd] = useState('');

  // Block Form fields
  const [blockTitle, setBlockTitle] = useState('');
  const [blockCategory, setBlockCategory] = useState('deep_work');
  const [blockStartTime, setBlockStartTime] = useState('09:00');
  const [blockEndTime, setBlockEndTime] = useState('11:00');
  const [blockDays, setBlockDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [blockIsMustDo, setBlockIsMustDo] = useState(false);
  const [blockIsProtected, setBlockIsProtected] = useState(false);
  const [blockLinkedTaskId, setBlockLinkedTaskId] = useState('');
  const [blockNotes, setBlockNotes] = useState('');
  const [availableTasks, setAvailableTasks] = useState([]);

  // Calculate duration between startTime and endTime in minutes
  const calculateDuration = (start, end) => {
    if (!start || !end || !start.includes(':') || !end.includes(':')) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMin = sh * 60 + sm;
    let endMin = eh * 60 + em;
    if (endMin <= startMin) endMin += 24 * 60; // Overnight block!
    return endMin - startMin;
  };

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const isToday = selectedDate === todayStr;

  const shiftDate = (days) => {
    const parts = (selectedDate || todayStr).split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    d.setUTCDate(d.getUTCDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  };

  const formattedDateTitle = useMemo(() => {
    if (!selectedDate) return '';
    const parts = selectedDate.split('-').map(Number);
    const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    }).format(d);
  }, [selectedDate]);

  const formatDurationText = (minutes) => {
    if (!minutes || minutes <= 0) return '0 min';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    if (mins === 0) return `${hrs}h`;
    return `${hrs}h ${mins}m`;
  };

  const setDurationFromStart = (start, addMinutes, setter) => {
    if (!start || !start.includes(':')) return;
    const [sh, sm] = start.split(':').map(Number);
    const totalMin = (sh * 60 + sm + addMinutes) % (24 * 60);
    const nh = Math.floor(totalMin / 60);
    const nm = totalMin % 60;
    const pad = (n) => String(n).padStart(2, '0');
    setter(`${pad(nh)}:${pad(nm)}`);
  };

  const applyPreset = (preset) => {
    setBlockTitle(preset.title);
    setBlockCategory(preset.category);
    setBlockStartTime(preset.startTime);
    setBlockEndTime(preset.endTime);
    setBlockIsMustDo(Boolean(preset.isMustDo));
    setBlockIsProtected(Boolean(preset.isProtected));
    if (preset.notes) setBlockNotes(preset.notes);
    toast.success(`Preset loaded: ${preset.title}`);
  };

  const applyUnplannedPreset = (title, cat, mins) => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const startStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const endMinutes = (now.getHours() * 60 + now.getMinutes() + mins) % (24 * 60);
    const endStr = `${pad(Math.floor(endMinutes / 60))}:${pad(endMinutes % 60)}`;
    setUnplannedTitle(title);
    setUnplannedCategory(cat);
    setUnplannedStartTime(startStr);
    setUnplannedEndTime(endStr);
  };

  // Unplanned Form fields
  const [unplannedTitle, setUnplannedTitle] = useState('');
  const [unplannedCategory, setUnplannedCategory] = useState('deep_work');
  const [unplannedStartTime, setUnplannedStartTime] = useState('14:00');
  const [unplannedEndTime, setUnplannedEndTime] = useState('15:00');
  const [unplannedIsMustDo, setUnplannedIsMustDo] = useState(false);
  const [unplannedNote, setUnplannedNote] = useState('');

  // Global Keyboard Shortcuts (Alt+R, Alt+S, Alt+X, Alt+U)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'r' || e.key === 'R')) {
        e.preventDefault();
        setActiveTab('timeline');
      } else if (e.altKey && (e.key === 'u' || e.key === 'U')) {
        e.preventDefault();
        setUnplannedModalOpen(true);
      } else if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        // Start current active or first pending block
        const pending = (todayData?.entries || []).find((en) => en.status === 'pending');
        if (pending) handleCheckIn(pending.id, 'start');
      } else if (e.altKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        // Complete current in_progress block
        const inProgress = (todayData?.entries || []).find((en) => en.status === 'in_progress');
        if (inProgress) handleCheckIn(inProgress.id, 'done');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [todayData]);

  // Focus Timer interval ticker
  useEffect(() => {
    if (timerSecondsLeft === null || timerSecondsLeft <= 0) return;
    const interval = setInterval(() => {
      setTimerSecondsLeft((prev) => {
        if (prev <= 1) {
          toast.success('Focus session completed! Great job.');
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerSecondsLeft]);

  // Load today's routine data
  const loadTodayData = async () => {
    try {
      setLoading(true);
      const res = await api.getRoutineToday(selectedDate);
      setTodayData(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load today routine');
    } finally {
      setLoading(false);
    }
  };

  // Load templates
  const loadTemplates = async () => {
    try {
      const res = await api.getRoutineTemplates();
      setTemplates(res.templates || []);
      if (!selectedTemplateId && res.templates?.length > 0) {
        setSelectedTemplateId(res.templates[0].id);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to load templates');
    }
  };

  useEffect(() => {
    if (activeTab === 'timeline') {
      loadTodayData();
    } else {
      loadTemplates();
    }
  }, [activeTab, selectedDate]);

  // Selected template object
  const activeTemplate = useMemo(() => {
    return templates.find((t) => t.id === selectedTemplateId) || templates[0] || null;
  }, [templates, selectedTemplateId]);

  // Dual time calculator (UAE GST UTC+4 vs India IST UTC+5:30)
  const formatDualTime = (hhmm) => {
    if (!hhmm || !hhmm.includes(':')) return { uae: hhmm, ist: hhmm };
    const [h, m] = hhmm.split(':').map(Number);
    // IST is +1h 30m ahead of GST
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

  // Check-in action
  const handleCheckIn = async (entryId, action, options = {}) => {
    try {
      await api.checkInRoutineEntry(entryId, { action, ...options });
      toast.success(`Block marked as ${action}!`);
      loadTodayData();
    } catch (err) {
      toast.error(err.message || 'Check-in failed');
    }
  };

  const handleSkipSubmit = async (e) => {
    e.preventDefault();
    if (!targetEntryForSkip) return;
    try {
      await api.checkInRoutineEntry(targetEntryForSkip.id, {
        action: 'skip',
        skipReason: skipReason.trim() || undefined
      });
      toast.success('Block skipped.');
      setSkipModalOpen(false);
      setSkipReason('');
      setTargetEntryForSkip(null);
      loadTodayData();
    } catch (err) {
      toast.error(err.message || 'Failed to skip block');
    }
  };

  const handleDecisionSubmit = async (e) => {
    e.preventDefault();
    if (!targetEntryForDecision) return;
    try {
      const subtasks = decisionAction === 'break_tasks'
        ? decisionSubtasks.split('\n').map((s) => s.trim()).filter(Boolean)
        : undefined;

      await api.resolveCarryDecision(targetEntryForDecision.id, {
        action: decisionAction,
        subtasks
      });

      toast.success('Carry decision recorded successfully.');
      setDecisionModalOpen(false);
      setTargetEntryForDecision(null);
      loadTodayData();
    } catch (err) {
      toast.error(err.message || 'Failed to submit decision');
    }
  };

  const handleStartTimer = (entryId, minutes) => {
    setActiveTimerEntryId(entryId);
    setTimerSessionLength(minutes);
    setTimerSecondsLeft(minutes * 60);
    // Also trigger start check-in
    handleCheckIn(entryId, 'start');
  };

  const handleStopTimer = () => {
    setActiveTimerEntryId(null);
    setTimerSecondsLeft(null);
  };

  const handleAddUnplannedSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.addUnplannedRoutineEntry({
        title: unplannedTitle.trim(),
        category: unplannedCategory,
        startTime: unplannedStartTime,
        endTime: unplannedEndTime,
        isMustDo: unplannedIsMustDo,
        note: unplannedNote.trim() || undefined,
        date: selectedDate
      });
      toast.success('Unplanned entry added to timeline.');
      setUnplannedModalOpen(false);
      setUnplannedTitle('');
      setUnplannedNote('');
      loadTodayData();
    } catch (err) {
      toast.error(err.message || 'Failed to add unplanned entry');
    }
  };

  // Template Save / Create
  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: tmplName.trim(),
        description: tmplDesc.trim() || undefined,
        assignedDays: tmplDays,
        isDefault: tmplIsDefault,
        travelStartDate: tmplTravelStart || undefined,
        travelEndDate: tmplTravelEnd || undefined
      };
      const res = await api.createRoutineTemplate(payload);
      toast.success('Routine template created!');
      setTemplateModalOpen(false);
      loadTemplates();
      setSelectedTemplateId(res.template.id);
    } catch (err) {
      toast.error(err.message || 'Failed to create template');
    }
  };

  // Block Save / Create
  const handleSaveBlock = async (e) => {
    e.preventDefault();
    if (!activeTemplate) return;
    try {
      const payload = {
        templateId: activeTemplate.id,
        title: blockTitle.trim(),
        category: blockCategory,
        startTime: blockStartTime,
        endTime: blockEndTime,
        daysOfWeek: blockDays,
        isMustDo: blockIsMustDo,
        isProtected: blockIsProtected,
        linkedTaskId: blockLinkedTaskId ? Number(blockLinkedTaskId) : null,
        notes: blockNotes.trim() || null
      };

      if (editingBlockId) {
        const res = await api.updateRoutineBlock(editingBlockId, payload);
        toast.success(res.overloadWarning?.hasWarning ? res.overloadWarning.message : 'Block updated');
      } else {
        const res = await api.addRoutineBlock(payload);
        toast.success(res.overloadWarning?.hasWarning ? res.overloadWarning.message : 'Block added to template');
      }

      setBlockModalOpen(false);
      setEditingBlockId(null);
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to save block');
    }
  };

  const handleDeleteBlock = async (blockId) => {
    if (!window.confirm('Remove this block from template?')) return;
    try {
      await api.deleteRoutineBlock(blockId);
      toast.success('Block removed');
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to delete block');
    }
  };

  const openEditBlock = (b) => {
    setEditingBlockId(b.id);
    setBlockTitle(b.title);
    setBlockCategory(b.category);
    setBlockStartTime(b.startTime);
    setBlockEndTime(b.endTime);
    setBlockDays(b.daysOfWeek ? JSON.parse(b.daysOfWeek) : [0, 1, 2, 3, 4, 5, 6]);
    setBlockIsMustDo(Boolean(b.isMustDo));
    setBlockIsProtected(Boolean(b.isProtected));
    setBlockLinkedTaskId(b.linkedTaskId ? String(b.linkedTaskId) : '');
    setBlockNotes(b.notes || '');
    api.getTasks({ status: 'todo' }).then((res) => setAvailableTasks(res.tasks || [])).catch(() => {});
    setBlockModalOpen(true);
  };

  const openCreateBlock = () => {
    setEditingBlockId(null);
    setBlockTitle('');
    setBlockCategory('deep_work');
    setBlockStartTime('09:00');
    setBlockEndTime('11:00');
    setBlockDays([0, 1, 2, 3, 4, 5, 6]);
    setBlockIsMustDo(false);
    setBlockIsProtected(false);
    setBlockLinkedTaskId('');
    setBlockNotes('');
    api.getTasks({ status: 'todo' }).then((res) => setAvailableTasks(res.tasks || [])).catch(() => {});
    setBlockModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', paddingBottom: '40px' }}>
      {/* Top Header & View Tabs */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Clock size={28} color="var(--gold-primary)" /> CEO Routine Engine
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
            Personal operating rhythm for Knotiq Rugs founder — Dual Dubai & Bhadohi time, plan, trace & enforce.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '3px' }}>
            <button
              type="button"
              className={`btn-tab ${activeTab === 'timeline' ? 'active' : ''}`}
              onClick={() => setActiveTab('timeline')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'timeline' ? 'var(--surface-elevated)' : 'transparent',
                color: activeTab === 'timeline' ? 'var(--gold-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'timeline' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Calendar size={14} /> Today's Trace
            </button>
            <button
              type="button"
              className={`btn-tab ${activeTab === 'planner' ? 'active' : ''}`}
              onClick={() => setActiveTab('planner')}
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                background: activeTab === 'planner' ? 'var(--surface-elevated)' : 'transparent',
                color: activeTab === 'planner' ? 'var(--gold-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === 'planner' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Layers size={14} /> Schedule Templates
            </button>
          </div>

          <Button variant="outline" onClick={() => navigate('/routine/review')}>
            <Award size={16} color="var(--gold-primary)" /> Weekly Review & Score
          </Button>
        </div>
      </div>

      {/* TIMELINE TAB: Planned vs Actual Day Trace */}
      {activeTab === 'timeline' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              {/* Previous / Today / Next Day Steppers */}
              <div style={{ display: 'flex', alignItems: 'center', background: 'var(--surface-subtle)', borderRadius: '8px', border: '1px solid var(--border-color)', padding: '2px' }}>
                <button
                  type="button"
                  onClick={() => shiftDate(-1)}
                  style={{
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Previous Day"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedDate(todayStr)}
                  style={{
                    padding: '6px 12px',
                    background: isToday ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                    border: isToday ? '1px solid var(--gold-primary)' : 'none',
                    color: isToday ? 'var(--gold-primary)' : 'var(--text-secondary)',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontWeight: isToday ? 700 : 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Jump to Today"
                >
                  <Calendar size={13} /> Today
                </button>

                <button
                  type="button"
                  onClick={() => shiftDate(1)}
                  style={{
                    padding: '6px 8px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  title="Next Day"
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Luxury Styled Date Input */}
              <div className="luxury-date-input-wrap" style={{ width: 'auto', minWidth: '160px' }}>
                <span className="input-icon">
                  <Calendar size={15} color="var(--gold-primary)" />
                </span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  style={{ padding: '7px 10px 7px 34px', fontSize: '12px', fontWeight: 600 }}
                />
              </div>

              {/* Formatted Date Header & Timezone Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {formattedDateTitle}
                </span>
                <span style={{ fontSize: '11px', color: 'var(--gold-primary)', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.25)', padding: '2px 8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={11} /> 🇦🇪 GST • 🇮🇳 IST
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="outline" onClick={() => setUnplannedModalOpen(true)}>
                <Plus size={16} /> Quick Add Unplanned (<span style={{ opacity: 0.7 }}>Alt+U</span>)
              </Button>
              <Button variant="ghost" onClick={loadTodayData}>
                <RotateCcw size={14} /> Refresh
              </Button>
            </div>
          </div>

          {/* Daily Routine Score Banner */}
          {todayData?.dailyScore && (
            <Card
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(16, 185, 129, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                flexWrap: 'wrap',
                gap: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    background: 'rgba(245, 158, 11, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--gold-primary)',
                    fontWeight: 800,
                    fontSize: '18px'
                  }}
                >
                  {todayData.dailyScore.score}
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                    Daily Routine Adherence Score: {todayData.dailyScore.score}/100
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    {todayData.dailyScore.formula}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
                <span>Must-Do: <strong style={{ color: 'var(--text-primary)' }}>{todayData.dailyScore.components?.mustDoCompleted}/{todayData.dailyScore.components?.mustDoTotal}</strong></span>
                <span>Total: <strong style={{ color: 'var(--text-primary)' }}>{todayData.dailyScore.components?.totalCompleted}/{todayData.dailyScore.components?.totalCount}</strong></span>
                <span>On-Time: <strong style={{ color: 'var(--emerald-accent)' }}>{todayData.dailyScore.components?.onTimeStarts}</strong></span>
              </div>
            </Card>
          )}

          {/* Active Focus Timer Card if running */}
          {timerSecondsLeft !== null && (
            <Card
              style={{
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid var(--emerald-accent)',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Timer size={24} color="var(--emerald-accent)" style={{ animation: 'pulse 1.5s infinite' }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--emerald-accent)', fontSize: '16px' }}>
                    Focus Session: {Math.floor(timerSecondsLeft / 60)}:{String(timerSecondsLeft % 60).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Active focus sprint ({timerSessionLength}m). Block is marked in progress.
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="outline" onClick={handleStopTimer}>
                  Stop Timer
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    if (activeTimerEntryId) handleCheckIn(activeTimerEntryId, 'done');
                    handleStopTimer();
                  }}
                >
                  <CheckCircle2 size={16} /> Complete Block
                </Button>
              </div>
            </Card>
          )}

          {/* Timeline Entries List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(!todayData?.entries || todayData.entries.length === 0) ? (
              <Card style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Clock size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-secondary)' }}>No routine entries for this date.</p>
                <Button variant="primary" onClick={() => setActiveTab('planner')} style={{ marginTop: '14px' }}>
                  Manage Schedule Templates
                </Button>
              </Card>
            ) : (
              todayData.entries.map((entry) => {
                const times = formatDualTime(entry.plannedStart);
                const endTimes = formatDualTime(entry.plannedEnd);
                const isOverdue = entry.isMustDo && entry.escalationLevel >= 4 && entry.status === 'pending';
                const isCarried3x = entry.carryCount >= 3 && entry.status === 'pending';

                return (
                  <Card
                    key={entry.id}
                    style={{
                      borderLeft: `4px solid ${
                        entry.status === 'done' ? 'var(--emerald-accent)'
                          : entry.status === 'in_progress' ? 'var(--gold-primary)'
                          : entry.status === 'missed' ? 'var(--danger)'
                          : entry.isMustDo ? 'var(--primary-color)' : 'var(--border-color)'
                      }`,
                      background: isOverdue ? 'rgba(239, 68, 68, 0.05)' : 'var(--surface-color)',
                      padding: '16px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    {/* Top Row: Title, Badges, Times */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                            {entry.blockTitle || entry.title}
                          </span>
                          {entry.isMustDo && <Badge variant="gold">Must-Do</Badge>}
                          {entry.isProtected && <Badge variant="secondary">Protected Rest</Badge>}
                          {entry.status === 'in_progress' && <Badge variant="gold">In Progress</Badge>}
                          {entry.status === 'done' && <Badge variant="success">Completed</Badge>}
                          {entry.status === 'partial' && <Badge variant="warning">Partial</Badge>}
                          {entry.status === 'skipped' && <Badge variant="secondary">Skipped</Badge>}
                          {entry.status === 'missed' && <Badge variant="danger">Missed</Badge>}
                          {entry.carryCount > 0 && (
                            <Badge variant="warning">Carried {entry.carryCount}x</Badge>
                          )}
                        </div>

                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                          <span>Category: <strong style={{ color: 'var(--text-secondary)' }}>{entry.category}</strong></span>
                          <span>Time: <strong style={{ color: 'var(--text-secondary)' }}>{times.uae} - {endTimes.uae}</strong> ({times.ist} - {endTimes.ist})</span>
                        </div>
                      </div>

                      {/* One-Tap Check-in Buttons */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {entry.status !== 'done' && (
                          <>
                            {entry.status !== 'in_progress' && (
                              <Button
                                variant="outline"
                                onClick={() => handleCheckIn(entry.id, 'start')}
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                              >
                                <Play size={13} /> Start
                              </Button>
                            )}

                            <Button
                              variant="primary"
                              onClick={() => {
                                const askTask = entry.linkedTaskId
                                  ? window.confirm('Mark linked Task as completed as well?')
                                  : false;
                                handleCheckIn(entry.id, 'done', { completeLinkedTask: askTask });
                              }}
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                              <CheckCircle2 size={13} /> Done
                            </Button>

                            <Button
                              variant="ghost"
                              onClick={() => handleCheckIn(entry.id, 'partial')}
                              style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-secondary)' }}
                            >
                              Partial
                            </Button>

                            <Button
                              variant="ghost"
                              onClick={() => {
                                setTargetEntryForSkip(entry);
                                setSkipModalOpen(true);
                              }}
                              style={{ padding: '6px 10px', fontSize: '12px', color: 'var(--text-tertiary)' }}
                            >
                              Skip
                            </Button>

                            {/* Focus Timer 25m/50m buttons */}
                            <button
                              type="button"
                              onClick={() => handleStartTimer(entry.id, 25)}
                              className="btn-ghost"
                              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--gold-primary)', cursor: 'pointer' }}
                              title="Start 25-minute Pomodoro sprint"
                            >
                              25m
                            </button>
                            <button
                              type="button"
                              onClick={() => handleStartTimer(entry.id, 50)}
                              className="btn-ghost"
                              style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--gold-primary)', cursor: 'pointer' }}
                              title="Start 50-minute Deep Work sprint"
                            >
                              50m
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Forced Decision Card if carryCount >= 3 */}
                    {isCarried3x && (
                      <div
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          borderRadius: 'var(--radius-md)',
                          padding: '12px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          flexWrap: 'wrap',
                          gap: '12px'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <AlertTriangle size={18} color="var(--danger)" />
                          <span style={{ fontSize: '13px', color: 'var(--danger)', fontWeight: 600 }}>
                            Carried 3+ times. System requires a decision: break into subtasks, re-prioritize, or delete.
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setTargetEntryForDecision(entry);
                            setDecisionModalOpen(true);
                          }}
                          style={{ padding: '6px 12px', fontSize: '12px', borderColor: 'var(--danger)', color: 'var(--danger)' }}
                        >
                          Resolve Carry Decision
                        </Button>
                      </div>
                    )}

                    {/* Evidence Chips: Calls, Emails, WhatsApps, Tasks during block window */}
                    {entry.evidence && (entry.evidence.calls?.length > 0 || entry.evidence.outreach?.length > 0 || entry.evidence.tasks?.length > 0) && (
                      <div
                        style={{
                          background: 'var(--surface-subtle)',
                          borderRadius: 'var(--radius-md)',
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px',
                          fontSize: '12px'
                        }}
                      >
                        <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                          Command Center Activity During Window ({entry.plannedStart} - {entry.plannedEnd}):
                        </span>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {entry.evidence.calls?.map((c) => (
                            <span
                              key={c.id}
                              style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                color: '#3B82F6',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <PhoneCall size={11} /> Call: {c.leadName || 'Client'} ({c.durationSec}s)
                            </span>
                          ))}
                          {entry.evidence.outreach?.map((o) => (
                            <span
                              key={o.id}
                              style={{
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: 'var(--emerald-accent)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              {o.channel === 'whatsapp' ? <Send size={11} /> : <Mail size={11} />}
                              {o.channel}: {o.leadName || 'Contact'}
                            </span>
                          ))}
                          {entry.evidence.tasks?.map((t) => (
                            <span
                              key={t.id}
                              style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: 'var(--gold-primary)',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <CheckSquare size={11} /> Task Completed: {t.title}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* PLANNER TAB: Multiple Templates & Week Blocks Editor */}
      {activeTab === 'planner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Template Selector & Add Template */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Active Routine Template:
              </span>
              <select
                value={selectedTemplateId || ''}
                onChange={(e) => setSelectedTemplateId(Number(e.target.value))}
                style={{
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '13px'
                }}
              >
                {templates.map((tmpl) => (
                  <option key={tmpl.id} value={tmpl.id}>
                    {tmpl.name} {tmpl.isDefault ? '(Default)' : ''}
                  </option>
                ))}
              </select>

              <Button variant="ghost" onClick={() => setTemplateModalOpen(true)}>
                <Plus size={14} /> New Template
              </Button>
            </div>

            <Button variant="primary" onClick={openCreateBlock}>
              <Plus size={16} /> Add Routine Block
            </Button>
          </div>

          {/* Active Template Overload Check Warning */}
          {activeTemplate?.overloadWarning?.hasWarning && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <AlertTriangle size={18} color="var(--gold-primary)" />
              <div style={{ fontSize: '13px', color: 'var(--gold-primary)' }}>
                <strong>Overload Warning:</strong> {activeTemplate.overloadWarning.message}
              </div>
            </div>
          )}

          {/* Blocks List in Active Template */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {(!activeTemplate?.blocks || activeTemplate.blocks.length === 0) ? (
              <Card style={{ padding: '60px 20px', textAlign: 'center' }}>
                <Layers size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
                <p style={{ color: 'var(--text-secondary)' }}>This template is currently empty.</p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '12px', marginTop: '4px' }}>
                  No pre-filled advice or times: you define your exact routine blocks.
                </p>
                <Button variant="primary" onClick={openCreateBlock} style={{ marginTop: '14px' }}>
                  <Plus size={16} /> Create First Routine Block
                </Button>
              </Card>
            ) : (
              activeTemplate.blocks.map((block) => {
                const times = formatDualTime(block.startTime);
                const endTimes = formatDualTime(block.endTime);
                const daysList = block.daysOfWeek ? JSON.parse(block.daysOfWeek) : [];

                return (
                  <Card
                    key={block.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '14px 18px',
                      flexWrap: 'wrap',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                          {block.title}
                        </span>
                        <Badge variant="secondary">{block.category}</Badge>
                        {block.isMustDo && <Badge variant="gold">Must-Do MIT</Badge>}
                        {block.isProtected && <Badge variant="secondary">Protected</Badge>}
                      </div>

                      <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                        <span>
                          Time: <strong style={{ color: 'var(--gold-primary)' }}>{times.uae} - {endTimes.uae}</strong>
                          <span style={{ opacity: 0.7 }}> ({times.ist} - {endTimes.ist})</span>
                        </span>
                        <span>
                          Days: {daysList.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label).join(', ') || 'Everyday'}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        className="btn-icon btn-ghost btn-sm"
                        onClick={() => openEditBlock(block)}
                        title="Edit block"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon btn-ghost btn-sm"
                        onClick={() => handleDeleteBlock(block.id)}
                        title="Delete block"
                        style={{ color: 'var(--danger)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* QUICK ADD UNPLANNED MODAL */}
      {unplannedModalOpen && (
        <Modal
          title="⚡ Quick Add Unplanned Execution"
          isOpen={unplannedModalOpen}
          onClose={() => setUnplannedModalOpen(false)}
          size="lg"
        >
          <form onSubmit={handleAddUnplannedSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Quick 1-Click Starter Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Sparkles size={12} /> Instant Presets
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: '📞 30m Client Call', title: 'Ad-hoc Client Call', cat: 'calls', mins: 30 },
                  { label: '🎨 1h Urgent CAD Review', title: 'Emergency CAD Pattern Review', cat: 'deep_work', mins: 60 },
                  { label: '🧵 45m Loom Problem Solving', title: 'Bhadohi Loom Troubleshooting', cat: 'team', mins: 45 },
                  { label: '💼 30m VIP Outreach', title: 'High-Net-Worth Designer Outreach', cat: 'sales', mins: 30 },
                  { label: '📋 20m Admin Catch-up', title: 'Cargo & Customs Documentation', cat: 'admin', mins: 20 }
                ].map((item, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyUnplannedPreset(item.title, item.cat, item.mins)}
                    style={{
                      fontSize: '11px',
                      padding: '5px 12px',
                      borderRadius: '20px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold-primary)';
                      e.currentTarget.style.color = 'var(--gold-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Activity Title">
              <input
                type="text"
                className="form-input"
                value={unplannedTitle}
                onChange={(e) => setUnplannedTitle(e.target.value)}
                placeholder="e.g. Urgent swatch review for Alserkal gallery designer"
                required
                style={{ fontSize: '13px', padding: '10px 12px' }}
              />
            </Field>

            {/* Visual Category Selection Grid (All 9 Categories) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Category & Context
                </label>
                <span style={{ fontSize: '11px', color: 'var(--gold-primary)' }}>
                  {CATEGORIES.find((c) => c.value === unplannedCategory)?.label}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = unplannedCategory === cat.value;
                  const IconComp = cat.icon;
                  return (
                    <div
                      key={cat.value}
                      onClick={() => setUnplannedCategory(cat.value)}
                      style={{
                        border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--border-color)',
                        background: isSelected ? cat.bg : 'var(--surface-subtle)',
                        borderRadius: '8px',
                        padding: '10px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: isSelected ? cat.color : 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? (cat.value === 'deep_work' ? '#000000' : '#FFFFFF') : cat.color, flexShrink: 0 }}>
                        <IconComp size={14} />
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: '12px', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {cat.label}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Slot Inputs with Quick Duration */}
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Field label="Start Time (Local HH:MM)">
                  <div className="luxury-time-input-wrap">
                    <span className="input-icon">
                      <Clock size={15} color="var(--gold-primary)" />
                    </span>
                    <input
                      type="text"
                      value={unplannedStartTime}
                      onChange={(e) => setUnplannedStartTime(e.target.value)}
                      placeholder="14:00"
                      pattern="^\d{2}:\d{2}$"
                      required
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                    <span>🇦🇪 {unplannedStartTime || '14:00'} GST</span>
                    <span>•</span>
                    <span style={{ color: '#38BDF8' }}>🇮🇳 {formatDualTime(unplannedStartTime).ist.replace(' IST', '')} IST</span>
                  </div>
                </Field>

                <Field label="End Time (Local HH:MM)">
                  <div className="luxury-time-input-wrap">
                    <span className="input-icon">
                      <Clock size={15} color="#38BDF8" />
                    </span>
                    <input
                      type="text"
                      value={unplannedEndTime}
                      onChange={(e) => setUnplannedEndTime(e.target.value)}
                      placeholder="15:00"
                      pattern="^\d{2}:\d{2}$"
                      required
                    />
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '4px', display: 'flex', gap: '8px' }}>
                    <span>🇦🇪 {unplannedEndTime || '15:00'} GST</span>
                    <span>•</span>
                    <span style={{ color: '#38BDF8' }}>🇮🇳 {formatDualTime(unplannedEndTime).ist.replace(' IST', '')} IST</span>
                  </div>
                </Field>
              </div>

              {/* Quick Duration Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Quick Duration:</span>
                {[15, 30, 45, 60, 90, 120].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationFromStart(unplannedStartTime, mins, setUnplannedEndTime)}
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>
            </div>

            {/* Live Dual Time & Duration Banner */}
            <div
              style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={16} color="var(--gold-primary)" />
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Duration: {formatDurationText(calculateDuration(unplannedStartTime, unplannedEndTime))}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                <span style={{ color: 'var(--gold-primary)' }}>🇦🇪 Dubai: {unplannedStartTime} - {unplannedEndTime}</span>
                <span style={{ color: '#38BDF8' }}>🇮🇳 Bhadohi: {formatDualTime(unplannedStartTime).ist.replace(' IST', '')} - {formatDualTime(unplannedEndTime).ist.replace(' IST', '')}</span>
              </div>
            </div>

            {/* Must-Do Toggle Card */}
            <div
              onClick={() => setUnplannedIsMustDo(!unplannedIsMustDo)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer',
                background: unplannedIsMustDo ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-subtle)',
                padding: '12px 14px',
                borderRadius: '10px',
                border: unplannedIsMustDo ? '2px solid var(--gold-primary)' : '1px solid var(--border-color)',
                transition: 'all 0.15s ease'
              }}
            >
              <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: unplannedIsMustDo ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)' }}>
                <Zap size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ color: unplannedIsMustDo ? 'var(--gold-primary)' : 'var(--text-primary)', fontSize: '13px' }}>
                    Count as Must-Do Priority (MIT)
                  </strong>
                  <input
                    type="checkbox"
                    checked={unplannedIsMustDo}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--gold-primary)', pointerEvents: 'none' }}
                  />
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Includes this unplanned block in daily routine adherence scoring and MIT trace
                </div>
              </div>
            </div>

            <Field label="Notes / Outcome">
              <Textarea
                value={unplannedNote}
                onChange={(e) => setUnplannedNote(e.target.value)}
                placeholder="Details of client discussion, spec decisions, or outcome..."
                rows={2}
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Button type="button" variant="ghost" onClick={() => setUnplannedModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" style={{ padding: '10px 18px', fontWeight: 700 }}>
                <Plus size={14} /> Add to Today's Timeline
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* SKIP MODAL (Attractive Executive Experience) */}
      {skipModalOpen && targetEntryForSkip && (
        <Modal
          title="⏭️ Skip Routine Block"
          isOpen={skipModalOpen}
          onClose={() => setSkipModalOpen(false)}
          size="md"
        >
          <form onSubmit={handleSkipSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Block Context Card */}
            <div
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                  {targetEntryForSkip.blockTitle}
                </span>
                <Badge variant={targetEntryForSkip.isMustDo ? 'gold' : 'secondary'}>
                  {targetEntryForSkip.isMustDo ? 'Must-Do MIT' : targetEntryForSkip.category}
                </Badge>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-tertiary)' }}>
                Scheduled Time: <strong style={{ color: 'var(--gold-primary)' }}>{targetEntryForSkip.plannedStart} - {targetEntryForSkip.plannedEnd}</strong>
              </div>
            </div>

            {targetEntryForSkip.isMustDo && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <AlertTriangle size={18} color="var(--gold-primary)" style={{ flexShrink: 0 }} />
                <div style={{ fontSize: '12px', color: 'var(--gold-primary)', lineHeight: '1.4' }}>
                  <strong>Must-Do Block:</strong> An explanation is mandatory for auditing and weekly routine adherence reports.
                </div>
              </div>
            )}

            {/* Quick Reason Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Quick Reasons:
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {[
                  '✈️ Flight / Travel Delay',
                  '📞 Urgent Client Meeting',
                  '🩺 Health & Recovery',
                  '🧵 Loom Factory Emergency',
                  '⚡ Tech / Power Disruption'
                ].map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => setSkipReason(reason)}
                    style={{
                      fontSize: '11px',
                      padding: '4px 10px',
                      borderRadius: '16px',
                      background: skipReason === reason ? 'rgba(245, 158, 11, 0.15)' : 'var(--surface-subtle)',
                      border: skipReason === reason ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                      color: skipReason === reason ? 'var(--gold-primary)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Reason for Skipping">
              <input
                type="text"
                className="form-input"
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                placeholder="e.g. Flight delay or urgent client call..."
                required={targetEntryForSkip.isMustDo}
                style={{ fontSize: '13px', padding: '10px 12px' }}
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Button type="button" variant="ghost" onClick={() => setSkipModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" style={{ background: 'var(--gold-primary)', color: 'var(--primary-contrast)', fontWeight: 700 }}>
                Confirm Skip
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CARRY DECISION MODAL (Forced decision at carryCount >= 3) */}
      {decisionModalOpen && targetEntryForDecision && (
        <Modal
          title="⚠️ Resolve Repeatedly Carried Task"
          isOpen={decisionModalOpen}
          onClose={() => setDecisionModalOpen(false)}
          size="lg"
        >
          <form onSubmit={handleDecisionSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}
            >
              <AlertTriangle size={24} color="var(--danger)" style={{ flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--danger)' }}>
                  Carried Forward {targetEntryForDecision.carryCount} Times
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  "{targetEntryForDecision.blockTitle}" has resisted completion. Executive momentum requires an explicit resolution:
                </div>
              </div>
            </div>

            {/* 3 Interactive Decision Option Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {[
                {
                  id: 'break_tasks',
                  title: 'Break into Subtasks',
                  desc: 'Deconstruct complex friction into bite-sized actionable steps',
                  icon: Layers,
                  color: 'var(--gold-primary)'
                },
                {
                  id: 'change_priority',
                  title: 'Re-evaluate Priority',
                  desc: 'Downgrade from Must-Do or reschedule to a later date',
                  icon: RotateCcw,
                  color: '#3B82F6'
                },
                {
                  id: 'delete',
                  title: 'Remove Entirely',
                  desc: 'Permanently abandon this task with an audit log reason',
                  icon: Trash2,
                  color: 'var(--danger)'
                }
              ].map((opt) => {
                const isSelected = decisionAction === opt.id;
                const IconComponent = opt.icon;
                return (
                  <div
                    key={opt.id}
                    onClick={() => setDecisionAction(opt.id)}
                    style={{
                      border: isSelected ? `2px solid ${opt.color}` : '1px solid var(--border-color)',
                      background: isSelected ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-subtle)',
                      borderRadius: '10px',
                      padding: '14px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: isSelected ? opt.color : 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? '#FFFFFF' : opt.color }}>
                        <IconComponent size={14} />
                      </div>
                      <input
                        type="radio"
                        checked={isSelected}
                        onChange={() => {}}
                        style={{ accentColor: opt.color, pointerEvents: 'none' }}
                      />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: isSelected ? opt.color : 'var(--text-primary)' }}>
                      {opt.title}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', lineHeight: '1.3' }}>
                      {opt.desc}
                    </div>
                  </div>
                );
              })}
            </div>

            {decisionAction === 'break_tasks' && (
              <Field label="Breakdown Subtasks (1 actionable step per line)">
                <Textarea
                  value={decisionSubtasks}
                  onChange={(e) => setDecisionSubtasks(e.target.value)}
                  placeholder="Step 1: Check wool dye batch quality with Bhadohi master&#10;Step 2: Message Ajman designer regarding color deviation&#10;Step 3: Update rug schedule in Command Center"
                  rows={4}
                  required
                />
              </Field>
            )}

            {decisionAction === 'delete' && (
              <Field label="Reason for Abandoning Carried Task (Required for Audit)">
                <Textarea
                  value={decisionSubtasks}
                  onChange={(e) => setDecisionSubtasks(e.target.value)}
                  placeholder="Explain why this task is being dropped from routine..."
                  rows={2}
                  required
                />
              </Field>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Button type="button" variant="ghost" onClick={() => setDecisionModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" style={{ padding: '10px 18px', fontWeight: 700 }}>
                Confirm Resolution
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE TEMPLATE MODAL (Executive Rhythm Designer) */}
      {templateModalOpen && (
        <Modal
          title="✨ Create Routine Template"
          isOpen={templateModalOpen}
          onClose={() => setTemplateModalOpen(false)}
          size="lg"
        >
          <form onSubmit={handleSaveTemplate} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1-Click Template Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={12} /> Executive Template Presets
              </span>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  {
                    label: '🏢 Weekday Executive (Bhadohi + Dubai)',
                    name: 'Weekday Executive Master',
                    desc: 'Standard commercial outreach in Dubai and afternoon loom sync in Bhadohi',
                    days: [1, 2, 3, 4, 5]
                  },
                  {
                    label: '🏖️ Weekend Harmony & Review',
                    name: 'Weekend Harmony & Review',
                    desc: 'Strategic reflection, family time & mental recovery',
                    days: [0, 6]
                  },
                  {
                    label: '✈️ International Trade Mission',
                    name: 'Trade Mission & Travel',
                    desc: 'On-site architect meetings across GCC & London design fairs',
                    days: [1, 2, 3, 4, 5]
                  }
                ].map((tmplPreset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setTmplName(tmplPreset.name);
                      setTmplDesc(tmplPreset.desc);
                      setTmplDays(tmplPreset.days);
                    }}
                    style={{
                      fontSize: '11px',
                      padding: '5px 12px',
                      borderRadius: '20px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold-primary)';
                      e.currentTarget.style.color = 'var(--gold-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    {tmplPreset.label}
                  </button>
                ))}
              </div>
            </div>

            <Field label="Template Name">
              <input
                type="text"
                className="form-input"
                value={tmplName}
                onChange={(e) => setTmplName(e.target.value)}
                placeholder="e.g. Weekday Executive Rhythm"
                required
                style={{ fontSize: '13px', padding: '10px 12px' }}
              />
            </Field>

            <Field label="Description & Purpose">
              <input
                type="text"
                className="form-input"
                value={tmplDesc}
                onChange={(e) => setTmplDesc(e.target.value)}
                placeholder="e.g. Standard Ajman sales & Bhadohi loom coordination"
                style={{ fontSize: '13px', padding: '10px 12px' }}
              />
            </Field>

            {/* Interactive Day Selection Pills */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Assigned Weekdays (Only 1 active template per weekday)
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setTmplDays([0, 1, 2, 3, 4, 5, 6])}
                    style={{ fontSize: '10px', color: 'var(--gold-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    All Days
                  </button>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setTmplDays([1, 2, 3, 4, 5])}
                    style={{ fontSize: '10px', color: 'var(--gold-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Mon-Fri
                  </button>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setTmplDays([0, 6])}
                    style={{ fontSize: '10px', color: 'var(--gold-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Weekend
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = tmplDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) setTmplDays(tmplDays.filter((x) => x !== d.value));
                        else setTmplDays([...tmplDays, d.value]);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-subtle)',
                        color: isSelected ? 'var(--gold-primary)' : 'var(--text-secondary)',
                        fontWeight: isSelected ? 800 : 500,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Travel Override Date Range Card */}
            <div
              style={{
                background: 'var(--surface-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={16} color="var(--gold-primary)" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  Travel Date Override (Optional)
                </span>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                  — overrides regular weekday templates during travel dates
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Field label="Departure Date">
                  <div className="luxury-date-input-wrap">
                    <span className="input-icon">
                      <Calendar size={15} color="var(--gold-primary)" />
                    </span>
                    <input
                      type="date"
                      value={tmplTravelStart}
                      onChange={(e) => setTmplTravelStart(e.target.value)}
                    />
                  </div>
                  {tmplTravelStart && (
                    <div style={{ fontSize: '11px', color: 'var(--gold-primary)', marginTop: '4px' }}>
                      Depart: {tmplTravelStart}
                    </div>
                  )}
                </Field>

                <Field label="Return Date">
                  <div className="luxury-date-input-wrap">
                    <span className="input-icon">
                      <Calendar size={15} color="#38BDF8" />
                    </span>
                    <input
                      type="date"
                      value={tmplTravelEnd}
                      onChange={(e) => setTmplTravelEnd(e.target.value)}
                    />
                  </div>
                  {tmplTravelEnd && (
                    <div style={{ fontSize: '11px', color: '#38BDF8', marginTop: '4px' }}>
                      Return: {tmplTravelEnd}
                    </div>
                  )}
                </Field>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Button type="button" variant="ghost" onClick={() => setTemplateModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                Create Template
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* CREATE / EDIT BLOCK MODAL (Attractive Executive Experience) */}
      {blockModalOpen && (
        <Modal
          title={editingBlockId ? '✏️ Edit Routine Block' : '✨ Craft Routine Block'}
          isOpen={blockModalOpen}
          onClose={() => setBlockModalOpen(false)}
          size="lg"
        >
          <form onSubmit={handleSaveBlock} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* 1-Click Founder Presets */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--gold-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={12} /> Founder Presets (1-Click Fill)
              </div>
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                {ROUTE_PRESETS.map((preset, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    style={{
                      fontSize: '11px',
                      padding: '5px 12px',
                      borderRadius: '20px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold-primary)';
                      e.currentTarget.style.color = 'var(--gold-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    <span>{preset.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Block Title */}
            <Field label="Block Title">
              <input
                type="text"
                className="form-input"
                value={blockTitle}
                onChange={(e) => setBlockTitle(e.target.value)}
                placeholder="e.g. Deep Work: CAD Rug Design & Swatch Approvals"
                required
                style={{ fontSize: '14px', padding: '10px 14px' }}
              />
            </Field>

            {/* Visual Category Selection Grid (Cards with Icons) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Category & Purpose
                </label>
                <span style={{ fontSize: '11px', color: 'var(--gold-primary)' }}>
                  {CATEGORIES.find((c) => c.value === blockCategory)?.label}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                {CATEGORIES.map((cat) => {
                  const isSelected = blockCategory === cat.value;
                  const IconComponent = cat.icon;
                  return (
                    <div
                      key={cat.value}
                      onClick={() => setBlockCategory(cat.value)}
                      style={{
                        border: isSelected ? `2px solid ${cat.color}` : '1px solid var(--border-color)',
                        background: isSelected ? cat.bg : 'var(--surface-subtle)',
                        borderRadius: '10px',
                        padding: '12px 10px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '6px',
                        textAlign: 'center',
                        transition: 'all 0.15s ease',
                        boxShadow: isSelected ? `0 0 12px ${cat.bg}` : 'none',
                        position: 'relative'
                      }}
                    >
                      {isSelected && (
                        <span style={{ position: 'absolute', top: '6px', right: '6px', background: cat.color, borderRadius: '50%', width: '15px', height: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Check size={10} color="#000" strokeWidth={3} />
                        </span>
                      )}
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: isSelected ? cat.color : 'var(--surface-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isSelected ? (cat.value === 'deep_work' ? '#000000' : '#FFFFFF') : cat.color }}>
                        <IconComponent size={18} />
                      </div>
                      <div style={{ fontWeight: isSelected ? 700 : 600, fontSize: '12px', color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {cat.label}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', lineHeight: '1.2' }}>
                        {cat.subtitle}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Time Settings & Live Dual Timezone Widget */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                <Field label="Start Time (Local HH:MM)">
                  <div className="luxury-time-input-wrap">
                    <span className="input-icon">
                      <Clock size={15} color="var(--gold-primary)" />
                    </span>
                    <input
                      type="text"
                      value={blockStartTime}
                      onChange={(e) => setBlockStartTime(e.target.value)}
                      placeholder="09:00"
                      pattern="^\d{2}:\d{2}$"
                      required
                    />
                  </div>
                  {/* Quick Start Presets */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['06:30', '09:00', '11:30', '14:30', '22:00'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBlockStartTime(t)}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: blockStartTime === t ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-subtle)',
                          border: blockStartTime === t ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                          color: blockStartTime === t ? 'var(--gold-primary)' : 'var(--text-tertiary)',
                          cursor: 'pointer'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="End Time (Local HH:MM)">
                  <div className="luxury-time-input-wrap">
                    <span className="input-icon">
                      <Clock size={15} color="#38BDF8" />
                    </span>
                    <input
                      type="text"
                      value={blockEndTime}
                      onChange={(e) => setBlockEndTime(e.target.value)}
                      placeholder="11:00"
                      pattern="^\d{2}:\d{2}$"
                      required
                    />
                  </div>
                  {/* Quick End Presets */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                    {['07:30', '11:00', '13:00', '15:30', '06:30'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBlockEndTime(t)}
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: blockEndTime === t ? 'rgba(56, 189, 248, 0.2)' : 'var(--surface-subtle)',
                          border: blockEndTime === t ? '1px solid #38BDF8' : '1px solid var(--border-color)',
                          color: blockEndTime === t ? '#38BDF8' : 'var(--text-tertiary)',
                          cursor: 'pointer'
                        }}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>

              {/* Quick Duration Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>Set Duration:</span>
                {[30, 45, 60, 90, 120, 180].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setDurationFromStart(blockStartTime, mins, setBlockEndTime)}
                    style={{
                      fontSize: '11px',
                      padding: '3px 9px',
                      borderRadius: '5px',
                      background: 'var(--surface-subtle)',
                      border: '1px solid var(--border-color)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--gold-primary)';
                      e.currentTarget.style.color = 'var(--gold-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                    }}
                  >
                    +{mins < 60 ? `${mins}m` : `${mins / 60}h`}
                  </button>
                ))}
              </div>

              {/* Live Dual Time & Duration Calculation Card */}
              <div style={{
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(59, 130, 246, 0.05) 100%)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '4px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="var(--gold-primary)" />
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600 }}>
                      Block Duration & Timespan
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-primary)' }}>
                      {formatDurationText(calculateDuration(blockStartTime, blockEndTime))}
                      {blockStartTime && blockEndTime && blockEndTime <= blockStartTime && (
                        <span style={{ fontSize: '11px', color: 'var(--gold-primary)', marginLeft: '6px' }}>
                          (🌙 Overnight Block)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>🇦🇪 Dubai (GST)</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold-primary)' }}>
                      {blockStartTime} - {blockEndTime}
                    </div>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
                  <div>
                    <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>🇮🇳 Bhadohi (IST)</div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#38BDF8' }}>
                      {formatDualTime(blockStartTime).ist.replace(' IST', '')} - {formatDualTime(blockEndTime).ist.replace(' IST', '')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Day-of-Week Pills with Quick Selection */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Active Days of the Week
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => setBlockDays([0, 1, 2, 3, 4, 5, 6])}
                    style={{ fontSize: '10px', color: 'var(--gold-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Everyday
                  </button>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setBlockDays([1, 2, 3, 4, 5])}
                    style={{ fontSize: '10px', color: 'var(--gold-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Weekdays
                  </button>
                  <span style={{ color: 'var(--border-color)' }}>|</span>
                  <button
                    type="button"
                    onClick={() => setBlockDays([0, 6])}
                    style={{ fontSize: '10px', color: 'var(--gold-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Weekend
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                {DAYS_OF_WEEK.map((d) => {
                  const isSelected = blockDays.includes(d.value);
                  return (
                    <button
                      key={d.value}
                      type="button"
                      onClick={() => {
                        if (isSelected) setBlockDays(blockDays.filter((x) => x !== d.value));
                        else setBlockDays([...blockDays, d.value]);
                      }}
                      style={{
                        flex: 1,
                        padding: '8px 0',
                        borderRadius: '8px',
                        border: isSelected ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                        background: isSelected ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-subtle)',
                        color: isSelected ? 'var(--gold-primary)' : 'var(--text-secondary)',
                        fontWeight: isSelected ? 800 : 500,
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Policy Enforcement & Health Guardrail Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {/* Must-Do MIT Card */}
              <div
                onClick={() => {
                  const next = !blockIsMustDo;
                  setBlockIsMustDo(next);
                  if (next) setBlockIsProtected(false);
                }}
                style={{
                  border: blockIsMustDo ? '2px solid var(--gold-primary)' : '1px solid var(--border-color)',
                  background: blockIsMustDo ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-subtle)',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: blockIsMustDo ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--gold-primary)',
                  flexShrink: 0
                }}>
                  <Zap size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: blockIsMustDo ? 'var(--gold-primary)' : 'var(--text-primary)' }}>
                      Must-Do Priority (MIT)
                    </span>
                    <input
                      type="checkbox"
                      checked={blockIsMustDo}
                      onChange={() => {}}
                      style={{ accentColor: 'var(--gold-primary)', pointerEvents: 'none' }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: '1.3' }}>
                    Enforces L1-L4 escalation & Focus Lock if neglected.
                  </p>
                </div>
              </div>

              {/* Protected Rest Card */}
              <div
                onClick={() => {
                  const next = !blockIsProtected;
                  setBlockIsProtected(next);
                  if (next) setBlockIsMustDo(false);
                }}
                style={{
                  border: blockIsProtected ? '2px solid #818CF8' : '1px solid var(--border-color)',
                  background: blockIsProtected ? 'rgba(129, 140, 248, 0.08)' : 'var(--surface-subtle)',
                  borderRadius: '10px',
                  padding: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  background: blockIsProtected ? 'rgba(129, 140, 248, 0.2)' : 'var(--surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#818CF8',
                  flexShrink: 0
                }}>
                  <Moon size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '13px', color: blockIsProtected ? '#818CF8' : 'var(--text-primary)' }}>
                      Protected Rest
                    </span>
                    <input
                      type="checkbox"
                      checked={blockIsProtected}
                      onChange={() => {}}
                      style={{ accentColor: '#818CF8', pointerEvents: 'none' }}
                    />
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px', lineHeight: '1.3' }}>
                    Immune from enforcement, locking, or scoring penalties.
                  </p>
                </div>
              </div>
            </div>

            {/* Linked Task Selector */}
            <Field label="Link to Existing Task (Optional)">
              <select
                value={blockLinkedTaskId}
                onChange={(e) => setBlockLinkedTaskId(e.target.value)}
                style={{
                  background: 'var(--surface-color)',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  fontSize: '13px',
                  width: '100%'
                }}
              >
                <option value="">None (Pure Habit / Scheduled Routine Block)</option>
                {availableTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    #{t.id} {t.isMIT ? '⭐ [MIT] ' : ''}{t.title} ({t.category || 'General'})
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notes / Strategic Intent">
              <Textarea
                value={blockNotes}
                onChange={(e) => setBlockNotes(e.target.value)}
                placeholder="Guidelines, rug specifications, client context, or focus rules..."
                rows={2}
              />
            </Field>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '6px' }}>
              <Button type="button" variant="ghost" onClick={() => setBlockModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" style={{ padding: '10px 20px', fontWeight: 700 }}>
                {editingBlockId ? 'Update Routine Block' : 'Add Block to Template'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
