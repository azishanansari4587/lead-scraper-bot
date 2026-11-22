import React, { useState, useEffect, useCallback } from 'react';
import {
  Megaphone,
  Calendar,
  Share2,
  TrendingUp,
  LayoutDashboard,
  Plus,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { api } from '../api';
import { Button, Card, useToast } from '../components/ui';

import OverviewTab from './marketing/OverviewTab';
import ContentTab from './marketing/ContentTab';
import CampaignsTab from './marketing/CampaignsTab';
import SourcesTab from './marketing/SourcesTab';
import TemplatesTab from './marketing/TemplatesTab';
import { FileText } from 'lucide-react';

export default function Marketing() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'content' | 'campaigns' | 'sources'
  const [contentPosts, setContentPosts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Cross-tab modal control states
  const [openNewPostModal, setOpenNewPostModal] = useState(false);
  const [openNewCampaignModal, setOpenNewCampaignModal] = useState(false);
  const [openInboundModal, setOpenInboundModal] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [contentInitialView, setContentInitialView] = useState('kanban');

  // Load all shared marketing resources
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [contentRes, campaignsRes] = await Promise.all([
        api.getContentPosts(),
        api.getCampaigns()
      ]);
      setContentPosts(contentRes.posts || []);
      setCampaigns(campaignsRes.campaigns || []);
    } catch (err) {
      toast.error(err.message || 'Failed to load marketing data');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Global Keyboard Shortcut: Alt+P to create a new content post
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.altKey && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setOpenNewPostModal(true);
        setActiveTab('content');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Navigation helper for children
  const handleNavigateTab = (tab, params = {}) => {
    if (params.campaignId) {
      setSelectedCampaignId(params.campaignId);
    }
    if (params.view) {
      setContentInitialView(params.view);
    }
    setActiveTab(tab);
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1440px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Marketing Hub
          </h1>
          <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>
            Content calendar, targeted trade campaigns, and lead source attribution for Knotiq Rugs.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadData}
            title="Refresh Marketing Data"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => setOpenInboundModal(true)}
          >
            <Plus size={14} style={{ marginRight: '4px' }} /> Inbound Lead
          </Button>

          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              setActiveTab('content');
              setOpenNewPostModal(true);
            }}
          >
            <Plus size={14} style={{ marginRight: '4px' }} /> Plan Post <span style={{ opacity: 0.6, fontSize: '10px', marginLeft: '4px' }}>(Alt+P)</span>
          </Button>
        </div>
      </div>

      {/* Tabs Navigation Bar */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-subtle)',
          paddingBottom: '2px',
          overflowX: 'auto'
        }}
      >
        {[
          { id: 'overview', label: 'Overview', icon: LayoutDashboard },
          { id: 'content', label: 'Content Calendar', icon: Calendar, badge: contentPosts.length },
          { id: 'campaigns', label: 'Trade Campaigns', icon: Megaphone, badge: campaigns.length },
          { id: 'templates', label: 'Outreach & A/B Templates', icon: FileText },
          { id: 'sources', label: 'Sources & ROI', icon: TrendingUp }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                fontSize: 'var(--font-sm)',
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--gold-accent)' : 'var(--text-secondary)',
                borderBottom: isActive ? '2px solid var(--gold-accent)' : '2px solid transparent',
                marginBottom: '-2px',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? 'rgba(245, 158, 11, 0.2)' : 'var(--surface-subtle)',
                    color: isActive ? 'var(--gold-accent)' : 'var(--text-dim)'
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {activeTab === 'overview' && (
        <OverviewTab
          onNavigateTab={handleNavigateTab}
          onOpenNewPost={() => {
            setActiveTab('content');
            setOpenNewPostModal(true);
          }}
          onOpenNewCampaign={() => {
            setActiveTab('campaigns');
            setOpenNewCampaignModal(true);
          }}
          onOpenInboundLead={() => {
            setOpenInboundModal(true);
          }}
          onMarkPosted={(post) => {
            setActiveTab('content');
          }}
        />
      )}

      {activeTab === 'content' && (
        <ContentTab
          posts={contentPosts}
          loading={loading}
          onRefresh={loadData}
          initialView={contentInitialView}
          openNewModal={openNewPostModal}
          onCloseNewModal={() => setOpenNewPostModal(false)}
          campaigns={campaigns}
        />
      )}

      {activeTab === 'campaigns' && (
        <CampaignsTab
          campaigns={campaigns}
          loading={loading}
          onRefresh={loadData}
          openNewModal={openNewCampaignModal}
          onCloseNewModal={() => setOpenNewCampaignModal(false)}
          selectedCampaignId={selectedCampaignId}
        />
      )}

      {activeTab === 'templates' && (
        <TemplatesTab />
      )}

      {activeTab === 'sources' && (
        <SourcesTab
          openInboundModal={openInboundModal}
          onCloseInboundModal={() => setOpenInboundModal(false)}
        />
      )}
    </div>
  );
}
