import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Trash2,
  Download,
  ExternalLink,
  Phone,
  Mail,
  Send,
  Sparkles,
  MapPin,
  Star,
  X,
  Check,
  Copy,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  Paperclip,
  FileText,
  CheckCircle2,
  Upload
} from 'lucide-react';
import { api } from '../api';

const LEAD_CATEGORIES = [
  { value: 'rug_retailer', label: 'Rug / Carpet Retailer & Showroom' },
  { value: 'rug_wholesaler', label: 'Rug & Flooring Importer / Wholesaler' },
  { value: 'interior_designer', label: 'Interior Designer / Studio' },
  { value: 'interior_contractor', label: 'Fit-out / Interior Contractor' },
  { value: 'architect', label: 'Architect / Interior Architecture Firm' },
  { value: 'home_decor', label: 'Luxury Home Decor & Furniture Store' },
  { value: 'hospitality', label: 'Hospitality & Contract Furniture Buyer' },
  { value: 'other', label: 'Other B2B Buyer' }
];

export default function Leads({ onExportRequested }) {
  const [leads, setLeads] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [leadType, setLeadType] = useState('');
  const [country, setCountry] = useState('');
  const [status, setStatus] = useState('');
  const [minScore, setMinScore] = useState('');
  const [sellsRugsOnly, setSellsRugsOnly] = useState(false);

  // Selection
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Manual Lead Creation Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [newLead, setNewLead] = useState({
    businessName: '',
    leadType: 'rug_retailer',
    country: 'UAE',
    city: 'Dubai',
    state: '',
    address: '',
    phone: '',
    whatsapp: '',
    email: '',
    website: '',
    sellsRugsSignal: true,
    notes: ''
  });

  // Drawer
  const [selectedLead, setSelectedLead] = useState(null);
  const [drawerNotes, setDrawerNotes] = useState('');
  const [drawerStatus, setDrawerStatus] = useState('new');
  const [outreachDraft, setOutreachDraft] = useState(null);
  const [generatingDraft, setGeneratingDraft] = useState(false);
  const [copiedDraft, setCopiedDraft] = useState(false);

  // Direct send in drawer
  const [drawerSubject, setDrawerSubject] = useState('');
  const [drawerBody, setDrawerBody] = useState('');
  const [drawerAttachments, setDrawerAttachments] = useState([]);
  const [uploadingDrawerAtt, setUploadingDrawerAtt] = useState(false);
  const [sendingOutreach, setSendingOutreach] = useState(false);
  const [sendSuccessMsg, setSendSuccessMsg] = useState('');

  useEffect(() => {
    loadLeads();
  }, [page, leadType, country, status, minScore, sellsRugsOnly]);

  async function loadLeads() {
    try {
      setLoading(true);
      const res = await api.getLeads({
        page,
        limit: 15,
        search: search.trim() || undefined,
        leadType: leadType || undefined,
        country: country || undefined,
        status: status || undefined,
        minScore: minScore || undefined,
        sellsRugsSignal: sellsRugsOnly ? 'true' : undefined
      });
      setLeads(res.leads || []);
      setTotal(res.total || 0);
    } catch (err) {
      console.error('Failed to load leads', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    setPage(1);
    loadLeads();
  }

  function handleSelectAll(e) {
    if (e.target.checked) {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    } else {
      setSelectedIds(new Set());
    }
  }

  function handleSelectOne(id) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected leads?`)) return;

    try {
      await api.bulkDeleteLeads(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadLeads();
    } catch (err) {
      alert(`Bulk delete failed: ${err.message}`);
    }
  }

  async function handleBulkStatus(newStatus) {
    if (selectedIds.size === 0) return;
    try {
      await api.bulkUpdateLeadStatus(Array.from(selectedIds), newStatus);
      setSelectedIds(new Set());
      loadLeads();
    } catch (err) {
      alert(`Bulk status update failed: ${err.message}`);
    }
  }

  async function handleCreateLead(e) {
    e.preventDefault();
    if (!newLead.businessName.trim() || !newLead.country.trim() || !newLead.city.trim()) {
      alert('Business Name, Country, aur City required hain.');
      return;
    }

    try {
      setSubmittingLead(true);
      const res = await api.createLead(newLead);
      if (res.lead) {
        setShowAddModal(false);
        setNewLead({
          businessName: '',
          leadType: 'rug_retailer',
          country: 'UAE',
          city: 'Dubai',
          state: '',
          address: '',
          phone: '',
          whatsapp: '',
          email: '',
          website: '',
          sellsRugsSignal: true,
          notes: ''
        });
        loadLeads();
        alert(`Lead "${res.lead.businessName}" successfully add ho gayi! Score: ${res.lead.score}/100`);
      }
    } catch (err) {
      alert(`Lead add karne me error: ${err.message}`);
    } finally {
      setSubmittingLead(false);
    }
  }

  function openLeadDrawer(lead) {
    setSelectedLead(lead);
    setDrawerNotes(lead.notes || '');
    setDrawerStatus(lead.status || 'new');
    setOutreachDraft(null);
    setCopiedDraft(false);
    setDrawerSubject(`Trade Partnership: Bespoke Handmade Rugs for ${lead.businessName}`);
    setDrawerBody(`Hello ${lead.businessName} Team,\n\nWe love your projects at ${lead.businessName}. At Knotiq Rugs, we are direct manufacturers of artisan hand-knotted and hand-tufted rugs in India.\n\nAttached is our digital trade catalogue and product collection for your upcoming interior projects.\n\nWarm regards,\nExport Team | Knotiq Rugs`);
    setDrawerAttachments([]);
    setSendSuccessMsg('');
  }

  async function saveLeadChanges() {
    if (!selectedLead) return;
    try {
      const updated = await api.updateLead(selectedLead.id, {
        notes: drawerNotes,
        status: drawerStatus
      });
      setSelectedLead(updated.lead);
      setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? updated.lead : l)));
      alert('Lead updated successfully!');
    } catch (err) {
      alert(`Failed to save changes: ${err.message}`);
    }
  }

  async function handleGenerateDraft(channel = 'email') {
    if (!selectedLead) return;
    setGeneratingDraft(true);
    try {
      const res = await api.generateDraft(selectedLead.id, channel);
      setOutreachDraft(res.draft);
      if (res.draft?.subject) setDrawerSubject(res.draft.subject);
      if (res.draft?.body) setDrawerBody(res.draft.body);
    } catch (err) {
      alert(`Draft generation failed: ${err.message}`);
    } finally {
      setGeneratingDraft(false);
    }
  }

  function handleCopyDraft() {
    if (!outreachDraft) return;
    const text = `Subject: ${outreachDraft.subject}\n\n${outreachDraft.body}`;
    navigator.clipboard.writeText(text);
    setCopiedDraft(true);
    setTimeout(() => setCopiedDraft(false), 2000);
  }

  async function handleDrawerAttachmentUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File size maximum 15MB ho sakti hai.');
      return;
    }

    try {
      setUploadingDrawerAtt(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.uploadAttachment(formData);
      if (res.attachment) {
        setDrawerAttachments((prev) => [...prev, res.attachment]);
      }
    } catch (err) {
      alert(`Attachment upload error: ${err.message}`);
    } finally {
      setUploadingDrawerAtt(false);
      e.target.value = '';
    }
  }

  function handleRemoveDrawerAttachment(idx) {
    setDrawerAttachments((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSendDirectOutreach(channel = 'email') {
    if (!selectedLead) return;
    if (!drawerBody.trim()) {
      alert('Message body khali nahi ho sakti.');
      return;
    }

    if (channel === 'whatsapp') {
      const rawPhone = selectedLead.whatsapp || selectedLead.phone;
      if (!rawPhone) {
        alert('Is lead ke pass WhatsApp ya Phone number nahi hai.');
        return;
      }
      const cleanPhone = rawPhone.replace(/[^0-9]/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(drawerBody)}`;
      window.open(waUrl, '_blank');

      try {
        await api.recordSent(selectedLead.id, 'whatsapp');
        setSendSuccessMsg('WhatsApp Chat opened (+971 582549695) & Lead status updated to Contacted!');
        setSelectedLead((prev) => ({ ...prev, status: 'contacted' }));
        setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? { ...l, status: 'contacted' } : l)));
      } catch (e) {
        console.error(e);
      }
      return;
    }

    setSendingOutreach(true);
    setSendSuccessMsg('');
    try {
      const res = await api.sendDirectOutreach({
        leadId: selectedLead.id,
        channel: 'email',
        subject: drawerSubject || 'Knotiq Rugs - Partnership & Catalogue',
        body: drawerBody,
        attachments: drawerAttachments
      });
      setSendSuccessMsg(res.message || 'Email dispatched via info@knotiqrugs.com successfully!');
      setSelectedLead((prev) => ({ ...prev, status: 'contacted' }));
      setLeads((prev) => prev.map((l) => (l.id === selectedLead.id ? { ...l, status: 'contacted' } : l)));
    } catch (err) {
      alert(`Send failed: ${err.message}`);
    } finally {
      setSendingOutreach(false);
    }
  }

  return (
    <div className="page-content">
      {/* Top Header & Action Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#FFF', margin: 0 }}>
            Buyer Leads & Directory
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Total {total} verified target buyers, showrooms, and designers
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowAddModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <PlusCircle size={15} /> Manually Add Lead
          </button>
          {onExportRequested && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={onExportRequested}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <form onSubmit={handleSearchSubmit} className="filter-row">
          <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
            <input
              type="text"
              className="input"
              style={{ width: '100%', paddingLeft: '36px' }}
              placeholder="Search leads by name, city, email, phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px', top: '12px' }} />
          </div>

          <select className="select" value={country} onChange={(e) => { setCountry(e.target.value); setPage(1); }}>
            <option value="">All Countries</option>
            <option value="UAE">UAE</option>
            <option value="USA">USA</option>
            <option value="United Kingdom">United Kingdom</option>
            <option value="Germany">Germany</option>
            <option value="Australia">Australia</option>
            <option value="Saudi Arabia">Saudi Arabia</option>
          </select>

          <select className="select" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="replied">Replied</option>
            <option value="won">Won (Deal Closed)</option>
            <option value="not_interested">Not Interested</option>
          </select>

          <select className="select" value={minScore} onChange={(e) => { setMinScore(e.target.value); setPage(1); }}>
            <option value="">Any Fit Score</option>
            <option value="70">≥ 70 (High Fit)</option>
            <option value="50">≥ 50 (Moderate)</option>
            <option value="80">≥ 80 (Prime Target)</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={sellsRugsOnly}
              onChange={(e) => { setSellsRugsOnly(e.target.checked); setPage(1); }}
              style={{ accentColor: 'var(--gold-primary)' }}
            />
            Rugs Signal Verified
          </label>

          <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
        </form>

        {/* Bulk Action Bar */}
        {selectedIds.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface-elevated)', padding: '8px 14px', borderRadius: 'var(--radius-md)', marginTop: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--gold-primary)' }}>
              {selectedIds.size} leads selected
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => handleBulkStatus('contacted')}>Mark Contacted</button>
              <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}><Trash2 size={14} /> Delete</button>
            </div>
          </div>
        )}
      </div>

      {/* Leads Table Card */}
      <div className="card" style={{ padding: 0 }}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '36px' }}>
                  <input
                    type="checkbox"
                    checked={leads.length > 0 && selectedIds.size === leads.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th>Business Name</th>
                <th>Category</th>
                <th>Location</th>
                <th>Score</th>
                <th>Contacts</th>
                <th>Status</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    Loading qualified leads...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                    No leads found matching current filters.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const isSelected = selectedIds.has(lead.id);
                  const score = lead.score || 0;
                  const scoreClass = score >= 70 ? 'badge-score-high' : score >= 40 ? 'badge-score-med' : 'badge-score-low';

                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLeadDrawer(lead)}
                      style={{ cursor: 'pointer', background: isSelected ? 'rgba(217, 119, 6, 0.05)' : undefined }}
                    >
                      <td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectOne(lead.id)}
                        />
                      </td>

                      <td>
                        <div style={{ fontWeight: 600, color: '#FFF' }}>{lead.businessName}</div>
                        {lead.sellsRugsSignal && (
                          <span style={{ fontSize: '11px', color: 'var(--gold-primary)', display: 'inline-flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                            <Star size={10} fill="var(--gold-primary)" /> Rugs Confirmed
                          </span>
                        )}
                      </td>

                      <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {lead.leadType?.replace(/_/g, ' ')}
                      </td>

                      <td style={{ fontSize: '12px' }}>
                        <div>{lead.city || '—'}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{lead.country}</div>
                      </td>

                      <td>
                        <span className={`badge ${scoreClass}`}>{score}</span>
                      </td>

                      <td>
                        <div style={{ display: 'flex', gap: '8px', color: 'var(--text-muted)' }}>
                          {lead.email && <Mail size={14} color="var(--emerald)" title={lead.email} />}
                          {lead.phone && <Phone size={14} color="var(--sky)" title={lead.phone} />}
                          {lead.website && <ExternalLink size={14} color="var(--gold-primary)" title={lead.website} />}
                        </div>
                      </td>

                      <td>
                        <span className="badge badge-score-med" style={{ textTransform: 'capitalize' }}>
                          {lead.status || 'new'}
                        </span>
                      </td>

                      <td style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                        {lead.source || 'Scraper'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Showing {leads.length} of {total} leads (Page {page} of {Math.max(1, Math.ceil(total / 15))})
          </span>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              className="btn btn-secondary btn-sm"
              disabled={page * 15 >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Manual Insert Lead Modal */}
      {showAddModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '600px',
              maxHeight: '90vh',
              overflowY: 'auto',
              background: 'var(--bg-surface-elevated)',
              border: '1px solid var(--border-color, #334155)',
              borderRadius: '12px',
              padding: '24px'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#FFF', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <PlusCircle size={18} color="var(--gold-primary)" /> Manually Insert Buyer Lead
                </h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '4px 0 0' }}>
                  Add offline client, trade fair contact, or direct inquiry. Lead score is auto-calculated.
                </p>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setShowAddModal(false)}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateLead} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Business / Company Name *
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="e.g. Al Maktoum Luxury Interiors LLC"
                  value={newLead.businessName}
                  onChange={(e) => setNewLead({ ...newLead, businessName: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Buyer Category *
                  </label>
                  <select
                    className="select"
                    style={{ width: '100%' }}
                    value={newLead.leadType}
                    onChange={(e) => setNewLead({ ...newLead, leadType: e.target.value })}
                  >
                    {LEAD_CATEGORIES.map((cat) => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Country *
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="UAE, USA, Germany..."
                    value={newLead.country}
                    onChange={(e) => setNewLead({ ...newLead, country: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    City *
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="Dubai, Abu Dhabi, London..."
                    value={newLead.city}
                    onChange={(e) => setNewLead({ ...newLead, city: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    State / Region (Optional)
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="Dubai Emirate, California..."
                    value={newLead.state}
                    onChange={(e) => setNewLead({ ...newLead, state: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Phone / Mobile
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="+971 50 123 4567"
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    WhatsApp Number
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="+971 50 123 4567"
                    value={newLead.whatsapp}
                    onChange={(e) => setNewLead({ ...newLead, whatsapp: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="buyer@interiorstudio.com"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Website URL
                  </label>
                  <input
                    type="text"
                    className="input"
                    style={{ width: '100%' }}
                    placeholder="https://interiorstudio.ae"
                    value={newLead.website}
                    onChange={(e) => setNewLead({ ...newLead, website: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Full Street Address / Showroom Location
                </label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%' }}
                  placeholder="Al Quoz Industrial Area 1, Sheikh Zayed Road, Dubai"
                  value={newLead.address}
                  onChange={(e) => setNewLead({ ...newLead, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0' }}>
                <input
                  type="checkbox"
                  id="sellsRugs"
                  style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)', cursor: 'pointer' }}
                  checked={newLead.sellsRugsSignal}
                  onChange={(e) => setNewLead({ ...newLead, sellsRugsSignal: e.target.checked })}
                />
                <label htmlFor="sellsRugs" style={{ fontSize: '13px', color: '#FFF', cursor: 'pointer' }}>
                  High Intent Signal (Buys/Sells Handmade Rugs & Flooring)
                </label>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                  Notes / Buyer Preferences
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '70px' }}
                  placeholder="e.g. Prefers custom 8x10 wool hand-tufted rugs, requests digital PDF catalog..."
                  value={newLead.notes}
                  onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submittingLead}
                >
                  {submittingLead ? 'Saving...' : 'Add Lead to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lead Detail & Direct Outreach Drawer */}
      {selectedLead && (
        <div className="drawer-overlay" onClick={() => setSelectedLead(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-header">
              <div>
                <h2 style={{ fontSize: '18px', color: '#FFF' }}>{selectedLead.businessName}</h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {selectedLead.leadType?.replace(/_/g, ' ')} • {selectedLead.city}, {selectedLead.country}
                </div>
              </div>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                onClick={() => setSelectedLead(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="drawer-body">
              {/* Score breakdown card */}
              <div className="card" style={{ background: 'var(--bg-surface-elevated)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    Qualification Score
                  </span>
                  <span className="badge badge-score-high" style={{ fontSize: '14px', padding: '4px 10px' }}>
                    {selectedLead.score} / 100
                  </span>
                </div>
                <p style={{ fontSize: '12.5px', color: 'var(--text-main)' }}>
                  {selectedLead.scoreReason || 'Evaluated via Knotiq Rugs scoring criteria.'}
                </p>
              </div>

              {/* Direct Outreach Channels & Action */}
              <div className="card" style={{ background: 'var(--bg-surface-elevated)' }}>
                <h3 style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold-primary)', marginBottom: '12px' }}>
                  Direct Outreach Channels
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  {selectedLead.phone && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>Phone:</strong> {selectedLead.phone}</span>
                      <a
                        className="btn btn-secondary btn-sm"
                        href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hello ' + selectedLead.businessName + ', this is Knotiq Rugs regarding handmade bespoke carpets.')}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--emerald)' }}
                      >
                        <Send size={12} /> WhatsApp Chat
                      </a>
                    </div>
                  )}

                  {selectedLead.email && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span><strong>Email:</strong> {selectedLead.email}</span>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleGenerateDraft('email')}
                        disabled={generatingDraft}
                      >
                        <Sparkles size={12} /> {generatingDraft ? 'Generating...' : 'AI Cold Email'}
                      </button>
                    </div>
                  )}

                  {selectedLead.website && (
                    <div>
                      <strong>Website:</strong>{' '}
                      <a href={selectedLead.website} target="_blank" rel="noreferrer" style={{ color: 'var(--gold-primary)' }}>
                        {selectedLead.website}
                      </a>
                    </div>
                  )}

                  {selectedLead.address && (
                    <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                      <strong>Address:</strong> {selectedLead.address}
                    </div>
                  )}
                </div>
              </div>

              {/* Send Direct Email / Outreach with Attachments */}
              {selectedLead.email && (
                <div className="card" style={{ background: 'rgba(217, 119, 6, 0.05)', borderColor: 'var(--gold-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Mail size={14} /> Send Email with PDF / Images
                    </span>
                    {outreachDraft && (
                      <button className="btn btn-secondary btn-sm" onClick={handleCopyDraft}>
                        {copiedDraft ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Subject:
                      </label>
                      <input
                        type="text"
                        className="input"
                        style={{ width: '100%', fontSize: '12px' }}
                        value={drawerSubject}
                        onChange={(e) => setDrawerSubject(e.target.value)}
                      />
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                        Message Body:
                      </label>
                      <textarea
                        className="input"
                        style={{ width: '100%', minHeight: '90px', fontSize: '12px', lineHeight: '1.4' }}
                        value={drawerBody}
                        onChange={(e) => setDrawerBody(e.target.value)}
                      />
                    </div>

                    {/* Attached Files List */}
                    {drawerAttachments.length > 0 && (
                      <div>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                          Attached Files ({drawerAttachments.length}):
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {drawerAttachments.map((att, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'var(--bg-app)',
                                padding: '6px 10px',
                                borderRadius: '6px',
                                fontSize: '12px'
                              }}
                            >
                              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#FFF' }}>
                                <FileText size={13} color="var(--gold-primary)" />
                                {att.filename} ({Math.round((att.size || 0) / 1024)} KB)
                              </span>
                              <button
                                type="button"
                                style={{ background: 'none', border: 'none', color: 'var(--rose)', cursor: 'pointer' }}
                                onClick={() => handleRemoveDrawerAttachment(idx)}
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* File Attachment & Send Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '6px' }}>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <span className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Paperclip size={13} /> {uploadingDrawerAtt ? 'Uploading...' : 'Attach PDF / Image'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                          style={{ display: 'none' }}
                          onChange={handleDrawerAttachmentUpload}
                          disabled={uploadingDrawerAtt}
                        />
                      </label>

                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {(selectedLead.phone || selectedLead.whatsapp) && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleSendDirectOutreach('whatsapp')}
                            style={{ display: 'flex', alignItems: 'center', gap: '5px', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}
                            title="Direct WhatsApp chat from your +971 582549695 number"
                          >
                            <MessageSquare size={13} /> WhatsApp (+971)
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleSendDirectOutreach('email')}
                          disabled={sendingOutreach || !selectedLead.email}
                          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          title="Send Email from info@knotiqrugs.com with attachments"
                        >
                          <Send size={13} /> {sendingOutreach ? 'Sending...' : 'Send Email'}
                        </button>
                      </div>
                    </div>

                    {sendSuccessMsg && (
                      <div style={{ fontSize: '12px', color: 'var(--emerald)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                        <CheckCircle2 size={13} /> {sendSuccessMsg}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Status & Internal Notes */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Lead Pipeline Status
                </label>
                <select
                  className="select"
                  style={{ width: '100%', marginBottom: '14px' }}
                  value={drawerStatus}
                  onChange={(e) => setDrawerStatus(e.target.value)}
                >
                  <option value="new">New Lead</option>
                  <option value="contacted">Contacted</option>
                  <option value="replied">Replied (In Conversation)</option>
                  <option value="won">Won (Deal Closed)</option>
                  <option value="not_interested">Not Interested</option>
                </select>

                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px' }}>
                  Internal Notes & Interactions
                </label>
                <textarea
                  className="input"
                  style={{ width: '100%', minHeight: '80px', resize: 'vertical' }}
                  placeholder="Record call notes, preferred rug dimensions, buyer timeline..."
                  value={drawerNotes}
                  onChange={(e) => setDrawerNotes(e.target.value)}
                />
              </div>
            </div>

            <div className="drawer-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedLead(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLeadChanges}>Save Notes & Status</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
