import React, { useState, useEffect, useRef } from 'react';
import {
  Send,
  Mail,
  MessageSquare,
  UploadCloud,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Download,
  Lock,
  Eye,
  Database,
  FileSpreadsheet,
  StopCircle,
  Info,
  CheckSquare,
  Square,
  ShieldCheck,
  Search,
  Filter,
  Paperclip,
  FileText
} from 'lucide-react';
import { api } from '../api';

export default function BulkSend() {
  // Auth state
  const [authPassword, setAuthPassword] = useState(
    localStorage.getItem('bulk_auth_password') || 'knotiq2026'
  );
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Source selection: 'db' | 'upload'
  const [leadSource, setLeadSource] = useState('db');
  const [dbLeads, setDbLeads] = useState([]);
  const [uploadedLeads, setUploadedLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Selected lead IDs (set of IDs)
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Channels: 'email' | 'whatsapp' | 'both'
  const [channelMode, setChannelMode] = useState('both'); // 'email', 'whatsapp', 'both'

  // Message fields
  const [subject, setSubject] = useState('Trade Partnership: Handmade Luxury Rugs for {company}');
  const [message, setMessage] = useState(
    `Hello {name} Team,\n\nWe love your design projects at {company}. At Knotiq Rugs, we are direct manufacturers of artisan hand-knotted and hand-tufted rugs in India, supplying luxury interior designers and boutique showrooms worldwide.\n\nWe offer bespoke custom sizing, yarn matching, and direct trade pricing without intermediary markups.\n\nCould I send over our digital trade catalog and complimentary yarn sample kit for your upcoming projects?\n\nWarm regards,\nExport Team | Knotiq Rugs`
  );
  const [useTemplate, setUseTemplate] = useState(false);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [delayMs, setDelayMs] = useState(3000);
  const [dryRun, setDryRun] = useState(false);

  // Attachments (PDFs & Images)
  const [attachments, setAttachments] = useState([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);

  // Confirmation modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Active Job & Progress
  const [currentJobId, setCurrentJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [pollingActive, setPollingActive] = useState(false);
  const pollTimerRef = useRef(null);

  // Daily quota stats
  const [dailyStats, setDailyStats] = useState({ dailySent: 0, dailyLimit: 50 });

  // Initial authentication check & data load
  useEffect(() => {
    checkAuth(authPassword);
  }, []);

  const checkAuth = async (pass) => {
    try {
      if (pass) localStorage.setItem('bulk_auth_password', pass);
      await api.verifyBulkAuth(pass);
      setIsAuthenticated(true);
      setShowPasswordModal(false);
      setAuthError('');
      loadDbLeads();
      loadDailyStats();
    } catch (err) {
      setIsAuthenticated(false);
      setShowPasswordModal(true);
      setAuthError('Authentication required. LocalTunnel par access ke liye BULK_PASSWORD daalein.');
    }
  };

  const loadDbLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await api.getBulkLeads({ limit: 300 });
      setDbLeads(res.leads || []);
      // Pre-select leads that have email or phone
      const initialSelected = new Set();
      (res.leads || []).forEach((l) => initialSelected.add(l.id));
      setSelectedIds(initialSelected);
    } catch (err) {
      console.error('Error loading DB leads:', err);
    } finally {
      setLoadingLeads(false);
    }
  };

  const loadDailyStats = async () => {
    try {
      const res = await api.getBulkHistory();
      if (res.success) {
        setDailyStats({
          dailySent: res.dailySent || 0,
          dailyLimit: res.dailyLimit || 50
        });
      }
    } catch (err) {}
  };

  // Poll Job Status while running
  useEffect(() => {
    if (!currentJobId || !pollingActive) return;

    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await api.getBulkStatus(currentJobId);
        if (res.success && res.job) {
          setJobStatus(res.job);
          if (res.job.status === 'completed' || res.job.status === 'stopped' || res.job.status === 'failed') {
            setPollingActive(false);
            clearInterval(pollTimerRef.current);
            loadDailyStats();
          }
        }
      } catch (err) {
        console.error('Error polling job status:', err);
      }
    }, 1500);

    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [currentJobId, pollingActive]);

  // Handle CSV/Excel file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFileName(file.name);
    const formData = new FormData();
    formData.append('file', file);

    setLoadingLeads(true);
    try {
      const res = await api.uploadBulkFile(formData);
      if (res.success) {
        setUploadedLeads(res.leads || []);
        setLeadSource('upload');
        const ids = new Set();
        (res.leads || []).forEach((l) => ids.add(l.id));
        setSelectedIds(ids);
      }
    } catch (err) {
      alert(`File upload error: ${err.message}`);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Active lead pool
  const currentLeadPool = leadSource === 'db' ? dbLeads : uploadedLeads;

  // Filter leads by search
  const filteredLeads = currentLeadPool.filter((lead) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (lead.name || '').toLowerCase().includes(q) ||
      (lead.company || '').toLowerCase().includes(q) ||
      (lead.email || '').toLowerCase().includes(q) ||
      (lead.phone || '').toLowerCase().includes(q) ||
      (lead.city || '').toLowerCase().includes(q)
    );
  });

  // Select / Deselect All
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      const next = new Set();
      filteredLeads.forEach((l) => next.add(l.id));
      setSelectedIds(next);
    }
  };

  const handleToggleLead = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  // Placeholder insertion helper
  const insertPlaceholder = (tag) => {
    setMessage((prev) => `${prev} ${tag}`);
  };

  // Get selected leads list
  const selectedLeadsList = currentLeadPool.filter((l) => selectedIds.has(l.id));

  // Determine channels array
  const activeChannels =
    channelMode === 'both' ? ['email', 'whatsapp'] : [channelMode];

  // Start sending
  const handleConfirmSend = async () => {
    setShowConfirmModal(false);
    if (selectedLeadsList.length === 0) {
      alert('Pehle kam se kam ek lead select karein.');
      return;
    }

    try {
      const payload = {
        leads: selectedLeadsList,
        channels: activeChannels,
        subject,
        message,
        attachments,
        useTemplate,
        skipAlreadySent,
        delayMs: Number(delayMs) || 3000,
        dryRun
      };

      const res = await api.startBulkSend(payload);
      if (res.success && res.jobId) {
        setCurrentJobId(res.jobId);
        setPollingActive(true);
        setJobStatus({
          jobId: res.jobId,
          status: 'running',
          total: selectedLeadsList.length,
          processed: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
          results: []
        });
      }
    } catch (err) {
      alert(`Send start error: ${err.message}`);
    }
  };

  // Attachment Handlers
  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('File size maximum 15MB ho sakti hai.');
      return;
    }

    try {
      setUploadingAtt(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.uploadAttachment(formData);
      if (res.attachment) {
        setAttachments((prev) => [...prev, res.attachment]);
      }
    } catch (err) {
      alert(`Attachment upload fail ho gaya: ${err.message}`);
    } finally {
      setUploadingAtt(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  // Stop Job
  const handleStopJob = async () => {
    if (!currentJobId) return;
    try {
      await api.stopBulkJob(currentJobId);
      setPollingActive(false);
    } catch (err) {
      alert(`Stop error: ${err.message}`);
    }
  };

  // Retry Failed Leads
  const handleRetryFailed = () => {
    if (!jobStatus || !jobStatus.results) return;
    const failedLeadKeys = new Set(
      jobStatus.results.filter((r) => r.status === 'failed').map((r) => r.recipient)
    );

    const retryLeads = currentLeadPool.filter(
      (l) => failedLeadKeys.has(l.email) || failedLeadKeys.has(l.phone)
    );

    if (retryLeads.length === 0) {
      alert('Koi failed lead retry ke liye nahi mili.');
      return;
    }

    const retryIds = new Set();
    retryLeads.forEach((l) => retryIds.add(l.id));
    setSelectedIds(retryIds);
    setJobStatus(null);
    setCurrentJobId(null);
    alert(`${retryLeads.length} failed leads retry ke liye select ho gayi hain. "Send" dabayein.`);
  };

  // Download Results CSV
  const handleDownloadCsv = () => {
    if (!jobStatus || !jobStatus.results || jobStatus.results.length === 0) {
      alert('Download karne ke liye abhi koi result nahi hai.');
      return;
    }

    const headers = ['Lead Name', 'Company', 'Channel', 'Recipient', 'Status', 'Error / Reason', 'Timestamp'];
    const rows = jobStatus.results.map((r) => [
      `"${(r.name || '').replace(/"/g, '""')}"`,
      `"${(r.company || '').replace(/"/g, '""')}"`,
      `"${r.channel || ''}"`,
      `"${r.recipient || ''}"`,
      `"${r.status || ''}"`,
      `"${(r.error || '').replace(/"/g, '""')}"`,
      `"${r.timestamp || ''}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `bulk_send_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Preview lead
  const previewLead = selectedLeadsList[0] || {
    name: 'Aarav Mehta',
    company: 'Mehta Luxury Living',
    city: 'Dubai',
    country: 'UAE'
  };

  const previewSubject = subject
    .replace(/{name}|\{\{name\}\}/gi, previewLead.name || 'Valued Partner')
    .replace(/{company}|\{\{company\}\}/gi, previewLead.company || 'your company');

  const previewBody = message
    .replace(/{name}|\{\{name\}\}/gi, previewLead.name || 'Valued Partner')
    .replace(/{company}|\{\{company\}\}/gi, previewLead.company || 'your company');

  return (
    <div className="page-container" style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Top Banner & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: '700', color: 'var(--text-bright, #fff)', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
            <Send size={24} color="var(--gold-primary, #d97706)" />
            Bulk Outreach Engine
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-dim, #94a3b8)', fontSize: '14px' }}>
            Email aur WhatsApp pe leads ko ek saath personal message bhejein (Anti-ban protection & Live tracking).
          </p>
        </div>

        {/* Stats & Auth pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'var(--card-bg, #1e293b)',
            padding: '8px 16px',
            borderRadius: '8px',
            border: '1px solid var(--border-color, #334155)',
            fontSize: '13px',
            color: 'var(--text-bright, #fff)'
          }}>
            <span style={{ color: 'var(--text-dim, #94a3b8)' }}>Aaj Bheje Gaye: </span>
            <strong style={{ color: dailyStats.dailySent >= dailyStats.dailyLimit ? '#ef4444' : '#10b981' }}>
              {dailyStats.dailySent} / {dailyStats.dailyLimit}
            </strong>
          </div>

          <button
            onClick={() => setShowPasswordModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #334155',
              background: isAuthenticated ? '#064e3b' : '#7f1d1d',
              color: '#fff',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            {isAuthenticated ? <ShieldCheck size={14} color="#34d399" /> : <Lock size={14} color="#f87171" />}
            {isAuthenticated ? 'Authenticated' : 'Unlock Auth'}
          </button>
        </div>
      </div>

      {/* Main Grid: Left side Setup & Compose | Right side Live Progress & Results */}
      <div style={{ display: 'grid', gridTemplateColumns: currentJobId ? '1fr 1fr' : '1.3fr 0.9fr', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Lead Selection & Message Composer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card 1: Leads Source & Table */}
          <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => setLeadSource('db')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    border: 'none',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: leadSource === 'db' ? 'var(--gold-primary, #d97706)' : '#334155',
                    color: '#fff'
                  }}
                >
                  <Database size={15} /> Scraper Leads (DB se)
                </button>

                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 14px',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                    background: leadSource === 'upload' ? 'var(--gold-primary, #d97706)' : '#334155',
                    color: '#fff'
                  }}
                >
                  <UploadCloud size={15} /> {uploadFileName ? uploadFileName : 'Upload CSV / Excel'}
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Search filter */}
              <div style={{ position: 'relative', width: '220px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="Search name, phone, city..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: '12px'
                  }}
                />
              </div>
            </div>

            {/* Selection info bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#0f172a', padding: '10px 14px', borderRadius: '6px', marginBottom: '12px', fontSize: '13px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }} onClick={handleToggleSelectAll}>
                {selectedIds.size > 0 && selectedIds.size === filteredLeads.length ? (
                  <CheckSquare size={16} color="var(--gold-primary, #d97706)" />
                ) : (
                  <Square size={16} color="#64748b" />
                )}
                <span style={{ fontWeight: '600', color: '#f8fafc' }}>
                  Select All ({filteredLeads.length} me se {selectedIds.size} selected)
                </span>
              </div>

              {leadSource === 'upload' && (
                <button
                  onClick={() => setLeadSource('db')}
                  style={{ background: 'transparent', border: 'none', color: '#38bdf8', fontSize: '12px', cursor: 'pointer' }}
                >
                  Wapas DB Leads Pe Jao
                </button>
              )}
            </div>

            {/* Leads Table */}
            <div style={{ maxHeight: '280px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '6px' }}>
              {loadingLeads ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>Leads load ho rahi hain...</div>
              ) : filteredLeads.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                  Koi lead nahi mili. {leadSource === 'upload' ? 'CSV/XLSX file upload karein.' : 'Scraper chala kar leads laayein.'}
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', color: '#cbd5e1' }}>
                  <thead>
                    <tr style={{ background: '#0f172a', borderBottom: '1px solid #334155', textAlign: 'left', color: '#94a3b8' }}>
                      <th style={{ padding: '8px 12px', width: '36px' }}></th>
                      <th style={{ padding: '8px 12px' }}>Business / Lead Name</th>
                      <th style={{ padding: '8px 12px' }}>Email</th>
                      <th style={{ padding: '8px 12px' }}>Phone / WA</th>
                      <th style={{ padding: '8px 12px' }}>City</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeads.map((lead) => {
                      const isSelected = selectedIds.has(lead.id);
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => handleToggleLead(lead.id)}
                          style={{
                            borderBottom: '1px solid #1e293b',
                            background: isSelected ? 'rgba(217, 119, 6, 0.1)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '8px 12px' }}>
                            {isSelected ? <CheckSquare size={15} color="var(--gold-primary, #d97706)" /> : <Square size={15} color="#64748b" />}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: '600', color: '#f8fafc' }}>
                            {lead.name || lead.businessName}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {lead.email ? (
                              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Mail size={12} /> {lead.email}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {lead.phone ? (
                              <span style={{ color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MessageSquare size={12} /> {lead.phone}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: '#94a3b8' }}>
                            {lead.city || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Card 2: Message & Channel Composer */}
          <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: '600', color: '#f8fafc', margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              Channel & Message Format
            </h3>

            {/* Channel Toggle */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <button
                onClick={() => setChannelMode('email')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: channelMode === 'email' ? '2px solid #10b981' : '1px solid #334155',
                  background: channelMode === 'email' ? 'rgba(16, 185, 129, 0.15)' : '#0f172a',
                  color: channelMode === 'email' ? '#10b981' : '#94a3b8',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Mail size={16} /> Sirf Email
              </button>

              <button
                onClick={() => setChannelMode('whatsapp')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: channelMode === 'whatsapp' ? '2px solid #38bdf8' : '1px solid #334155',
                  background: channelMode === 'whatsapp' ? 'rgba(56, 189, 248, 0.15)' : '#0f172a',
                  color: channelMode === 'whatsapp' ? '#38bdf8' : '#94a3b8',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <MessageSquare size={16} /> Sirf WhatsApp
              </button>

              <button
                onClick={() => setChannelMode('both')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '8px',
                  border: channelMode === 'both' ? '2px solid var(--gold-primary, #d97706)' : '1px solid #334155',
                  background: channelMode === 'both' ? 'rgba(217, 119, 6, 0.15)' : '#0f172a',
                  color: channelMode === 'both' ? 'var(--gold-primary, #d97706)' : '#94a3b8',
                  fontWeight: '600',
                  fontSize: '13px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Send size={16} /> Dono (Email + WA)
              </button>
            </div>

            {/* Email Subject Line (if email included) */}
            {(channelMode === 'email' || channelMode === 'both') && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                  Email Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #475569',
                    background: '#0f172a',
                    color: '#fff',
                    fontSize: '13px'
                  }}
                />
              </div>
            )}

            {/* Message Body & Placeholders */}
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: '600', color: '#94a3b8' }}>
                  Message Content (Hinglish / English)
                </label>

                {/* Clickable Placeholders */}
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{name}')}
                    style={{ background: '#334155', border: 'none', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    + {'{name}'}
                  </button>
                  <button
                    type="button"
                    onClick={() => insertPlaceholder('{company}')}
                    style={{ background: '#334155', border: 'none', color: '#38bdf8', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}
                  >
                    + {'{company}'}
                  </button>
                </div>
              </div>

              <textarea
                rows={7}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#fff',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  lineHeight: '1.5'
                }}
              />
            </div>

            {/* Attachments Section (PDF Catalogues & Product Images) */}
            <div style={{ marginBottom: '16px', background: '#0f172a', padding: '12px 14px', borderRadius: '8px', border: '1px dashed #334155' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '600', color: '#cbd5e1', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Paperclip size={14} color="#d97706" /> Attach Files (PDF Catalog, Rug Photos)
                </span>

                <label style={{ cursor: 'pointer' }}>
                  <span style={{ fontSize: '11px', background: '#334155', color: '#f8fafc', padding: '4px 10px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    + {uploadingAtt ? 'Uploading...' : 'Upload File'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
                    style={{ display: 'none' }}
                    onChange={handleAttachmentUpload}
                    disabled={uploadingAtt}
                  />
                </label>
              </div>

              {attachments.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  Koi file attach nahi hai. PDF catalogue ya image attach karke buyers ko send kar sakte hain (max 15MB).
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: '#1e293b',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        fontSize: '12px'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#f8fafc' }}>
                        <FileText size={13} color="#d97706" />
                        {att.filename} ({Math.round((att.size || 0) / 1024)} KB)
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveAttachment(idx)}
                        style={{ background: 'none', border: 'none', color: '#f43f5e', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Guardrails & Safety Options */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: '#0f172a', padding: '12px', borderRadius: '8px', fontSize: '12px', marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={skipAlreadySent}
                  onChange={(e) => setSkipAlreadySent(e.target.checked)}
                />
                Pehle bhej chuke hain unhe skip karo
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#cbd5e1' }}>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                />
                <span style={{ color: dryRun ? '#f59e0b' : '#cbd5e1', fontWeight: dryRun ? '600' : 'normal' }}>
                  Dry Run Mode (Test bina message bheje)
                </span>
              </label>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8' }}>
                <span>Delay:</span>
                <input
                  type="number"
                  min="1000"
                  step="500"
                  value={delayMs}
                  onChange={(e) => setDelayMs(e.target.value)}
                  style={{ width: '80px', padding: '3px 6px', background: '#1e293b', border: '1px solid #475569', color: '#fff', borderRadius: '4px', fontSize: '11px' }}
                />
                <span>ms / msg</span>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: '#94a3b8' }}>
                <input
                  type="checkbox"
                  checked={useTemplate}
                  onChange={(e) => setUseTemplate(e.target.checked)}
                />
                Meta Approved WhatsApp Template use karo
              </label>
            </div>

            {/* SEND BUTTON */}
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={selectedLeadsList.length === 0 || pollingActive}
              style={{
                width: '100%',
                padding: '14px',
                borderRadius: '8px',
                border: 'none',
                background: pollingActive ? '#475569' : 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                color: '#fff',
                fontSize: '15px',
                fontWeight: '700',
                cursor: pollingActive ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(217, 119, 6, 0.3)'
              }}
            >
              <Send size={18} />
              {pollingActive
                ? 'Job chal rahi hai...'
                : `${selectedLeadsList.length} Leads ko Send Karo (${channelMode.toUpperCase()})`}
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Preview & Progress/Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Live Progress Card (Active or Finished Job) */}
          {jobStatus && (
            <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc', margin: 0 }}>
                    Live Sending Progress
                  </h3>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Job ID: {jobStatus.jobId}</div>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {pollingActive && (
                    <button
                      onClick={handleStopJob}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <StopCircle size={14} /> Stop
                    </button>
                  )}

                  {!pollingActive && jobStatus.failed > 0 && (
                    <button
                      onClick={handleRetryFailed}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#d97706',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <RotateCcw size={14} /> Retry Failed
                    </button>
                  )}

                  {!pollingActive && (
                    <button
                      onClick={handleDownloadCsv}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: '#0284c7',
                        color: '#fff',
                        border: 'none',
                        padding: '6px 12px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      <Download size={14} /> CSV
                    </button>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              {(() => {
                const total = jobStatus.total || 1;
                const processed = jobStatus.processed || 0;
                const pct = Math.min(100, Math.round((processed / total) * 100));
                return (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#cbd5e1', marginBottom: '6px' }}>
                      <span>Progress: {pct}%</span>
                      <span>{processed} / {total} processed</span>
                    </div>
                    <div style={{ height: '8px', background: '#0f172a', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
                      <div
                        style={{
                          height: '100%',
                          width: `${pct}%`,
                          background: jobStatus.status === 'completed' ? '#10b981' : 'linear-gradient(90deg, #d97706, #f59e0b)',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Counter Metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', textAlign: 'center', marginBottom: '16px' }}>
                <div style={{ background: '#0f172a', padding: '10px 4px', borderRadius: '6px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#f8fafc' }}>{jobStatus.total}</div>
                </div>
                <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '10px 4px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#10b981' }}>Sent</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#10b981' }}>{jobStatus.sent}</div>
                </div>
                <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '10px 4px', borderRadius: '6px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#ef4444' }}>Failed</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#ef4444' }}>{jobStatus.failed}</div>
                </div>
                <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '10px 4px', borderRadius: '6px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                  <div style={{ fontSize: '11px', color: '#f59e0b' }}>Skipped</div>
                  <div style={{ fontSize: '16px', fontWeight: '700', color: '#f59e0b' }}>{jobStatus.skipped}</div>
                </div>
              </div>

              {/* Real-time Results Log List */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid #334155', borderRadius: '6px' }}>
                {(!jobStatus.results || jobStatus.results.length === 0) ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                    Leads process hone ka intezar...
                  </div>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <tbody>
                      {jobStatus.results.map((r, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #1e293b' }}>
                          <td style={{ padding: '6px 8px', width: '20px' }}>
                            {r.status === 'sent' && <CheckCircle2 size={13} color="#10b981" />}
                            {r.status === 'failed' && <XCircle size={13} color="#ef4444" />}
                            {r.status === 'skipped' && <AlertTriangle size={13} color="#f59e0b" />}
                          </td>
                          <td style={{ padding: '6px 8px', fontWeight: '600', color: '#f8fafc' }}>
                            {r.name}
                          </td>
                          <td style={{ padding: '6px 8px', color: '#94a3b8' }}>
                            {r.channel === 'email' ? <Mail size={11} style={{ display: 'inline', marginRight: '3px' }} /> : <MessageSquare size={11} style={{ display: 'inline', marginRight: '3px' }} />}
                            {r.recipient}
                          </td>
                          <td style={{ padding: '6px 8px', textAlign: 'right' }}>
                            {r.status === 'sent' && <span style={{ color: '#10b981', fontWeight: '600' }}>Sent</span>}
                            {r.status === 'failed' && <span style={{ color: '#ef4444' }}>{r.error || 'Failed'}</span>}
                            {r.status === 'skipped' && <span style={{ color: '#f59e0b' }}>{r.error || 'Skipped'}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* Live Preview Card */}
          <div style={{ background: 'var(--card-bg, #1e293b)', border: '1px solid var(--border-color, #334155)', borderRadius: '12px', padding: '20px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: '600', color: '#f8fafc', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Eye size={16} color="#38bdf8" /> Pehli Selected Lead Ka Message Preview
            </h3>

            <div style={{ background: '#0f172a', padding: '14px', borderRadius: '8px', border: '1px solid #334155', fontSize: '13px' }}>
              <div style={{ borderBottom: '1px solid #334155', paddingBottom: '8px', marginBottom: '10px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>TO:</div>
                <div style={{ fontWeight: '600', color: '#f8fafc' }}>
                  {previewLead.name} ({previewLead.company})
                </div>
                <div style={{ fontSize: '12px', color: '#38bdf8' }}>
                  {previewLead.email || 'No email'} • {previewLead.phone || 'No phone'}
                </div>
              </div>

              {(channelMode === 'email' || channelMode === 'both') && (
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>SUBJECT: </span>
                  <strong style={{ color: '#f8fafc' }}>{previewSubject}</strong>
                </div>
              )}

              <div style={{ whiteSpace: 'pre-wrap', color: '#cbd5e1', lineHeight: '1.5', fontSize: '12px', background: '#1e293b', padding: '10px', borderRadius: '6px' }}>
                {previewBody}
              </div>

              <div style={{ fontSize: '10px', color: '#64748b', marginTop: '8px' }}>
                * Note: Email me automated unsubscribe footer ("Reply STOP to opt out") automatically judta hai.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '460px',
            width: '90%',
            color: '#fff',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5)'
          }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle color="#f59e0b" size={20} /> Bulk Send Confirm Karein
            </h3>

            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.5', margin: '0 0 16px 0' }}>
              Aap <strong style={{ color: '#f8fafc' }}>{selectedLeadsList.length} leads</strong> ko message bhejne wale hain:
            </p>

            <ul style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0', paddingLeft: '20px' }}>
              <li><strong>Channel:</strong> {channelMode.toUpperCase()}</li>
              <li><strong>Delay:</strong> {delayMs}ms (Anti-spam interval)</li>
              <li><strong>Already Sent Check:</strong> {skipAlreadySent ? 'Enabled (Do-bara nahi jayega)' : 'Disabled'}</li>
              <li><strong>Mode:</strong> {dryRun ? 'DRY RUN (Bina message bheje test)' : 'LIVE OUTREACH'}</li>
            </ul>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  background: '#334155',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleConfirmSend}
                style={{
                  background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
                  border: 'none',
                  color: '#fff',
                  padding: '8px 18px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Haan, Send Karo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Auth Modal */}
      {showPasswordModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #475569',
            borderRadius: '12px',
            padding: '24px',
            maxWidth: '420px',
            width: '90%',
            color: '#fff'
          }}>
            <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Lock color="#f59e0b" size={18} /> Bulk Send Security Access
            </h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 16px 0' }}>
              LocalTunnel public link par secure rakhne ke liye Bulk Send password daalein (.env mein BULK_PASSWORD):
            </p>

            {authError && (
              <div style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', padding: '8px 12px', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
                {authError}
              </div>
            )}

            <input
              type="password"
              placeholder="Enter BULK_PASSWORD (default: knotiq2026)"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') checkAuth(authPassword); }}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '6px',
                border: '1px solid #475569',
                background: '#0f172a',
                color: '#fff',
                fontSize: '14px',
                marginBottom: '16px'
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => checkAuth(authPassword)}
                style={{
                  background: 'var(--gold-primary, #d97706)',
                  border: 'none',
                  color: '#fff',
                  padding: '9px 18px',
                  borderRadius: '6px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Authenticate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
