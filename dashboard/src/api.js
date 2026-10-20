/**
 * API Client for Knotiq Rugs Lead Scraper
 */

const BASE_URL = '/api';

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

  // Exports
  getExports: () => fetchJson('/exports'),
  createExport: (format, filters = {}) => fetchJson('/exports', { method: 'POST', body: JSON.stringify({ format, filters }) }),

  // Outreach & Templates
  getTemplates: () => fetchJson('/outreach/templates'),
  createTemplate: (template) => fetchJson('/outreach/templates', { method: 'POST', body: JSON.stringify(template) }),
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
  verifyBulkAuth: (key) => fetchJson(`/bulk/verify-auth${key ? `?key=${encodeURIComponent(key)}` : ''}`)
};
