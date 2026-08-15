const mongoose = require('mongoose');

const ragDocumentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceType: {
      type: String,
      enum: ['profile', 'plan', 'progress'],
      required: true,
      index: true,
    },
    sourceId: { type: String, required: true, index: true },
    content: { type: String, required: true, maxlength: 50000 },
    embedding: { type: [Number], default: [] },
    contentHash: { type: String, required: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

ragDocumentSchema.index({ user: 1, sourceType: 1, sourceId: 1 }, { unique: true });

module.exports = mongoose.model('RagDocument', ragDocumentSchema);
