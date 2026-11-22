import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  Download,
  Plus,
  BarChart3,
  Split,
  PhoneCall,
  Share2,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  DollarSign,
  FileSpreadsheet
} from 'lucide-react';
import { api } from '../../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, useToast, SkeletonCard } from '../../components/ui';

const INBOUND_SOURCES = [
  { value: 'whatsapp_inbound', label: 'WhatsApp Inbound (+971)' },
  { value: 'website_form', label: 'Website Inquiry Form' },
  { value: 'instagram', label: 'Instagram DM / Link in Bio' },
  { value: 'linkedin', label: 'LinkedIn InMail / Message' },
  { value: 'referral', label: 'Client / Trade Referral' },
  { value: 'trade_show', label: 'Trade Show / Index Exhibition' },
  { value: 'walk_in', label: 'Ajman Office / Walk-in' },
  { value: 'manual', label: 'Direct Cold Scout' },
  { value: 'other', label: 'Other Channel' }
];

const BUYER_TYPES = [
  { value: 'designer', label: 'Interior Designer' },
  { value: 'importer', label: 'Rug Importer / Wholesaler' },
  { value: 'hotel', label: 'Hotel & Hospitality' },
  { value: 'retailer', label: 'Showroom / Retailer' },
  { value: 'online_seller', label: 'Online Rug Seller' },
  { value: 'homeowner', label: 'Bespoke Homeowner' },
  { value: 'developer', label: 'Property Developer' },
  { value: 'investor', label: 'Commercial Investor' }
];

export default function SourcesTab({
  openInboundModal = false,
  onCloseInboundModal
}) {
  const toast = useToast();
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [isInboundModalOpen, setIsInboundModalOpen] = useState(false);

  // Inbound Form State
  const [inboundData, setInboundData] = useState({
    businessName: '',
    phone: '',
    email: '',
    source: 'whatsapp_inbound',
    buyerType: 'designer',
    dealValue: '',
    dealCurrency: 'AED',
    city: 'Dubai',
    country: 'United Arab Emirates',
    notes: ''
  });

  const fetchReport = async () => {
    try {
      setLoading(true);
      const res = await api.getSourcesReport();
      setReport(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load attribution report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  useEffect(() => {
    if (openInboundModal) {
      setIsInboundModalOpen(true);
    }
  }, [openInboundModal]);

  // Handle Quick Add Inbound Lead
  const handleSaveInbound = async (e) => {
    e.preventDefault();
    if (!inboundData.businessName.trim()) {
      toast.error('Client or business name is required');
      return;
    }

    try {
      const payload = {
        businessName: inboundData.businessName.trim(),
        phone: inboundData.phone?.trim() || null,
        email: inboundData.email?.trim() || null,
        source: inboundData.source,
        buyerType: inboundData.buyerType,
        dealValue: inboundData.dealValue ? parseFloat(inboundData.dealValue) : null,
        dealCurrency: inboundData.dealCurrency || 'AED',
        city: inboundData.city?.trim() || 'Dubai',
        country: inboundData.country?.trim() || 'United Arab Emirates',
        notes: inboundData.notes?.trim() || null
      };

      await api.addInboundLead(payload);
      toast.success('Inbound lead added with immediate Day 1 follow-up created!');
      setIsInboundModalOpen(false);
      if (onCloseInboundModal) onCloseInboundModal();
      fetchReport();
    } catch (err) {
      toast.error(err.message || 'Failed to save inbound lead');
    }
  };

  // Download Excel
  const handleDownloadExcel = async () => {
    try {
      setIsExporting(true);
      const res = await fetch('/api/marketing/export-sources');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `knotiq_marketing_sources_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success('Excel report downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download Excel report');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  const { sources = [], abTesting = {}, callConnectRates = [], topPosts = [] } = report || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Action Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: 'var(--font-lg)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Attribution & ROI Analytics
          </h2>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
            Track which platforms and cold sequences drive high-value custom rug contracts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <Button
            variant="secondary"
            disabled={isExporting}
            onClick={handleDownloadExcel}
          >
            <FileSpreadsheet size={15} style={{ marginRight: '6px' }} />
            {isExporting ? 'Generating...' : 'Export Excel (.xlsx)'}
          </Button>

          <Button
            variant="primary"
            onClick={() => setIsInboundModalOpen(true)}
          >
            <Plus size={16} style={{ marginRight: '6px' }} /> Quick Inbound Lead
          </Button>
        </div>
      </div>

      {/* Sources Conversion Table */}
      <Card>
        <div style={{ padding: '20px' }}>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={18} color="var(--emerald-accent)" /> Lead Sources Conversion & Won Revenue
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 14px' }}>Source Platform</th>
                  <th style={{ padding: '10px 14px' }}>Total Leads</th>
                  <th style={{ padding: '10px 14px' }}>Contacted</th>
                  <th style={{ padding: '10px 14px' }}>Replied</th>
                  <th style={{ padding: '10px 14px' }}>Samples Sent</th>
                  <th style={{ padding: '10px 14px' }}>Quotation</th>
                  <th style={{ padding: '10px 14px' }}>Won Deals</th>
                  <th style={{ padding: '10px 14px' }}>Won Value (AED)</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Win Rate</th>
                </tr>
              </thead>
              <tbody>
                {sources.length === 0 ? (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No leads recorded across sources yet.
                    </td>
                  </tr>
                ) : (
                  sources.map((s) => (
                    <tr key={s.source} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {s.source.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{s.totalLeads}</td>
                      <td style={{ padding: '10px 14px', color: '#38BDF8' }}>{s.contacted}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--gold-accent)' }}>{s.replied}</td>
                      <td style={{ padding: '10px 14px' }}>{s.sample_sent}</td>
                      <td style={{ padding: '10px 14px' }}>{s.quotation}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--emerald-accent)' }}>{s.won}</td>
                      <td style={{ padding: '10px 14px' }}>
                        {s.wonRevenue > 0 ? (
                          <strong style={{ color: 'var(--emerald-accent)' }}>
                            AED {s.wonRevenue.toLocaleString()}
                          </strong>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>AED 0</span>
                        )}
                        {s.leadsWithNoValue > 0 && (
                          <div style={{ fontSize: '10px', color: 'var(--text-dim)' }}>
                            ({s.leadsWithNoValue} with no val)
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 600, color: s.conversionRate > 0 ? 'var(--emerald-accent)' : 'var(--text-dim)' }}>
                        {s.conversionRate}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Two Column Grid: A/B Testing Matrix + Buyer Type Call Connect Rates */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '20px' }}>
        {/* A/B Testing Matrix */}
        <Card>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Split size={18} color="var(--gold-accent)" /> A/B Outreach Copy Testing
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Deterministic 50/50 split across Day 1, 4 & 7 sequences
                </p>
              </div>

              {abTesting?.hasWinner ? (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--emerald-accent)'
                  }}
                >
                  Winner: Variant {abTesting.winner}
                </span>
              ) : (
                <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                  {abTesting?.notice || 'Requires 25+ sends per variant'}
                </span>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              {/* Variant A Card */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: abTesting?.winner === 'A' ? '2px solid var(--emerald-accent)' : '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: '#38BDF8' }}>Variant A</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{abTesting?.variantA?.sends || 0} sends</span>
                </div>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {abTesting?.variantA?.replyRate || 0}%
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  {abTesting?.variantA?.replies || 0} replies recorded
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' }}>
                  Threshold: {abTesting?.variantA?.sends || 0}/25 sends
                </div>
              </div>

              {/* Variant B Card */}
              <div
                style={{
                  padding: '16px',
                  backgroundColor: 'var(--surface-subtle)',
                  borderRadius: 'var(--radius-md)',
                  border: abTesting?.winner === 'B' ? '2px solid var(--emerald-accent)' : '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: 'var(--gold-accent)' }}>Variant B</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{abTesting?.variantB?.sends || 0} sends</span>
                </div>
                <div style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  {abTesting?.variantB?.replyRate || 0}%
                </div>
                <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  {abTesting?.variantB?.replies || 0} replies recorded
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginTop: '8px' }}>
                  Threshold: {abTesting?.variantB?.sends || 0}/25 sends
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Buyer Type Call Connect Rates */}
        <Card>
          <div style={{ padding: '20px' }}>
            <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <PhoneCall size={18} color="#38BDF8" /> Buyer Type Call Connect Rates
            </h3>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', marginBottom: '14px' }}>
              Phone outreach pickup and engagement by segment
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '220px', overflowY: 'auto' }}>
              {callConnectRates.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                  No phone calls logged yet.
                </div>
              ) : (
                callConnectRates.map((cr) => (
                  <div
                    key={cr.buyerType}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      backgroundColor: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-md)'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                        {cr.buyerType.replace(/_/g, ' ')}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)', marginLeft: '8px' }}>
                        ({cr.connected} of {cr.totalCalls} connected)
                      </span>
                    </div>
                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: 700, color: cr.connectRate > 0 ? 'var(--emerald-accent)' : 'var(--text-dim)' }}>
                      {cr.connectRate}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Top Published Posts Ranking */}
      <Card>
        <div style={{ padding: '20px' }}>
          <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Share2 size={18} color="var(--gold-accent)" /> Top Performing Content Posts
          </h3>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '10px 14px' }}>Platform</th>
                  <th style={{ padding: '10px 14px' }}>Topic</th>
                  <th style={{ padding: '10px 14px' }}>Published</th>
                  <th style={{ padding: '10px 14px' }}>Impressions</th>
                  <th style={{ padding: '10px 14px' }}>Likes</th>
                  <th style={{ padding: '10px 14px' }}>Clicks</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Leads Generated</th>
                </tr>
              </thead>
              <tbody>
                {topPosts.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No published posts with performance metrics yet.
                    </td>
                  </tr>
                ) : (
                  topPosts.map((post) => (
                    <tr key={post.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', backgroundColor: 'rgba(245, 158, 11, 0.1)', color: 'var(--gold-accent)', textTransform: 'uppercase' }}>
                          {post.platform}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: 'var(--text-primary)' }}>
                        {post.topic}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                        {post.postedAt ? new Date(post.postedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '-'}
                      </td>
                      <td style={{ padding: '10px 14px' }}>{post.impressions || 0}</td>
                      <td style={{ padding: '10px 14px' }}>{post.likes || 0}</td>
                      <td style={{ padding: '10px 14px' }}>{post.clicks || 0}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: post.leadsGenerated > 0 ? 'var(--emerald-accent)' : 'var(--text-dim)' }}>
                        {post.leadsGenerated || 0} leads
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>

      {/* Quick Add Inbound Lead Modal */}
      <Modal
        isOpen={isInboundModalOpen}
        onClose={() => {
          setIsInboundModalOpen(false);
          if (onCloseInboundModal) onCloseInboundModal();
        }}
        title="Quick-Add Inbound Lead"
        size="md"
      >
        <form onSubmit={handleSaveInbound} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
            Record an inbound inquiry from WhatsApp, website form, or trade exhibition. Automatically creates immediate Day 1 follow-up and deduplicates.
          </p>

          <Field label="Business or Client Name *" hint="e.g. Al Wasl Luxury Interiors LLC">
            <input
              type="text"
              required
              value={inboundData.businessName}
              onChange={(e) => setInboundData({ ...inboundData, businessName: e.target.value })}
              placeholder="e.g. Mirage Hospitality Group"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Phone / WhatsApp">
              <input
                type="text"
                value={inboundData.phone}
                onChange={(e) => setInboundData({ ...inboundData, phone: e.target.value })}
                placeholder="+971 50 123 4567"
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

            <Field label="Email Address">
              <input
                type="email"
                value={inboundData.email}
                onChange={(e) => setInboundData({ ...inboundData, email: e.target.value })}
                placeholder="procurement@mirage.ae"
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
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Inbound Channel / Source">
              <Select
                value={inboundData.source}
                onChange={(e) => setInboundData({ ...inboundData, source: e.target.value })}
              >
                {INBOUND_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Buyer Type">
              <Select
                value={inboundData.buyerType}
                onChange={(e) => setInboundData({ ...inboundData, buyerType: e.target.value })}
              >
                {BUYER_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <Field label="Estimated Deal Value (Optional)">
              <input
                type="number"
                min="0"
                value={inboundData.dealValue}
                onChange={(e) => setInboundData({ ...inboundData, dealValue: e.target.value })}
                placeholder="e.g. 45000"
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

            <Field label="Currency">
              <Select
                value={inboundData.dealCurrency}
                onChange={(e) => setInboundData({ ...inboundData, dealCurrency: e.target.value })}
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SAR">SAR</option>
                <option value="INR">INR</option>
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="City">
              <input
                type="text"
                value={inboundData.city}
                onChange={(e) => setInboundData({ ...inboundData, city: e.target.value })}
                placeholder="Dubai"
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

            <Field label="Country">
              <input
                type="text"
                value={inboundData.country}
                onChange={(e) => setInboundData({ ...inboundData, country: e.target.value })}
                placeholder="United Arab Emirates"
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
          </div>

          <Field label="Initial Inbound Notes">
            <Textarea
              rows={3}
              value={inboundData.notes}
              onChange={(e) => setInboundData({ ...inboundData, notes: e.target.value })}
              placeholder="Inquired about 10x14 ft hand-tufted botanical wool rug for penthouse in Downtown Dubai..."
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsInboundModalOpen(false);
                if (onCloseInboundModal) onCloseInboundModal();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Save Inbound Lead
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
