import React, { useState, useEffect, useMemo } from 'react';
import {
  FileText,
  Search,
  Plus,
  Pin,
  PinOff,
  Trash2,
  Tag as TagIcon,
  Clock,
  Edit2,
  Eye,
  Check,
  X,
  Building2,
  Sparkles
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, EmptyState, useToast } from '../components/ui';

export default function Notes() {
  const toast = useToast();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [ownerTypeFilter, setOwnerTypeFilter] = useState('');
  const [allTags, setAllTags] = useState([]);

  // Create / Edit Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formBody, setFormBody] = useState('');
  const [formOwnerType, setFormOwnerType] = useState('general');
  const [formOwnerId, setFormOwnerId] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formPinned, setFormPinned] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // Leads for owner selector
  const [leadsList, setLeadsList] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadNotes();
    loadTags();
    api.getLeads({ limit: 50 }).then((res) => setLeadsList(res.leads || [])).catch(() => {});
  }, [debouncedSearch, selectedTag, ownerTypeFilter]);

  const loadNotes = async () => {
    try {
      setLoading(true);
      const res = await api.getNotes({
        search: debouncedSearch.trim() || undefined,
        tag: selectedTag || undefined,
        ownerType: ownerTypeFilter || undefined,
        limit: 100
      });
      setNotes(res.notes || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const loadTags = async () => {
    try {
      const res = await api.getNoteTags();
      setAllTags(res.tags || []);
    } catch (_) {}
  };

  const handleOpenAdd = () => {
    setEditingNote(null);
    setFormTitle('');
    setFormBody('');
    setFormOwnerType('general');
    setFormOwnerId('');
    setFormTags('');
    setFormPinned(false);
    setPreviewMode(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (note) => {
    setEditingNote(note);
    setFormTitle(note.title || '');
    setFormBody(note.body || '');
    setFormOwnerType(note.ownerType || 'general');
    setFormOwnerId(note.ownerId || '');
    setFormTags((note.tags || []).join(', '));
    setFormPinned(Boolean(note.pinned));
    setPreviewMode(false);
    setModalOpen(true);
  };

  const handleSaveNote = async (e) => {
    e.preventDefault();
    if (!formBody.trim()) {
      toast.warning('Note content body is required.');
      return;
    }

    setSavingNote(true);
    try {
      const parsedTags = formTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const payload = {
        title: formTitle.trim() || undefined,
        body: formBody.trim(),
        ownerType: formOwnerType,
        ownerId: formOwnerType === 'lead' ? (formOwnerId ? parseInt(formOwnerId, 10) : null) : null,
        tags: parsedTags,
        pinned: formPinned
      };

      if (editingNote) {
        await api.updateNote(editingNote.id, payload);
        toast.success('Note updated successfully.');
      } else {
        await api.createNote(payload);
        toast.success('Note saved to notebook.');
      }

      setModalOpen(false);
      loadNotes();
      loadTags();
    } catch (err) {
      toast.error(`Failed to save note: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  const handleTogglePin = async (note, e) => {
    e.stopPropagation();
    try {
      await api.toggleNotePinned(note.id);
      toast.success(note.pinned ? 'Note unpinned.' : 'Note pinned to top!');
      loadNotes();
    } catch (err) {
      toast.error(`Could not toggle pin: ${err.message}`);
    }
  };

  const handleDelete = async (noteId, e) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this note?')) return;
    try {
      await api.deleteNote(noteId);
      toast.success('Note deleted.');
      loadNotes();
      loadTags();
    } catch (err) {
      toast.error(`Failed to delete note: ${err.message}`);
    }
  };

  const pinnedNotes = useMemo(() => notes.filter((n) => n.pinned), [notes]);
  const regularNotes = useMemo(() => notes.filter((n) => !n.pinned), [notes]);

  const renderNoteCard = (note) => {
    const isPinned = Boolean(note.pinned);
    return (
      <Card
        key={note.id}
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderColor: isPinned ? 'var(--gold-primary)' : 'var(--border-subtle)',
          background: isPinned ? 'rgba(245, 158, 11, 0.03)' : 'var(--bg-surface)',
          position: 'relative',
          minHeight: '180px'
        }}
      >
        <div>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {note.title && (
                <h4 style={{ margin: 0, fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--text-heading)' }}>
                  {note.title}
                </h4>
              )}
              {note.ownerType !== 'general' && (
                <Badge variant="outline" style={{ fontSize: '10px', textTransform: 'uppercase' }}>
                  {note.ownerType} {note.ownerId ? `#${note.ownerId}` : ''}
                </Badge>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button
                type="button"
                className="btn-icon btn-ghost btn-sm"
                onClick={(e) => handleTogglePin(note, e)}
                title={isPinned ? 'Unpin note' : 'Pin to top'}
                style={{ color: isPinned ? 'var(--gold-primary)' : 'var(--text-dim)' }}
              >
                {isPinned ? <Pin size={14} fill="var(--gold-primary)" /> : <Pin size={14} />}
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost btn-sm"
                onClick={() => handleOpenEdit(note)}
                title="Edit note"
              >
                <Edit2 size={13} />
              </button>
              <button
                type="button"
                className="btn-icon btn-ghost btn-sm"
                onClick={(e) => handleDelete(note.id, e)}
                title="Delete note"
                style={{ color: 'var(--danger-text)' }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              fontSize: 'var(--font-xs)',
              color: 'var(--text-main)',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              marginBottom: '12px'
            }}
          >
            {note.body}
          </div>
        </div>

        {/* Footer */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '8px', marginTop: 'auto' }}>
          {note.tags && note.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' }}>
              {note.tags.map((t) => (
                <span
                  key={t}
                  onClick={() => setSelectedTag(t)}
                  style={{
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: 'var(--bg-app)',
                    color: 'var(--gold-primary)',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '2px'
                  }}
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          <div style={{ fontSize: '10px', color: 'var(--text-dim)', display: 'flex', justifyContent: 'space-between' }}>
            <span>{new Date(note.updatedAt || note.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="page-content">
      {/* Top Header Card */}
      <Card>
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <FileText size={20} color="var(--gold-primary)" aria-hidden="true" />
              Founder Notebook
            </h2>
            <p className="page-subtitle">
              Quick meeting takeaways, custom rug specs, buyer requirements, and strategy logs.
            </p>
          </div>

          <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
            Add Note (Alt+N)
          </Button>
        </div>

        {/* Search & Tag Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <Field id="note-search">
              <input
                id="note-search"
                type="search"
                className="input"
                placeholder="Search notes by keyword or title..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
          </div>

          <div style={{ width: '160px' }}>
            <Select
              value={ownerTypeFilter}
              onChange={(e) => setOwnerTypeFilter(e.target.value)}
              aria-label="Filter by owner type"
            >
              <option value="">All Contexts</option>
              <option value="general">General</option>
              <option value="lead">Lead Specific</option>
              <option value="call">Call Related</option>
              <option value="task">Tasks</option>
              <option value="campaign">Campaigns</option>
            </Select>
          </div>

          {selectedTag && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="filter-chip">
                #{selectedTag}
                <button type="button" className="filter-chip-remove" onClick={() => setSelectedTag('')}>
                  <X size={12} />
                </button>
              </span>
            </div>
          )}
        </div>

        {/* Tags bar */}
        {allTags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', fontWeight: 600 }}>Quick Tags:</span>
            {allTags.slice(0, 15).map((t) => (
              <button
                key={t}
                type="button"
                className={`btn btn-sm ${selectedTag === t ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '11px', padding: '2px 8px' }}
                onClick={() => setSelectedTag(selectedTag === t ? '' : t)}
              >
                #{t}
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Pinned Notes Section */}
      {pinnedNotes.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <Pin size={16} color="var(--gold-primary)" />
            <h3 style={{ margin: 0, fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-heading)' }}>
              Pinned Notes ({pinnedNotes.length})
            </h3>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {pinnedNotes.map(renderNoteCard)}
          </div>
        </div>
      )}

      {/* All Notes Grid */}
      <div>
        <h3 style={{ margin: '0 0 12px 0', fontSize: 'var(--font-md)', fontWeight: 700, color: 'var(--text-heading)' }}>
          {pinnedNotes.length > 0 ? `Other Notes (${regularNotes.length})` : `All Notes (${notes.length})`}
        </h3>

        {loading ? (
          <Card style={{ padding: '30px', textAlign: 'center', color: 'var(--text-dim)' }}>
            Loading notes...
          </Card>
        ) : notes.length === 0 ? (
          <Card>
            <EmptyState
              title="No notes found"
              description={search || selectedTag ? "Try adjusting your search or tag filters." : "Start keeping quick notes, meeting minutes, and buyer specs."}
              action={
                <Button variant="primary" icon={Plus} onClick={handleOpenAdd}>
                  Create First Note
                </Button>
              }
            />
          </Card>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
            {regularNotes.map(renderNoteCard)}
          </div>
        )}
      </div>

      {/* Add / Edit Note Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingNote ? 'Edit Note' : 'Create New Note'}
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingNote} onClick={handleSaveNote}>
              {editingNote ? 'Update Note' : 'Save Note'}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Note Title (Optional)" id="note-form-title">
            <input
              id="note-form-title"
              className="input"
              placeholder="e.g. Dubai Marina Villa Project - 9x12 Wool Rug Specs"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Context / Owner Type" id="note-form-owner-type">
              <Select
                id="note-form-owner-type"
                value={formOwnerType}
                onChange={(e) => setFormOwnerType(e.target.value)}
              >
                <option value="general">General Business Note</option>
                <option value="lead">Associated with Lead</option>
                <option value="call">Call Interaction</option>
                <option value="task">Action Item / Task</option>
                <option value="campaign">Outreach Campaign</option>
              </Select>
            </Field>

            {formOwnerType === 'lead' ? (
              <Field label="Select Target Lead" id="note-form-lead">
                <Select
                  id="note-form-lead"
                  value={formOwnerId}
                  onChange={(e) => setFormOwnerId(e.target.value)}
                >
                  <option value="">-- Choose Lead --</option>
                  {leadsList.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.businessName} ({l.city})
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <Field label="Tags (Comma separated)" id="note-form-tags">
                <input
                  id="note-form-tags"
                  className="input"
                  placeholder="e.g. pricing, dubai, wool, sample"
                  value={formTags}
                  onChange={(e) => setFormTags(e.target.value)}
                />
              </Field>
            )}
          </div>

          {formOwnerType === 'lead' && (
            <Field label="Tags (Comma separated)" id="note-form-tags-extra">
              <input
                id="note-form-tags-extra"
                className="input"
                placeholder="e.g. pricing, dubai, wool, sample"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
            </Field>
          )}

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-main)' }}>
                Note Body (Markdown supported) *
              </label>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPreviewMode(!previewMode)}
                style={{ fontSize: '11px', padding: '2px 8px' }}
              >
                {previewMode ? <Edit2 size={12} /> : <Eye size={12} />}
                <span style={{ marginLeft: '4px' }}>{previewMode ? 'Edit' : 'Preview'}</span>
              </button>
            </div>

            {previewMode ? (
              <div
                style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  minHeight: '140px',
                  fontSize: 'var(--font-xs)',
                  whiteSpace: 'pre-wrap',
                  color: 'var(--text-main)'
                }}
              >
                {formBody || '<Empty note>'}
              </div>
            ) : (
              <Textarea
                id="note-form-body"
                rows={6}
                placeholder="Type note content here... Supports bullet points, specs, and markdown."
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                required
              />
            )}
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: 'var(--font-xs)', color: 'var(--text-main)' }}>
            <input
              type="checkbox"
              checked={formPinned}
              onChange={(e) => setFormPinned(e.target.checked)}
              style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
            />
            <span>Pin this note to the top of the notebook</span>
          </label>
        </form>
      </Modal>
    </div>
  );
}
