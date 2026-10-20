import React, { useState, useEffect } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileText,
  FileCode,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../api';

const FORMATS = [
  { id: 'xlsx', label: 'Excel Workbook (.xlsx)', icon: FileSpreadsheet, desc: 'Styled multi-sheet workbook with score highlights and summary' },
  { id: 'csv', label: 'CSV Spreadsheet (.csv)', icon: FileText, desc: 'UTF-8 BOM with formula injection protection for Excel & Sheets' },
  { id: 'pdf', label: 'Executive PDF Dossier (.pdf)', icon: FileText, desc: 'Branded Knotiq Rugs intelligence report with KPI metrics' },
  { id: 'whatsapp', label: 'WhatsApp Broadcast List', icon: MessageSquare, desc: 'Formatted phone list with 1-click wa.me chat initiation links' },
  { id: 'json', label: 'JSON Data (.json)', icon: FileCode, desc: 'Machine-readable structured lead dataset for API integrations' }
];

export default function Exports() {
  const [selectedFormat, setSelectedFormat] = useState('xlsx');
  const [exportCountry, setExportCountry] = useState('');
  const [exportLeadType, setExportLeadType] = useState('');
  const [exportMinScore, setExportMinScore] = useState('');

  const [exportJobs, setExportJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadExports();
  }, []);

  async function loadExports() {
    try {
      setLoading(true);
      const res = await api.getExports();
      setExportJobs(res.jobs || []);
    } catch (err) {
      console.error('Failed to load export jobs', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateExport(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.createExport(selectedFormat, {
        country: exportCountry || undefined,
        leadType: exportLeadType || undefined,
        minScore: exportMinScore ? parseInt(exportMinScore, 10) : undefined
      });
      // Refresh list
      setTimeout(loadExports, 1000);
      alert('Export job queued! Generating file in background...');
    } catch (err) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-content">
      {/* Export Generator Card */}
      <div className="card">
        <div className="card-header">
          <div>
            <h2 className="card-title">
              <Download size={18} color="var(--gold-primary)" /> Generate Lead Export
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              Export qualified leads with formula protection and signed 15-minute download links.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateExport}>
          {/* Format Selection Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
            {FORMATS.map((fmt) => {
              const Icon = fmt.icon;
              const isSelected = selectedFormat === fmt.id;
              return (
                <div
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  style={{
                    background: isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-app)',
                    border: `1px solid ${isSelected ? 'var(--gold-primary)' : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-md)',
                    padding: '16px',
                    cursor: 'pointer',
                    boxShadow: isSelected ? 'var(--shadow-glow)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                    <Icon size={18} color={isSelected ? 'var(--gold-primary)' : 'var(--text-muted)'} />
                    <span style={{ fontWeight: 700, fontSize: '13.5px', color: isSelected ? '#FFF' : 'var(--text-main)' }}>
                      {fmt.label}
                    </span>
                  </div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: 1.4 }}>
                    {fmt.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Filter Country</label>
              <select className="select" style={{ width: '100%' }} value={exportCountry} onChange={(e) => setExportCountry(e.target.value)}>
                <option value="">All Destination Countries</option>
                <option value="UAE">UAE</option>
                <option value="USA">USA</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Germany">Germany</option>
                <option value="Australia">Australia</option>
                <option value="Saudi Arabia">Saudi Arabia</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Filter Category</label>
              <select className="select" style={{ width: '100%' }} value={exportLeadType} onChange={(e) => setExportLeadType(e.target.value)}>
                <option value="">All Categories</option>
                <option value="rug_retailer">Rug Retailers</option>
                <option value="interior_designer">Interior Designers</option>
                <option value="interior_contractor">Fit-out Contractors</option>
                <option value="architect">Architects</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Min Fit Score</label>
              <select className="select" style={{ width: '100%' }} value={exportMinScore} onChange={(e) => setExportMinScore(e.target.value)}>
                <option value="">Any Score</option>
                <option value="70">≥ 70 (High Fit Only)</option>
                <option value="80">≥ 80 (Prime Targets Only)</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              <Download size={16} /> Generate {selectedFormat.toUpperCase()} Export
            </button>
          </div>
        </form>
      </div>

      {/* Export Jobs History */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">
            <Clock size={18} color="var(--gold-primary)" /> Export History & Signed Downloads
          </h2>
          <button className="btn btn-secondary btn-sm" onClick={loadExports}>Refresh</button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>File Name</th>
                <th>Format</th>
                <th>Records</th>
                <th>Status</th>
                <th>Expires</th>
                <th style={{ textAlign: 'right' }}>Download Link</th>
              </tr>
            </thead>
            <tbody>
              {exportJobs.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-dim)' }}>
                    No export jobs created yet.
                  </td>
                </tr>
              ) : (
                exportJobs.map((job) => (
                  <tr key={job.id}>
                    <td style={{ fontWeight: 600, color: '#FFF' }}>{job.fileName}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: '12px' }}>{job.format}</td>
                    <td>{job.totalRecords || 0} leads</td>
                    <td>
                      <span className={`badge ${job.status === 'completed' ? 'badge-score-high' : 'badge-score-med'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {job.expiresAt ? new Date(job.expiresAt).toLocaleTimeString() : '15 mins'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {job.downloadUrl && job.status === 'completed' ? (
                        <a
                          href={job.downloadUrl}
                          download
                          className="btn btn-primary btn-sm"
                        >
                          <Download size={13} /> Download
                        </a>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>Processing...</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
