import { api, getApiMessage } from './api';
import { todayKey } from '../utils/date';

export async function getTodayHabits(date) {
  const response = await api.get('/api/progress/today', {
    params: { date },
  });
  return response.data;
}

export async function saveTodayHabits(payload) {
  const response = await api.put('/api/progress/today', payload);
  return response.data;
}

export async function getProgressHistory() {
  const response = await api.get('/api/progress');
  return response.data;
}

export { getApiMessage };

export async function getWeeklyInsights() {
  const response = await api.get('/api/progress/weekly-insights');
  return response.data;
}

export async function uploadProgressPhoto(file, type, date) {
  const formData = new FormData();
  formData.append('photo', file);
  formData.append('type', type);
  formData.append('date', date || todayKey());
  const response = await api.post('/api/progress/photos', formData);
  return response.data;
}

export async function getProgressPhoto(id, type) {
  return api.get(`/api/progress/${id}/photo/${type}`, { responseType: 'blob' });
}

export async function saveTodayNutrition(payload) {
  const response = await api.put('/api/progress/today/nutrition', payload);
  return response.data;
}
