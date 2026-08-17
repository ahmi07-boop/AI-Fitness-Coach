const fs = require('fs/promises');
const path = require('path');
const mongoose = require('mongoose');

const BUCKET_NAME = process.env.MONGO_FILE_BUCKET || 'fitcoach_files';
const LEGACY_UPLOAD_ROOTS = [
  path.resolve(path.join(__dirname, '..', 'uploads')),
  path.resolve('/app/uploads'),
];

function isAllowedLegacyPath(filePath) {
  const resolved = path.resolve(String(filePath || ''));
  return LEGACY_UPLOAD_ROOTS.some((root) => (
    resolved.startsWith(`${root}${path.sep}`)
  ));
}

async function legacyFileExists(filePath) {
  if (!isAllowedLegacyPath(filePath)) return false;
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function legacyUploadRoots() {
  return [...LEGACY_UPLOAD_ROOTS];
}

function getBucket() {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB file storage is not ready.');
  }
  if (!mongoose.mongo.ObjectId) {
    throw new Error('MongoDB ObjectId support is unavailable.');
  }
  // GridFSBucket is created lazily so application modules can be imported
  // before MongoDB connects during server startup.
  return new mongoose.mongo.GridFSBucket(db, { bucketName: BUCKET_NAME });
}

function toObjectId(fileId) {
  if (!fileId || !mongoose.isValidObjectId(fileId)) return null;
  return new mongoose.Types.ObjectId(String(fileId));
}

async function uploadBuffer(buffer, {
  filename,
  contentType,
  metadata = {},
} = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('A non-empty file buffer is required.');
  }

  const bucket = getBucket();
  const safeFilename = path.basename(String(filename || `upload-${Date.now()}`));
  const uploadStream = bucket.openUploadStream(safeFilename, {
    contentType: String(contentType || 'application/octet-stream'),
    metadata: {
      ...metadata,
      uploadedAt: new Date(),
      storageVersion: 1,
    },
  });

  await new Promise((resolve, reject) => {
    uploadStream.once('finish', resolve);
    uploadStream.once('error', reject);
    uploadStream.end(buffer);
  });

  return {
    fileId: String(uploadStream.id),
    filename: safeFilename,
    contentType: String(contentType || 'application/octet-stream'),
    size: buffer.length,
  };
}

async function uploadFile(filePath, options = {}) {
  const buffer = await fs.readFile(filePath);
  return uploadBuffer(buffer, {
    ...options,
    filename: options.filename || path.basename(filePath),
  });
}

async function getFile(fileId) {
  const objectId = toObjectId(fileId);
  if (!objectId) return null;

  const bucket = getBucket();
  const files = await bucket.find({ _id: objectId }).limit(1).toArray();
  return files[0] || null;
}

function openDownloadStream(fileId) {
  const objectId = toObjectId(fileId);
  if (!objectId) return null;
  return getBucket().openDownloadStream(objectId);
}

async function deleteFile(fileId) {
  const objectId = toObjectId(fileId);
  if (!objectId) return false;

  try {
    await getBucket().delete(objectId);
    return true;
  } catch (error) {
    // A missing file is idempotent for cleanup operations.
    if (error?.code === 'ENOENT' || error?.code === 26 || /not found/i.test(error?.message || '')) {
      return false;
    }
    throw error;
  }
}

function isStoredFileId(value) {
  return Boolean(toObjectId(value));
}

module.exports = {
  BUCKET_NAME,
  uploadBuffer,
  uploadFile,
  getFile,
  openDownloadStream,
  deleteFile,
  isStoredFileId,
  isAllowedLegacyPath,
  legacyFileExists,
  legacyUploadRoots,
};
