const BodyAnalysis = require('../models/BodyAnalysis');
const { analyzeImages } = require('../services/mediapipeService');
const { moderateImage } = require('../services/imageModerationService');
const { uploadBuffer, deleteFile } = require('../services/storageService');
const sharp = require('sharp');

function parseLandmarkViews(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) throw new Error('landmarkViews must be an array.');
    return parsed;
  } catch (error) {
    throw new Error(`Invalid MediaPipe landmark payload: ${error.message}`);
  }
}


async function validateUploadedImage(file) {
  const metadata = await sharp(file.buffer, { failOn: 'error' }).metadata();
  const width = Number(metadata.width || 0);
  const height = Number(metadata.height || 0);
  const pixels = width * height;

  if (!width || !height || pixels > 25_000_000) {
    throw new Error('Each body image must be a valid image with at most 25 megapixels.');
  }

  if (Math.min(width, height) < 240) {
    throw new Error('Each body image must be at least 240 pixels on its shortest side.');
  }

  return { width, height, format: metadata.format };
}


function validateLandmarkViews(viewResults) {
  if (!Array.isArray(viewResults) || viewResults.length !== 4) {
    throw new Error('Exactly four valid MediaPipe body views are required.');
  }

  const allowedPositions = new Set(['front', 'back', 'left', 'right']);
  const seen = new Set();

  for (const view of viewResults) {
    const position = String(view?.position || '').toLowerCase();
    if (!allowedPositions.has(position) || seen.has(position)) {
      throw new Error('MediaPipe landmark views must contain one front, back, left and right result.');
    }
    seen.add(position);

    if (!Array.isArray(view.landmarks) || view.landmarks.length < 25 || view.landmarks.length > 33) {
      throw new Error(`Invalid landmark count for the ${position} view.`);
    }

    for (const [index, point] of view.landmarks.entries()) {
      /*
       * MediaPipe normalized x/y are normally in [0, 1]. Small out-of-frame
       * values are still valid for landmarks near the image boundary, so the
       * API permits a bounded range instead of rejecting otherwise usable
       * detections. z is optional in the JS result and the analysis service
       * safely defaults an omitted z value to 0.
       */
      const hasValidXY =
        Number.isFinite(point?.x) &&
        Number.isFinite(point?.y);

      const hasValidZ =
        point?.z === undefined ||
        Number.isFinite(point.z);

      const withinCoordinateBounds =
        Math.abs(Number(point?.x)) <= 2 &&
        Math.abs(Number(point?.y)) <= 2 &&
        (point?.z === undefined || Math.abs(Number(point.z)) <= 10);

      if (!hasValidXY || !hasValidZ || !withinCoordinateBounds) {
        throw new Error(
          `Invalid landmark coordinates for the ${position} view at landmark ${index}.`
        );
      }

      if (point.visibility !== undefined
        && (!Number.isFinite(point.visibility) || point.visibility < 0 || point.visibility > 1)) {
        throw new Error(`Invalid landmark visibility for the ${position} view at landmark ${index}.`);
      }
    }
  }
}

exports.bodyAnalysis = async (req, res) => {
  const uploadedFileIds = [];

  try {
    const heightCm = Number(req.body.heightCm ?? req.user.profile?.heightCm);
    const weightKg = Number(req.body.weightKg ?? req.user.profile?.weightKg);
    const landmarkViews = parseLandmarkViews(req.body.landmarkViews);

    if (!Number.isFinite(heightCm) || heightCm <= 0 || !Number.isFinite(weightKg) || weightKg <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Height and weight are required to calculate BMI. Please complete your profile before starting analysis.',
      });
    }

    if (!landmarkViews.length) {
      return res.status(400).json({ success: false, message: 'No MediaPipe landmark results were provided.' });
    }

    const files = [];
    for (const position of ['front', 'back', 'left', 'right']) {
      const file = req.files?.[position]?.[0];
      if (file) files.push({ position, file });
    }

    if (files.length !== 4) {
      return res.status(400).json({
        success: false,
        message: 'All four body images (front, back, left and right) are required.',
      });
    }

    validateLandmarkViews(landmarkViews);
    const imageMetadata = await Promise.all(files.map(({ file }) => validateUploadedImage(file)));

    // Normalize all body photos to WebP. This strips EXIF/GPS metadata, keeps
    // the stored format consistent, and makes retrieval independent of Railway's
    // ephemeral filesystem.
    const normalizedFiles = await Promise.all(files.map(async ({ position, file }) => {
      const buffer = await sharp(file.buffer, { failOn: 'error' })
        .rotate()
        .webp({ quality: 88 })
        .toBuffer();

      return {
        position,
        buffer,
        mimeType: 'image/webp',
        originalMimeType: file.mimetype,
      };
    }));

    // Safety classification happens before MediaPipe so flagged content never
    // enters the fitness-analysis workflow. A moderation result is a content
    // safety signal; it does not replace pose validation or posture scoring.
    let moderationStatus = 'Pending';
    let moderationReason = 'Manual review required.';
    let moderationResults = [];

    try {
      moderationResults = await Promise.all(
        normalizedFiles.map((item) => moderateImage(item.buffer, item.mimeType))
      );

      if (moderationResults.some((item) => item.status === 'Flagged')) {
        moderationStatus = 'Flagged';
        moderationReason = moderationResults.find((item) => item.status === 'Flagged')?.reason || moderationReason;
      } else if (moderationResults.length && moderationResults.every((item) => item.status === 'Approved')) {
        moderationStatus = 'Approved';
        moderationReason = 'All uploaded views passed automatic safety review.';
      }
    } catch (moderationError) {
      console.warn('Image moderation unavailable; leaving upload pending:', moderationError.message);
    }

    const imagePaths = {};
    for (const item of normalizedFiles) {
      const stored = await uploadBuffer(item.buffer, {
        filename: `${String(req.user._id)}-${item.position}-${Date.now()}.webp`,
        contentType: item.mimeType,
        metadata: {
          ownerUserId: String(req.user._id),
          purpose: `body-analysis-${item.position}`,
          moderationStatus,
        },
      });

      uploadedFileIds.push(stored.fileId);
      imagePaths[item.position] = stored.fileId;
    }

    if (moderationStatus === 'Flagged') {
      const moderationRecord = await BodyAnalysis.create({
        userId: req.user._id,
        viewsAnalyzed: 0,
        totalViews: 4,
        source: 'Image moderation',
        images: imagePaths,
        moderationStatus,
        moderationReason,
        moderatedAt: new Date(),
        imageMetadata: normalizedFiles.reduce((acc, item, index) => {
          acc[item.position] = {
            width: imageMetadata[index]?.width,
            height: imageMetadata[index]?.height,
            contentType: item.mimeType,
          };
          return acc;
        }, {}),
      });

      return res.status(422).json({
        success: false,
        code: 'IMAGE_MODERATION_FLAGGED',
        message: 'One or more uploaded images require safety review before body analysis can continue.',
        moderationStatus,
        analysisId: String(moderationRecord._id),
        requestId: req.requestId,
      });
    }

    const result = await analyzeImages(files.map(({ file }) => file), heightCm, weightKg, landmarkViews);

    const analysis = await BodyAnalysis.create({
      userId: req.user._id,
      bmi: result.bmi,
      postureScore: result.postureScore,
      postureStatus: result.postureStatus,
      postureFlags: result.postureFlags || [],
      symmetryScore: result.symmetryScore,
      shoulderAlignment: result.shoulderAlignment,
      hipAlignment: result.hipAlignment,
      detectionConfidence: result.detectionConfidence,
      viewsAnalyzed: result.viewsAnalyzed,
      totalViews: result.totalViews,
      viewResults: result.viewResults,
      landmarks: result.viewResults[0]?.landmarks || [],
      images: imagePaths,
      source: 'MediaPipe Pose Landmarker',
      moderationStatus,
      moderationReason,
      moderatedAt: moderationStatus === 'Pending' ? null : new Date(),
      imageMetadata: normalizedFiles.reduce((acc, item, index) => {
        acc[item.position] = {
          width: imageMetadata[index]?.width,
          height: imageMetadata[index]?.height,
          contentType: item.mimeType,
        };
        return acc;
      }, {}),
    });

    return res.status(201).json({
      success: true,
      message: 'MediaPipe body analysis saved successfully.',
      data: analysis,
    });
  } catch (error) {
    await Promise.all(uploadedFileIds.map((fileId) => deleteFile(fileId).catch(() => {})));

    console.error('Body analysis error:', error);
    const status = /required|invalid|exactly four|landmark|image/i.test(error.message || '') ? 400 : 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to analyze body.',
      requestId: req.requestId,
    });
  }
};

exports.history = async (req, res) => {
  try {
    const history = await BodyAnalysis.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(20);
    return res.json({ success: true, data: history });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch history', error: error.message });
  }
};

exports.compare = async (req, res) => {
  try {
    const analyses = await BodyAnalysis.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(2);
    if (analyses.length < 2) {
      return res.json({ success: true, bmiChange: 0, postureChange: 0, symmetryChange: 0, message: 'Not enough data to compare' });
    }
    const latest = analyses[0];
    const previous = analyses[1];
    return res.json({
      success: true,
      bmiChange: Number((latest.bmi - previous.bmi).toFixed(1)),
      postureChange: latest.postureScore - previous.postureScore,
      symmetryChange: latest.symmetryScore - previous.symmetryScore,
      latestDate: latest.createdAt,
      previousDate: previous.createdAt,
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to compare analyses', error: error.message });
  }
};
