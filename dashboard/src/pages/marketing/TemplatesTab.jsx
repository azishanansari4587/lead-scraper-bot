import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Copy,
  Filter,
  Sparkles,
  Info,
  Mail,
  MessageSquare
} from 'lucide-react';
import { api } from '../../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, useToast } from '../../components/ui';

const BUYER_TYPES = [
  { value: 'all', label: 'All Buyer Types' },
  { value: 'general', label: 'General / Default (Fallback)' },
  { value: 'designer', label: 'Interior Designer' },
  { value: 'importer', label: 'Rug Importer / Wholesaler' },
  { value: 'hotel', label: 'Hotel & Hospitality' },
  { value: 'retailer', label: 'Showroom / Retailer' },
  { value: 'online_seller', label: 'Online Rug Seller' },
  { value: 'developer', label: 'Property Developer' },
  { value: 'investor', label: 'Commercial Investor' },
  { value: 'homeowner', label: 'Bespoke Homeowner' }
];

const STEPS = [
  { value: 'all', label: 'All Steps' },
  { value: 'day1', label: 'Day 1 (Initial Cold Outreach)' },
  { value: 'day4', label: 'Day 4 (First Follow-up)' },
  { value: 'day7', label: 'Day 7 (Breakup Follow-up)' },
  { value: 'after_reply', label: 'After Reply (Discovery)' }
];

const CHANNELS = [
  { value: 'all', label: 'All Channels' },
  { value: 'email', label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' }
];

export default function TemplatesTab() {
  const toast = useToast();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [channelFilter, setChannelFilter] = useState('all');
  const [buyerTypeFilter, setBuyerTypeFilter] = useState('all');
  const [stepFilter, setStepFilter] = useState('all');
  const [variantFilter, setVariantFilter] = useState('all');
  const [activeFilter, setActiveFilter] = useState('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    channel: 'email',
    buyerType: 'designer',
    step: 'day1',
    variant: 'B',
    subject: '',
    body: '',
    isDefault: false,
    isActive: true
  });

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getTemplates();
      setTemplates(res.templates || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load templates');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleToggleActive = async (template) => {
    try {
      await api.toggleTemplateActive(template.id);
      const newState = template.isActive !== false ? 'deactivated' : 'activated';
      toast.success(`Template ${newState}`);
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to toggle template status');
    }
  };

  const handleOpenCreate = (prefillVariant = 'B') => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      channel: channelFilter !== 'all' ? channelFilter : 'email',
      buyerType: buyerTypeFilter !== 'all' && buyerTypeFilter !== 'general' ? buyerTypeFilter : 'designer',
      step: stepFilter !== 'all' ? stepFilter : 'day1',
      variant: prefillVariant,
      subject: '',
      body: '',
      isDefault: false,
      isActive: true
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name || '',
      channel: template.channel || 'email',
      buyerType: template.buyerType || 'general',
      step: template.step || 'day1',
      variant: template.variant || 'A',
      subject: template.subject || '',
      body: template.body || '',
      isDefault: !!template.isDefault,
      isActive: template.isActive !== false
    });
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.body.trim()) {
      toast.error('Template name and message body are required');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        channel: formData.channel,
        buyerType: formData.buyerType === 'general' ? null : formData.buyerType,
        step: formData.step,
        variant: formData.variant,
        subject: formData.channel === 'email' ? formData.subject?.trim() : null,
        body: formData.body.trim(),
        isDefault: formData.isDefault,
        isActive: formData.isActive
      };

      if (editingTemplate) {
        await api.updateTemplate(editingTemplate.id, payload);
        toast.success(`Template updated successfully (Variant ${payload.variant})`);
      } else {
        await api.createTemplate(payload);
        toast.success(`New Variant ${payload.variant} template created!`);
      }

      setIsModalOpen(false);
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete template "${name}"?`)) return;
    try {
      await api.deleteTemplate(id);
      toast.success('Template deleted');
      loadTemplates();
    } catch (err) {
      toast.error(err.message || 'Failed to delete template');
    }
  };

  const filteredTemplates = templates.filter((t) => {
    if (channelFilter !== 'all' && t.channel !== channelFilter) return false;
    if (buyerTypeFilter !== 'all') {
      if (buyerTypeFilter === 'general' && t.buyerType !== null) return false;
      if (buyerTypeFilter !== 'general' && t.buyerType !== buyerTypeFilter) return false;
    }
    if (stepFilter !== 'all' && t.step !== stepFilter) return false;
    if (variantFilter !== 'all' && (t.variant || 'A') !== variantFilter) return false;
    if (activeFilter === 'active' && t.isActive === false) return false;
    if (activeFilter === 'inactive' && t.isActive !== false) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            Outreach Templates & A/B Variants
          </h2>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
            Manage copy per channel, buyer type, and cadence step. Create Variant B to benchmark subject lines & hooks.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenCreate('A')}
          >
            <Plus size={14} style={{ marginRight: '6px' }} />
            New Variant A
          </Button>
          <Button
            size="sm"
            variant="primary"
            onClick={() => handleOpenCreate('B')}
          >
            <Plus size={14} style={{ marginRight: '6px' }} />
            New Variant B
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card style={{ padding: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: 'var(--font-sm)', color: 'var(--text-muted)' }}>
            <Filter size={14} /> Filters:
          </div>

          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            {CHANNELS.map((ch) => (
              <option key={ch.value} value={ch.value}>{ch.label}</option>
            ))}
          </select>

          <select
            value={buyerTypeFilter}
            onChange={(e) => setBuyerTypeFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            {BUYER_TYPES.map((bt) => (
              <option key={bt.value} value={bt.value}>{bt.label}</option>
            ))}
          </select>

          <select
            value={stepFilter}
            onChange={(e) => setStepFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            {STEPS.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>

          <select
            value={variantFilter}
            onChange={(e) => setVariantFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            <option value="all">All Variants (A & B)</option>
            <option value="A">Variant A (Default Control)</option>
            <option value="B">Variant B (Challenger)</option>
          </select>

          <select
            value={activeFilter}
            onChange={(e) => setActiveFilter(e.target.value)}
            style={{
              padding: '6px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            <option value="all">All Statuses (Active & Inactive)</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
      </Card>

      {/* Info Callout */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 16px',
          backgroundColor: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--font-sm)',
          color: 'var(--text-secondary)'
        }}
      >
        <Info size={16} style={{ color: 'var(--gold-accent)', flexShrink: 0 }} />
        <span>
          <strong>Honest Attribution Guard:</strong> If a lead is deterministically assigned Variant B but no Variant B template exists for that buyer type and step, the dispatcher automatically falls back to Variant A copy and records the send as <strong>Variant A</strong> so metrics stay honest.
        </span>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          Loading templates...
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card style={{ padding: '48px', textAlign: 'center' }}>
          <FileText size={36} style={{ color: 'var(--text-muted)', margin: '0 auto 12px auto' }} />
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)' }}>
            No templates found matching current filters
          </h3>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Create a Variant B challenger template to test different hooks against Variant A.
          </p>
          <Button size="sm" variant="primary" onClick={() => handleOpenCreate('B')}>
            Create Variant B Template
          </Button>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
          {filteredTemplates.map((template) => {
            const isVarB = (template.variant || 'A') === 'B';
            return (
              <Card
                key={template.id}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  borderTop: isVarB ? '3px solid var(--purple-accent, #8b5cf6)' : '3px solid var(--gold-accent)',
                  padding: '16px',
                  gap: '14px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '8px' }}>
                    <div>
                      <h4 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
                        {template.name}
                      </h4>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '6px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            backgroundColor: isVarB ? 'rgba(139, 92, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)',
                            color: isVarB ? '#c084fc' : 'var(--gold-accent)'
                          }}
                        >
                          Variant {template.variant || 'A'}
                        </span>
                        <Badge size="xs" variant="outline">
                          {template.channel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                        </Badge>
                        <Badge size="xs" variant="subtle">
                          {template.step || 'day1'}
                        </Badge>
                        {template.buyerType && (
                          <Badge size="xs" variant="primary">
                            {template.buyerType}
                          </Badge>
                        )}
                        {template.isDefault && (
                          <Badge size="xs" variant="success">Default</Badge>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggleActive(template)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: 0
                          }}
                          title={template.isActive !== false ? 'Click to deactivate' : 'Click to activate'}
                        >
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 8px',
                              borderRadius: '12px',
                              backgroundColor: template.isActive !== false ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.2)',
                              color: template.isActive !== false ? '#22c55e' : 'var(--text-muted)',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <span style={{ fontSize: '8px' }}>●</span>
                            {template.isActive !== false ? 'Active' : 'Inactive'}
                          </span>
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        onClick={() => handleOpenEdit(template)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Edit Template"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id, template.name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          padding: '4px'
                        }}
                        title="Delete Template"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  {template.subject && (
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: '8px', wordBreak: 'break-word' }}>
                      <strong>Subject:</strong> {template.subject}
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 'var(--font-xs)',
                      color: 'var(--text-muted)',
                      backgroundColor: 'var(--surface-subtle)',
                      padding: '10px',
                      borderRadius: 'var(--radius-sm)',
                      whiteSpace: 'pre-wrap',
                      maxHeight: '120px',
                      overflowY: 'auto',
                      lineHeight: 1.5
                    }}
                  >
                    {template.body}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                  <span>Variables: {'{businessName}'}, {'{city}'}</span>
                  <Button size="xs" variant="ghost" onClick={() => handleOpenEdit(template)}>
                    Edit Copy
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Template Modal */}
      {isModalOpen && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingTemplate ? `Edit Template: ${editingTemplate.name}` : `New ${formData.variant} Template`}
          size="lg"
        >
          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Field label="Template Name *" required>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Interior Designers Day 1 - Angle B (Direct Pricing)"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-sm)'
                }}
                required
              />
            </Field>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              <Field label="Variant *">
                <select
                  value={formData.variant}
                  onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-sm)',
                    fontWeight: 600
                  }}
                >
                  <option value="A">Variant A (Control / Standard)</option>
                  <option value="B">Variant B (Challenger / Test)</option>
                </select>
              </Field>

              <Field label="Channel *">
                <select
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-sm)'
                  }}
                >
                  <option value="email">Email</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </Field>

              <Field label="Buyer Type Target">
                <select
                  value={formData.buyerType}
                  onChange={(e) => setFormData({ ...formData, buyerType: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-sm)'
                  }}
                >
                  {BUYER_TYPES.filter((b) => b.value !== 'all').map((b) => (
                    <option key={b.value} value={b.value}>{b.label}</option>
                  ))}
                </select>
              </Field>

              <Field label="Cadence Step">
                <select
                  value={formData.step}
                  onChange={(e) => setFormData({ ...formData, step: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-sm)'
                  }}
                >
                  {STEPS.filter((s) => s.value !== 'all').map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </Field>
            </div>

            {formData.channel === 'email' && (
              <Field label="Email Subject Line">
                <input
                  type="text"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="e.g. Handmade Rug Sourcing for {businessName} (Direct Mill Pricing)"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: 'var(--surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: 'var(--font-sm)'
                  }}
                />
              </Field>
            )}

            <Field label="Message Copy (Body) *" required>
              <Textarea
                rows={6}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Write message copy here. Available placeholders: {businessName}, {city}, {country}"
                required
              />
            </Field>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="template-active"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                />
                <label htmlFor="template-active" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}>
                  Active (eligible for outreach campaigns and A/B variant selection)
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  id="template-default"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
                />
                <label htmlFor="template-default" style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                  Set as default template for this segment and channel
                </label>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
              <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                Save Template
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
