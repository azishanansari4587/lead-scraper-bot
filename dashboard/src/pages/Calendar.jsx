import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Clock,
  AlertTriangle,
  User,
  MapPin,
  FileText,
  Trash2,
  Edit2,
  Check,
  PhoneCall,
  CheckSquare,
  Layers,
  Sparkles
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, useToast } from '../components/ui';

const EVENT_TYPES = [
  { value: 'meeting', label: 'Client / Buyer Meeting', color: 'var(--primary-color)' },
  { value: 'call_block', label: 'Call Batch Block', color: '#8B5CF6' },
  { value: 'work_block', label: 'Deep Work / Manufacturing', color: 'var(--gold-primary)' },
  { value: 'production', label: 'Production Check (Bhadohi)', color: '#EC4899' },
  { value: 'shipping', label: 'Logistics & Dispatch', color: '#06B6D4' },
  { value: 'other', label: 'General / Other', color: '#64748B' }
];

export default function Calendar() {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('week'); // 'day' | 'week' | 'month'
  const [currentDate, setCurrentDate] = useState(new Date());

  // Event modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [editingEventId, setEditingEventId] = useState(null);

  // Form fields
  const [formTitle, setFormTitle] = useState('');
  const [formStartAt, setFormStartAt] = useState('');
  const [formEndAt, setFormEndAt] = useState('');
  const [formType, setFormType] = useState('meeting');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formAllDay, setFormAllDay] = useState(false);
  const [formRelatedLeadId, setFormRelatedLeadId] = useState('');
  const [saving, setSaving] = useState(false);

  // Attached Notes state for selected event
  const [eventNotes, setEventNotes] = useState([]);
  const [loadingEventNotes, setLoadingEventNotes] = useState(false);
  const [newEventNote, setNewEventNote] = useState('');
  const [addingEventNote, setAddingEventNote] = useState(false);

  useEffect(() => {
    if (selectedItem && selectedItem.itemType === 'event') {
      setEventNotes([]);
      setNewEventNote('');
      setLoadingEventNotes(true);
      api.getNotes({ ownerType: 'event', ownerId: selectedItem.id })
        .then((res) => setEventNotes(res.notes || []))
        .catch(() => setEventNotes([]))
        .finally(() => setLoadingEventNotes(false));
    }
  }, [selectedItem]);

  const handleAddEventNote = async () => {
    if (!newEventNote.trim() || !selectedItem) return;
    try {
      setAddingEventNote(true);
      const res = await api.createNote({
        ownerType: 'event',
        ownerId: String(selectedItem.id),
        body: newEventNote.trim()
      });
      if (res.note) {
        setEventNotes((prev) => [res.note, ...prev]);
        setNewEventNote('');
        toast.success('Note attached to event');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to attach note');
    } finally {
      setAddingEventNote(false);
    }
  };

  // Calculate range based on viewMode and currentDate
  const dateRange = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (viewMode === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (viewMode === 'week') {
      const day = start.getDay(); // 0 is Sunday
      const diff = start.getDate() - day + (day === 0 ? -6 : 1); // Start on Monday
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      // Month
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(start.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }

    return { from: start.toISOString(), to: end.toISOString() };
  }, [currentDate, viewMode]);

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const res = await api.getCalendar(dateRange);
      setItems(res.items || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load calendar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalendar();
  }, [dateRange]);

  // Navigate dates
  const handlePrev = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setCurrentDate(d);
  };

  const handleNext = () => {
    const d = new Date(currentDate);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setCurrentDate(d);
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const openCreateModal = (defaultStartDate = null) => {
    setEditingEventId(null);
    const now = defaultStartDate ? new Date(defaultStartDate) : new Date();
    const later = new Date(now.getTime() + 60 * 60 * 1000);

    const pad = (n) => String(n).padStart(2, '0');
    const toLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setFormTitle('');
    setFormStartAt(toLocalISO(now));
    setFormEndAt(toLocalISO(later));
    setFormType('meeting');
    setFormLocation('Ajman Showroom / Zoom');
    setFormNotes('');
    setFormAllDay(false);
    setFormRelatedLeadId('');
    setModalOpen(true);
  };

  const openEditModal = (eventItem) => {
    setEditingEventId(eventItem.id);
    const start = new Date(eventItem.startAt);
    const end = new Date(eventItem.endAt);

    const pad = (n) => String(n).padStart(2, '0');
    const toLocalISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

    setFormTitle(eventItem.title || '');
    setFormStartAt(toLocalISO(start));
    setFormEndAt(toLocalISO(end));
    setFormType(eventItem.type || 'meeting');
    setFormLocation(eventItem.location || '');
    setFormNotes(eventItem.notes || '');
    setFormAllDay(Boolean(eventItem.allDay));
    setFormRelatedLeadId(eventItem.relatedLeadId ? String(eventItem.relatedLeadId) : '');
    setDetailModalOpen(false);
    setModalOpen(true);
  };

  const handleSaveEvent = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.warning('Event title is required');
      return;
    }
    if (new Date(formEndAt) < new Date(formStartAt)) {
      toast.error('End time must be after start time');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: formTitle.trim(),
        startAt: new Date(formStartAt).toISOString(),
        endAt: new Date(formEndAt).toISOString(),
        type: formType,
        location: formLocation.trim() || null,
        notes: formNotes.trim() || null,
        allDay: Boolean(formAllDay),
        relatedLeadId: formRelatedLeadId ? parseInt(formRelatedLeadId, 10) : null
      };

      if (editingEventId) {
        await api.updateCalendarEvent(editingEventId, payload);
        toast.success('Calendar event updated');
      } else {
        await api.createCalendarEvent(payload);
        toast.success('Calendar event scheduled');
      }

      setModalOpen(false);
      loadCalendar();
    } catch (err) {
      toast.error(err.message || 'Failed to save event');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEvent = async (id) => {
    if (!window.confirm('Delete this event from your calendar?')) return;
    try {
      await api.deleteCalendarEvent(id);
      toast.success('Event deleted');
      setDetailModalOpen(false);
      loadCalendar();
    } catch (err) {
      toast.error(err.message || 'Failed to delete event');
    }
  };

  // Convert UTC to dual display: UAE (GST) and India (IST)
  const formatDualTimes = (utcDate) => {
    if (!utcDate) return { uae: '', ist: '' };
    const d = new Date(utcDate);

    const uae = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dubai',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);

    const ist = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    }).format(d);

    return { uae, ist };
  };

  // Days for week view
  const weekDays = useMemo(() => {
    if (viewMode !== 'week') return [];
    const days = [];
    const monday = new Date(dateRange.from);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [dateRange, viewMode]);

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CalendarIcon size={26} color="var(--gold-primary)" /> Internal Calendar & Schedule
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            Unified schedule merging founder meetings, calls to make, task deadlines, and Bhadohi production checkpoints.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {/* Navigation */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--surface-color)', borderRadius: 'var(--radius-md)', padding: '4px 8px', border: '1px solid var(--border-color)' }}>
            <button type="button" onClick={handlePrev} className="btn-icon btn-ghost btn-sm" title="Previous">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={handleToday} className="btn-ghost btn-sm" style={{ fontSize: 'var(--font-xs)', fontWeight: 600 }}>
              Today
            </button>
            <button type="button" onClick={handleNext} className="btn-icon btn-ghost btn-sm" title="Next">
              <ChevronRight size={16} />
            </button>
          </div>

          {/* View mode toggle */}
          <div style={{ display: 'inline-flex', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            {['day', 'week', 'month'].map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: viewMode === mode ? 'var(--gold-primary)' : 'transparent',
                  color: viewMode === mode ? '#090D16' : 'var(--text-secondary)',
                  fontWeight: 600,
                  fontSize: 'var(--font-xs)',
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
              >
                {mode}
              </button>
            ))}
          </div>

          <Button variant="primary" onClick={() => openCreateModal()} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Schedule Event
          </Button>
        </div>
      </div>

      {/* Current Range & Conflict Legend Banner */}
      <Card style={{ padding: '12px 18px', marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
          {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          {viewMode === 'day' && ` — ${currentDate.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric' })}`}
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-color)' }} /> Event
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--gold-primary)' }} /> Task Due
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--emerald-accent)' }} /> Follow-up
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8B5CF6' }} /> Call Batch
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={12} color="var(--danger)" /> Overlap Warning
          </span>
        </div>
      </Card>

      {/* Loading state */}
      {loading && (
        <Card style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Clock size={28} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px', color: 'var(--gold-primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading schedule items...</p>
        </Card>
      )}

      {/* Week View */}
      {!loading && viewMode === 'week' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
          {weekDays.map((day) => {
            const isToday = day.toDateString() === new Date().toDateString();
            const dayStr = day.toISOString().slice(0, 10);
            const dayItems = items.filter((it) => it.startAt.slice(0, 10) === dayStr);

            return (
              <div
                key={dayStr}
                style={{
                  background: isToday ? 'rgba(245, 158, 11, 0.05)' : 'var(--surface-color)',
                  border: isToday ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '12px 10px',
                  minHeight: '420px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                {/* Day Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: isToday ? 'var(--gold-primary)' : 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                      {day.toLocaleDateString('en-US', { weekday: 'short' })}
                    </div>
                    <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: isToday ? 'var(--gold-primary)' : 'var(--text-primary)' }}>
                      {day.getDate()}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateModal(day)}
                    className="btn-icon btn-ghost btn-xs"
                    title="Add event for this day"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Day Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, overflowY: 'auto' }}>
                  {dayItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontSize: '11px' }}>
                      No events
                    </div>
                  ) : (
                    dayItems.map((item) => {
                      const times = formatDualTimes(item.startAt);
                      return (
                        <div
                          key={item.id}
                          onClick={() => {
                            setSelectedItem(item);
                            setDetailModalOpen(true);
                          }}
                          style={{
                            background: 'var(--surface-subtle)',
                            borderLeft: `3px solid ${item.color || 'var(--primary-color)'}`,
                            padding: '6px 8px',
                            borderRadius: '4px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            transition: 'background 0.15s ease',
                            position: 'relative'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-elevated)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--surface-subtle)')}
                        >
                          {item.hasConflict && (
                            <span style={{ position: 'absolute', right: '4px', top: '4px' }} title="Time conflict with another event!">
                              <AlertTriangle size={12} color="var(--danger)" />
                            </span>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.title}
                            </span>
                            {item.itemType === 'routine' && (
                              <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(245, 158, 11, 0.2)', color: 'var(--gold-primary)', fontWeight: 700, flexShrink: 0 }}>
                                Routine
                              </span>
                            )}
                          </div>

                          <div style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                            {item.allDay ? 'All Day' : `${times.uae} GST`}
                          </div>

                          {item.lead && (
                            <div style={{ color: 'var(--gold-primary)', fontSize: '10px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.lead.businessName}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Day View */}
      {!loading && viewMode === 'day' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {items.length === 0 ? (
            <Card style={{ padding: '60px 20px', textAlign: 'center' }}>
              <CalendarIcon size={36} color="var(--text-tertiary)" style={{ margin: '0 auto 12px' }} />
              <p style={{ color: 'var(--text-secondary)' }}>No items scheduled for this day.</p>
              <Button variant="primary" onClick={() => openCreateModal(currentDate)} style={{ marginTop: '14px' }}>
                <Plus size={16} /> Schedule Something
              </Button>
            </Card>
          ) : (
            items.map((item) => {
              const times = formatDualTimes(item.startAt);
              return (
                <Card
                  key={item.id}
                  style={{
                    padding: '16px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    borderLeft: `4px solid ${item.color || 'var(--primary-color)'}`
                  }}
                  onClick={() => {
                    setSelectedItem(item);
                    setDetailModalOpen(true);
                  }}
                >
                  <div style={{ width: '130px', flexShrink: 0 }}>
                    <div style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {item.allDay ? 'All Day' : `${times.uae} GST`}
                    </div>
                    {!item.allDay && (
                      <div style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
                        {times.ist} IST (India)
                      </div>
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontSize: 'var(--font-md)', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {item.title}
                      </span>
                      {item.hasConflict && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', fontSize: '10px', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                          <AlertTriangle size={10} /> Overlap Conflict
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                      <span style={{ textTransform: 'capitalize' }}>{item.itemType}</span>
                      {item.location && <span><MapPin size={12} style={{ display: 'inline', marginRight: '4px' }} />{item.location}</span>}
                      {item.lead && <span style={{ color: 'var(--gold-primary)' }}><User size={12} style={{ display: 'inline', marginRight: '4px' }} />{item.lead.businessName}</span>}
                    </div>
                  </div>

                  <Button variant="ghost" size="sm">
                    View Details
                  </Button>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Month View */}
      {!loading && viewMode === 'month' && (
        <Card style={{ padding: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((h) => (
              <div key={h} style={{ textAlign: 'center', fontWeight: 600, fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', padding: '6px' }}>
                {h}
              </div>
            ))}
            {/* Generate calendar cells */}
            {Array.from({ length: 35 }).map((_, idx) => {
              const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
              const dayOffset = (startOfMonth.getDay() + 6) % 7; // Monday = 0
              const cellDate = new Date(startOfMonth);
              cellDate.setDate(1 - dayOffset + idx);

              const isCurrentMonth = cellDate.getMonth() === currentDate.getMonth();
              const isToday = cellDate.toDateString() === new Date().toDateString();
              const cellDateStr = cellDate.toISOString().slice(0, 10);
              const cellItems = items.filter((it) => it.startAt.slice(0, 10) === cellDateStr);

              return (
                <div
                  key={idx}
                  onClick={() => {
                    setCurrentDate(cellDate);
                    setViewMode('day');
                  }}
                  style={{
                    minHeight: '80px',
                    padding: '6px',
                    borderRadius: '6px',
                    background: isToday ? 'rgba(245, 158, 11, 0.08)' : 'var(--surface-subtle)',
                    border: isToday ? '1px solid var(--gold-primary)' : '1px solid var(--border-color)',
                    opacity: isCurrentMonth ? 1 : 0.4,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div style={{ fontSize: '11px', fontWeight: 600, color: isToday ? 'var(--gold-primary)' : 'var(--text-primary)', textAlign: 'right' }}>
                    {cellDate.getDate()}
                  </div>
                  {cellItems.slice(0, 2).map((it) => (
                    <div
                      key={it.id}
                      style={{
                        fontSize: '9px',
                        background: it.color || 'var(--primary-color)',
                        color: '#fff',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}
                    >
                      {it.title}
                    </div>
                  ))}
                  {cellItems.length > 2 && (
                    <div style={{ fontSize: '9px', color: 'var(--text-tertiary)', textAlign: 'right' }}>
                      +{cellItems.length - 2} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Create / Edit Event Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingEventId ? 'Edit Calendar Event' : 'Schedule New Event'}
      >
        <form onSubmit={handleSaveEvent} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Title / Objective *" required>
            <input
              type="text"
              className="input"
              placeholder="e.g. Video call with Dubai Interior Design Studio"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Start Time (Local / UAE) *" required>
              <input
                type="datetime-local"
                className="input"
                value={formStartAt}
                onChange={(e) => setFormStartAt(e.target.value)}
                required
              />
            </Field>

            <Field label="End Time (Local / UAE) *" required>
              <input
                type="datetime-local"
                className="input"
                value={formEndAt}
                onChange={(e) => setFormEndAt(e.target.value)}
                required
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Event Type">
              <Select value={formType} onChange={(e) => setFormType(e.target.value)}>
                {EVENT_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Link to Lead ID (Optional)">
              <input
                type="number"
                className="input"
                placeholder="Lead ID"
                value={formRelatedLeadId}
                onChange={(e) => setFormRelatedLeadId(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Location / Link">
            <input
              type="text"
              className="input"
              placeholder="e.g. Knotiq Ajman Showroom / Zoom Meeting"
              value={formLocation}
              onChange={(e) => setFormLocation(e.target.value)}
            />
          </Field>

          <Field label="Notes / Agenda">
            <Textarea
              placeholder="Provide rug specifications, catalogue references, or discussion agenda..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              rows={3}
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingEventId ? 'Update Event' : 'Schedule Event'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Item Detail Drawer / Modal */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => setDetailModalOpen(false)}
        title={selectedItem?.title || 'Schedule Details'}
      >
        {selectedItem && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {selectedItem.hasConflict && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: 'var(--radius-md)', color: 'var(--danger)', fontSize: 'var(--font-xs)' }}>
                <AlertTriangle size={16} />
                <span>
                  <strong>Schedule Conflict:</strong> This item overlaps in time with another calendar event.
                </span>
              </div>
            )}

            {/* Dual Timezone Box */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', padding: '12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  🇦🇪 UAE Time (GST, UTC+4)
                </div>
                <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--gold-primary)' }}>
                  {formatDualTimes(selectedItem.startAt).uae} - {formatDualTimes(selectedItem.endAt).uae}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 600 }}>
                  🇮🇳 India Time (IST, UTC+5:30)
                </div>
                <div style={{ fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--primary-color)' }}>
                  {formatDualTimes(selectedItem.startAt).ist} - {formatDualTimes(selectedItem.endAt).ist}
                </div>
              </div>
            </div>

            {selectedItem.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
                <MapPin size={16} color="var(--gold-primary)" /> {selectedItem.location}
              </div>
            )}

            {selectedItem.lead && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                <User size={16} color="var(--gold-primary)" />
                <span>Associated Lead: <strong>{selectedItem.lead.businessName}</strong> ({selectedItem.lead.city || 'UAE'})</span>
              </div>
            )}

            {selectedItem.notes && (
              <div style={{ padding: '12px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginBottom: '4px', fontWeight: 600 }}>NOTES & CONTEXT</div>
                {selectedItem.notes}
              </div>
            )}

            {selectedItem.itemType === 'event' && (
              <div style={{ marginTop: '4px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} color="var(--gold-primary)" /> Attached Notes ({eventNotes.length})
                </div>
                {loadingEventNotes ? (
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', padding: '6px 0' }}>Loading notes...</div>
                ) : eventNotes.length === 0 ? (
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>No notes attached to this event yet.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', marginBottom: '10px' }}>
                    {eventNotes.map((n) => (
                      <div key={n.id} style={{ background: 'var(--surface-subtle)', padding: '8px 10px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)', borderLeft: '2px solid var(--gold-primary)' }}>
                        <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{n.body}</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                          {new Date(n.createdAt).toLocaleDateString()} {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Attach meeting notes, buyer requests, or follow-up notes..."
                    value={newEventNote}
                    onChange={(e) => setNewEventNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddEventNote();
                      }
                    }}
                    style={{ flex: 1, fontSize: 'var(--font-xs)', padding: '6px 10px' }}
                  />
                  <Button variant="secondary" size="sm" type="button" onClick={handleAddEventNote} disabled={addingEventNote || !newEventNote.trim()}>
                    {addingEventNote ? 'Adding...' : 'Attach Note'}
                  </Button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              {selectedItem.itemType === 'event' ? (
                <>
                  <Button variant="danger" size="sm" onClick={() => handleDeleteEvent(selectedItem.id)}>
                    <Trash2 size={14} /> Delete Event
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => openEditModal(selectedItem)}>
                    <Edit2 size={14} /> Edit Event
                  </Button>
                </>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>
                    Linked {selectedItem.itemType} item.
                  </div>
                  {selectedItem.itemType === 'routine' && (
                    <a href="/routine" className="btn btn-primary btn-sm" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      Open Routine Hub &rarr;
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
