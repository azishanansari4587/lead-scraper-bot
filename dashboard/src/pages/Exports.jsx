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
import {
  Button,
  Field,
  Select,
  Card,
  Badge,
  EmptyState,
  useToast
} from '../components/ui';

const FORMATS = [
  { id: 'xlsx', label: 'Excel Workbook (.xlsx)', icon: FileSpreadsheet, desc: 'Styled multi-sheet workbook with score highlights and summary' },
  { id: 'csv', label: 'CSV Spreadsheet (.csv)', icon: FileText, desc: 'UTF-8 BOM with formula injection protection for Excel & Sheets' },
  { id: 'pdf', label: 'Executive PDF Dossier (.pdf)', icon: FileText, desc: 'Branded Knotiq Rugs intelligence report with KPI metrics' },
  { id: 'whatsapp', label: 'WhatsApp Broadcast List', icon: MessageSquare, desc: 'Formatted phone list with 1-click wa.me chat initiation links' },
  { id: 'json', label: 'JSON Dataset (.json)', icon: FileCode, desc: 'Machine-readable structured lead dataset for API integrations' }
];

export default function Exports() {
  const toast = useToast();

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
      toast.error('Failed to load export jobs history');
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
      toast.info('Export job queued. File generating in background.');
      setTimeout(loadExports, 1200);
    } catch (err) {
      toast.error(`Export failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-content">
      {/* Export Generator Card */}
      <Card
        title="Generate B2B Lead Export Dossier"
        icon={Download}
        subtitle="Export qualified leads with formula protection, signed 15-minute download links, and customized trade formats."
      >
        <form onSubmit={handleCreateExport}>
          {/* Format Selection Grid */}
          <div className="grid-responsive" style={{ marginBottom: '20px' }}>
            {FORMATS.map((fmt) => {
              const Icon = fmt.icon;
              const isSelected = selectedFormat === fmt.id;
              return (
                <div
                  key={fmt.id}
                  onClick={() => setSelectedFormat(fmt.id)}
                  tabIndex={0}
                  role="radio"
                  aria-checked={isSelected}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedFormat(fmt.id);
                    }
                  }}
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
                    <Icon size={18} color={isSelected ? 'var(--gold-primary)' : 'var(--text-dim)'} aria-hidden="true" />
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-sm)', color: isSelected ? 'var(--text-heading)' : 'var(--text-main)' }}>
                      {fmt.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', lineHeight: '1.4' }}>
                    {fmt.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Filter options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))', gap: '16px', marginBottom: '20px' }}>
            <Field label="Filter Country" id="export-country">
              <Select
                id="export-country"
                value={exportCountry}
                onChange={(e) => setExportCountry(e.target.value)}
              >
                <option value="">All Destination Countries</option>
                <option value="UAE">UAE</option>
                <option value="USA">USA</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Germany">Germany</option>
                <option value="Australia">Australia</option>
                <option value="Saudi Arabia">Saudi Arabia</option>
              </Select>
            </Field>

            <Field label="Filter Category" id="export-category">
              <Select
                id="export-category"
                value={exportLeadType}
                onChange={(e) => setExportLeadType(e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="rug_retailer">Rug Retailers</option>
                <option value="interior_designer">Interior Designers</option>
                <option value="interior_contractor">Fit-out Contractors</option>
                <option value="architect">Architects</option>
              </Select>
            </Field>

            <Field label="Minimum Qualification Score" id="export-score">
              <Select
                id="export-score"
                value={exportMinScore}
                onChange={(e) => setExportMinScore(e.target.value)}
              >
                <option value="">Any Score</option>
                <option value="70">≥ 70 (High Fit Only)</option>
                <option value="40">≥ 40 (Medium+ Fit)</option>
              </Select>
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <Button
              type="submit"
              variant="primary"
              size="lg"
              icon={Download}
              loading={submitting}
            >
              Generate {selectedFormat.toUpperCase()} Export
            </Button>
          </div>
        </form>
      </Card>

      {/* Export Jobs History */}
      <Card title="Generated Export Dossiers" icon={Clock}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Format</th>
                <th>Target Scope</th>
                <th>Status</th>
                <th>Leads Count</th>
                <th>Created Time</th>
                <th style={{ textAlign: 'right' }}>Download</th>
              </tr>
            </thead>
            <tbody>
              {exportJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: 0 }}>
                    <EmptyState
                      title="No exports generated yet"
                      description="Create an Excel or PDF dossier using the form above."
                    />
                  </td>
                </tr>
              ) : (
                exportJobs.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <Badge variant="primary" style={{ textTransform: 'uppercase' }}>
                        {job.format}
                      </Badge>
                    </td>
                    <td style={{ fontSize: 'var(--font-xs)' }}>
                      {job.filters?.country || 'Global'} • {job.filters?.leadType || 'All Categories'}
                    </td>
                    <td>
                      <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'warning'}>
                        {job.status}
                      </Badge>
                    </td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>
                      {job.leadCount || '—'}
                    </td>
                    <td className="tabular-nums" style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {job.downloadUrl ? (
                        <a
                          href={job.downloadUrl}
                          className="btn btn-secondary btn-sm"
                          download
                        >
                          <Download size={13} aria-hidden="true" /> Download
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>Generating...</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
