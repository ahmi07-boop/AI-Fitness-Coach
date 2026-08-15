const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, maxlength: 10000 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const chatLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    messages: { type: [messageSchema], default: [] },
    moderationStatus: {
      type: String,
      enum: ['Normal', 'Flagged', 'Blocked'],
      default: 'Normal',
      index: true,
    },
    aiModerationStatus: {
      type: String,
      enum: ['Pending', 'Approved', 'Flagged'],
      default: 'Pending',
      index: true,
    },
    model: { type: String, default: null },
    tokens: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('ChatLog', chatLogSchema);
