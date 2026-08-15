const mongoose = require('mongoose');

const planTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    goal: { type: String, required: true, enum: ['weight-loss', 'weight-gain', 'muscle-building', 'maintenance'] },
    calories: { type: Number, min: 0, required: true },
    protein: { type: Number, min: 0, required: true },
    carbs: { type: Number, min: 0, required: true },
    fat: { type: Number, min: 0, required: true },
    hydrationLiters: { type: Number, min: 0, default: 2 },
    meals: { type: Array, default: [] },
    workout: { type: Object, default: {} },
    notes: { type: [String], default: [] },
    active: { type: Boolean, default: true, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlanTemplate', planTemplateSchema);
