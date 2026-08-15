const mongoose = require('mongoose');

const mealSchema = new mongoose.Schema(
  {
    type: { type: String, default: '' },
    name: { type: String, default: '' },
    time: { type: String, default: '' },
    calories: { type: Number, min: 0, default: 0 },
    protein: { type: Number, min: 0, default: 0 },
    carbs: { type: Number, min: 0, default: 0 },
    fat: { type: Number, min: 0, default: 0 },
    ingredients: { type: [String], default: [] },
    notes: { type: String, default: '' },
  },
  { _id: false }
);

const exerciseSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true, maxlength: 120 },
    name: { type: String, default: '' },
    category: { type: String, default: '' },
    sets: { type: Number, min: 0, default: 0 },
    reps: { type: String, default: '' },
    rest: { type: String, default: '' },
    difficulty: { type: String, default: '' },
    description: { type: String, default: '' },
  },
  { _id: false }
);

const workoutDaySchema = new mongoose.Schema(
  {
    day: { type: String, default: '' },
    title: { type: String, default: '' },
    type: { type: String, default: '' },
    duration: { type: String, default: '' },
    exercises: { type: [exerciseSchema], default: [] },
  },
  { _id: false }
);

const planSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    goal: { type: String, required: true, trim: true },
    title: { type: String, default: '' },
    summary: { type: String, default: '' },
    calories: { type: Number, min: 0 },
    protein: { type: Number, min: 0 },
    carbs: { type: Number, min: 0 },
    fat: { type: Number, min: 0 },
    hydrationLiters: { type: Number, min: 0 },
    meals: { type: [mealSchema], default: [] },
    workout: {
      daysPerWeek: { type: Number, min: 0, default: 0 },
      weeklySplit: { type: [workoutDaySchema], default: [] },
    },
    notes: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['AI Generated', 'Admin Modified', 'Manual Template'],
      default: 'AI Generated',
      index: true,
    },
    moderationStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Flagged'],
      default: 'Pending',
      index: true,
    },
    moderationReason: { type: String, default: '' },
    moderatedAt: { type: Date, default: null },
    moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    generatedBy: { type: String, default: 'OpenAI' },
    model: { type: String, default: '' },
    aiUsage: {
      promptTokens: { type: Number, min: 0, default: 0 },
      completionTokens: { type: Number, min: 0, default: 0 },
      totalTokens: { type: Number, min: 0, default: 0 },
      latencyMs: { type: Number, min: 0, default: 0 },
    },
    lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Plan', planSchema);
