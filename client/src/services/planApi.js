import { api } from "./api";

export async function getMyPlan() {
  const { data } = await api.get("/api/plans/me");
  return data.data.plan;
}

export async function generateMyPlan(goal) {
  const { data } = await api.post("/api/plans/generate", { goal });
  return data.data.plan;
}

export async function getPlanUsage() {
  const { data } = await api.get('/api/plans/usage');
  return data.data;
}
