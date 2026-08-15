const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ['user', 'admin'], default: 'user', index: true },
    isActive: { type: Boolean, default: true, index: true },
    accountStatus: {
      type: String,
      enum: ['active', 'inactive', 'banned'],
      default: 'active',
      index: true,
    },
    lastLogin: { type: Date, default: null },
    profile: {
      age: { type: Number, min: 13, max: 120 },
      gender: { type: String, trim: true },
      heightCm: { type: Number, min: 50, max: 300 },
      weightKg: { type: Number, min: 20, max: 500 },
      goal: {
        type: String,
        enum: ['weight-loss', 'weight-gain', 'muscle-building', 'muscle', 'maintenance', null],
        default: null,
      },
      activityLevel: { type: String, trim: true, default: '' },
      dietaryPreference: { type: String, trim: true, default: '' },
      allergies: { type: String, trim: true, default: '' },
      avatarPath: { type: String, default: null },
    },
    planUsage: {
      freeGenerationsUsed: { type: Number, default: 0, min: 0 },
    },
    billing: {
      stripeCustomerId: { type: String, default: null, index: true },
      stripeSubscriptionId: { type: String, default: null, index: true },
      subscriptionStatus: { type: String, default: 'none' },
      priceId: { type: String, default: null },
      currentPeriodEnd: { type: Date, default: null },
      cancelAtPeriodEnd: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);
