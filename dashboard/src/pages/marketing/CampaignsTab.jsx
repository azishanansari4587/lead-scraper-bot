import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Plus,
  Users,
  Send,
  Archive,
  BarChart2,
  DollarSign,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ExternalLink,
  MessageSquare,
  Mail,
  ChevronRight,
  Filter,
  Info
} from 'lucide-react';
import { api } from '../../api';
import { Button, Card, Modal, Drawer, Field, Select, Textarea, Badge, useToast } from '../../components/ui';

const CHANNELS = [
  { value: 'all', label: 'All Channels' },
  { value: 'email', label: 'Email Outreach' },
  { value: 'whatsapp', label: 'WhatsApp Outreach' },
  { value: 'instagram', label: 'Instagram DM' },
  { value: 'linkedin', label: 'LinkedIn InMail' },
  { value: 'trade_show', label: 'Trade Show / Exhibition' },
  { value: 'mixed', label: 'Multi-Channel' },
  { value: 'other', label: 'Other' }
];

const CAMPAIGN_STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' }
];

const BUYER_TYPES = [
  { value: 'all', label: 'All Buyer Types' },
  { value: 'designer', label: 'Interior Designer' },
  { value: 'importer', label: 'Rug Importer / Wholesaler' },
  { value: 'hotel', label: 'Hotel & Hospitality' },
  { value: 'retailer', label: 'Showroom / Retailer' },
  { value: 'online_seller', label: 'Online Rug Seller' },
  { value: 'homeowner', label: 'Bespoke Homeowner' },
  { value: 'developer', label: 'Property Developer' },
  { value: 'investor', label: 'Commercial Investor' }
];

export default function CampaignsTab({
  campaigns,
  loading,
  onRefresh,
  openNewModal = false,
  onCloseNewModal,
  selectedCampaignId = null
}) {
  const toast = useToast();
  const [channelFilter, setChannelFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [isAddLeadsModalOpen, setIsAddLeadsModalOpen] = useState(false);
  const [isSendQueueModalOpen, setIsSendQueueModalOpen] = useState(false);

  // Selected Campaign State
  const [activeCampaign, setActiveCampaign] = useState(null);
  const [campaignDetails, setCampaignDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  // New Campaign Form
  const [newCampaignData, setNewCampaignData] = useState({
    name: '',
    goal: '',
    channel: 'email',
    targetBuyerType: 'designer',
    startDate: '',
    endDate: '',
    status: 'planned',
    budget: '',
    currency: 'AED',
    notes: ''
  });

  // Add Leads Filter & Preview State
  const [leadFilters, setLeadFilters] = useState({
    buyerType: 'all',
    city: '',
    country: '',
    status: 'all',
    minScore: ''
  });
  const [leadPreview, setLeadPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [addingLeads, setAddingLeads] = useState(false);

  // Send Queue State
  const [sendQueueData, setSendQueueData] = useState(null);
  const [queueLoading, setQueueLoading] = useState(false);
  const [recordingSend, setRecordingSend] = useState({});

  useEffect(() => {
    if (openNewModal) {
      setIsCreateModalOpen(true);
    }
  }, [openNewModal]);

  useEffect(() => {
    if (selectedCampaignId && campaigns.length > 0) {
      const camp = campaigns.find((c) => c.id === Number(selectedCampaignId));
      if (camp) {
        handleOpenDetails(camp);
      }
    }
  }, [selectedCampaignId, campaigns]);

  // Load campaign details (funnel + leads)
  const handleOpenDetails = async (campaign) => {
    setActiveCampaign(campaign);
    setIsDetailDrawerOpen(true);
    setDetailsLoading(true);
    try {
      const res = await api.getCampaign(campaign.id);
      setCampaignDetails(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load campaign details');
    } finally {
      setDetailsLoading(false);
    }
  };

  // Create Campaign
  const handleCreateCampaign = async (e) => {
    e.preventDefault();
    if (!newCampaignData.name.trim()) {
      toast.error('Campaign name is required');
      return;
    }

    try {
      const payload = {
        name: newCampaignData.name.trim(),
        goal: newCampaignData.goal?.trim() || null,
        channel: newCampaignData.channel,
        targetBuyerType: newCampaignData.targetBuyerType === 'all' ? null : newCampaignData.targetBuyerType,
        startDate: newCampaignData.startDate || null,
        endDate: newCampaignData.endDate || null,
        status: newCampaignData.status,
        budget: newCampaignData.budget ? parseFloat(newCampaignData.budget) : null,
        currency: newCampaignData.currency,
        notes: newCampaignData.notes?.trim() || null
      };

      await api.createCampaign(payload);
      toast.success('Campaign created successfully');
      setIsCreateModalOpen(false);
      if (onCloseNewModal) onCloseNewModal();
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Failed to create campaign');
    }
  };

  // Open Add Leads Modal & fetch initial preview
  const handleOpenAddLeads = async (campaign) => {
    setActiveCampaign(campaign);
    setLeadFilters({
      buyerType: campaign.targetBuyerType || 'all',
      city: '',
      country: '',
      status: 'new',
      minScore: ''
    });
    setIsAddLeadsModalOpen(true);
    fetchLeadPreview(campaign.id, {
      buyerType: campaign.targetBuyerType || 'all',
      status: 'new'
    });
  };

  const fetchLeadPreview = async (campaignId, filters) => {
    setPreviewLoading(true);
    try {
      const res = await api.previewCampaignLeads(campaignId, filters);
      setLeadPreview(res);
    } catch (err) {
      toast.error(err.message || 'Failed to preview leads');
    } finally {
      setPreviewLoading(false);
    }
  };

  // Confirm Add Leads
  const handleConfirmAddLeads = async () => {
    if (!activeCampaign) return;
    setAddingLeads(true);
    try {
      const res = await api.addLeadsToCampaign(activeCampaign.id, leadFilters);
      toast.success(`Added ${res.addedCount} leads (${res.skippedOptOuts} opted-out skipped)`);
      setIsAddLeadsModalOpen(false);
      onRefresh();
      if (isDetailDrawerOpen) {
        handleOpenDetails(activeCampaign);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to add leads');
    } finally {
      setAddingLeads(false);
    }
  };

  // Open Send Queue Modal
  const handleOpenSendQueue = async (campaign) => {
    setActiveCampaign(campaign);
    setIsSendQueueModalOpen(true);
    setQueueLoading(true);
    try {
      const res = await api.getCampaignSendQueue(campaign.id);
      setSendQueueData(res);
    } catch (err) {
      toast.error(err.message || 'Failed to load send queue');
    } finally {
      setQueueLoading(false);
    }
  };

  // Record send from queue
  const handleRecordQueueSend = async (leadId, item) => {
    if (!activeCampaign) return;
    setRecordingSend((prev) => ({ ...prev, [leadId]: true }));
    try {
      await api.recordCampaignSend(activeCampaign.id, {
        leadId,
        messageSent: item.previewMessage,
        variant: item.variant,
        templateId: item.templateId
      });
      toast.success(`Outreach recorded for ${item.lead.businessName}. Follow-ups scheduled.`);
      // Refresh send queue
      const res = await api.getCampaignSendQueue(activeCampaign.id);
      setSendQueueData(res);
      onRefresh();
      if (isDetailDrawerOpen) {
        handleOpenDetails(activeCampaign);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to record outreach');
    } finally {
      setRecordingSend((prev) => ({ ...prev, [leadId]: false }));
    }
  };

  // Archive / Delete Campaign
  const handleArchiveCampaign = async (campaignId) => {
    if (!window.confirm('Archive this campaign? If no activity exists it will be deleted, otherwise marked as archived.')) return;
    try {
      const res = await api.archiveCampaign(campaignId);
      toast.success(res.message || 'Campaign archived');
      setIsDetailDrawerOpen(false);
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Failed to archive campaign');
    }
  };

  // Unarchive Campaign
  const handleUnarchiveCampaign = async (campaignId) => {
    try {
      await api.unarchiveCampaign(campaignId);
      toast.success('Campaign restored to active.');
      setIsDetailDrawerOpen(false);
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Failed to unarchive campaign');
    }
  };

  const filteredCampaigns = campaigns.filter((c) => {
    if (channelFilter !== 'all' && c.channel !== channelFilter) return false;
    if (statusFilter !== 'all' && c.status !== statusFilter) return false;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header & Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Channel Filter */}
          <select
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value)}
            style={{
              padding: '8px 12px',
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

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            {CAMPAIGN_STATUSES.map((st) => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>
        </div>

        <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
          <Plus size={16} style={{ marginRight: '6px' }} /> New Campaign
        </Button>
      </div>

      {/* Campaigns Grid */}
      {filteredCampaigns.length === 0 ? (
        <Card>
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-dim)' }}>
            <Megaphone size={36} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
            <h3 style={{ fontSize: 'var(--font-base)', color: 'var(--text-primary)', marginBottom: '8px' }}>
              No trade campaigns found
            </h3>
            <p style={{ fontSize: 'var(--font-sm)', maxWidth: '400px', margin: '0 auto 16px' }}>
              Create targeted trade outreach campaigns for UAE designers, hotel fit-outs, or international rug importers.
            </p>
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              Create First Campaign
            </Button>
          </div>
        </Card>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
          {filteredCampaigns.map((camp) => (
            <Card key={camp.id} padding="none">
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', height: '100%' }}>
                {/* Card Top: Channel + Status */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      color: 'var(--gold-accent)',
                      textTransform: 'uppercase'
                    }}
                  >
                    {camp.channel}
                  </span>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor:
                        camp.status === 'active'
                          ? 'rgba(16, 185, 129, 0.15)'
                          : camp.status === 'completed'
                          ? 'rgba(56, 189, 248, 0.15)'
                          : 'rgba(100, 116, 139, 0.15)',
                      color:
                        camp.status === 'active'
                          ? 'var(--emerald-accent)'
                          : camp.status === 'completed'
                          ? '#38BDF8'
                          : 'var(--text-dim)',
                      textTransform: 'capitalize'
                    }}
                  >
                    {camp.status}
                  </span>
                </div>

                {/* Campaign Name & Goal */}
                <div>
                  <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {camp.name}
                  </h3>
                  {camp.goal && (
                    <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                      {camp.goal}
                    </p>
                  )}
                </div>

                {/* Target & Budget Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--font-xs)', color: 'var(--text-dim)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)', padding: '8px 0' }}>
                  <span>Target: <strong style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{camp.targetBuyerType || 'All Buyers'}</strong></span>
                  <span>Leads: <strong style={{ color: 'var(--gold-accent)' }}>{camp.leadCount || 0}</strong></span>
                  {camp.budget ? (
                    <span>Budget: <strong style={{ color: 'var(--text-primary)' }}>{camp.currency} {camp.budget.toLocaleString()}</strong></span>
                  ) : null}
                </div>

                {/* Card Actions */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '8px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Button size="xs" variant="secondary" onClick={() => handleOpenAddLeads(camp)}>
                      <Users size={12} style={{ marginRight: '4px' }} /> Add Leads
                    </Button>
                    <Button size="xs" variant="primary" onClick={() => handleOpenSendQueue(camp)}>
                      <Send size={12} style={{ marginRight: '4px' }} /> Send Queue
                    </Button>
                  </div>

                  <Button size="xs" variant="ghost" onClick={() => handleOpenDetails(camp)}>
                    Funnel & Roster <ChevronRight size={14} />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Campaign Details Drawer (Funnel + Lead Roster) */}
      <Drawer
        isOpen={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        title={activeCampaign ? `${activeCampaign.name} — Performance & Funnel` : 'Campaign Details'}
        size="lg"
      >
        {detailsLoading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading funnel analytics...</div>
        ) : campaignDetails ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Stage-rank Funnel Bar Chart */}
            <Card>
              <div style={{ padding: '16px' }}>
                <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
                  Stage-Rank Funnel Conversion
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '8px', textAlign: 'center' }}>
                  {[
                    { label: 'Added', count: campaignDetails.funnel?.stages?.added || 0, color: '#64748B' },
                    { label: 'Contacted', count: campaignDetails.funnel?.stages?.contacted || 0, color: '#38BDF8' },
                    { label: 'Replied', count: campaignDetails.funnel?.stages?.replied || 0, color: '#F59E0B' },
                    { label: 'Sample', count: campaignDetails.funnel?.stages?.sample_sent || 0, color: '#818CF8' },
                    { label: 'Quotation', count: campaignDetails.funnel?.stages?.quotation || 0, color: '#EC4899' },
                    { label: 'Won', count: campaignDetails.funnel?.stages?.won || 0, color: '#10B981' }
                  ].map((st) => (
                    <div key={st.label} style={{ padding: '10px 4px', backgroundColor: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)', borderTop: `3px solid ${st.color}` }}>
                      <div style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {st.count}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {st.label}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Revenue Metrics */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', padding: '12px', backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <div>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>Won Revenue: </span>
                    <strong style={{ fontSize: 'var(--font-base)', color: 'var(--emerald-accent)' }}>
                      {campaignDetails.funnel?.revenue?.currency || 'AED'} {(campaignDetails.funnel?.revenue?.wonRevenue || 0).toLocaleString()}
                    </strong>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', marginLeft: '12px' }}>
                      (Total Pipeline: {campaignDetails.funnel?.revenue?.currency || 'AED'} {(campaignDetails.funnel?.revenue?.totalDealValue || 0).toLocaleString()})
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                    {campaignDetails.funnel?.revenue?.leadsWithNoValue || 0} leads with no deal value recorded
                  </span>
                </div>

                {/* Lost Leads Breakdown (Item 7) */}
                <div style={{ marginTop: '14px', padding: '12px', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} style={{ color: 'var(--rose-accent, #ef4444)' }} />
                      <strong style={{ fontSize: 'var(--font-sm)', color: 'var(--text-primary)' }}>
                        Lost / Dropped Leads ({campaignDetails.funnel?.lost?.count || 0})
                      </strong>
                    </div>
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                      {campaignDetails.funnel?.lost?.percentage || 0}% drop-off
                    </span>
                  </div>

                  {campaignDetails.funnel?.lost?.byStage && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      {Object.entries(campaignDetails.funnel.lost.byStage).map(([stage, count]) => {
                        if (count === 0) return null;
                        return (
                          <span
                            key={stage}
                            style={{
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: 'var(--surface-subtle)',
                              color: 'var(--text-secondary)',
                              border: '1px solid var(--border-subtle)'
                            }}
                          >
                            Lost at {stage.replace('_', ' ')}: <strong style={{ color: 'var(--rose-accent, #ef4444)' }}>{count}</strong>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.4 }}>
                    Note: Stage lost is derived from status change audit logs and outreach history. Unlogged transitions are categorized under "unknown".
                  </div>
                </div>
              </div>
            </Card>

            {/* Quick Actions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <Button size="sm" variant="secondary" onClick={() => handleOpenAddLeads(activeCampaign)}>
                  <Users size={14} style={{ marginRight: '6px' }} /> Add Leads
                </Button>
                <Button size="sm" variant="primary" onClick={() => handleOpenSendQueue(activeCampaign)}>
                  <Send size={14} style={{ marginRight: '6px' }} /> Send Queue
                </Button>
              </div>

              {activeCampaign.status === 'archived' ? (
                <Button size="sm" variant="secondary" onClick={() => handleUnarchiveCampaign(activeCampaign.id)}>
                  <CheckCircle2 size={14} style={{ marginRight: '6px', color: 'var(--emerald-accent)' }} /> Unarchive Campaign
                </Button>
              ) : (
                <Button size="sm" variant="danger" onClick={() => handleArchiveCampaign(activeCampaign.id)}>
                  <Archive size={14} style={{ marginRight: '6px' }} /> Archive Campaign
                </Button>
              )}
            </div>

            {/* Lead Roster Table */}
            <div>
              <h4 style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Leads in Campaign ({campaignDetails.leads?.length || 0})
              </h4>
              <div style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-xs)' }}>
                  <thead style={{ backgroundColor: 'var(--surface-subtle)', position: 'sticky', top: 0 }}>
                    <tr style={{ color: 'var(--text-secondary)' }}>
                      <th style={{ padding: '8px 12px' }}>Business</th>
                      <th style={{ padding: '8px 12px' }}>Buyer Type</th>
                      <th style={{ padding: '8px 12px' }}>Status</th>
                      <th style={{ padding: '8px 12px' }}>Deal Value</th>
                      <th style={{ padding: '8px 12px' }}>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(!campaignDetails.leads || campaignDetails.leads.length === 0) ? (
                      <tr>
                        <td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--text-dim)' }}>
                          No leads in this campaign yet. Click "Add Leads" to ingest filtered leads.
                        </td>
                      </tr>
                    ) : (
                      campaignDetails.leads.map((l) => (
                        <tr key={l.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                          <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>{l.businessName}</td>
                          <td style={{ padding: '8px 12px', textTransform: 'capitalize' }}>{l.buyerType}</td>
                          <td style={{ padding: '8px 12px' }}>
                            <span style={{ textTransform: 'capitalize', color: l.status === 'won' ? 'var(--emerald-accent)' : 'var(--text-secondary)' }}>
                              {l.status}
                            </span>
                          </td>
                          <td style={{ padding: '8px 12px' }}>
                            {l.dealValue ? `${l.dealCurrency || 'AED'} ${l.dealValue.toLocaleString()}` : <span style={{ color: 'var(--text-dim)' }}>Not recorded</span>}
                          </td>
                          <td style={{ padding: '8px 12px', color: 'var(--text-dim)' }}>{l.city || l.country || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : null}
      </Drawer>

      {/* New Campaign Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          if (onCloseNewModal) onCloseNewModal();
        }}
        title="Create Trade Campaign"
        size="md"
      >
        <form onSubmit={handleCreateCampaign} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Field label="Campaign Name *" hint="e.g. Q4 Dubai Luxury Villa Interior Designers">
            <input
              type="text"
              required
              value={newCampaignData.name}
              onChange={(e) => setNewCampaignData({ ...newCampaignData, name: e.target.value })}
              placeholder="e.g. Index Dubai Trade Show Follow-up 2026"
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

          <Field label="Campaign Goal">
            <input
              type="text"
              value={newCampaignData.goal}
              onChange={(e) => setNewCampaignData({ ...newCampaignData, goal: e.target.value })}
              placeholder="e.g. Book 15 swatch box sample deliveries to boutique interior firms"
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
            <Field label="Outreach Channel">
              <Select
                value={newCampaignData.channel}
                onChange={(e) => setNewCampaignData({ ...newCampaignData, channel: e.target.value })}
              >
                {CHANNELS.filter((ch) => ch.value !== 'all').map((ch) => (
                  <option key={ch.value} value={ch.value}>{ch.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Target Buyer Type">
              <Select
                value={newCampaignData.targetBuyerType}
                onChange={(e) => setNewCampaignData({ ...newCampaignData, targetBuyerType: e.target.value })}
              >
                {BUYER_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Start Date">
              <input
                type="date"
                value={newCampaignData.startDate}
                onChange={(e) => setNewCampaignData({ ...newCampaignData, startDate: e.target.value })}
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

            <Field label="End Date">
              <input
                type="date"
                value={newCampaignData.endDate}
                onChange={(e) => setNewCampaignData({ ...newCampaignData, endDate: e.target.value })}
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

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
            <Field label="Budget (Optional)">
              <input
                type="number"
                min="0"
                value={newCampaignData.budget}
                onChange={(e) => setNewCampaignData({ ...newCampaignData, budget: e.target.value })}
                placeholder="0"
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
                value={newCampaignData.currency}
                onChange={(e) => setNewCampaignData({ ...newCampaignData, currency: e.target.value })}
              >
                <option value="AED">AED</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="SAR">SAR</option>
                <option value="INR">INR</option>
              </Select>
            </Field>
          </div>

          <Field label="Strategic Notes">
            <Textarea
              rows={3}
              value={newCampaignData.notes}
              onChange={(e) => setNewCampaignData({ ...newCampaignData, notes: e.target.value })}
              placeholder="Key value props: fast UAE stock delivery, custom rug weaving within 4-6 weeks..."
            />
          </Field>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsCreateModalOpen(false);
                if (onCloseNewModal) onCloseNewModal();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Create Campaign
            </Button>
          </div>
        </form>
      </Modal>

      {/* Add Leads Modal with Live Filter & Opt-Out Preview */}
      <Modal
        isOpen={isAddLeadsModalOpen}
        onClose={() => setIsAddLeadsModalOpen(false)}
        title={`Add Filtered Leads to ${activeCampaign?.name || 'Campaign'}`}
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
            Filter leads from your pipeline to add in bulk. Opted-out leads and duplicate campaign entries will be skipped automatically.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Buyer Type">
              <Select
                value={leadFilters.buyerType}
                onChange={(e) => {
                  const updated = { ...leadFilters, buyerType: e.target.value };
                  setLeadFilters(updated);
                  fetchLeadPreview(activeCampaign.id, updated);
                }}
              >
                {BUYER_TYPES.map((bt) => (
                  <option key={bt.value} value={bt.value}>{bt.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Lead Status">
              <Select
                value={leadFilters.status}
                onChange={(e) => {
                  const updated = { ...leadFilters, status: e.target.value };
                  setLeadFilters(updated);
                  fetchLeadPreview(activeCampaign.id, updated);
                }}
              >
                <option value="all">All Statuses</option>
                <option value="new">New (Uncontacted)</option>
                <option value="contacted">Contacted</option>
                <option value="replied">Replied</option>
              </Select>
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="City">
              <input
                type="text"
                placeholder="e.g. Dubai"
                value={leadFilters.city}
                onChange={(e) => {
                  const updated = { ...leadFilters, city: e.target.value };
                  setLeadFilters(updated);
                  fetchLeadPreview(activeCampaign.id, updated);
                }}
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
                placeholder="e.g. United Arab Emirates"
                value={leadFilters.country}
                onChange={(e) => {
                  const updated = { ...leadFilters, country: e.target.value };
                  setLeadFilters(updated);
                  fetchLeadPreview(activeCampaign.id, updated);
                }}
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

          {/* Live Preview Counts Box */}
          <div
            style={{
              padding: '14px',
              backgroundColor: 'var(--surface-subtle)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--text-primary)' }}>
                Audience Preview:
              </span>
              {previewLoading && <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Calculating...</span>}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
              <div style={{ padding: '8px', backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {leadPreview?.totalMatched ?? '-'}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Matched Filters</div>
              </div>

              <div style={{ padding: '8px', backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--rose-accent)' }}>
                  {leadPreview?.skippedOptOuts ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--rose-accent)' }}>Opt-Outs Skipped</div>
              </div>

              <div style={{ padding: '8px', backgroundColor: 'var(--surface-card)', borderRadius: 'var(--radius-sm)' }}>
                <div style={{ fontSize: 'var(--font-lg)', fontWeight: 700, color: 'var(--emerald-accent)' }}>
                  {leadPreview?.eligibleCount ?? 0}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--emerald-accent)' }}>Eligible to Add</div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <Button variant="secondary" onClick={() => setIsAddLeadsModalOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={addingLeads || !leadPreview?.eligibleCount}
              onClick={handleConfirmAddLeads}
            >
              {addingLeads ? 'Adding...' : `Add ${leadPreview?.eligibleCount || 0} Leads`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Send Queue Modal (WhatsApp wa.me link flow & Email) */}
      <Modal
        isOpen={isSendQueueModalOpen}
        onClose={() => setIsSendQueueModalOpen(false)}
        title={`Send Queue: ${activeCampaign?.name || 'Campaign'}`}
        size="lg"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              Outreach queue for leads added to this campaign. OptOut status is strictly re-verified before each send.
            </p>
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--gold-accent)', fontWeight: 600 }}>
              {sendQueueData?.queue?.length || 0} leads pending
            </span>
          </div>

          {queueLoading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>Loading send queue...</div>
          ) : !sendQueueData || sendQueueData.queue?.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)', backgroundColor: 'var(--surface-subtle)', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle2 size={32} color="var(--emerald-accent)" style={{ margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Queue is Clean!</div>
              <p style={{ fontSize: 'var(--font-xs)' }}>All eligible leads in this campaign have already been contacted.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '420px', overflowY: 'auto' }}>
              {sendQueueData.queue.map((item) => {
                const lead = item.lead;
                const isRecording = recordingSend[lead.id];
                const phoneClean = (lead.whatsapp || lead.phone || '').replace(/[^0-9]/g, '');
                const encodedMsg = encodeURIComponent(item.previewMessage || '');
                const waLink = phoneClean ? `https://wa.me/${phoneClean}?text=${encodedMsg}` : null;

                return (
                  <div
                    key={lead.id}
                    style={{
                      padding: '14px',
                      backgroundColor: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {lead.businessName}
                        </span>
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                          • {lead.buyerType} • {lead.city || lead.country || 'UAE'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: item.variant === 'A' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                            color: item.variant === 'A' ? '#38BDF8' : 'var(--gold-accent)'
                          }}
                        >
                          Variant {item.variant}
                        </span>
                      </div>
                    </div>

                    {/* Preview Message */}
                    <div
                      style={{
                        padding: '10px',
                        backgroundColor: 'var(--surface-card)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: 'var(--font-xs)',
                        color: 'var(--text-secondary)',
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '90px',
                        overflowY: 'auto'
                      }}
                    >
                      {item.previewMessage}
                    </div>

                    {/* Actions Bar */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>
                        {sendQueueData.channel === 'whatsapp' ? (lead.whatsapp || lead.phone || 'No phone') : (lead.email || 'No email')}
                      </span>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        {sendQueueData.channel === 'whatsapp' && waLink && (
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noreferrer"
                            style={{ textDecoration: 'none' }}
                          >
                            <Button size="xs" variant="secondary">
                              <MessageSquare size={13} style={{ marginRight: '4px' }} /> Open WhatsApp
                            </Button>
                          </a>
                        )}

                        <Button
                          size="xs"
                          variant="primary"
                          disabled={isRecording}
                          onClick={() => handleRecordQueueSend(lead.id, item)}
                        >
                          {isRecording ? 'Recording...' : 'Record Sent'}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button variant="secondary" onClick={() => setIsSendQueueModalOpen(false)}>
              Close Queue
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
