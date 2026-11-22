import React, { useState, useEffect, useMemo } from 'react';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertTriangle,
  RotateCcw,
  Star,
  Trash2,
  Edit2,
  Check,
  ChevronRight,
  User,
  ArrowRight,
  LayoutList,
  Columns,
  FileText
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, useToast } from '../components/ui';

const CATEGORIES = [
  { value: 'all', label: 'All Categories' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'production', label: 'Production (India)' },
  { value: 'shipping', label: 'Shipping / Logistics' },
  { value: 'accounts', label: 'Accounts / Invoicing' },
  { value: 'personal', label: 'Personal / Founder' }
];

const PRIORITIES = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High Priority' },
  { value: 'medium', label: 'Medium Priority' },
  { value: 'low', label: 'Low Priority' }
];

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No Recurrence' },
  { value: 'daily', label: 'Daily (Every Day)' },
  { value: 'weekdays', label: 'Weekdays (Mon-Fri)' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' }
];

export default function Tasks() {
  const toast = useToast();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'board'
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create / Edit modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formCategory, setFormCategory] = useState('sales');
  const [formPriority, setFormPriority] = useState('medium');
  const [formDueDate, setFormDueDate] = useState('');
  const [formStatus, setFormStatus] = useState('todo');
  const [formIsMIT, setFormIsMIT] = useState(false);
  const [formRecurrence, setFormRecurrence] = useState('none');
  const [formRelatedLeadId, setFormRelatedLeadId] = useState('');
  const [saving, setSaving] = useState(false);

  // Attached Notes state for task detail
  const [taskNotes, setTaskNotes] = useState([]);
  const [loadingTaskNotes, setLoadingTaskNotes] = useState(false);
  const [newTaskNote, setNewTaskNote] = useState('');
  const [addingTaskNote, setAddingTaskNote] = useState(false);

  // Global Alt+T shortcut to quick-add task
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 't' || e.key === 'T')) {
        e.preventDefault();
        openCreateModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadTasks = async () => {
    try {
      setLoading(true);
      const res = await api.getTasks({ all: 'true' });
      setTasks(res.tasks || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const openCreateModal = () => {
    setEditingTask(null);
    setFormTitle('');
    setFormDescription('');
    setFormCategory('sales');
    setFormPriority('medium');
    setFormDueDate('');
    setFormStatus('todo');
    setFormIsMIT(false);
    setFormRecurrence('none');
    setFormRelatedLeadId('');
    setTaskNotes([]);
    setNewTaskNote('');
    setModalOpen(true);
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setFormTitle(task.title || '');
    setFormDescription(task.description || '');
    setFormCategory(task.category || 'sales');
    setFormPriority(task.priority || 'medium');
    setFormDueDate(task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : '');
    setFormStatus(task.status || 'todo');
    setFormIsMIT(Boolean(task.isMIT));
    setFormRecurrence(task.recurrenceRule || 'none');
    setFormRelatedLeadId(task.relatedLeadId ? String(task.relatedLeadId) : '');
    setNewTaskNote('');
    setTaskNotes([]);
    setLoadingTaskNotes(true);
    setModalOpen(true);

    api.getNotes({ ownerType: 'task', ownerId: task.id })
      .then((res) => setTaskNotes(res.notes || []))
      .catch(() => setTaskNotes([]))
      .finally(() => setLoadingTaskNotes(false));
  };

  const handleAddTaskNote = async () => {
    if (!newTaskNote.trim() || !editingTask) return;
    try {
      setAddingTaskNote(true);
      const res = await api.createNote({
        ownerType: 'task',
        ownerId: String(editingTask.id),
        body: newTaskNote.trim()
      });
      if (res.note) {
        setTaskNotes((prev) => [res.note, ...prev]);
        setNewTaskNote('');
        toast.success('Note attached to task');
      }
    } catch (err) {
      toast.error(err.message || 'Failed to attach note');
    } finally {
      setAddingTaskNote(false);
    }
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      toast.warning('Task title is required');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim() || null,
        category: formCategory,
        priority: formPriority,
        dueAt: formDueDate ? new Date(formDueDate).toISOString() : null,
        status: formStatus,
        isMIT: Boolean(formIsMIT),
        recurrenceRule: formRecurrence,
        relatedLeadId: formRelatedLeadId ? parseInt(formRelatedLeadId, 10) : null
      };

      if (editingTask) {
        const res = await api.updateTask(editingTask.id, payload);
        toast.success('Task updated successfully');
        if (res.nextOccurrence) {
          toast.info(`Recurring next occurrence created for ${new Date(res.nextOccurrence.dueAt).toLocaleDateString()}`);
        }
      } else {
        await api.createTask(payload);
        toast.success('Task created successfully');
      }

      setModalOpen(false);
      loadTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleDone = async (task) => {
    try {
      const nextStatus = task.status === 'done' ? 'todo' : 'done';
      const res = await api.updateTask(task.id, { status: nextStatus });
      toast.success(nextStatus === 'done' ? 'Task marked as completed!' : 'Task reopened');
      if (res.nextOccurrence) {
        toast.info(`Recurring next occurrence spawned for ${new Date(res.nextOccurrence.dueAt).toLocaleDateString()}`);
      }
      loadTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to update task');
    }
  };

  const handleToggleMIT = async (task) => {
    try {
      await api.updateTask(task.id, { isMIT: !task.isMIT });
      toast.success(task.isMIT ? 'Removed from Top MITs' : 'Marked as Most Important Task (MIT)!');
      loadTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to update MIT status');
    }
  };

  const handleDeleteTask = async (id) => {
    if (!window.confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.deleteTask(id);
      toast.success('Task deleted');
      loadTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to delete task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      const res = await api.updateTask(taskId, { status: newStatus });
      if (res.nextOccurrence) {
        toast.info(`Recurring occurrence spawned`);
      }
      loadTasks();
    } catch (err) {
      toast.error(err.message || 'Failed to move task');
    }
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (t.title || '').toLowerCase().includes(q);
        const matchDesc = (t.description || '').toLowerCase().includes(q);
        const matchLead = (t.lead?.businessName || '').toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchLead) return false;
      }
      return true;
    });
  }, [tasks, categoryFilter, priorityFilter, statusFilter, searchQuery]);

  const now = new Date();

  const isOverdue = (dueAt, status) => {
    if (!dueAt || status === 'done' || status === 'cancelled') return false;
    return new Date(dueAt) < now;
  };

  const formatDueDate = (dueAt) => {
    if (!dueAt) return null;
    const d = new Date(dueAt);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckSquare size={26} color="var(--gold-primary)" /> Tasks & Priority MITs
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-sm)' }}>
            Manage founder tasks across sales, production in Bhadohi, and logistics. Quick add: <kbd style={{ background: 'var(--surface-elevated)', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border-color)', color: 'var(--gold-primary)' }}>Alt + T</kbd>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ display: 'inline-flex', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: viewMode === 'list' ? 'var(--gold-primary)' : 'transparent',
                color: viewMode === 'list' ? '#090D16' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <LayoutList size={14} /> List
            </button>
            <button
              type="button"
              onClick={() => setViewMode('board')}
              style={{
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: viewMode === 'board' ? 'var(--gold-primary)' : 'transparent',
                color: viewMode === 'board' ? '#090D16' : 'var(--text-secondary)',
                fontWeight: 600,
                fontSize: 'var(--font-xs)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <Columns size={14} /> Kanban
            </button>
          </div>

          <Button variant="primary" onClick={openCreateModal} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={16} /> Add Task
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card orientation="horizontal" style={{ padding: '14px 18px', marginBottom: '20px', display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 240px', minWidth: '200px' }}>
          <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            className="input"
            placeholder="Search tasks, descriptions, or leads..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '36px', width: '100%', height: '38px', fontSize: 'var(--font-sm)' }}
          />
        </div>

        <select
          className="select"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          style={{ width: '170px', height: '38px', fontSize: 'var(--font-xs)' }}
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>

        <select
          className="select"
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          style={{ width: '150px', height: '38px', fontSize: 'var(--font-xs)' }}
        >
          {PRIORITIES.map((p) => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>

        {viewMode === 'list' && (
          <select
            className="select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: '140px', height: '38px', fontSize: 'var(--font-xs)' }}
          >
            <option value="all">All Statuses</option>
            <option value="todo">To Do</option>
            <option value="doing">In Progress</option>
            <option value="done">Completed</option>
          </select>
        )}

        <div style={{ marginLeft: 'auto', fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
          Showing <strong>{filteredTasks.length}</strong> tasks
        </div>
      </Card>

      {/* Loading State */}
      {loading && (
        <Card style={{ padding: '60px 20px', textAlign: 'center' }}>
          <Clock size={28} style={{ animation: 'spin 1.5s linear infinite', margin: '0 auto 12px', color: 'var(--gold-primary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading founder tasks...</p>
        </Card>
      )}

      {/* Empty State */}
      {!loading && filteredTasks.length === 0 && (
        <Card style={{ padding: '60px 20px', textAlign: 'center' }}>
          <CheckSquare size={40} style={{ color: 'var(--text-tertiary)', margin: '0 auto 16px' }} />
          <h3 style={{ fontSize: 'var(--font-lg)', color: 'var(--text-primary)', marginBottom: '8px' }}>
            No tasks found
          </h3>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '420px', margin: '0 auto 20px', fontSize: 'var(--font-sm)' }}>
            {searchQuery || categoryFilter !== 'all' || priorityFilter !== 'all'
              ? 'Try adjusting your filters or search keywords.'
              : 'Keep yourself organized by tracking your high-priority items and manufacturing check-ins.'}
          </p>
          <Button variant="primary" onClick={openCreateModal}>
            <Plus size={16} /> Create First Task
          </Button>
        </Card>
      )}

      {/* List View */}
      {!loading && filteredTasks.length > 0 && viewMode === 'list' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filteredTasks.map((task) => {
            const overdue = isOverdue(task.dueAt, task.status);
            const isDone = task.status === 'done';

            return (
              <Card
                key={task.id}
                style={{
                  padding: '14px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '14px',
                  borderLeft: task.isMIT
                    ? '4px solid var(--gold-primary)'
                    : overdue
                    ? '4px solid var(--danger)'
                    : '4px solid transparent',
                  background: isDone ? 'rgba(18, 26, 45, 0.4)' : 'var(--surface-color)',
                  opacity: isDone ? 0.75 : 1
                }}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => handleToggleDone(task)}
                  style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '6px',
                    border: isDone ? '2px solid var(--emerald-accent)' : '2px solid var(--border-color)',
                    background: isDone ? 'var(--emerald-accent)' : 'transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: '#fff',
                    flexShrink: 0
                  }}
                  title={isDone ? 'Mark as todo' : 'Mark as completed'}
                >
                  {isDone && <Check size={14} strokeWidth={3} />}
                </button>

                {/* MIT Star Toggle */}
                <button
                  type="button"
                  onClick={() => handleToggleMIT(task)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: task.isMIT ? 'var(--gold-primary)' : 'var(--text-tertiary)',
                    padding: '2px',
                    display: 'flex',
                    alignItems: 'center',
                    flexShrink: 0
                  }}
                  title={task.isMIT ? 'Remove MIT priority' : 'Mark as Top Priority MIT'}
                >
                  <Star size={18} fill={task.isMIT ? 'var(--gold-primary)' : 'none'} />
                </button>

                {/* Task Details */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span
                      style={{
                        fontSize: 'var(--font-sm)',
                        fontWeight: 600,
                        color: isDone ? 'var(--text-tertiary)' : 'var(--text-primary)',
                        textDecoration: isDone ? 'line-through' : 'none'
                      }}
                    >
                      {task.title}
                    </span>

                    {task.isMIT && (
                      <span style={{ fontSize: '10px', background: 'rgba(245, 158, 11, 0.15)', color: 'var(--gold-primary)', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                        ★ MIT
                      </span>
                    )}

                    {task.recurrenceRule && task.recurrenceRule !== 'none' && (
                      <span style={{ fontSize: '10px', background: 'rgba(59, 130, 246, 0.15)', color: 'var(--primary-color)', padding: '1px 6px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        <RotateCcw size={10} /> {task.recurrenceRule}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', flexWrap: 'wrap' }}>
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
                      {task.category}
                    </span>

                    {task.dueAt && (
                      <span style={{ color: overdue ? 'var(--danger)' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: overdue ? 600 : 400 }}>
                        {overdue && <AlertTriangle size={12} />}
                        Due: {formatDueDate(task.dueAt)}
                      </span>
                    )}

                    {task.lead && (
                      <span style={{ color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} /> Lead: {task.lead.businessName}
                      </span>
                    )}

                    {task.description && (
                      <span style={{ maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {task.description}
                      </span>
                    )}
                  </div>
                </div>

                {/* Priority Pill */}
                <div style={{ flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      background:
                        task.priority === 'high'
                          ? 'rgba(239, 68, 68, 0.15)'
                          : task.priority === 'low'
                          ? 'rgba(100, 116, 139, 0.15)'
                          : 'rgba(245, 158, 11, 0.15)',
                      color:
                        task.priority === 'high'
                          ? 'var(--danger)'
                          : task.priority === 'low'
                          ? 'var(--text-secondary)'
                          : 'var(--gold-primary)'
                    }}
                  >
                    {task.priority}
                  </span>
                </div>

                {/* Status Selector */}
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(task.id, e.target.value)}
                  style={{
                    height: '28px',
                    fontSize: '11px',
                    background: 'var(--surface-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    borderRadius: '4px',
                    padding: '0 6px',
                    cursor: 'pointer'
                  }}
                >
                  <option value="todo">To Do</option>
                  <option value="doing">Doing</option>
                  <option value="done">Done</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => openEditModal(task)}
                    className="btn-icon btn-ghost btn-sm"
                    title="Edit task"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(task.id)}
                    className="btn-icon btn-ghost btn-sm"
                    title="Delete task"
                    style={{ color: 'var(--danger)' }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Kanban Board View */}
      {!loading && filteredTasks.length > 0 && viewMode === 'board' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {['todo', 'doing', 'done'].map((columnStatus) => {
            const columnTasks = filteredTasks.filter((t) => t.status === columnStatus);
            const columnLabels = { todo: 'To Do', doing: 'In Progress', done: 'Completed' };
            const columnColors = { todo: 'var(--primary-color)', doing: 'var(--gold-primary)', done: 'var(--emerald-accent)' };

            return (
              <div key={columnStatus} style={{ background: 'var(--surface-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: columnColors[columnStatus] }} />
                    <h3 style={{ fontSize: 'var(--font-md)', color: 'var(--text-primary)', fontWeight: 600 }}>
                      {columnLabels[columnStatus]}
                    </h3>
                  </div>
                  <Badge variant="subtle">{columnTasks.length}</Badge>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '300px' }}>
                  {columnTasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-tertiary)', fontSize: 'var(--font-xs)' }}>
                      No tasks in this lane
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const overdue = isOverdue(task.dueAt, task.status);

                      return (
                        <Card
                          key={task.id}
                          style={{
                            padding: '12px 14px',
                            borderLeft: task.isMIT ? '4px solid var(--gold-primary)' : overdue ? '4px solid var(--danger)' : undefined,
                            background: 'var(--surface-color)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <button
                                type="button"
                                onClick={() => handleToggleMIT(task)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: task.isMIT ? 'var(--gold-primary)' : 'var(--text-tertiary)' }}
                              >
                                <Star size={14} fill={task.isMIT ? 'var(--gold-primary)' : 'none'} />
                              </button>
                              <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {task.title}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEditModal(task)}
                              className="btn-icon btn-ghost btn-xs"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              <Edit2 size={12} />
                            </button>
                          </div>

                          {task.description && (
                            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: '10px', lineHeight: 1.4 }}>
                              {task.description}
                            </p>
                          )}

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '8px' }}>
                            <span style={{ textTransform: 'capitalize' }}>{task.category}</span>
                            {task.dueAt && (
                              <span style={{ color: overdue ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: overdue ? 600 : 400 }}>
                                {formatDueDate(task.dueAt)}
                              </span>
                            )}
                          </div>

                          {/* Quick lane transition buttons */}
                          <div style={{ display: 'flex', gap: '6px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                            {columnStatus !== 'todo' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(task.id, 'todo')}
                                style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                              >
                                ← Todo
                              </button>
                            )}
                            {columnStatus !== 'doing' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(task.id, 'doing')}
                                style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '4px', color: 'var(--text-secondary)', cursor: 'pointer' }}
                              >
                                {columnStatus === 'todo' ? 'Start →' : '← In Prog'}
                              </button>
                            )}
                            {columnStatus !== 'done' && (
                              <button
                                type="button"
                                onClick={() => handleStatusChange(task.id, 'done')}
                                style={{ flex: 1, padding: '4px', fontSize: '10px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '4px', color: 'var(--emerald-accent)', cursor: 'pointer', fontWeight: 600 }}
                              >
                                Done ✓
                              </button>
                            )}
                          </div>
                        </Card>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Task Create / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingTask ? 'Edit Task' : 'Quick Add Founder Task'}
      >
        <form onSubmit={handleSaveTask} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Field label="Task Title *" required>
            <input
              type="text"
              className="input"
              placeholder="e.g. Follow up on Bhadohi hand-knotted samples shipment"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              required
              autoFocus
            />
          </Field>

          <Field label="Description / Context">
            <Textarea
              placeholder="Add key notes, specs, or tracking numbers..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              rows={3}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Category">
              <Select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              >
                <option value="sales">Sales & Outreach</option>
                <option value="marketing">Marketing</option>
                <option value="production">Production (Bhadohi)</option>
                <option value="shipping">Shipping & Logistics</option>
                <option value="accounts">Accounts & Pricing</option>
                <option value="personal">Personal / Strategic</option>
              </Select>
            </Field>

            <Field label="Priority">
              <Select
                value={formPriority}
                onChange={(e) => setFormPriority(e.target.value)}
              >
                <option value="high">High Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="low">Low Priority</option>
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Due Date & Time">
              <input
                type="datetime-local"
                className="input"
                value={formDueDate}
                onChange={(e) => setFormDueDate(e.target.value)}
              />
            </Field>

            <Field label="Recurrence">
              <Select
                value={formRecurrence}
                onChange={(e) => setFormRecurrence(e.target.value)}
              >
                {RECURRENCE_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <Field label="Status">
              <Select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value)}
              >
                <option value="todo">To Do</option>
                <option value="doing">In Progress</option>
                <option value="done">Completed</option>
                <option value="cancelled">Cancelled</option>
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

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', background: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
            <input
              type="checkbox"
              id="isMITCheckbox"
              checked={formIsMIT}
              onChange={(e) => setFormIsMIT(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
            />
            <label htmlFor="isMITCheckbox" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>
              ★ Mark as Most Important Task (MIT) for Today's Command Center
            </label>
          </div>

          {editingTask && (
            <div style={{ marginTop: '4px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FileText size={16} color="var(--gold-primary)" /> Attached Notes ({taskNotes.length})
              </div>
              {loadingTaskNotes ? (
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', padding: '6px 0' }}>Loading notes...</div>
              ) : taskNotes.length === 0 ? (
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)', marginBottom: '8px' }}>No notes attached yet to this task.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '140px', overflowY: 'auto', marginBottom: '10px' }}>
                  {taskNotes.map((n) => (
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
                  placeholder="Attach a quick progress note to this task..."
                  value={newTaskNote}
                  onChange={(e) => setNewTaskNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTaskNote();
                    }
                  }}
                  style={{ flex: 1, fontSize: 'var(--font-xs)', padding: '6px 10px' }}
                />
                <Button variant="secondary" size="sm" type="button" onClick={handleAddTaskNote} disabled={addingTaskNote || !newTaskNote.trim()}>
                  {addingTaskNote ? 'Adding...' : 'Attach Note'}
                </Button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button variant="ghost" type="button" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={saving}>
              {saving ? 'Saving...' : editingTask ? 'Update Task' : 'Create Task'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
