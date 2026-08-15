const mongoose = require('mongoose');

const habitsSchema = new mongoose.Schema(
  {
    meals: { type: Boolean, default: false },
    water: { type: Boolean, default: false },
    workout: { type: Boolean, default: false },
    sleep: { type: Boolean, default: false },
  },
  { _id: false }
);

const nutritionSchema = new mongoose.Schema(
  {
    completedMealIds: { type: [String], default: [] },
    caloriesConsumed: { type: Number, min: 0, default: 0 },
    proteinConsumed: { type: Number, min: 0, default: 0 },
    carbsConsumed: { type: Number, min: 0, default: 0 },
    fatConsumed: { type: Number, min: 0, default: 0 },
  },
  { _id: false }
);

const workoutSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, maxlength: 100 },
    status: { type: String, enum: ['in-progress', 'completed'], default: 'completed' },
    totalExercises: { type: Number, min: 0 },
    completedExerciseIds: { type: [String], default: [] },
    exercisesCompleted: { type: Number, min: 0, default: 0 },
    totalSets: { type: Number, min: 0, default: 0 },
    completedSets: { type: Number, min: 0, default: 0 },
    durationSeconds: { type: Number, min: 0, default: 0 },
    startedAt: Date,
    completedAt: Date,
  },
  { _id: false }
);

const progressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    date: { type: Date, required: true, index: true },
    weightKg: { type: Number, min: 0 },
    calories: { type: Number, min: 0 },
    waterLiters: { type: Number, min: 0 },
    nutrition: { type: nutritionSchema, default: () => ({}) },
    workoutCompleted: { type: Boolean, default: false },
    workoutSession: { type: workoutSessionSchema, default: undefined },
    sleepHours: { type: Number, min: 0, max: 24 },
    fitnessScore: { type: Number, min: 0, max: 100 },
    notes: { type: String, maxlength: 2000 },
    photos: { before: { path: String, uploadedAt: Date }, current: { path: String, uploadedAt: Date } },
    habits: { type: habitsSchema, default: () => ({}) },
    habitCompletionCount: { type: Number, min: 0, max: 4, default: 0 },
    habitCompletionPercent: { type: Number, min: 0, max: 100, default: 0 },
    completedDay: { type: Boolean, default: false },
  },
  { timestamps: true }
);

progressSchema.index({ user: 1, date: -1 });
progressSchema.index({ user: 1, date: 1 }, { unique: true, name: 'user_date_unique' });

module.exports = mongoose.model('Progress', progressSchema);
