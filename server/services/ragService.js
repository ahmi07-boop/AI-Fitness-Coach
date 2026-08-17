const crypto = require('crypto');
const OpenAI = require('openai');
const RagDocument = require('../models/RagDocument');
const Plan = require('../models/Plan');
const Progress = require('../models/Progress');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-small';

function hashContent(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

function safeNumber(value) {
  return Number.isFinite(Number(value)) ? Number(value) : null;
}

function profileContext(user) {
  const p = user.profile || {};
  return [
    `User name: ${user.name || 'Unknown'}`,
    `Age: ${safeNumber(p.age) ?? 'not provided'}`,
    `Gender: ${p.gender || 'not provided'}`,
    `Height: ${safeNumber(p.heightCm) ?? 'not provided'} cm`,
    `Weight: ${safeNumber(p.weightKg) ?? 'not provided'} kg`,
    `Goal: ${p.goal || 'not provided'}`,
    `Activity level: ${p.activityLevel || 'not provided'}`,
    `Dietary preference: ${p.dietaryPreference || 'not provided'}`,
    `Allergies: ${p.allergies || 'none reported'}`,
  ].join('\n');
}

function planContext(plan) {
  if (!plan) return 'No personalized plan has been generated yet.';
  const meals = (plan.meals || []).map((meal) =>
    `- ${meal.type || 'Meal'}: ${meal.name || 'Unnamed'} at ${meal.time || 'unspecified time'}; ${meal.calories || 0} kcal; protein ${meal.protein || 0}g; carbs ${meal.carbs || 0}g; fat ${meal.fat || 0}g; ingredients: ${(meal.ingredients || []).join(', ')}`
  ).join('\n');
  const workouts = (plan.workout?.weeklySplit || []).map((day) =>
    `- ${day.day || 'Day'} — ${day.title || day.type || 'Workout'} (${day.duration || 'unspecified duration'}): ${(day.exercises || []).map((exercise) => `${exercise.name} ${exercise.sets || 0} sets x ${exercise.reps || ''} reps, rest ${exercise.rest || ''}`).join('; ')}`
  ).join('\n');
  return [
    `Plan title: ${plan.title || 'Personalized plan'}`,
    `Goal: ${plan.goal || 'not provided'}`,
    `Summary: ${plan.summary || 'not provided'}`,
    `Daily calories: ${plan.calories ?? 'not provided'}`,
    `Protein: ${plan.protein ?? 'not provided'}g`,
    `Carbs: ${plan.carbs ?? 'not provided'}g`,
    `Fat: ${plan.fat ?? 'not provided'}g`,
    `Hydration: ${plan.hydrationLiters ?? 'not provided'} L`,
    `Meals:\n${meals || 'No meals listed.'}`,
    `Weekly workout:\n${workouts || 'No workouts listed.'}`,
    `Plan notes: ${(plan.notes || []).join(' | ') || 'None'}`,
  ].join('\n');
}

function progressContext(entries) {
  if (!entries.length) return 'No progress history has been recorded yet.';
  return entries.map((entry) => {
    const date = new Date(entry.date).toISOString().slice(0, 10);
    const habits = entry.habits || {};
    return [
      `${date}: weight ${entry.weightKg ?? 'n/a'} kg; calories ${entry.calories ?? 'n/a'}; water ${entry.waterLiters ?? 'n/a'} L; sleep ${entry.sleepHours ?? 'n/a'} h; workout ${entry.workoutCompleted ? 'completed' : 'not completed'}; habits ${entry.habitCompletionPercent ?? 0}%; fitness score ${entry.fitnessScore ?? 'n/a'}; meals ${habits.meals ? 'done' : 'not done'}, water ${habits.water ? 'done' : 'not done'}, workout ${habits.workout ? 'done' : 'not done'}, sleep ${habits.sleep ? 'done' : 'not done'}.`,
    ].join('');
  }).join('\n');
}

async function upsertDocument(userId, sourceType, sourceId, content, metadata = {}) {
  const contentHash = hashContent(content);
  const existing = await RagDocument.findOne({ user: userId, sourceType, sourceId });
  if (existing && existing.contentHash === contentHash && existing.embedding?.length) {
    return existing;
  }

  const embeddingResponse = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: content,
  });
  const embedding = embeddingResponse.data[0].embedding;

  return RagDocument.findOneAndUpdate(
    { user: userId, sourceType, sourceId },
    { $set: { content, contentHash, embedding, metadata } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );
}

async function syncUserContext(userId, user) {
  const plan = await Plan.findOne({ user: userId }).sort({ updatedAt: -1 });
  const progress = await Progress.find({ user: userId }).sort({ date: -1 }).limit(14);

  await upsertDocument(userId, 'profile', String(userId), profileContext(user), { source: 'user-profile' });

  if (plan) {
    await upsertDocument(userId, 'plan', String(plan._id), planContext(plan), { source: 'personalized-plan' });
  }

  await upsertDocument(
    userId,
    'progress',
    'recent-14-days',
    progressContext(progress),
    { source: 'recent-progress', count: progress.length }
  );

  return { plan, progress };
}

function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (!normA || !normB) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function retrieveContext(userId, query, user) {
  const cleanQuery = String(query || '').trim();
  if (!cleanQuery) return [];

  await syncUserContext(userId, user);

  const queryResponse = await client.embeddings.create({
    model: EMBEDDING_MODEL,
    input: cleanQuery,
  });
  const queryEmbedding = queryResponse.data[0].embedding;

  const documents = await RagDocument.find({ user: userId }).lean();
  return documents
    .map((doc) => ({
      id: String(doc._id),
      sourceType: doc.sourceType,
      sourceId: doc.sourceId,
      content: doc.content,
      score: cosineSimilarity(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

module.exports = {
  createEmbedding: async (text) => {
    const res = await client.embeddings.create({ model: EMBEDDING_MODEL, input: text });
    return res.data[0].embedding;
  },
  retrieveContext,
  syncUserContext,
};
