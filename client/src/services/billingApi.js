import { api } from './api';

export async function getBillingStatus() {
  const { data } = await api.get('/api/billing/status');
  return data.data;
}

export async function createCheckoutSession() {
  const { data } = await api.post('/api/billing/checkout');
  return data.data;
}

export async function openBillingPortal() {
  const { data } = await api.post('/api/billing/portal');
  return data.data;
}
