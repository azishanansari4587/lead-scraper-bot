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
  EyeOff,
  Database,
  StopCircle,
  CheckSquare,
  Square,
  ShieldCheck,
  Search,
  Paperclip,
  FileText
} from 'lucide-react';
import { api } from '../api';
import {
  Button,
  Field,
  Select,
  Textarea,
  Card,
  Modal,
  Badge,
  EmptyState,
  useToast
} from '../components/ui';

export default function BulkSend() {
  const toast = useToast();

  // Auth state
  const [authPassword, setAuthPassword] = useState(
    localStorage.getItem('bulk_auth_password') || ''
  );
  const [showPassword, setShowPassword] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // Source selection: 'db' | 'upload'
  const [leadSource, setLeadSource] = useState('db');
  const [dbLeads, setDbLeads] = useState([]);
  const [uploadedLeads, setUploadedLeads] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [uploadFileName, setUploadFileName] = useState('');
  const [searchFilter, setSearchFilter] = useState('');

  // Selected lead IDs
  const [selectedIds, setSelectedIds] = useState(new Set());

  // Channels: 'email' | 'whatsapp' | 'both'
  const [channelMode, setChannelMode] = useState('both');

  // Message fields
  const [subject, setSubject] = useState('Trade Partnership: Handmade Luxury Rugs for {company}');
  const [message, setMessage] = useState(
    `Hello {name} Team,\n\nWe admire your design projects at {company}. At Knotiq Rugs, we are direct manufacturers of artisan hand-knotted and hand-tufted rugs in India, supplying luxury interior designers and boutique showrooms worldwide.\n\nWe offer bespoke custom sizing, yarn matching, and direct trade pricing without intermediary markups.\n\nCould I send over our digital trade catalog and complimentary yarn sample kit for your upcoming projects?\n\nWarm regards,\nExport Team | Knotiq Rugs`
  );
  const [useTemplate, setUseTemplate] = useState(false);
  const [skipAlreadySent, setSkipAlreadySent] = useState(true);
  const [delayMs, setDelayMs] = useState(3000);
  const [dryRun, setDryRun] = useState(false);

  // Attachments
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
    const saved = localStorage.getItem('bulk_auth_password');
    if (saved && saved.trim()) {
      checkAuth(saved.trim());
    } else {
      setIsAuthenticated(false);
      setShowPasswordModal(true);
      setAuthError('');
    }
  }, []);

  const checkAuth = async (pass) => {
    const candidate = pass !== undefined ? pass : authPassword;
    const trimmed = (candidate || '').trim();

    if (!trimmed) {
      setIsAuthenticated(false);
      setShowPasswordModal(true);
      setAuthError('Please enter your BULK_PASSWORD (configured in your .env file).');
      return;
    }

    setAuthLoading(true);
    setAuthError('');
    setAuthSuccess('');

    try {
      await api.verifyBulkAuth(trimmed);
      localStorage.setItem('bulk_auth_password', trimmed);
      setIsAuthenticated(true);
      setAuthSuccess('Password verified. Bulk outreach access granted.');
      setAuthError('');
      loadDbLeads();
      loadDailyStats();
      setTimeout(() => {
        setShowPasswordModal(false);
        setAuthSuccess('');
      }, 700);
    } catch (err) {
      setIsAuthenticated(false);
      setShowPasswordModal(true);
      const serverMsg = err.data?.message || err.message;
      setAuthError(serverMsg ? `${serverMsg}` : 'Invalid BULK_PASSWORD. Please verify your environment configuration.');
      setAuthSuccess('');
    } finally {
      setAuthLoading(false);
    }
  };

  const loadDbLeads = async () => {
    setLoadingLeads(true);
    try {
      const res = await api.getBulkLeads({ limit: 300 });
      setDbLeads(res.leads || []);
      const initialSelected = new Set();
      (res.leads || []).forEach((l) => initialSelected.add(l.id));
      setSelectedIds(initialSelected);
    } catch (err) {
      toast.error('Failed to load database leads for outreach.');
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
            if (res.job.status === 'completed') {
              toast.success(`Bulk campaign finished. ${res.job.sent} messages delivered.`);
            }
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
        toast.success(`Imported ${res.leads?.length || 0} leads from "${file.name}".`);
      }
    } catch (err) {
      toast.error(`File upload error: ${err.message}`);
    } finally {
      setLoadingLeads(false);
    }
  };

  const currentLeadPool = leadSource === 'db' ? dbLeads : uploadedLeads;

  const filteredLeads = currentLeadPool.filter((lead) => {
    if (!searchFilter.trim()) return true;
    const q = searchFilter.toLowerCase();
    return (
      (lead.name || lead.businessName || '').toLowerCase().includes(q) ||
      (lead.company || '').toLowerCase().includes(q) ||
      (lead.email || '').toLowerCase().includes(q) ||
      (lead.phone || '').toLowerCase().includes(q) ||
      (lead.city || '').toLowerCase().includes(q)
    );
  });

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
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const insertPlaceholder = (tag) => {
    setMessage((prev) => `${prev} ${tag}`);
  };

  const selectedLeadsList = currentLeadPool.filter((l) => selectedIds.has(l.id));

  const activeChannels =
    channelMode === 'both' ? ['email', 'whatsapp'] : [channelMode];

  const handleConfirmSend = async () => {
    setShowConfirmModal(false);
    if (selectedLeadsList.length === 0) {
      toast.warning('Please select at least one recipient lead.');
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
        toast.info('Outreach campaign launched in background.');
      }
    } catch (err) {
      toast.error(`Campaign initiation error: ${err.message}`);
    }
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      toast.error('File size exceeds the 15 MB limit.');
      return;
    }

    try {
      setUploadingAtt(true);
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.uploadAttachment(formData);
      if (res.attachment || res.file) {
        setAttachments((prev) => [...prev, res.attachment || res.file]);
        toast.success(`Attached "${file.name}".`);
      }
    } catch (err) {
      toast.error(`Attachment upload failed: ${err.message}`);
    } finally {
      setUploadingAtt(false);
      e.target.value = '';
    }
  };

  const handleRemoveAttachment = (idx) => {
    setAttachments((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleStopJob = async () => {
    if (!currentJobId) return;
    try {
      await api.stopBulkJob(currentJobId);
      setPollingActive(false);
      toast.warning('Campaign stop signal dispatched.');
    } catch (err) {
      toast.error(`Stop error: ${err.message}`);
    }
  };

  const handleRetryFailed = () => {
    if (!jobStatus || !jobStatus.results) return;
    const failedLeadKeys = new Set(
      jobStatus.results.filter((r) => r.status === 'failed').map((r) => r.recipient)
    );

    const retryLeads = currentLeadPool.filter(
      (l) => failedLeadKeys.has(l.email) || failedLeadKeys.has(l.phone)
    );

    if (retryLeads.length === 0) {
      toast.info('No failed leads available to retry.');
      return;
    }

    const retryIds = new Set();
    retryLeads.forEach((l) => retryIds.add(l.id));
    setSelectedIds(retryIds);
    setJobStatus(null);
    setCurrentJobId(null);
    toast.success(`Selected ${retryLeads.length} failed leads. Click "Send" when ready.`);
  };

  const handleDownloadCsv = () => {
    if (!jobStatus || !jobStatus.results || jobStatus.results.length === 0) {
      toast.warning('No campaign results available to download.');
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
    link.setAttribute('download', `bulk_outreach_results_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const previewLead = selectedLeadsList[0] || {
    name: 'Sarah Jenkins',
    company: 'Jenkins Architecture Studio',
    city: 'Dubai',
    country: 'UAE'
  };

  const previewSubject = subject
    .replace(/{name}|\{\{name\}\}/gi, previewLead.name || 'Valued Partner')
    .replace(/{company}|\{\{company\}\}/gi, previewLead.company || 'your studio');

  const previewBody = message
    .replace(/{name}|\{\{name\}\}/gi, previewLead.name || 'Valued Partner')
    .replace(/{company}|\{\{company\}\}/gi, previewLead.company || 'your studio');

  return (
    <div className="page-content">
      {/* Top Banner & Quota */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--text-heading)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Send size={22} color="var(--gold-primary)" aria-hidden="true" />
            Bulk Outreach & Campaign Engine
          </h2>
          <p className="page-subtitle">
            Deliver personalized trade partnership inquiries across Email and WhatsApp with rate limiting and anti-spam defenses.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              background: 'var(--bg-surface)',
              padding: '8px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              fontSize: 'var(--font-xs)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <span style={{ color: 'var(--text-dim)' }}>Daily Sent:</span>
            <strong className="tabular-nums" style={{ color: dailyStats.dailySent >= dailyStats.dailyLimit ? 'var(--danger-text)' : 'var(--success)' }}>
              {dailyStats.dailySent} / {dailyStats.dailyLimit}
            </strong>
          </div>

          <Button
            variant={isAuthenticated ? 'secondary' : 'danger'}
            size="sm"
            icon={isAuthenticated ? ShieldCheck : Lock}
            onClick={() => setShowPasswordModal(true)}
          >
            {isAuthenticated ? 'Authenticated' : 'Unlock Auth'}
          </Button>
        </div>
      </div>

      {/* Main Grid: Left side Setup & Compose | Right side Live Progress & Results */}
      <div style={{ display: 'grid', gridTemplateColumns: currentJobId ? '1fr 1fr' : 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: '20px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: Lead Selection & Message Composer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card 1: Leads Source & Selection */}
          <Card title="Target Recipients Pool" icon={Database}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button
                  variant={leadSource === 'db' ? 'primary' : 'secondary'}
                  size="sm"
                  icon={Database}
                  onClick={() => setLeadSource('db')}
                >
                  Database Leads ({dbLeads.length})
                </Button>

                <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
                  <span className={`btn btn-sm ${leadSource === 'upload' ? 'btn-primary' : 'btn-secondary'}`} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <UploadCloud size={14} aria-hidden="true" />
                    {uploadFileName || 'Upload CSV / Excel'}
                  </span>
                  <input
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    style={{ display: 'none' }}
                    onChange={handleFileUpload}
                  />
                </label>
              </div>

              {/* Search filter in pool */}
              <div style={{ position: 'relative', width: '200px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-dim)' }} aria-hidden="true" />
                <input
                  type="search"
                  placeholder="Filter pool..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '30px', fontSize: 'var(--font-xs)', height: '34px' }}
                  aria-label="Filter recipient pool"
                />
              </div>
            </div>

            {/* Select All Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'var(--bg-app)',
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                marginBottom: '10px',
                fontSize: 'var(--font-xs)'
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' }}
                onClick={handleToggleSelectAll}
              >
                {selectedIds.size > 0 && selectedIds.size === filteredLeads.length ? (
                  <CheckSquare size={16} color="var(--gold-primary)" aria-hidden="true" />
                ) : (
                  <Square size={16} color="var(--text-dim)" aria-hidden="true" />
                )}
                <span style={{ fontWeight: 600, color: 'var(--text-heading)' }}>
                  Select All ({selectedIds.size} of {filteredLeads.length} selected)
                </span>
              </div>

              {leadSource === 'upload' && (
                <button
                  type="button"
                  onClick={() => setLeadSource('db')}
                  style={{ background: 'transparent', border: 'none', color: 'var(--info)', fontSize: 'var(--font-xs)', cursor: 'pointer' }}
                >
                  Back to Database Leads
                </button>
              )}
            </div>

            {/* Leads Table */}
            <div style={{ maxHeight: '260px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)' }}>
              {loadingLeads ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Loading recipient pool...
                </div>
              ) : filteredLeads.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                  No recipients found. Please upload a CSV or extract leads with the scraper.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)', color: 'var(--text-main)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-dim)' }}>
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
                            borderBottom: '1px solid var(--border-subtle)',
                            background: isSelected ? 'rgba(217, 119, 6, 0.08)' : 'transparent',
                            cursor: 'pointer'
                          }}
                        >
                          <td style={{ padding: '8px 12px' }}>
                            {isSelected ? (
                              <CheckSquare size={15} color="var(--gold-primary)" aria-hidden="true" />
                            ) : (
                              <Square size={15} color="var(--text-dim)" aria-hidden="true" />
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-heading)' }}>
                            {lead.name || lead.businessName}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {lead.email ? (
                              <span style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Mail size={12} aria-hidden="true" /> {lead.email}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {lead.phone ? (
                              <span style={{ color: 'var(--info)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MessageSquare size={12} aria-hidden="true" /> {lead.phone}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-dim)' }}>—</span>
                            )}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-muted)' }}>
                            {lead.city || '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>

          {/* Card 2: Message & Channel Composer */}
          <Card title="Channel & Message Formulation" icon={Mail}>
            {/* Channel Selection */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
              <Button
                variant={channelMode === 'email' ? 'primary' : 'secondary'}
                size="sm"
                icon={Mail}
                onClick={() => setChannelMode('email')}
                style={{ flex: 1 }}
              >
                Email Only
              </Button>
              <Button
                variant={channelMode === 'whatsapp' ? 'primary' : 'secondary'}
                size="sm"
                icon={MessageSquare}
                onClick={() => setChannelMode('whatsapp')}
                style={{ flex: 1 }}
              >
                WhatsApp Only
              </Button>
              <Button
                variant={channelMode === 'both' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => setChannelMode('both')}
                style={{ flex: 1 }}
              >
                Both Channels
              </Button>
            </div>

            {/* Email Subject */}
            {(channelMode === 'email' || channelMode === 'both') && (
              <Field label="Email Subject Line" id="bulk-subject">
                <input
                  id="bulk-subject"
                  className="input"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Trade Partnership: Handmade Bespoke Rugs"
                />
              </Field>
            )}

            {/* Message Body */}
            <div style={{ marginTop: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label htmlFor="bulk-message" className="form-label" style={{ marginBottom: 0 }}>
                  Message Content Template
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                    onClick={() => insertPlaceholder('{name}')}
                  >
                    + {'{name}'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                    onClick={() => insertPlaceholder('{company}')}
                  >
                    + {'{company}'}
                  </button>
                </div>
              </div>
              <Textarea
                id="bulk-message"
                rows={6}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            {/* File Attachments */}
            <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Catalog & Digital Attachments
                </span>
                <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
                  <span className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Paperclip size={13} aria-hidden="true" />
                    {uploadingAtt ? 'Uploading...' : 'Attach PDF / Image'}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp"
                    style={{ display: 'none' }}
                    onChange={handleAttachmentUpload}
                    disabled={uploadingAtt}
                  />
                </label>
              </div>

              {attachments.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        background: 'var(--bg-app)',
                        padding: '6px 10px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-xs)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-main)' }}>
                        <FileText size={13} color="var(--gold-primary)" aria-hidden="true" />
                        {att.filename}
                      </span>
                      <button
                        type="button"
                        className="btn-icon btn-ghost btn-sm"
                        onClick={() => handleRemoveAttachment(idx)}
                        style={{ color: 'var(--danger-text)' }}
                        aria-label={`Remove attachment ${att.filename}`}
                      >
                        <XCircle size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Campaign Options */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--font-xs)', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={skipAlreadySent}
                  onChange={(e) => setSkipAlreadySent(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
                />
                <span>Skip contacted leads</span>
              </label>

              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: 'var(--font-xs)', color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={dryRun}
                  onChange={(e) => setDryRun(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--gold-primary)' }}
                />
                <span>Dry Run (simulate only)</span>
              </label>
            </div>

            {/* Launch Campaign Button */}
            <div style={{ marginTop: '20px' }}>
              <Button
                variant="primary"
                size="lg"
                icon={Send}
                onClick={() => setShowConfirmModal(true)}
                disabled={selectedLeadsList.length === 0 || !isAuthenticated || pollingActive}
                style={{ width: '100%' }}
              >
                Send to {selectedLeadsList.length} Selected Leads
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Live Progress & Live Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Card: Active Campaign Progress */}
          {jobStatus && (
            <Card title="Campaign Execution Monitor" icon={Send}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <Badge variant={jobStatus.status === 'completed' ? 'success' : jobStatus.status === 'running' ? 'warning' : 'danger'}>
                  Status: {jobStatus.status.toUpperCase()}
                </Badge>

                {jobStatus.status === 'running' && (
                  <Button variant="danger" size="sm" icon={StopCircle} onClick={handleStopJob}>
                    Stop Job
                  </Button>
                )}
              </div>

              {/* Progress metrics */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', textAlign: 'center', marginBottom: '14px' }}>
                <div style={{ background: 'var(--bg-app)', padding: '10px 6px', borderRadius: 'var(--radius-sm)' }}>
                  <div className="tabular-nums" style={{ fontSize: 'var(--font-lg)', fontWeight: 700 }}>{jobStatus.total || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Total</div>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '10px 6px', borderRadius: 'var(--radius-sm)' }}>
                  <div className="tabular-nums" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--success)' }}>{jobStatus.sent || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Delivered</div>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '10px 6px', borderRadius: 'var(--radius-sm)' }}>
                  <div className="tabular-nums" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--danger-text)' }}>{jobStatus.failed || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Failed</div>
                </div>
                <div style={{ background: 'var(--bg-app)', padding: '10px 6px', borderRadius: 'var(--radius-sm)' }}>
                  <div className="tabular-nums" style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--warning-text)' }}>{jobStatus.skipped || 0}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', textTransform: 'uppercase' }}>Skipped</div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="progress-track" style={{ height: '8px', marginBottom: '16px' }}>
                <div
                  className="progress-bar"
                  style={{
                    width: `${Math.min(100, Math.round(((jobStatus.processed || 0) / (jobStatus.total || 1)) * 100))}%`
                  }}
                />
              </div>

              {/* Actions: Download CSV & Retry */}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                {jobStatus.failed > 0 && (
                  <Button variant="secondary" size="sm" icon={RotateCcw} onClick={handleRetryFailed}>
                    Retry {jobStatus.failed} Failed
                  </Button>
                )}
                <Button variant="secondary" size="sm" icon={Download} onClick={handleDownloadCsv}>
                  Export Results CSV
                </Button>
              </div>

              {/* Results Stream Table */}
              <div style={{ maxHeight: '240px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', marginTop: '14px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--font-xs)', color: 'var(--text-main)' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-surface-elevated)', borderBottom: '1px solid var(--border-subtle)', textAlign: 'left', color: 'var(--text-dim)' }}>
                      <th style={{ padding: '6px 10px' }}>Recipient</th>
                      <th style={{ padding: '6px 10px' }}>Channel</th>
                      <th style={{ padding: '6px 10px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(jobStatus.results || []).slice(-25).reverse().map((res, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '6px 10px', fontWeight: 600 }}>{res.recipient || res.name}</td>
                        <td style={{ padding: '6px 10px', textTransform: 'capitalize' }}>{res.channel}</td>
                        <td style={{ padding: '6px 10px' }}>
                          <span style={{ color: res.status === 'sent' ? 'var(--success)' : 'var(--danger-text)' }}>
                            {res.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Card: Live Dynamic Preview */}
          <Card title="Personalized Preview" icon={Eye}>
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Previewing template variables mapped for sample lead: <strong>{previewLead.company || previewLead.name}</strong>
            </div>

            <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '14px' }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: 'var(--gold-primary)', marginBottom: '8px' }}>
                {previewSubject}
              </div>
              <div style={{ fontSize: 'var(--font-xs)', whiteSpace: 'pre-wrap', lineHeight: '1.5', color: 'var(--text-main)' }}>
                {previewBody}
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Bulk Outreach Campaign"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowConfirmModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleConfirmSend}>
              Start Campaign Now
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-main)' }}>
            You are about to launch an automated outreach campaign to <strong>{selectedLeadsList.length}</strong> selected leads via{' '}
            <strong style={{ textTransform: 'uppercase' }}>{channelMode}</strong>.
          </p>

          <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            <div>• Channels: {activeChannels.join(' & ')}</div>
            <div>• Attachments: {attachments.length} files attached</div>
            <div>• Safety delay: {delayMs} ms per message</div>
            <div>• Mode: {dryRun ? 'Simulated (Dry Run)' : 'Live Delivery'}</div>
          </div>
        </div>
      </Modal>

      {/* Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Outreach Security Authorization"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowPasswordModal(false)}>
              Close
            </Button>
            <Button variant="primary" loading={authLoading} onClick={() => checkAuth()}>
              Authorize Access
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            To safeguard outbound export messaging channels and ensure verified operation, please enter the authorized <code>BULK_PASSWORD</code>:
          </p>

          <div style={{ position: 'relative' }}>
            <Field label="Security Password" id="bulk-auth-input">
              <input
                id="bulk-auth-input"
                type={showPassword ? 'text' : 'password'}
                className="input"
                placeholder="Enter password from .env"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && checkAuth()}
              />
            </Field>
            <button
              type="button"
              className="btn-icon btn-ghost btn-sm"
              style={{ position: 'absolute', right: '8px', top: '28px', color: 'var(--text-dim)' }}
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {authError && (
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--danger-text)' }}>
              {authError}
            </div>
          )}

          {authSuccess && (
            <div style={{ fontSize: 'var(--font-xs)', color: 'var(--success)' }}>
              {authSuccess}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
