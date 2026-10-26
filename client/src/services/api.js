const API_BASE = '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const errorMsg = data?.error || data?.message || `HTTP error ${response.status}`;
      const error = new Error(errorMsg);
      error.status = response.status;
      error.details = data?.details;
      error.requiresConfirmation = data?.requiresConfirmation;
      throw error;
    }

    return data;
  } catch (err) {
    throw err;
  }
}

export const api = {
  // Health
  getHealth: () => request('/health'),

  // WhatsApp Connection
  getWhatsAppStatus: () => request('/whatsapp/status'),
  getWhatsAppQr: () => request('/whatsapp/qr'),
  logoutWhatsApp: () => request('/whatsapp/logout', { method: 'POST' }),
  reconnectWhatsApp: () => request('/whatsapp/reconnect', { method: 'POST' }),

  // Dashboard
  getDashboardStats: (params = {}) => {
    const query = new URLSearchParams();
    if (params.timezone) query.append('timezone', params.timezone);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/dashboard/stats${queryString}`);
  },

  // Schedules
  getSchedules: (params = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.status) query.append('status', params.status);
    if (params.type) query.append('type', params.type);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/schedules${queryString}`);
  },
  getSchedule: (id) => request(`/schedules/${id}`),
  createSchedule: (payload) => request('/schedules', { method: 'POST', body: JSON.stringify(payload) }),
  updateSchedule: (id, payload) => request(`/schedules/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),
  updateScheduleStatus: (id, enabled, status) =>
    request(`/schedules/${id}/status`, { method: 'PATCH', body: JSON.stringify({ enabled, status }) }),
  deleteSchedule: (id) => request(`/schedules/${id}`, { method: 'DELETE' }),
  duplicateSchedule: (id) => request(`/schedules/${id}/duplicate`, { method: 'POST' }),

  // Execution History
  getHistory: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append('status', params.status);
    if (params.search) query.append('search', params.search);
    if (params.schedule_id) query.append('schedule_id', params.schedule_id);
    if (params.startDate) query.append('startDate', params.startDate);
    if (params.endDate) query.append('endDate', params.endDate);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/history${queryString}`);
  },
  getHistoryItem: (id) => request(`/history/${id}`),
  retryHistory: (id, confirmUncertain = false) =>
    request(`/history/${id}/retry`, { method: 'POST', body: JSON.stringify({ confirmUncertain }) }),
  clearHistory: (params = {}) =>
    request('/history', { method: 'DELETE', body: JSON.stringify(params) }),

  // Settings & Logs
  getSettings: () => request('/settings'),
  updateSettings: (payload) => request('/settings', { method: 'PUT', body: JSON.stringify(payload) }),
  getSystemLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.limit) query.append('limit', params.limit);
    if (params.offset) query.append('offset', params.offset);
    if (params.source) query.append('source', params.source);
    if (params.level) query.append('level', params.level);
    const queryString = query.toString() ? `?${query.toString()}` : '';
    return request(`/settings/logs${queryString}`);
  },
  clearSystemLogs: () => request('/settings/logs', { method: 'DELETE' })
};

export default api;
