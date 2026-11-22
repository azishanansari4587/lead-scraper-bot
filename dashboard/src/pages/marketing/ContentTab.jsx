import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Filter,
  Columns,
  List,
  Sparkles,
  ExternalLink,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Share2,
  TrendingUp,
  Tag,
  Link,
  Search
} from 'lucide-react';
import { api } from '../../api';
import { Button, Card, Modal, Field, Select, Textarea, Badge, Drawer, useToast } from '../../components/ui';

const PLATFORMS = [
  { value: 'all', label: 'All Platforms' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'pinterest', label: 'Pinterest' },
  { value: 'youtube', label: 'YouTube' },
  { value: 'blog', label: 'Journal / Blog' },
  { value: 'newsletter', label: 'Newsletter' },
  { value: 'whatsapp_status', label: 'WhatsApp Status' },
  { value: 'other', label: 'Other' }
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'idea', label: 'Idea Bank' },
  { value: 'draft', label: 'Draft' },
  { value: 'ready', label: 'Ready' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'posted', label: 'Posted' },
  { value: 'skipped', label: 'Skipped' }
];

const KANBAN_COLUMNS = [
  { id: 'idea', title: 'Ideas Bank', color: '#818CF8' },
  { id: 'draft', title: 'Drafting', color: '#F59E0B' },
  { id: 'ready', title: 'Ready', color: '#38BDF8' },
  { id: 'scheduled', title: 'Scheduled', color: '#A855F7' },
  { id: 'posted', title: 'Published', color: '#10B981' },
  { id: 'skipped', title: 'Skipped', color: '#64748B' }
];

export default function ContentTab({
  posts,
  loading,
  onRefresh,
  initialView = 'kanban',
  openNewModal = false,
  onCloseNewModal,
  campaigns = []
}) {
  const toast = useToast();
  const [viewMode, setViewMode] = useState(initialView); // 'kanban' | 'list'
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isMarkPublishedModalOpen, setIsMarkPublishedModalOpen] = useState(false);
  const [isIdeasDrawerOpen, setIsIdeasDrawerOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    platform: 'instagram',
    topic: '',
    caption: '',
    hashtags: '',
    assetLink: '',
    scheduledAt: '',
    status: 'scheduled',
    campaignId: ''
  });

  const [publishData, setPublishData] = useState({
    postedUrl: '',
    postedAt: '',
    impressions: '',
    likes: '',
    comments: '',
    saves: '',
    clicks: '',
    leadsGenerated: ''
  });

  useEffect(() => {
    if (openNewModal) {
      setIsCreateModalOpen(true);
    }
  }, [openNewModal]);

  // Open Create Modal
  const handleOpenCreate = (initialState = {}) => {
    setSelectedPost(null);
    setFormData({
      platform: initialState.platform || 'instagram',
      topic: initialState.topic || '',
      caption: initialState.caption || '',
      hashtags: initialState.hashtags || '',
      assetLink: initialState.assetLink || '',
      scheduledAt: initialState.scheduledAt || '',
      status: initialState.status || (initialState.scheduledAt ? 'scheduled' : 'idea'),
      campaignId: initialState.campaignId || ''
    });
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (post) => {
    setSelectedPost(post);
    setFormData({
      platform: post.platform,
      topic: post.topic,
      caption: post.caption || '',
      hashtags: post.hashtags || '',
      assetLink: post.assetLink || '',
      scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString().slice(0, 16) : '',
      status: post.status,
      campaignId: post.campaignId ? String(post.campaignId) : ''
    });
    setIsCreateModalOpen(true);
  };

  // Open Mark Published Modal
  const handleOpenPublish = (post) => {
    setSelectedPost(post);
    setPublishData({
      postedUrl: post.postedUrl || '',
      postedAt: post.postedAt ? new Date(post.postedAt).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
      impressions: post.impressions ?? '',
      likes: post.likes ?? '',
      comments: post.comments ?? '',
      saves: post.saves ?? '',
      clicks: post.clicks ?? '',
      leadsGenerated: post.leadsGenerated ?? ''
    });
    setIsMarkPublishedModalOpen(true);
  };

  // Submit Create or Edit Post
  const handleSavePost = async (e) => {
    e.preventDefault();
    if (!formData.topic.trim()) {
      toast.error('Topic is required');
      return;
    }

    try {
      const payload = {
        platform: formData.platform,
        topic: formData.topic.trim(),
        caption: formData.caption?.trim() || null,
        hashtags: formData.hashtags?.trim() || null,
        assetLink: formData.assetLink?.trim() || null,
        scheduledAt: formData.scheduledAt ? new Date(formData.scheduledAt).toISOString() : null,
        status: formData.status,
        campaignId: formData.campaignId ? parseInt(formData.campaignId, 10) : null
      };

      if (selectedPost) {
        await api.updateContentPost(selectedPost.id, payload);
        toast.success('Post updated');
      } else {
        await api.createContentPost(payload);
        toast.success('Post created');
      }

      setIsCreateModalOpen(false);
      if (onCloseNewModal) onCloseNewModal();
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Failed to save post');
    }
  };

  // Submit Mark Published Dialog
  const handleSavePublished = async (e) => {
    e.preventDefault();
    if (!publishData.postedUrl.trim()) {
      toast.error('Live post URL is required');
      return;
    }

    try {
      const payload = {
        postedUrl: publishData.postedUrl.trim(),
        postedAt: publishData.postedAt ? new Date(publishData.postedAt).toISOString() : new Date().toISOString(),
        impressions: publishData.impressions !== '' ? parseInt(publishData.impressions, 10) : null,
        likes: publishData.likes !== '' ? parseInt(publishData.likes, 10) : null,
        comments: publishData.comments !== '' ? parseInt(publishData.comments, 10) : null,
        saves: publishData.saves !== '' ? parseInt(publishData.saves, 10) : null,
        clicks: publishData.clicks !== '' ? parseInt(publishData.clicks, 10) : null,
        leadsGenerated: publishData.leadsGenerated !== '' ? parseInt(publishData.leadsGenerated, 10) : null
      };

      await api.markContentPostPublished(selectedPost.id, payload);
      toast.success('Post marked as published!');
      setIsMarkPublishedModalOpen(false);
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Failed to record published post');
    }
  };

  // Delete Post
  const handleDeletePost = async (id) => {
    if (!window.confirm('Delete this content post?')) return;
    try {
      await api.deleteContentPost(id);
      toast.success('Post deleted');
      onRefresh();
    } catch (err) {
      toast.error(err.message || 'Failed to delete post');
    }
  };

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (platformFilter !== 'all' && p.platform !== platformFilter) return false;
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesTopic = p.topic?.toLowerCase().includes(q);
        const matchesCaption = p.caption?.toLowerCase().includes(q);
        const matchesHashtags = p.hashtags?.toLowerCase().includes(q);
        if (!matchesTopic && !matchesCaption && !matchesHashtags) return false;
      }
      return true;
    });
  }, [posts, platformFilter, statusFilter, searchQuery]);

  // Ideas only (for drawer)
  const ideasList = useMemo(() => {
    return posts.filter((p) => p.status === 'idea' || !p.scheduledAt);
  }, [posts]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Action Header & Filters */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Search */}
          <div style={{ position: 'relative', width: '220px' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-dim)' }} />
            <input
              type="text"
              placeholder="Search topic or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 10px 8px 34px',
                backgroundColor: 'var(--surface-subtle)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontSize: 'var(--font-sm)'
              }}
            />
          </div>

          {/* Platform Filter */}
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--surface-subtle)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)'
            }}
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
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
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>

          {/* Ideas Drawer Button */}
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsIdeasDrawerOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Sparkles size={14} color="#818CF8" /> Ideas Bank ({ideasList.length})
          </Button>
        </div>

        {/* View mode toggle & Create Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', backgroundColor: 'var(--surface-subtle)', padding: '2px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('kanban')}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'kanban' ? 'var(--surface-card)' : 'transparent',
                color: viewMode === 'kanban' ? 'var(--gold-accent)' : 'var(--text-dim)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--font-xs)',
                fontWeight: 600
              }}
            >
              <Columns size={14} /> Board
            </button>
            <button
              onClick={() => setViewMode('list')}
              style={{
                padding: '6px 10px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: viewMode === 'list' ? 'var(--surface-card)' : 'transparent',
                color: viewMode === 'list' ? 'var(--gold-accent)' : 'var(--text-dim)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: 'var(--font-xs)',
                fontWeight: 600
              }}
            >
              <List size={14} /> List
            </button>
          </div>

          <Button variant="primary" onClick={() => handleOpenCreate()}>
            <Plus size={16} style={{ marginRight: '6px' }} /> Plan Post <span style={{ opacity: 0.6, fontSize: '11px', marginLeft: '4px' }}>(Alt+P)</span>
          </Button>
        </div>
      </div>

      {/* Main View: Kanban Board */}
      {viewMode === 'kanban' ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '16px', alignItems: 'start' }}>
          {KANBAN_COLUMNS.map((col) => {
            const colPosts = filteredPosts.filter((p) => p.status === col.id);
            return (
              <div
                key={col.id}
                style={{
                  backgroundColor: 'var(--surface-card)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border-subtle)',
                  padding: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  minHeight: '400px'
                }}
              >
                {/* Column Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '8px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: col.color }} />
                    <span style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {col.title}
                    </span>
                  </div>
                  <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', fontWeight: 600 }}>
                    {colPosts.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {colPosts.length === 0 ? (
                    <div style={{ padding: '24px 8px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-xs)' }}>
                      Empty
                    </div>
                  ) : (
                    colPosts.map((post) => (
                      <div
                        key={post.id}
                        style={{
                          backgroundColor: 'var(--surface-subtle)',
                          borderRadius: 'var(--radius-md)',
                          border: post.isMissed ? '1px solid rgba(244, 63, 94, 0.5)' : '1px solid var(--border-subtle)',
                          padding: '12px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        {/* Header: Platform + Missed + Date */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
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
                                fontSize: '10px',
                                fontWeight: 600,
                                padding: '2px 6px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                                color: 'var(--rose-accent)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                            >
                              <AlertTriangle size={10} /> Missed
                            </span>
                          )}
                        </div>

                        {/* Topic */}
                        <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4 }}>
                          {post.topic}
                        </div>

                        {/* Caption preview if exists */}
                        {post.caption && (
                          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {post.caption}
                          </div>
                        )}

                        {/* Date info */}
                        {post.scheduledAt && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-dim)' }}>
                            <Clock size={12} />
                            {new Date(post.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}

                        {/* Published Metrics Badge if posted */}
                        {post.status === 'posted' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'var(--emerald-accent)', backgroundColor: 'rgba(16, 185, 129, 0.08)', padding: '4px 6px', borderRadius: '4px' }}>
                            <span>{post.impressions || 0} imp</span>
                            <span>•</span>
                            <span>{post.likes || 0} likes</span>
                            <span>•</span>
                            <span>{post.leadsGenerated || 0} leads</span>
                          </div>
                        )}

                        {/* Actions */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px', paddingTop: '6px', borderTop: '1px solid var(--border-subtle)' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => handleOpenEdit(post)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '2px' }}
                              title="Edit post"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeletePost(post.id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-dim)', padding: '2px' }}
                              title="Delete post"
                            >
                              <Trash2 size={13} />
                            </button>
                            {post.postedUrl && (
                              <a
                                href={post.postedUrl}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--gold-accent)', display: 'flex', alignItems: 'center', padding: '2px' }}
                                title="Open Live Post"
                              >
                                <ExternalLink size={13} />
                              </a>
                            )}
                          </div>

                          {post.status !== 'posted' && (
                            <Button
                              size="xs"
                              variant={post.isMissed ? 'danger' : 'primary'}
                              onClick={() => handleOpenPublish(post)}
                            >
                              Published
                            </Button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: 'var(--font-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                  <th style={{ padding: '12px 16px' }}>Platform</th>
                  <th style={{ padding: '12px 16px' }}>Topic & Caption</th>
                  <th style={{ padding: '12px 16px' }}>Scheduled Date</th>
                  <th style={{ padding: '12px 16px' }}>Status</th>
                  <th style={{ padding: '12px 16px' }}>Results</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-dim)' }}>
                      No content posts match current filters.
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((post) => (
                    <tr key={post.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 16px' }}>
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
                          {post.platform}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', maxWidth: '300px' }}>
                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                          {post.topic}
                        </div>
                        {post.caption && (
                          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {post.caption}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {post.scheduledAt ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{new Date(post.scheduledAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                            {post.isMissed && (
                              <span style={{ fontSize: '10px', color: 'var(--rose-accent)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <AlertTriangle size={11} /> Overdue
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-dim)' }}>Unscheduled</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ textTransform: 'capitalize', fontWeight: 500, color: post.status === 'posted' ? 'var(--emerald-accent)' : 'var(--text-secondary)' }}>
                          {post.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 'var(--font-xs)', color: 'var(--text-dim)' }}>
                        {post.status === 'posted' ? (
                          <div>
                            <div>{post.impressions || 0} imp • {post.likes || 0} likes</div>
                            <div style={{ color: 'var(--emerald-accent)' }}>{post.leadsGenerated || 0} leads</div>
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                          {post.status !== 'posted' && (
                            <Button size="xs" variant={post.isMissed ? 'danger' : 'primary'} onClick={() => handleOpenPublish(post)}>
                              Published
                            </Button>
                          )}
                          <Button size="xs" variant="secondary" onClick={() => handleOpenEdit(post)}>
                            Edit
                          </Button>
                          <Button size="xs" variant="ghost" onClick={() => handleDeletePost(post.id)}>
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Ideas Bank Side Drawer */}
      <Drawer
        isOpen={isIdeasDrawerOpen}
        onClose={() => setIsIdeasDrawerOpen(false)}
        title="Ideas Bank (Unassigned)"
        size="md"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
            Jot down content hooks, rug showcase angles, or craft stories here without committing to a date. When ready, 1-click Schedule.
          </p>

          <Button
            size="sm"
            variant="secondary"
            onClick={() => handleOpenCreate({ status: 'idea', scheduledAt: '' })}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
          >
            <Plus size={14} /> Add Raw Idea
          </Button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ideasList.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-sm)' }}>
                No unscheduled ideas in the bank. Click above to add one!
              </div>
            ) : (
              ideasList.map((idea) => (
                <div
                  key={idea.id}
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--surface-subtle)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--gold-accent)', textTransform: 'uppercase' }}>
                      {idea.platform}
                    </span>
                    <button
                      onClick={() => handleOpenEdit({ ...idea, status: 'scheduled' })}
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        backgroundColor: 'var(--gold-accent)',
                        color: '#000',
                        fontSize: '11px',
                        fontWeight: 600,
                        border: 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <CalendarIcon size={12} /> Schedule
                    </button>
                  </div>
                  <div style={{ fontSize: 'var(--font-sm)', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {idea.topic}
                  </div>
                  {idea.caption && (
                    <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-dim)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {idea.caption}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </Drawer>

      {/* Plan / Edit Content Post Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
          if (onCloseNewModal) onCloseNewModal();
        }}
        title={selectedPost ? 'Edit Content Post' : 'Plan New Content Post'}
        size="md"
      >
        <form onSubmit={handleSavePost} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Platform">
              <Select
                value={formData.platform}
                onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
              >
                {PLATFORMS.filter((p) => p.value !== 'all').map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </Select>
            </Field>

            <Field label="Status">
              <Select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="idea">Idea (Unassigned)</option>
                <option value="draft">Drafting</option>
                <option value="ready">Ready to Post</option>
                <option value="scheduled">Scheduled</option>
                <option value="posted">Posted</option>
                <option value="skipped">Skipped</option>
              </Select>
            </Field>
          </div>

          <Field label="Topic / Hook *" hint="Short concept or title (e.g. Bhadohi Silk Loom Weave Tour)">
            <input
              type="text"
              required
              value={formData.topic}
              onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
              placeholder="e.g. Master Weaver series: Raw New Zealand Wool dyeing"
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

          <Field label="Scheduled Date & Time (UTC / Asia/Dubai)" hint="Leave blank to save into Ideas Bank">
            <input
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
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

          <Field label="Caption / Copy">
            <Textarea
              rows={4}
              value={formData.caption}
              onChange={(e) => setFormData({ ...formData, caption: e.target.value })}
              placeholder="Write the full social caption, newsletter text, or talking points..."
            />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="Hashtags">
              <input
                type="text"
                value={formData.hashtags}
                onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                placeholder="#HandmadeRugs #DubaiDesign"
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

            <Field label="Asset Link / Google Drive">
              <input
                type="url"
                value={formData.assetLink}
                onChange={(e) => setFormData({ ...formData, assetLink: e.target.value })}
                placeholder="https://drive.google.com/..."
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

          {campaigns.length > 0 && (
            <Field label="Link to Campaign (Optional)">
              <Select
                value={formData.campaignId}
                onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
              >
                <option value="">No Campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.channel})</option>
                ))}
              </Select>
            </Field>
          )}

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
              {selectedPost ? 'Save Changes' : 'Create Post'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Mark as Published Modal */}
      <Modal
        isOpen={isMarkPublishedModalOpen}
        onClose={() => setIsMarkPublishedModalOpen(false)}
        title="Mark Content Post Published"
        size="md"
      >
        <form onSubmit={handleSavePublished} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
            Confirm that you manually published this post to {selectedPost?.platform}. Provide the live link and optional launch metrics.
          </p>

          <Field label="Live Post URL *" hint="Link to Instagram post, LinkedIn share, or web article">
            <input
              type="text"
              required
              value={publishData.postedUrl}
              onChange={(e) => setPublishData({ ...publishData, postedUrl: e.target.value })}
              placeholder="https://instagram.com/p/..."
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

          <Field label="Published Time">
            <input
              type="datetime-local"
              value={publishData.postedAt}
              onChange={(e) => setPublishData({ ...publishData, postedAt: e.target.value })}
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

          <div style={{ fontSize: 'var(--font-xs)', fontWeight: 600, color: 'var(--gold-accent)', marginTop: '6px' }}>
            Manual Performance Metrics (Can be updated later)
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <Field label="Impressions">
              <input
                type="number"
                min="0"
                value={publishData.impressions}
                onChange={(e) => setPublishData({ ...publishData, impressions: e.target.value })}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-sm)'
                }}
              />
            </Field>

            <Field label="Likes / Reactions">
              <input
                type="number"
                min="0"
                value={publishData.likes}
                onChange={(e) => setPublishData({ ...publishData, likes: e.target.value })}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-sm)'
                }}
              />
            </Field>

            <Field label="Comments">
              <input
                type="number"
                min="0"
                value={publishData.comments}
                onChange={(e) => setPublishData({ ...publishData, comments: e.target.value })}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-sm)'
                }}
              />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <Field label="Saves / Bookmarks">
              <input
                type="number"
                min="0"
                value={publishData.saves}
                onChange={(e) => setPublishData({ ...publishData, saves: e.target.value })}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-sm)'
                }}
              />
            </Field>

            <Field label="Clicks / Profile Visits">
              <input
                type="number"
                min="0"
                value={publishData.clicks}
                onChange={(e) => setPublishData({ ...publishData, clicks: e.target.value })}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-sm)'
                }}
              />
            </Field>

            <Field label="Inbound Leads Generated">
              <input
                type="number"
                min="0"
                value={publishData.leadsGenerated}
                onChange={(e) => setPublishData({ ...publishData, leadsGenerated: e.target.value })}
                placeholder="0"
                style={{
                  width: '100%',
                  padding: '8px 10px',
                  backgroundColor: 'var(--surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: 'var(--font-sm)'
                }}
              />
            </Field>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <Button type="button" variant="secondary" onClick={() => setIsMarkPublishedModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              Confirm Published
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
