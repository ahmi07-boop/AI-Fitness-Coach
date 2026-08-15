import { api } from './api';

export async function saveWorkoutCompletion(payload) {
  const response = await api.post('/api/progress/workout-completion', payload);
  return response.data;
}
