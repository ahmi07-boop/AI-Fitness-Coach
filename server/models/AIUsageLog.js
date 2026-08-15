const mongoose = require('mongoose');

const aiUsageLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    operation: { type: String, required: true, trim: true, index: true },
    model: { type: String, default: '' },
    endpoint: { type: String, default: '' },
    promptTokens: { type: Number, default: 0, min: 0 },
    completionTokens: { type: Number, default: 0, min: 0 },
    totalTokens: { type: Number, default: 0, min: 0 },
    latencyMs: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ['success', 'error'], default: 'success', index: true },
    error: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AIUsageLog', aiUsageLogSchema);
