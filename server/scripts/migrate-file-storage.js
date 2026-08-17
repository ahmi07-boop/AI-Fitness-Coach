const fs = require('fs/promises');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/User');
const Progress = require('../models/Progress');
const BodyAnalysis = require('../models/BodyAnalysis');
const { uploadBuffer, isStoredFileId, isAllowedLegacyPath } = require('../services/storageService');

async function exists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

function safeLegacyPath(value) {
  if (!value) return null;
  const resolved = path.resolve(String(value));
  return isAllowedLegacyPath(resolved) ? resolved : null;
}

async function migrateFile(value, purpose, ownerUserId, contentType = 'image/webp') {
  if (!value || isStoredFileId(value)) return value;
  const filePath = safeLegacyPath(value);
  if (!filePath || !(await exists(filePath))) return value;

  const buffer = await fs.readFile(filePath);
  const stored = await uploadBuffer(buffer, {
    filename: path.basename(filePath),
    contentType,
    metadata: {
      ownerUserId: String(ownerUserId || ''),
      purpose,
      migratedFromLocalStorage: true,
    },
  });

  return stored.fileId;
}

async function main() {
  await connectDB();

  let migrated = 0;
  let missing = 0;
  let cleared = 0;

  const users = await User.find({ 'profile.avatarPath': { $exists: true, $ne: null } }).select('_id profile.avatarPath');
  for (const user of users) {
    const current = user.profile?.avatarPath;
    if (!current || isStoredFileId(current)) continue;

    const next = await migrateFile(current, 'profile-avatar', user._id);
    if (next !== current) {
      user.profile.avatarPath = next;
      await user.save();
      migrated += 1;
    } else {
      // The local file is permanently unavailable on the ephemeral runtime.
      // Clear only the stale pointer so the account remains usable.
      user.profile.avatarPath = null;
      await user.save();
      missing += 1;
      cleared += 1;
    }
  }

  const progressEntries = await Progress.find({
    $or: [
      { 'photos.before.path': { $exists: true, $ne: null } },
      { 'photos.current.path': { $exists: true, $ne: null } },
    ],
  }).select('user photos');

  for (const entry of progressEntries) {
    let changed = false;
    for (const type of ['before', 'current']) {
      const current = entry.photos?.[type]?.path;
      if (!current || isStoredFileId(current)) continue;
      const next = await migrateFile(current, `progress-${type}`, entry.user);
      if (next !== current) {
        entry.photos[type].path = next;
        changed = true;
        migrated += 1;
      } else {
        entry.photos[type].path = undefined;
        entry.photos[type].uploadedAt = undefined;
        missing += 1;
        cleared += 1;
        changed = true;
      }
    }
    if (changed) await entry.save();
  }

  const analyses = await BodyAnalysis.find({
    $or: [
      { 'images.front': { $exists: true, $ne: null } },
      { 'images.back': { $exists: true, $ne: null } },
      { 'images.left': { $exists: true, $ne: null } },
      { 'images.right': { $exists: true, $ne: null } },
    ],
  }).select('userId images imageMetadata');

  for (const analysis of analyses) {
    let changed = false;
    for (const position of ['front', 'back', 'left', 'right']) {
      const current = analysis.images?.[position];
      if (!current || isStoredFileId(current)) continue;
      const next = await migrateFile(current, `body-analysis-${position}`, analysis.userId);
      if (next !== current) {
        analysis.images[position] = next;
        changed = true;
        migrated += 1;
      } else {
        analysis.images[position] = undefined;
        if (analysis.imageMetadata?.[position]) analysis.imageMetadata[position] = undefined;
        missing += 1;
        cleared += 1;
        changed = true;
      }
    }
    if (changed) await analysis.save();
  }

  console.log(`File-storage migration complete. Migrated: ${migrated}. Missing legacy files: ${missing}. Stale references cleared: ${cleared}.`);
}

main()
  .catch((error) => {
    console.error('File-storage migration failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectDB();
  });
