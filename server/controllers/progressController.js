const Progress = require('../models/Progress');
const Plan = require('../models/Plan');
const OpenAI = require('openai');
const AIUsageLog = require('../models/AIUsageLog');
const { normalizeDay, dayKey, getCurrentWeekRange } = require('../utils/date');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const { uploadBuffer, getFile, openDownloadStream, deleteFile, isStoredFileId } = require('../services/storageService');

const aiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const INSIGHT_MODEL = process.env.OPENAI_CHAT_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

const HABIT_KEYS = ['meals', 'water', 'workout', 'sleep'];

function normalizeHabits(input = {}) {
  return HABIT_KEYS.reduce((habits, key) => {
    habits[key] = Boolean(input[key]);
    return habits;
  }, {});
}

function habitSummary(habits) {
  const count = HABIT_KEYS.filter((key) => Boolean(habits[key])).length;
  return {
    count,
    percent: Math.round((count / HABIT_KEYS.length) * 100),
    completedDay: count === HABIT_KEYS.length,
  };
}

function calculateStreak(entries) {
  const completedDays = new Set(
    entries
      .filter((entry) => entry.completedDay)
      .map((entry) => dayKey(entry.date))
  );

  if (!completedDays.size) return 0;

  const today = normalizeDay();
  let cursor = new Date(today);
  const todayKey = dayKey(cursor);

  if (!completedDays.has(todayKey)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  let streak = 0;
  while (completedDays.has(dayKey(cursor))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

async function getWeeklyInsights(req, res) {
  const { start, end } = getCurrentWeekRange();
  const [entries, plan] = await Promise.all([
    Progress.find({ user: req.user._id, date: { $gte: start, $lt: end } }).sort({ date: 1 }).lean(),
    Plan.findOne({ user: req.user._id }).sort({ updatedAt: -1 }).lean(),
  ]);

  if (!entries.length) {
    return res.json({ success: true, data: { insights: ['Start logging your habits this week and FitCoach AI will turn them into personalized insights.'] } });
  }

  const summary = entries.map((entry) => ({
    date: dayKey(entry.date), weightKg: entry.weightKg, waterLiters: entry.waterLiters, sleepHours: entry.sleepHours,
    workoutCompleted: entry.workoutCompleted, habitCompletionPercent: entry.habitCompletionPercent, fitnessScore: entry.fitnessScore,
  }));
  const startedAt = Date.now();
  try {
    const response = await aiClient.chat.completions.create({
      model: INSIGHT_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: 'You are FitCoach AI. Generate three concise, supportive weekly fitness insights from the supplied progress data. Do not diagnose medical conditions. Return JSON with an insights array of exactly three strings.' },
        { role: 'user', content: JSON.stringify({ goal: req.user.profile?.goal || null, plan: plan ? { calories: plan.calories, protein: plan.protein, hydrationLiters: plan.hydrationLiters } : null, progress: summary }) },
      ],
    });
    const raw = response.choices?.[0]?.message?.content || '{}';
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    const insights = Array.isArray(parsed.insights) ? parsed.insights.filter(Boolean).slice(0, 3) : [];
    await AIUsageLog.create({ user: req.user._id, operation: 'weekly-progress-insights', model: response.model || INSIGHT_MODEL, endpoint: '/api/progress/weekly-insights', promptTokens: Number(response.usage?.prompt_tokens || 0), completionTokens: Number(response.usage?.completion_tokens || 0), totalTokens: Number(response.usage?.total_tokens || 0), latencyMs: Date.now() - startedAt, status: 'success' });
    return res.json({ success: true, data: { insights } });
  } catch (error) {
    await AIUsageLog.create({ user: req.user._id, operation: 'weekly-progress-insights', model: INSIGHT_MODEL, endpoint: '/api/progress/weekly-insights', latencyMs: Date.now() - startedAt, status: 'error', error: error.message });
    return res.json({ success: true, data: { insights: ['Your weekly data is being collected. Keep logging meals, water, workouts and sleep for more personalized insights.'] } });
  }
}

async function uploadProgressPhoto(req, res) {
  const type = req.body?.type;
  if (!['before', 'current'].includes(type)) {
    return res.status(400).json({ success: false, message: 'type must be before or current.' });
  }

  const file = req.file;
  if (!file?.buffer) {
    return res.status(400).json({ success: false, message: 'A photo file is required.' });
  }

  const date = normalizeDay(req.body?.date || new Date());

  try {
    const metadata = await sharp(file.buffer, { failOn: 'error' }).metadata();
    const width = Number(metadata.width || 0);
    const height = Number(metadata.height || 0);
    if (!width || !height || width * height > 25_000_000 || Math.min(width, height) < 240) {
      return res.status(400).json({
        success: false,
        message: 'Progress photo must be a valid image, at least 240 pixels on its shortest side, and no more than 25 megapixels.',
      });
    }

    const normalizedBuffer = await sharp(file.buffer, { failOn: 'error' })
      .rotate()
      .webp({ quality: 88 })
      .toBuffer();

    const stored = await uploadBuffer(normalizedBuffer, {
      filename: `${String(req.user._id)}-${date.toISOString().slice(0, 10)}-${type}-${Date.now()}.webp`,
      contentType: 'image/webp',
      metadata: {
        ownerUserId: String(req.user._id),
        purpose: `progress-${type}`,
        progressDate: date.toISOString().slice(0, 10),
      },
    });

    const existing = await Progress.findOne({ user: req.user._id, date }).select(`photos.${type}`).lean();
    const previousFileId = existing?.photos?.[type]?.path;

    const entry = await Progress.findOneAndUpdate(
      { user: req.user._id, date },
      {
        $setOnInsert: { user: req.user._id, date },
        $set: { [`photos.${type}`]: { path: stored.fileId, uploadedAt: new Date() } },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    if (previousFileId && isStoredFileId(previousFileId) && previousFileId !== stored.fileId) {
      await deleteFile(previousFileId).catch((error) => {
        console.warn('Previous progress photo cleanup failed:', error.message);
      });
    }

    return res.status(201).json({
      success: true,
      message: 'Progress photo saved.',
      data: { progress: entry },
    });
  } catch (error) {
    throw error;
  }
}

async function getProgressPhoto(req, res) {
  const type = String(req.params.type || '').toLowerCase();
  if (!['before', 'current'].includes(type)) {
    return res.status(400).json({ success: false, message: 'Invalid progress photo type.' });
  }

  const entry = await Progress.findById(req.params.id).select('user photos').lean();
  if (!entry) return res.status(404).json({ success: false, message: 'Progress entry not found.' });
  if (String(entry.user) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  const storedFileId = entry.photos?.[type]?.path;
  if (!storedFileId) return res.status(404).json({ success: false, message: 'Progress photo not found.' });

  if (isStoredFileId(storedFileId)) {
    const file = await getFile(storedFileId);
    if (!file) return res.status(404).json({ success: false, message: 'Progress photo not found.' });

    res.setHeader('Content-Type', file.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.length));
    res.setHeader('Cache-Control', 'private, max-age=300, must-revalidate');

    const stream = openDownloadStream(storedFileId);
    stream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'Progress photo not found.' });
      } else {
        res.destroy(error);
      }
    });
    return stream.pipe(res);
  }

  // Backward-compatible fallback for legacy local files.
  const resolved = path.resolve(storedFileId);
  const uploadsRoot = path.resolve(path.join(__dirname, '..', 'uploads'));
  if (!resolved.startsWith(`${uploadsRoot}${path.sep}`)) {
    return res.status(400).json({ success: false, message: 'Invalid progress photo path.' });
  }
  if (!fs.existsSync(resolved)) {
    return res.status(404).json({ success: false, message: 'Progress photo not found.' });
  }
  return res.sendFile(resolved);
}

async function listProgress(req, res) {
  const entries = await Progress.find({ user: req.user._id })
    .sort({ date: -1, createdAt: -1 })
    .limit(365);

  res.json({
    success: true,
    count: entries.length,
    data: {
      progress: entries,
      streak: calculateStreak(entries),
    },
  });
}

async function getTodayProgress(req, res) {
  const date = normalizeDay(req.query.date || new Date());
  if (!date) {
    return res.status(400).json({ success: false, message: 'date must use YYYY-MM-DD format.' });
  }

  const entry = await Progress.findOne({ user: req.user._id, date }).sort({ updatedAt: -1 });
  const recentEntries = await Progress.find({ user: req.user._id })
    .sort({ date: -1, createdAt: -1 })
    .limit(365);

  res.json({
    success: true,
    data: {
      progress: entry || null,
      streak: calculateStreak(recentEntries),
    },
  });
}

async function saveTodayProgress(req, res) {
  const date = normalizeDay(req.body?.date || new Date());
  if (!date) {
    return res.status(400).json({ success: false, message: 'date must use YYYY-MM-DD format.' });
  }

  const existing = await Progress.findOne({ user: req.user._id, date });
  const incomingHabits = req.body?.habits;
  const habits = normalizeHabits(existing?.habits || {});
  if (incomingHabits && typeof incomingHabits === 'object') {
    for (const key of HABIT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(incomingHabits, key)) {
        habits[key] = Boolean(incomingHabits[key]);
      }
    }
  }

  const summary = habitSummary(habits);
  const update = {
    user: req.user._id,
    date,
    habits,
    habitCompletionCount: summary.count,
    habitCompletionPercent: summary.percent,
    completedDay: summary.completedDay,
  };

  const numericFields = ['weightKg', 'calories', 'waterLiters', 'sleepHours', 'fitnessScore'];
  for (const field of numericFields) {
    if (req.body?.[field] !== undefined && req.body[field] !== '') {
      const value = Number(req.body[field]);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ success: false, message: `${field} must be a valid non-negative number.` });
      }
      update[field] = value;
    }
  }

  if (req.body?.workoutCompleted !== undefined) {
    update.workoutCompleted = Boolean(req.body.workoutCompleted);
    if (update.workoutCompleted) update.habits.workout = true;
  }

  if (req.body?.notes !== undefined) {
    update.notes = String(req.body.notes).slice(0, 2000);
  }

  const entry = await Progress.findOneAndUpdate(
    { user: req.user._id, date },
    { $set: update },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const recentEntries = await Progress.find({ user: req.user._id })
    .sort({ date: -1, createdAt: -1 })
    .limit(365);

  const streak = calculateStreak(recentEntries);
  const io = req.app.locals.io;
  if (io) {
    io.to(`user:${String(req.user._id)}`).emit('progress:updated', {
      progress: entry,
      streak,
      timestamp: new Date().toISOString(),
    });
  }

  res.json({
    success: true,
    message: 'Daily progress saved.',
    data: { progress: entry, streak },
  });
}

async function saveTodayNutrition(req, res) {
  const date = normalizeDay(req.body?.date || new Date());
  if (!date) return res.status(400).json({ success: false, message: 'date must use YYYY-MM-DD format.' });

  const plan = await Plan.findOne({ user: req.user._id }).sort({ updatedAt: -1 }).lean();
  if (!plan) return res.status(404).json({ success: false, message: 'A nutrition plan is required before tracking nutrition.' });

  const validMealIds = new Set((plan.meals || []).map((meal, index) => String(meal.id || index)));
  const completedMealIds = [...new Set(
    (Array.isArray(req.body?.completedMealIds) ? req.body.completedMealIds : [])
      .map((value) => String(value).trim())
      .filter((value) => validMealIds.has(value))
  )];

  const completedMeals = (plan.meals || []).filter((meal, index) => {
    const id = String(meal.id || index);
    return completedMealIds.includes(id);
  });
  const caloriesConsumed = completedMeals.reduce((sum, meal) => sum + Math.max(0, Number(meal.calories || 0)), 0);
  const proteinConsumed = completedMeals.reduce((sum, meal) => sum + Math.max(0, Number(meal.protein || 0)), 0);
  const carbsConsumed = completedMeals.reduce((sum, meal) => sum + Math.max(0, Number(meal.carbs || 0)), 0);
  const fatConsumed = completedMeals.reduce((sum, meal) => sum + Math.max(0, Number(meal.fat || 0)), 0);
  const waterValue = Number(req.body?.waterLiters || 0);
  if (!Number.isFinite(waterValue) || waterValue < 0 || waterValue > 20) {
    return res.status(400).json({ success: false, message: 'waterLiters must be between 0 and 20.' });
  }
  const waterLiters = waterValue;

  const existing = await Progress.findOne({ user: req.user._id, date });
  const habits = normalizeHabits(existing?.habits || {});
  habits.meals = completedMealIds.length > 0;
  habits.water = waterLiters > 0;

  const summary = habitSummary(habits);
  const entry = await Progress.findOneAndUpdate(
    { user: req.user._id, date },
    {
      $set: {
        user: req.user._id,
        date,
        waterLiters,
        nutrition: {
          completedMealIds,
          caloriesConsumed,
          proteinConsumed,
          carbsConsumed,
          fatConsumed,
        },
        habits,
        habitCompletionCount: summary.count,
        habitCompletionPercent: summary.percent,
        completedDay: summary.completedDay,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const recentEntries = await Progress.find({ user: req.user._id }).sort({ date: -1, createdAt: -1 }).limit(365);
  const streak = calculateStreak(recentEntries);
  const io = req.app.locals.io;
  if (io) {
    io.to(`user:${String(req.user._id)}`).emit('progress:updated', {
      progress: entry,
      streak,
      timestamp: new Date().toISOString(),
    });
  }

  return res.json({ success: true, message: 'Nutrition saved.', data: { progress: entry, streak } });
}

async function saveWorkoutCompletion(req, res) {
  const date = normalizeDay(req.body?.date || new Date());
  if (!date) return res.status(400).json({ success: false, message: 'date must use YYYY-MM-DD format.' });

  const planQuery = Plan.findOne({ user: req.user._id }).sort({ updatedAt: -1 });
  const plan = typeof planQuery?.lean === 'function'
    ? await planQuery.lean()
    : await planQuery;
  if (!plan?.workout?.weeklySplit?.length) {
    return res.status(400).json({ success: false, message: 'Your personalized workout plan is not available.' });
  }

  const todayName = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: process.env.APP_TIMEZONE || 'UTC',
  }).format(date);

  const workoutDay = plan.workout.weeklySplit.find((day) => {
    const name = String(day.day || '').toLowerCase();
    return String(day.type || '').toLowerCase() !== 'rest' && name.includes(todayName.toLowerCase());
  }) || plan.workout.weeklySplit.find((day) => String(day.type || '').toLowerCase() !== 'rest');

  const authoritativeExercises = workoutDay?.exercises || [];
  const expectedIds = authoritativeExercises.map((exercise, index) =>
    String(exercise?.id || `exercise-${index + 1}-${exercise?.name || 'workout'}`).trim()
  ).filter(Boolean);

  const rawIds = Array.isArray(req.body?.completedExerciseIds) ? req.body.completedExerciseIds : [];
  const completedExerciseIds = [...new Set(rawIds.map((value) => String(value).trim()).filter(Boolean))];
  const totalExercises = expectedIds.length;

  if (!totalExercises) {
    return res.status(400).json({ success: false, message: 'Today has no exercises to complete.' });
  }

  const unknownIds = completedExerciseIds.filter((id) => !expectedIds.includes(id));
  if (unknownIds.length) {
    return res.status(400).json({ success: false, message: 'One or more completed exercises do not belong to your current workout plan.' });
  }

  if (completedExerciseIds.length !== totalExercises || !expectedIds.every((id) => completedExerciseIds.includes(id))) {
    return res.status(400).json({ success: false, message: 'All exercises must be completed before finishing the workout.' });
  }

  const sessionId = String(req.body?.sessionId || '').trim().slice(0, 100);
  const totalSets = expectedIds.reduce((sum, id, index) => {
    const exercise = authoritativeExercises[index];
    return sum + Math.max(0, Number(exercise?.sets || 0));
  }, 0);
  const completedSets = totalSets;
  const durationSeconds = Math.max(0, Number(req.body?.durationSeconds || 0));
  const startedAt = req.body?.startedAt ? new Date(req.body.startedAt) : undefined;
  const completedAt = new Date();

  const workoutSession = {
    sessionId: sessionId || undefined,
    status: 'completed',
    totalExercises,
    completedExerciseIds: expectedIds,
    exercisesCompleted: totalExercises,
    totalSets,
    completedSets,
    durationSeconds,
    startedAt: startedAt && !Number.isNaN(startedAt.getTime()) ? startedAt : undefined,
    completedAt,
  };

  const existing = await Progress.findOne({ user: req.user._id, date });
  const habits = normalizeHabits(existing?.habits || {});
  habits.workout = true;
  const summary = habitSummary(habits);

  const entry = await Progress.findOneAndUpdate(
    { user: req.user._id, date },
    {
      $set: {
        user: req.user._id,
        date,
        workoutCompleted: true,
        'habits.workout': true,
        workoutSession,
        habitCompletionCount: summary.count,
        habitCompletionPercent: summary.percent,
        completedDay: summary.completedDay,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  const recentEntries = await Progress.find({ user: req.user._id }).sort({ date: -1, createdAt: -1 }).limit(365);
  const streak = calculateStreak(recentEntries);
  const io = req.app.locals.io;
  if (io) {
    io.to(`user:${String(req.user._id)}`).emit('progress:updated', {
      progress: entry,
      streak,
      timestamp: completedAt.toISOString(),
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Workout completion saved.',
    data: { progress: entry, streak },
  });
}

async function getProgress(req, res) {
  const entry = await Progress.findById(req.params.id);
  if (!entry) return res.status(404).json({ success: false, message: 'Progress entry not found.' });
  if (String(entry.user) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }
  res.json({ success: true, data: { progress: entry } });
}

async function createProgress(req, res) {
  const { date, weightKg, calories, waterLiters, workoutCompleted, sleepHours, fitnessScore, notes } = req.body;
  const normalizedDate = normalizeDay(date);
  if (!normalizedDate) return res.status(400).json({ success: false, message: 'A valid date is required.' });

  const existing = await Progress.findOne({ user: req.user._id, date: normalizedDate });
  const habits = normalizeHabits(existing?.habits || {});
  if (req.body?.habits && typeof req.body.habits === 'object') {
    for (const key of HABIT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(req.body.habits, key)) {
        habits[key] = Boolean(req.body.habits[key]);
      }
    }
  }
  const summary = habitSummary(habits);

  const payload = {
    user: req.user._id,
    date: normalizedDate,
    habits,
    habitCompletionCount: summary.count,
    habitCompletionPercent: summary.percent,
    completedDay: summary.completedDay,
  };

  for (const field of ['weightKg', 'calories', 'waterLiters', 'sleepHours', 'fitnessScore', 'workoutCompleted', 'notes']) {
    if (req.body?.[field] !== undefined) payload[field] = req.body[field];
  }

  const entry = await Progress.findOneAndUpdate(
    { user: req.user._id, date: normalizedDate },
    { $set: payload },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  res.status(201).json({ success: true, message: 'Progress saved.', data: { progress: entry } });
}

async function updateProgress(req, res) {
  const entry = await Progress.findById(req.params.id);
  if (!entry) return res.status(404).json({ success: false, message: 'Progress entry not found.' });
  if (String(entry.user) !== String(req.user._id) && req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  if (req.body?.habits) {
    const habits = normalizeHabits(entry.habits || {});
    for (const key of HABIT_KEYS) {
      if (Object.prototype.hasOwnProperty.call(req.body.habits, key)) {
        habits[key] = Boolean(req.body.habits[key]);
      }
    }
    const summary = habitSummary(habits);
    req.body.habits = habits;
    req.body.habitCompletionCount = summary.count;
    req.body.habitCompletionPercent = summary.percent;
    req.body.completedDay = summary.completedDay;
  }

  delete req.body.user;
  delete req.body._id;

  Object.assign(entry, req.body);
  await entry.save();

  res.json({ success: true, message: 'Progress updated.', data: { progress: entry } });
}

module.exports = {
  getWeeklyInsights,
  uploadProgressPhoto,
  getProgressPhoto,
  listProgress,
  getTodayProgress,
  saveTodayProgress,
  saveTodayNutrition,
  saveWorkoutCompletion,
  getProgress,
  createProgress,
  updateProgress,
};
