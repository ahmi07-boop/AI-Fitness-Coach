const mongoose = require('mongoose');

const landmarkSchema = new mongoose.Schema({
  x: Number,
  y: Number,
  z: Number,
  visibility: Number,
}, { _id: false });

const viewResultSchema = new mongoose.Schema({
  position: String,
  label: String,
  landmarks: { type: [landmarkSchema], default: [] },
  worldLandmarks: { type: [landmarkSchema], default: [] },
  metrics: {
    postureScore: Number,
    symmetryScore: Number,
    shoulderAlignment: Number,
    hipAlignment: Number,
    detectionConfidence: Number,
    postureStatus: String,
    postureFlags: { type: [String], default: [] },
  },
}, { _id: false });

const bodyAnalysisSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  bmi: Number,
  postureScore: Number,
  postureStatus: String,
  postureFlags: { type: [String], default: [] },
  symmetryScore: Number,
  shoulderAlignment: Number,
  hipAlignment: Number,
  detectionConfidence: Number,
  viewsAnalyzed: { type: Number, default: 0 },
  totalViews: { type: Number, default: 0 },
  source: { type: String, default: 'MediaPipe Pose Landmarker' },
  landmarks: { type: [landmarkSchema], default: [] },
  viewResults: { type: [viewResultSchema], default: [] },
  images: { front: String, back: String, left: String, right: String },
  moderationStatus: { type: String, enum: ['Pending', 'Approved', 'Flagged', 'Deleted'], default: 'Pending', index: true },
  moderationReason: { type: String, default: '' },
  moderatedAt: { type: Date, default: null },
}, { timestamps: true });

module.exports = mongoose.model('BodyAnalysis', bodyAnalysisSchema);
