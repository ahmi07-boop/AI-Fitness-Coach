import { api, getApiMessage } from './api';

export async function getMyConversation() {
  const response = await api.get('/api/chat/me');
  return response.data;
}

export async function createConversation() {
  const response = await api.post('/api/chat');
  return response.data;
}

export async function sendChatMessage({ conversationId, message }) {
  const response = await api.post('/api/chat/message', {
    conversationId,
    message,
  });
  return response.data;
}

export async function searchCoachContext(query) {
  const response = await api.post('/api/rag/search', { query });
  return response.data;
}

export { getApiMessage };
