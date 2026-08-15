import { api } from "./api";

export async function analyzeBody(formData) {
  const response = await api.post("/api/analysis/body-analysis", formData);
  return response.data;
}

export async function getAnalysisHistory() {
  const response = await api.get("/api/analysis/history");
  return response.data;
}

export async function compareAnalysis() {
  const response = await api.get("/api/analysis/compare");
  return response.data;
}
