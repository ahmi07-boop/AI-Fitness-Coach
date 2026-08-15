const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const AIUsageLog = require('../models/AIUsageLog');
const PromptTemplate = require('../models/PromptTemplate');

const PLAN_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    calories: { type: 'number' },
    protein: { type: 'number' },
    carbs: { type: 'number' },
    fat: { type: 'number' },
    hydrationLiters: { type: 'number' },
    meals: {
      type: 'array',
      minItems: 4,
      maxItems: 6,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          name: { type: 'string' },
          time: { type: 'string' },
          calories: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
          ingredients: { type: 'array', items: { type: 'string' } },
          notes: { type: 'string' },
        },
        required: ['type', 'name', 'time', 'calories', 'protein', 'carbs', 'fat', 'ingredients', 'notes'],
      },
    },
    workout: {
      type: 'object',
      additionalProperties: false,
      properties: {
        daysPerWeek: { type: 'number' },
        weeklySplit: {
          type: 'array',
          minItems: 7,
          maxItems: 7,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              day: { type: 'string' },
              title: { type: 'string' },
              type: { type: 'string' },
              duration: { type: 'string' },
              exercises: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    name: { type: 'string' },
                    category: { type: 'string' },
                    sets: { type: 'number' },
                    reps: { type: 'string' },
                    rest: { type: 'string' },
                    difficulty: { type: 'string' },
                    description: { type: 'string' },
                  },
                  required: ['name', 'category', 'sets', 'reps', 'rest', 'difficulty', 'description'],
                },
              },
            },
            required: ['day', 'title', 'type', 'duration', 'exercises'],
          },
        },
      },
      required: ['daysPerWeek', 'weeklySplit'],
    },
    notes: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'summary', 'calories', 'protein', 'carbs', 'fat', 'hydrationLiters', 'meals', 'workout', 'notes'],
};

function normalizeGoal(goal) {
  return goal === 'muscle' ? 'muscle-building' : (goal || 'maintenance');
}

function buildUserContext(user, analysis) {
  const profile = user.profile || {};
  return {
    name: user.name,
    age: profile.age || null,
    gender: profile.gender || null,
    heightCm: profile.heightCm || null,
    weightKg: profile.weightKg || null,
    activityLevel: profile.activityLevel || null,
    goal: normalizeGoal(profile.goal),
    dietaryPreference: profile.dietaryPreference || 'No specific preference',
    allergies: profile.allergies || 'None reported',
    bodyAnalysis: analysis ? {
      bmi: analysis.bmi,
      postureScore: analysis.postureScore,
      symmetryScore: analysis.symmetryScore,
      shoulderAlignment: analysis.shoulderAlignment,
      hipAlignment: analysis.hipAlignment,
    } : null,
  };
}

async function generatePersonalizedPlan(user, analysis) {
  const context = buildUserContext(user, analysis);
  const promptTemplates = await PromptTemplate.find({ key: { $in: ['diet', 'workout'] }, active: true }).lean();
  const templateText = promptTemplates.map((item) => item.template).filter(Boolean).join('\n\n');
  const systemPrompt = `${templateText || 'You are FitCoach AI, a fitness planning assistant. Create a practical 7-day fitness and nutrition starting plan from the supplied user data.'}\n\nRules:\n- Respect the user's goal, activity level, dietary preference, and allergies.\n- Never include a reported allergen in meals or ingredient lists.\n- Use reasonable calorie and macro targets; keep protein/carbs/fat internally plausible.\n- Include exactly 7 days in the weekly workout split.\n- Prefer equipment-light exercises because equipment availability is not supplied.\n- Keep exercise prescriptions beginner-to-intermediate unless the user context indicates otherwise.\n- Do not diagnose, prescribe treatment, or make medical claims.\n- Treat body-analysis scores as approximate fitness signals, not medical measurements.\n- Return only the requested JSON structure.`;
  const userPrompt = `Build the plan using this user context:\n${JSON.stringify(context, null, 2)}`;

  const startedAt = Date.now();
  let response;
  try {
    response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.4,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: { name: 'fitness_plan', strict: true, schema: PLAN_SCHEMA },
    },
  });
    await AIUsageLog.create({
      user: user._id, operation: 'plan_generation', model: response.model || MODEL, endpoint: '/api/plans/generate',
      promptTokens: Number(response.usage?.prompt_tokens || 0), completionTokens: Number(response.usage?.completion_tokens || 0),
      totalTokens: Number(response.usage?.total_tokens || 0), latencyMs: Date.now() - startedAt, status: 'success'
    });
  } catch (error) {
    await AIUsageLog.create({ user: user._id, operation: 'plan_generation', model: MODEL, endpoint: '/api/plans/generate', latencyMs: Date.now() - startedAt, status: 'error', error: error.message });
    throw error;
  }

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error('The AI did not return a fitness plan.');
  const plan = JSON.parse(content);

  // AI output intentionally omits client identifiers from the strict schema.
  // Add deterministic IDs after validation so workout progress can safely
  // track individual exercises without relying on array indexes or undefined IDs.
  for (let dayIndex = 0; dayIndex < (plan.workout?.weeklySplit || []).length; dayIndex += 1) {
    const day = plan.workout.weeklySplit[dayIndex];
    for (let exerciseIndex = 0; exerciseIndex < (day.exercises || []).length; exerciseIndex += 1) {
      const exercise = day.exercises[exerciseIndex];
      const slug = String(exercise.name || 'exercise')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'exercise';
      exercise.id = `day-${dayIndex + 1}-exercise-${exerciseIndex + 1}-${slug}`;
    }
  }

  plan.generatedBy = 'OpenAI';
  plan.model = MODEL;
  const usage = {
    ...(response.usage || {}),
    latency_ms: Date.now() - startedAt,
  };
  return { plan, usage };
}

module.exports = { generatePersonalizedPlan, normalizeGoal };
