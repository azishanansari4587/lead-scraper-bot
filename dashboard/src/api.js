/**
 * API Client for Knotiq Rugs Lead Scraper
 */

const API_HOST = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const BASE_URL = API_HOST ? `${API_HOST}/api` : '/api';

async function fetchJson(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const bulkAuth = typeof localStorage !== 'undefined' ? localStorage.getItem('bulk_auth_password') : null;
  const headers = {
    'Content-Type': 'application/json',
    ...(bulkAuth ? { 'x-bulk-auth': bulkAuth } : {}),
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const error = new Error(data.message || `Request failed with status ${res.status}`);
    error.status = res.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Leads
  getLeads: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/leads?${qs.toString()}`);
  },
  getLeadStats: () => fetchJson('/leads/stats'),
  getLead: (id) => fetchJson(`/leads/${id}`),
  createLead: (leadData) => fetchJson('/leads', { method: 'POST', body: JSON.stringify(leadData) }),
  updateLead: (id, updates) => fetchJson(`/leads/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteLead: (id) => fetchJson(`/leads/${id}`, { method: 'DELETE' }),
  bulkDeleteLeads: (ids) => fetchJson('/leads/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  bulkUpdateLeadStatus: (ids, status) => fetchJson('/leads/bulk-status', { method: 'POST', body: JSON.stringify({ ids, status }) }),

  // Scraper
  runScrape: (options) => fetchJson('/scrape/run', { method: 'POST', body: JSON.stringify(options) }),
  getScrapeRuns: () => fetchJson('/scrape/runs'),

  // Presets
  getPresets: () => fetchJson('/presets'),
  createPreset: (preset) => fetchJson('/presets', { method: 'POST', body: JSON.stringify(preset) }),
  deletePreset: (id) => fetchJson(`/presets/${id}`, { method: 'DELETE' }),

  // Schedules
  getSchedules: () => fetchJson('/schedules'),
  createSchedule: (schedule) => fetchJson('/schedules', { method: 'POST', body: JSON.stringify(schedule) }),
  toggleSchedule: (id) => fetchJson(`/schedules/${id}/toggle`, { method: 'PATCH' }),
  deleteSchedule: (id) => fetchJson(`/schedules/${id}`, { method: 'DELETE' }),

  // Sources
  getSources: () => fetchJson('/sources'),
  toggleSource: (platform) => fetchJson(`/sources/${platform}/toggle`, { method: 'PATCH' }),
  testSource: (platform, options = {}) => fetchJson(`/sources/${platform}/test`, { method: 'POST', body: JSON.stringify(options) }),

  // Exports
  getExports: () => fetchJson('/exports'),
  createExport: (format, filters = {}) => fetchJson('/exports', { method: 'POST', body: JSON.stringify({ format, filters }) }),

  // Outreach & Templates
  getTemplates: () => fetchJson('/outreach/templates'),
  createTemplate: (template) => fetchJson('/outreach/templates', { method: 'POST', body: JSON.stringify(template) }),
  updateTemplate: (id, updates) => fetchJson(`/outreach/templates/${id}`, { method: 'PUT', body: JSON.stringify(updates) }),
  toggleTemplateActive: (id) => fetchJson(`/outreach/templates/${id}/toggle-active`, { method: 'PATCH' }),
  deleteTemplate: (id) => fetchJson(`/outreach/templates/${id}`, { method: 'DELETE' }),
  generateDraft: (leadId, channel = 'email') => fetchJson('/outreach/draft', { method: 'POST', body: JSON.stringify({ leadId, channel }) }),
  recordSent: (leadId, channel = 'email') => fetchJson('/outreach/record-sent', { method: 'POST', body: JSON.stringify({ leadId, channel }) }),

  // OptOut
  getOptOuts: () => fetchJson('/optout'),
  createOptOut: (data) => fetchJson('/optout', { method: 'POST', body: JSON.stringify(data) }),
  deleteOptOut: (id) => fetchJson(`/optout/${id}`, { method: 'DELETE' }),

  // Keywords & Locations
  getKeywords: () => fetchJson('/keywords'),
  getLocations: () => fetchJson('/locations'),

  // Settings & Diagnostics
  getSettings: () => fetchJson('/settings'),
  saveApiKeys: (keys) => fetchJson('/settings/api-keys', { method: 'POST', body: JSON.stringify(keys) }),

  // Bulk Outreach API
  getBulkLeads: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/bulk/leads?${qs.toString()}`);
  },
  uploadBulkFile: async (formData) => {
    const bulkAuth = typeof localStorage !== 'undefined' ? localStorage.getItem('bulk_auth_password') : null;
    const headers = {};
    if (bulkAuth) headers['x-bulk-auth'] = bulkAuth;
    const res = await fetch(`${BASE_URL}/bulk/upload`, {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `File upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  startBulkSend: (payload) => fetchJson('/bulk/send', { method: 'POST', body: JSON.stringify(payload) }),
  uploadAttachment: async (formData) => {
    const bulkAuth = typeof localStorage !== 'undefined' ? localStorage.getItem('bulk_auth_password') : null;
    const headers = {};
    if (bulkAuth) headers['x-bulk-auth'] = bulkAuth;
    const res = await fetch(`${BASE_URL}/bulk/upload-attachment`, {
      method: 'POST',
      headers,
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(data.message || `Attachment upload failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    return data;
  },
  sendDirectOutreach: (payload) => fetchJson('/outreach/send-direct', { method: 'POST', body: JSON.stringify(payload) }),
  getBulkStatus: (jobId) => fetchJson(`/bulk/status/${jobId}`),
  stopBulkJob: (jobId) => fetchJson(`/bulk/stop/${jobId}`, { method: 'POST' }),
  getBulkHistory: () => fetchJson('/bulk/history'),
  verifyBulkAuth: (key) =>
    fetchJson('/bulk/verify-auth', {
      headers: key ? { 'x-bulk-auth': key } : {}
    }),

  // Phase A: Today Command Center & User Settings
  getTodaySummary: () => fetchJson('/today/summary'),
  getUserSettings: () => fetchJson('/settings/user'),
  updateUserSettings: (updates) => fetchJson('/settings/user', { method: 'PATCH', body: JSON.stringify(updates) }),

  // Phase A: Calls & Scripts
  getCalls: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/calls?${qs.toString()}`);
  },
  getCallsToday: () => fetchJson('/calls/today'),
  getCallStats: () => fetchJson('/calls/stats'),
  getCallScripts: () => fetchJson('/calls/scripts'),
  logCall: (payload) => fetchJson('/calls', { method: 'POST', body: JSON.stringify(payload) }),

  // Phase A: Notes (Polymorphic Notebook)
  getNotes: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/notes?${qs.toString()}`);
  },
  getNoteTags: () => fetchJson('/notes/tags'),
  createNote: (payload) => fetchJson('/notes', { method: 'POST', body: JSON.stringify(payload) }),
  updateNote: (id, updates) => fetchJson(`/notes/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteNote: (id) => fetchJson(`/notes/${id}`, { method: 'DELETE' }),

  // Phase A: Follow-ups Engine
  getFollowUpsToday: () => fetchJson('/follow-ups/today'),
  updateFollowUpStatus: (id, status, notes) => fetchJson(`/follow-ups/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status, notes }) }),
  createFollowUp: (payload) => fetchJson('/follow-ups', { method: 'POST', body: JSON.stringify(payload) }),

  // Phase A: Leads Extensions (Timeline, Mark-Replied, BuyerType)
  getLeadTimeline: (id) => fetchJson(`/leads/${id}/timeline`),
  markLeadReplied: (id, replyNote) => fetchJson(`/leads/${id}/mark-replied`, { method: 'POST', body: JSON.stringify({ replyNote }) }),
  updateLeadBuyerType: (id, buyerType) => fetchJson(`/leads/${id}/buyer-type`, { method: 'PATCH', body: JSON.stringify({ buyerType }) }),
  classifyLead: (id) => fetchJson(`/leads/${id}/classify`, { method: 'POST' }),

  // Phase B: Tasks
  getTasks: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/tasks?${qs.toString()}`);
  },
  createTask: (payload) => fetchJson('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  updateTask: (id, updates) => fetchJson(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteTask: (id) => fetchJson(`/tasks/${id}`, { method: 'DELETE' }),

  // Phase B: Calendar
  getCalendar: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/calendar?${qs.toString()}`);
  },
  createCalendarEvent: (payload) => fetchJson('/calendar/events', { method: 'POST', body: JSON.stringify(payload) }),
  updateCalendarEvent: (id, updates) => fetchJson(`/calendar/events/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteCalendarEvent: (id) => fetchJson(`/calendar/events/${id}`, { method: 'DELETE' }),

  // Phase B: Planner Rituals & Streaks
  getDailyPlan: (date) => fetchJson(`/planner/daily-plan${date ? `?date=${date}` : ''}`),
  saveDailyPlan: (payload) => fetchJson('/planner/daily-plan', { method: 'POST', body: JSON.stringify(payload) }),
  getDailyReviewSummary: (date) => fetchJson(`/planner/daily-review/summary${date ? `?date=${date}` : ''}`),
  saveDailyReview: (payload) => fetchJson('/planner/daily-review', { method: 'POST', body: JSON.stringify(payload) }),
  getTomorrowDraft: (date) => fetchJson(`/planner/tomorrow-draft${date ? `?date=${date}` : ''}`),
  getStreaks: () => fetchJson('/planner/streaks'),

  // Phase C: Marketing Hub - Content Calendar
  getContentPosts: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/content?${qs.toString()}`);
  },
  createContentPost: (payload) => fetchJson('/content', { method: 'POST', body: JSON.stringify(payload) }),
  updateContentPost: (id, updates) => fetchJson(`/content/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  markContentPostPublished: (id, payload) => fetchJson(`/content/${id}/mark-posted`, { method: 'POST', body: JSON.stringify(payload) }),
  deleteContentPost: (id) => fetchJson(`/content/${id}`, { method: 'DELETE' }),

  // Phase C: Marketing Hub - Campaigns
  getCampaigns: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/campaigns?${qs.toString()}`);
  },
  createCampaign: (payload) => fetchJson('/campaigns', { method: 'POST', body: JSON.stringify(payload) }),
  getCampaign: (id) => fetchJson(`/campaigns/${id}`),
  updateCampaign: (id, updates) => fetchJson(`/campaigns/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  previewCampaignLeads: (id, filters = {}) => fetchJson(`/campaigns/${id}/preview-leads`, { method: 'POST', body: JSON.stringify({ filters }) }),
  addLeadsToCampaign: (id, filters = {}) => fetchJson(`/campaigns/${id}/add-leads`, { method: 'POST', body: JSON.stringify({ filters }) }),
  getCampaignSendQueue: (id) => fetchJson(`/campaigns/${id}/send-queue`),
  recordCampaignSend: (id, payload) => fetchJson(`/campaigns/${id}/record-send`, { method: 'POST', body: JSON.stringify(payload) }),
  dispatchCampaignEmail: (id, payload) => fetchJson(`/campaigns/${id}/dispatch-email`, { method: 'POST', body: JSON.stringify(payload) }),
  archiveCampaign: (id) => fetchJson(`/campaigns/${id}/archive`, { method: 'POST' }),
  unarchiveCampaign: (id) => fetchJson(`/campaigns/${id}/unarchive`, { method: 'POST' }),
  deleteCampaign: (id) => fetchJson(`/campaigns/${id}`, { method: 'DELETE' }),

  // Phase C: Marketing Hub - Overview & Sources
  getMarketingOverview: () => fetchJson('/marketing/overview'),
  getSourcesReport: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/marketing/sources-report?${qs.toString()}`);
  },
  addInboundLead: (payload) => fetchJson('/marketing/inbound-lead', { method: 'POST', body: JSON.stringify(payload) }),

  // Mindmap Module
  getMindmaps: (params = {}) => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.append(k, v);
    });
    return fetchJson(`/mindmaps?${qs.toString()}`);
  },
  createMindmap: (payload) => fetchJson('/mindmaps', { method: 'POST', body: JSON.stringify(payload) }),
  getMindmap: (id) => fetchJson(`/mindmaps/${id}`),
  updateMindmap: (id, updates) => fetchJson(`/mindmaps/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteMindmap: (id) => fetchJson(`/mindmaps/${id}`, { method: 'DELETE' }),
  duplicateMindmap: (id) => fetchJson(`/mindmaps/${id}/duplicate`, { method: 'POST' }),
  createMindmapNode: (mapId, payload) => fetchJson(`/mindmaps/${mapId}/nodes`, { method: 'POST', body: JSON.stringify(payload) }),
  updateMindmapNode: (mapId, nodeId, updates) => fetchJson(`/mindmaps/${mapId}/nodes/${nodeId}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  moveMindmapNode: (mapId, nodeId, moveData) => fetchJson(`/mindmaps/${mapId}/nodes/${nodeId}/move`, { method: 'POST', body: JSON.stringify(moveData) }),
  deleteMindmapNode: (mapId, nodeId) => fetchJson(`/mindmaps/${mapId}/nodes/${nodeId}`, { method: 'DELETE' }),
  duplicateMindmapNode: (mapId, nodeId) => fetchJson(`/mindmaps/${mapId}/nodes/${nodeId}/duplicate`, { method: 'POST' }),
  completeAllDescendants: (mapId, nodeId) => fetchJson(`/mindmaps/${mapId}/nodes/${nodeId}/complete-all`, { method: 'POST' }),
  createTaskFromNode: (mapId, nodeId) => fetchJson(`/mindmaps/${mapId}/nodes/${nodeId}/create-task`, { method: 'POST' }),
  exportMindmap: (mapId, format = 'json') => fetchJson(`/mindmaps/${mapId}/export?format=${format}`),
  importMindmap: (payload, preview = false) => fetchJson(`/mindmaps/import?preview=${preview}`, { method: 'POST', body: JSON.stringify(payload) }),

  // Mindset Gate API
  getGateStatus: () => fetchJson('/gate/status'),
  startGate: () => fetchJson('/gate/start', { method: 'POST' }),
  completeGate: (payload) => fetchJson('/gate/complete', { method: 'POST', body: JSON.stringify(payload) }),
  getGateQuotes: () => fetchJson('/gate/quotes'),
  createGateQuote: (payload) => fetchJson('/gate/quotes', { method: 'POST', body: JSON.stringify(payload) }),
  updateGateQuote: (id, updates) => fetchJson(`/gate/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  replaceGateQuotes: (quotes) => fetchJson('/gate/quotes/replace', { method: 'PUT', body: JSON.stringify({ quotes }) }),
  reorderGateQuotes: (order) => fetchJson('/gate/quotes/reorder', { method: 'POST', body: JSON.stringify({ order }) }),
  deleteGateQuote: (id) => fetchJson(`/gate/quotes/${id}`, { method: 'DELETE' }),
  getGateStreak: () => fetchJson('/gate/streak'),
  updateGateSettings: (settings) => fetchJson('/gate/settings', { method: 'PATCH', body: JSON.stringify(settings) }),

  // CEO Routine Engine API
  getRoutineToday: (date) => fetchJson(`/routine/today${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  getRoutineEntries: (date) => fetchJson(`/routine/entries${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  checkInRoutineEntry: (id, payload) => fetchJson(`/routine/entries/${id}/check-in`, { method: 'POST', body: JSON.stringify(payload) }),
  addUnplannedRoutineEntry: (payload) => fetchJson('/routine/entries/unplanned', { method: 'POST', body: JSON.stringify(payload) }),
  snoozeRoutineEntry: (id, payload) => fetchJson(`/routine/entries/${id}/snooze`, { method: 'POST', body: JSON.stringify(payload) }),
  resolveCarryDecision: (id, payload) => fetchJson(`/routine/entries/${id}/decision`, { method: 'POST', body: JSON.stringify(payload) }),
  getRoutineTemplates: () => fetchJson('/routine/templates'),
  createRoutineTemplate: (payload) => fetchJson('/routine/templates', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoutineTemplate: (id, updates) => fetchJson(`/routine/templates/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteRoutineTemplate: (id) => fetchJson(`/routine/templates/${id}`, { method: 'DELETE' }),
  addRoutineBlock: (payload) => fetchJson('/routine/blocks', { method: 'POST', body: JSON.stringify(payload) }),
  updateRoutineBlock: (id, updates) => fetchJson(`/routine/blocks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  deleteRoutineBlock: (id) => fetchJson(`/routine/blocks/${id}`, { method: 'DELETE' }),
  getWeeklyRoutineAnalytics: (includeAi = false) => fetchJson(`/routine/analytics/weekly?includeAi=${includeAi}`),
  acceptRoutineSuggestion: (payload) => fetchJson('/routine/suggestions/accept', { method: 'POST', body: JSON.stringify(payload) }),
  getRoutinePolicy: () => fetchJson('/routine/policy'),
  updateRoutinePolicy: (payload) => fetchJson('/routine/policy', { method: 'PATCH', body: JSON.stringify(payload) }),
  emergencyExitFocusLock: (reason) => fetchJson('/routine/policy/emergency-exit', { method: 'POST', body: JSON.stringify({ reason }) }),
  createPartnerInvite: (username) => fetchJson('/routine/partner/invite', { method: 'POST', body: JSON.stringify({ username }) }),
  stopPartnerSharing: () => fetchJson('/routine/partner/stop', { method: 'POST' })
};
