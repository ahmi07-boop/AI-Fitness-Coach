const mongoose = require('mongoose');

const adminLogSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    event: { type: String, required: true, trim: true },
    targetUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, default: 'Success', trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AdminLog', adminLogSchema);
