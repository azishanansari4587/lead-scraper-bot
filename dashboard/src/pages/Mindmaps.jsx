import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Network,
  Plus,
  Sparkles,
  Upload,
  Calendar,
  Target,
  ArrowRight,
  Archive,
  Copy,
  Trash2,
  RefreshCw,
  Search,
  CheckCircle2,
  FileText
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Badge, Modal, Field, useToast, ConfirmDialog, EmptyState } from '../components/ui';

export default function Mindmaps() {
  const navigate = useNavigate();
  const toast = useToast();

  const [mindmaps, setMindmaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active'); // 'active' | 'archived'

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, title: '' });

  // Form states for creation
  const [newTitle, setNewTitle] = useState('');
  const [newGoalText, setNewGoalText] = useState('');
  const [newTargetValue, setNewTargetValue] = useState('');
  const [newTargetUnit, setNewTargetUnit] = useState('AED');
  const [newDeadline, setNewDeadline] = useState('');
  const [newLayoutPref, setNewLayoutPref] = useState('radial');
  const [isSkeleton, setIsSkeleton] = useState(false);
  const [creating, setCreating] = useState(false);

  // Import states
  const [importJsonText, setImportJsonText] = useState('');
  const [importing, setImporting] = useState(false);

  const loadMindmaps = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getMindmaps({ status: statusFilter });
      setMindmaps(res.mindmaps || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load mindmaps');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadMindmaps();
  }, [loadMindmaps]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      toast.error('Mindmap title is required');
      return;
    }

    try {
      setCreating(true);
      const res = await api.createMindmap({
        title: newTitle.trim(),
        goalText: newGoalText.trim() || null,
        targetValue: newTargetValue ? parseFloat(newTargetValue) : null,
        targetUnit: newTargetUnit.trim() || null,
        deadline: newDeadline || null,
        layoutPref: newLayoutPref,
        isSkeleton
      });

      toast.success(isSkeleton ? 'Goal mindmap created with 11 strategic tracks!' : 'Blank mindmap created!');
      setShowCreateModal(false);
      resetForm();
      navigate(`/mindmaps/${res.mindmap.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to create mindmap');
    } finally {
      setCreating(false);
    }
  };

  const handleDuplicate = async (e, id) => {
    e.stopPropagation();
    try {
      const res = await api.duplicateMindmap(id);
      toast.success('Mindmap duplicated successfully!');
      loadMindmaps();
    } catch (err) {
      toast.error(err.message || 'Failed to duplicate mindmap');
    }
  };

  const handleDelete = async () => {
    try {
      const res = await api.deleteMindmap(confirmDelete.id);
      if (res.archived) {
        toast.info(res.message);
      } else {
        toast.success('Mindmap deleted successfully');
      }
      setConfirmDelete({ open: false, id: null, title: '' });
      loadMindmaps();
    } catch (err) {
      toast.error(err.message || 'Failed to delete mindmap');
    }
  };

  const handleImport = async (e) => {
    e.preventDefault();
    try {
      setImporting(true);
      let parsed;
      try {
        parsed = JSON.parse(importJsonText);
      } catch {
        toast.error('Invalid JSON format. Please paste valid mindmap JSON.');
        setImporting(false);
        return;
      }

      const res = await api.importMindmap(parsed, false);
      toast.success('Mindmap imported successfully!');
      setShowImportModal(false);
      setImportJsonText('');
      navigate(`/mindmaps/${res.mindmap.id}`);
    } catch (err) {
      toast.error(err.message || 'Failed to import mindmap');
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setNewTitle('');
    setNewGoalText('');
    setNewTargetValue('');
    setNewTargetUnit('AED');
    setNewDeadline('');
    setNewLayoutPref('radial');
    setIsSkeleton(false);
  };

  const filteredMindmaps = mindmaps.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(q) ||
      (m.goalText && m.goalText.toLowerCase().includes(q))
    );
  });

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1600px', margin: '0 auto' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.08))',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--gold-primary)'
              }}
            >
              <Network size={20} />
            </div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>
              Goal Mindmap Studio
            </h1>
            <Badge variant="warning">Custom Strategy Engine</Badge>
          </div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '14px' }}>
            Plan your business goals yourself. Break objectives down into actionable tracks and execute them directly through your Command Center.
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetForm();
              setIsSkeleton(true);
              setNewTitle('Knotiq Rugs Growth Plan');
              setShowCreateModal(true);
            }}
          >
            <Sparkles size={14} style={{ marginRight: '6px', color: 'var(--gold-primary)' }} />
            Start from Skeleton (11 Tracks)
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
          >
            <Upload size={14} style={{ marginRight: '6px' }} />
            Import JSON
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetForm();
              setIsSkeleton(false);
              setShowCreateModal(true);
            }}
          >
            <Plus size={14} style={{ marginRight: '6px' }} />
            Start Blank Map
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '8px', padding: '3px' }}>
            <button
              onClick={() => setStatusFilter('active')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: statusFilter === 'active' ? 'var(--gold-primary)' : 'transparent',
                color: statusFilter === 'active' ? '#090D16' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Active Mindmaps
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                background: statusFilter === 'archived' ? 'var(--gold-primary)' : 'transparent',
                color: statusFilter === 'archived' ? '#090D16' : 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              Archived
            </button>
          </div>

          <button
            onClick={loadMindmaps}
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              padding: '8px',
              color: 'var(--text-dim)',
              cursor: 'pointer'
            }}
            title="Refresh mindmaps"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
          <input
            type="text"
            placeholder="Search mindmaps or goals..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '8px',
              color: 'var(--text-main)',
              fontSize: '13px'
            }}
          />
        </div>
      </div>

      {/* Mindmaps Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ height: '200px', background: 'var(--bg-surface)', borderRadius: '14px', border: '1px solid var(--border-subtle)' }} />
          ))}
        </div>
      ) : filteredMindmaps.length === 0 ? (
        <EmptyState
          icon={Network}
          title={statusFilter === 'archived' ? 'No archived mindmaps' : 'No mindmaps created yet'}
          description={
            statusFilter === 'archived'
              ? 'Archived mindmaps will appear here.'
              : 'Start by creating your first business goal mindmap from scratch or use the 11-track strategy skeleton.'
          }
          actionLabel="Start from Skeleton"
          onAction={() => {
            resetForm();
            setIsSkeleton(true);
            setNewTitle('Knotiq Rugs Growth Engine');
            setShowCreateModal(true);
          }}
        />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
          {filteredMindmaps.map((m) => (
            <div
              key={m.id}
              onClick={() => navigate(`/mindmaps/${m.id}`)}
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '14px',
                padding: '20px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'all 0.2s ease',
                boxShadow: 'var(--shadow-card)',
                position: 'relative'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-subtle)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <div>
                {/* Header & Badges */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '10px' }}>
                  <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-heading)', fontFamily: 'Outfit, sans-serif' }}>
                    {m.title}
                  </h3>
                  <Badge variant={m.layoutPref === 'radial' ? 'warning' : 'outline'} style={{ fontSize: '10px', textTransform: 'capitalize' }}>
                    {m.layoutPref} layout
                  </Badge>
                </div>

                {/* Goal description */}
                {m.goalText ? (
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                    {m.goalText}
                  </p>
                ) : (
                  <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--text-dim)', fontStyle: 'italic' }}>
                    No goal narrative set yet.
                  </p>
                )}

                {/* Key Metrics / Targets */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', marginBottom: '16px' }}>
                  {m.targetValue && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--gold-primary)', fontWeight: 600 }}>
                      <Target size={14} />
                      {m.targetValue} {m.targetUnit || ''}
                    </div>
                  )}
                  {m.deadline && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: 'var(--text-dim)' }}>
                      <Calendar size={13} />
                      {new Date(m.deadline).toISOString().slice(0, 10)}
                    </div>
                  )}
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)', marginBottom: '5px' }}>
                    <span>Progress: {m.doneCount || 0} of {m.leafCount || 0} actions complete</span>
                    <span style={{ color: 'var(--success-text)', fontWeight: 600 }}>{m.progressPct || 0}%</span>
                  </div>
                  <div style={{ width: '100%', height: '6px', background: 'rgba(255, 255, 255, 0.08)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${m.progressPct || 0}%`,
                        height: '100%',
                        background: 'linear-gradient(90deg, #F59E0B, #10B981)',
                        borderRadius: '999px'
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Card Footer with actions */}
              <div
                style={{
                  paddingTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    onClick={(e) => handleDuplicate(e, m.id)}
                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', padding: '4px' }}
                    title="Duplicate mindmap"
                  >
                    <Copy size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete({ open: true, id: m.id, title: m.title });
                    }}
                    style={{ background: 'none', border: 'none', color: 'var(--danger-text)', cursor: 'pointer', padding: '4px' }}
                    title="Archive / Delete mindmap"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  Open Studio <ArrowRight size={13} />
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Mindmap Modal */}
      {showCreateModal && (
        <Modal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          title={isSkeleton ? 'Start Strategy Mindmap (11 Tracks)' : 'Create Blank Mindmap'}
        >
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Mindmap Title" required>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Knotiq Rugs 2027 Revenue Roadmap"
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '13px'
                }}
                required
              />
            </Field>

            <Field label="Goal Narrative (Central Target)">
              <textarea
                value={newGoalText}
                onChange={(e) => setNewGoalText(e.target.value)}
                placeholder="Describe the ultimate outcome in 1-2 sentences..."
                rows={2}
                style={{
                  width: '100%',
                  padding: '9px 12px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  color: 'var(--text-main)',
                  fontSize: '13px'
                }}
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Target Number">
                <input
                  type="number"
                  step="any"
                  value={newTargetValue}
                  onChange={(e) => setNewTargetValue(e.target.value)}
                  placeholder="e.g. 100000"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                />
              </Field>

              <Field label="Target Unit">
                <input
                  type="text"
                  value={newTargetUnit}
                  onChange={(e) => setNewTargetUnit(e.target.value)}
                  placeholder="AED / Orders / Clients"
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                />
              </Field>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Field label="Target Deadline">
                <input
                  type="date"
                  value={newDeadline}
                  onChange={(e) => setNewDeadline(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                />
              </Field>

              <Field label="Initial Layout">
                <select
                  value={newLayoutPref}
                  onChange={(e) => setNewLayoutPref(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '8px',
                    color: 'var(--text-main)',
                    fontSize: '13px'
                  }}
                >
                  <option value="radial">Radial Tree Layout</option>
                  <option value="horizontal">Horizontal Tidy Tree</option>
                  <option value="vertical">Vertical List Layout</option>
                </select>
              </Field>
            </div>

            {isSkeleton && (
              <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: '8px', fontSize: '12px', color: 'var(--gold-primary)' }}>
                ✨ <strong>Strategy Skeleton:</strong> Pre-populates 11 blank top-level branch titles (Sales pipeline, Lead generation, Outreach & calls, Marketing, Google & SEO, Samples, Production, Shipping, Finance, Systems, Risks) with zero pre-written advice or fake numbers.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button variant="ghost" onClick={() => setShowCreateModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={creating}>
                Create & Open Studio
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Import JSON Modal */}
      {showImportModal && (
        <Modal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          title="Import Goal Mindmap JSON"
        >
          <form onSubmit={handleImport} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>
              Paste your exported Mindmap JSON below. All IDs will be regenerated, external links cleared, and content sanitized against HTML/XSS.
            </p>

            <textarea
              value={importJsonText}
              onChange={(e) => setImportJsonText(e.target.value)}
              placeholder="Paste mindmap JSON here..."
              rows={10}
              style={{
                width: '100%',
                padding: '10px 12px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                color: 'var(--text-main)',
                fontFamily: 'monospace',
                fontSize: '12px'
              }}
              required
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
              <Button variant="ghost" onClick={() => setShowImportModal(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" loading={importing}>
                Validate & Import
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Archive/Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmDelete.open}
        title="Archive or Delete Mindmap"
        message={`Are you sure you want to delete or archive "${confirmDelete.title}"? If it has linked tasks in the Command Center, it will be safely archived to preserve your task history.`}
        confirmText="Confirm"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ open: false, id: null, title: '' })}
      />
    </div>
  );
}
