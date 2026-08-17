import { api } from './api';

export const getAdminSummary = () => api.get('/api/admin/summary');
export const getAdminUsers = (params = {}) => api.get('/api/admin/users', { params });
export const updateAdminUser = (id, payload) => api.patch(`/api/admin/users/${id}`, payload);
export const getAdminPlans = (params = {}) => api.get('/api/admin/plans', { params });
export const updateAdminPlan = (id, payload) => api.patch(`/api/admin/plans/${id}`, payload);
export const getAIOutputs = () => api.get('/api/admin/ai/outputs');
export const updateAIOutputStatus = (id, payload) => api.patch(`/api/admin/ai/outputs/${id}`, payload);
export const getPromptTemplates = () => api.get('/api/admin/ai/prompts');
export const updatePromptTemplate = (key, payload) => api.patch(`/api/admin/ai/prompts/${key}`, payload);
export const getModerationImages = () => api.get('/api/admin/moderation/images');
export const updateModerationImage = (id, payload) => api.patch(`/api/admin/moderation/images/${id}`, payload);
export const getModerationChats = () => api.get('/api/admin/moderation/chats');
export const updateModerationChat = (id, payload) => api.patch(`/api/admin/moderation/chats/${id}`, payload);
export const getAdminLogs = () => api.get('/api/admin/logs');
export const getAIUsageLogs = () => api.get('/api/admin/logs/ai-usage');
export const getErrorLogs = () => api.get('/api/admin/logs/errors');

export const getModerationImageFile = (id, position, fileId = '') => {
  const storedFileId = String(fileId || '').trim();
  if (/^[a-f0-9]{24}$/i.test(storedFileId)) {
    return api.get(`/api/admin/moderation/files/${encodeURIComponent(storedFileId)}`, { responseType: 'blob' });
  }
  return api.get(`/api/admin/moderation/images/${encodeURIComponent(String(id))}/file/${encodeURIComponent(String(position))}`, { responseType: 'blob' });
};

export const getPlanTemplates = () => api.get('/api/admin/plans/templates');
export const createPlanTemplate = (payload) => api.post('/api/admin/plans/templates', payload);
export const updatePlanTemplate = (id, payload) => api.patch(`/api/admin/plans/templates/${id}`, payload);

export const assignPlanTemplate = (payload) => api.post("/api/admin/plans/assign-template", payload);
export const getAdminUserAvatar = (id) => api.get(`/api/admin/users/${id}/avatar`, { responseType: "blob" });
