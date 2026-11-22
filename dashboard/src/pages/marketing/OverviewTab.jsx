import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  TrendingUp,
  Megaphone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowRight,
  Plus,
  Share2,
  ExternalLink
} from 'lucide-react';
import { api } from '../../api';
import { Card, Button, Badge, SkeletonCard } from '../../components/ui';

export default function OverviewTab({
  onNavigateTab,
  onOpenNewPost,
  onOpenNewCampaign,
  onOpenInboundLead,
  onMarkPosted
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOverview = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getMarketingOverview();
      setData(res);
    } catch (err) {
      setError(err.message || 'Failed to load marketing overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--rose-accent)' }}>
          <AlertTriangle size={32} style={{ margin: '0 auto 12px' }} />
          <p>{error}</p>
          <Button variant="secondary" onClick={fetchOverview} style={{ marginTop: '16px' }}>
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  const { consistency, ideasCount, topSourceMonth, activeCampaigns = [], postsDueThisWeek = [] } = data || {};

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Top Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px' }}>
        {/* Weekly Consistency */}
        <Card>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Weekly Consistency
              </span>
              <Share2 size={18} color="var(--gold-accent)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {consistency?.publishedThisWeek || 0}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                / {consistency?.weeklyTarget || 5} posts
              </span>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--gold-accent)' }}>
                {consistency?.percentage || 0}%
              </span>
            </div>
            {/* Progress bar */}
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-subtle)', borderRadius: '3px', overflow: 'hidden' }}>
              <div
                style={{
                  width: `${consistency?.percentage || 0}%`,
                  height: '100%',
                  backgroundColor: consistency?.percentage >= 100 ? 'var(--emerald-accent)' : 'var(--gold-accent)',
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
          </div>
        </Card>

        {/* Ideas Bank Counter */}
        <Card padding="none">
          <div
            onClick={() => onNavigateTab('content', { view: 'ideas' })}
            style={{ padding: '20px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Ideas Bank
              </span>
              <Sparkles size={18} color="#818CF8" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {ideasCount || 0}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                unassigned ideas
              </span>
            </div>
            <span style={{ marginTop: 'auto', fontSize: 'var(--font-xs)', color: '#818CF8', display: 'flex', alignItems: 'center', gap: '4px' }}>
              View & Schedule Ideas <ArrowRight size={12} />
            </span>
          </div>
        </Card>

        {/* Top Source this Month */}
        <Card padding="none">
          <div
            onClick={() => onNavigateTab('sources')}
            style={{ padding: '20px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Top Source This Month
              </span>
              <TrendingUp size={18} color="var(--emerald-accent)" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-xl)', fontWeight: 700, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                {topSourceMonth?.source?.replace(/_/g, ' ') || 'None'}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                ({topSourceMonth?.count || 0} leads)
              </span>
            </div>
            <span style={{ marginTop: 'auto', fontSize: 'var(--font-xs)', color: 'var(--emerald-accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Explore Sources & ROI <ArrowRight size={12} />
            </span>
          </div>
        </Card>

        {/* Active Campaigns */}
        <Card padding="none">
          <div
            onClick={() => onNavigateTab('campaigns')}
            style={{ padding: '20px', cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Active Campaigns
              </span>
              <Megaphone size={18} color="#F43F5E" />
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
              <span style={{ fontSize: 'var(--font-2xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                {activeCampaigns?.length || 0}
              </span>
              <span style={{ color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                running multi-channel
              </span>
            </div>
            <span style={{ marginTop: 'auto', fontSize: 'var(--font-xs)', color: '#F43F5E', display: 'flex', alignItems: 'center', gap: '4px' }}>
              Manage Campaigns <ArrowRight size={12} />
            </span>
          </div>
        </Card>
      </div>

      {/* Main Content Split: Content Due This Week + Active Campaigns Funnels */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '20px' }}>
        {/* Posts Due This Week */}
        <Card>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Content Due This Week
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  Posts scheduled for manual publishing
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={onOpenNewPost}>
                <Plus size={14} style={{ marginRight: '4px' }} /> Quick Post
              </Button>
            </div>

            {postsDueThisWeek.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                <Clock size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                No posts scheduled for this week.
                <div style={{ marginTop: '8px' }}>
                  <Button size="xs" variant="ghost" onClick={onOpenNewPost}>
                    Schedule one now (Alt+P)
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {postsDueThisWeek.map((post) => (
                  <div
                    key={post.id}
                    style={{
                      padding: '12px 14px',
                      backgroundColor: 'var(--surface-subtle)',
                      borderRadius: 'var(--radius-md)',
                      border: post.isMissed ? '1px solid rgba(244, 63, 94, 0.4)' : '1px solid var(--border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px'
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            color: 'var(--gold-accent)',
                            textTransform: 'uppercase'
                          }}
                        >
                          {post.platform}
                        </span>
                        {post.isMissed && (
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 600,
                              padding: '2px 6px',
                              borderRadius: '4px',
                              backgroundColor: 'rgba(244, 63, 94, 0.15)',
                              color: 'var(--rose-accent)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <AlertTriangle size={11} /> Overdue
                          </span>
                        )}
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                          {post.scheduledAt ? new Date(post.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Undated'}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 'var(--font-sm)',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {post.topic}
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {post.status === 'posted' ? (
                        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--emerald-accent)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={14} /> Posted
                        </span>
                      ) : (
                        <Button
                          size="xs"
                          variant={post.isMissed ? 'danger' : 'primary'}
                          onClick={() => onMarkPosted(post)}
                        >
                          Mark Published
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Active Campaigns Funnel Overview */}
        <Card>
          <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: 'var(--font-base)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Active Campaign Funnels
                </h3>
                <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
                  Conversion stage-rank progress & revenue
                </p>
              </div>
              <Button size="sm" variant="secondary" onClick={onOpenNewCampaign}>
                <Plus size={14} style={{ marginRight: '4px' }} /> New Campaign
              </Button>
            </div>

            {activeCampaigns.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                <Megaphone size={28} style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                No active campaigns currently running.
                <div style={{ marginTop: '8px' }}>
                  <Button size="xs" variant="ghost" onClick={onOpenNewCampaign}>
                    Create trade campaign
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {activeCampaigns.map((camp) => {
                  const addedCount = camp.stages?.added || 0;
                  const contactedCount = camp.stages?.contacted || 0;
                  const repliedCount = camp.stages?.replied || 0;
                  const wonCount = camp.stages?.won || 0;
                  const wonVal = camp.revenue?.wonRevenue || 0;

                  return (
                    <div
                      key={camp.id}
                      onClick={() => onNavigateTab('campaigns', { campaignId: camp.id })}
                      style={{
                        padding: '14px',
                        backgroundColor: 'var(--surface-subtle)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        transition: 'border-color 0.2s'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <div>
                          <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                            {camp.name}
                          </span>
                          <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--text-dim)', textTransform: 'capitalize' }}>
                            ({camp.channel})
                          </span>
                        </div>
                        <span style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--emerald-accent)' }}>
                          {wonVal > 0 ? `${camp.revenue?.currency || 'AED'} ${wonVal.toLocaleString()}` : `${wonCount} won`}
                        </span>
                      </div>

                      {/* Mini Funnel Bar */}
                      <div style={{ display: 'flex', gap: '4px', height: '8px', borderRadius: '4px', overflow: 'hidden', backgroundColor: 'var(--border-subtle)', marginBottom: '8px' }}>
                        <div style={{ flex: Math.max(1, addedCount), backgroundColor: '#64748B' }} title={`Added: ${addedCount}`} />
                        <div style={{ flex: Math.max(1, contactedCount), backgroundColor: '#38BDF8' }} title={`Contacted: ${contactedCount}`} />
                        <div style={{ flex: Math.max(1, repliedCount), backgroundColor: '#F59E0B' }} title={`Replied: ${repliedCount}`} />
                        <div style={{ flex: Math.max(1, wonCount), backgroundColor: '#10B981' }} title={`Won: ${wonCount}`} />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-dim)' }}>
                        <span>Added: {addedCount}</span>
                        <span>Contacted: {contactedCount}</span>
                        <span>Replied: {repliedCount}</span>
                        <span style={{ color: 'var(--emerald-accent)', fontWeight: 600 }}>Won: {wonCount}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
