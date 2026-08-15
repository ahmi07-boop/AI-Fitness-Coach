/**
 * MediaPipe result processing and posture-quality calculations.
 *
 * Pose detection alone is not a posture assessment. This service evaluates
 * shoulder/hip tilt, torso alignment, forward-head alignment and (when
 * available) knee flexion. It is deliberately deterministic so the persisted
 * MongoDB result is the same source of truth as the browser preview.
 */

function calculateBMI(heightCm, weightKg) {
  const height = Number(heightCm);
  const weight = Number(weightKg);
  if (!height || !weight || height <= 0 || weight <= 0) return null;
  return Number((weight / ((height / 100) ** 2)).toFixed(1));
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getLandmark(landmarks, index, minVisibility = 0.35) {
  const point = landmarks?.[index];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (typeof point.visibility === 'number' && point.visibility < minVisibility) return null;
  return point;
}

function midpoint(a, b) {
  if (!a || !b) return null;
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function angleBetween(a, b, c) {
  if (!a || !b || !c) return null;
  const ab = { x: a.x - b.x, y: a.y - b.y };
  const cb = { x: c.x - b.x, y: c.y - b.y };
  const abLength = Math.hypot(ab.x, ab.y);
  const cbLength = Math.hypot(cb.x, cb.y);
  if (!abLength || !cbLength) return null;
  const cosine = clamp((ab.x * cb.x + ab.y * cb.y) / (abLength * cbLength), -1, 1);
  return Math.acos(cosine) * (180 / Math.PI);
}

function verticalDeviationScore(degrees, tolerance = 4, maxDeviation = 24) {
  if (degrees == null) return null;
  const excess = Math.max(0, Math.abs(degrees) - tolerance);
  return Math.round(clamp(100 - (excess / Math.max(1, maxDeviation - tolerance)) * 100));
}

function calculateTiltScore(a, b, tolerance = 4, maxTilt = 20) {
  if (!a || !b) return null;
  const tilt = Math.atan2(b.y - a.y, b.x - a.x) * (180 / Math.PI);
  const deviation = Math.min(90, Math.abs(tilt));
  const excess = Math.max(0, deviation - tolerance);
  return Math.round(clamp(100 - (excess / Math.max(1, maxTilt - tolerance)) * 100));
}

function calculateShoulderAlignment(landmarks) {
  return calculateTiltScore(getLandmark(landmarks, 11), getLandmark(landmarks, 12));
}

function calculateHipAlignment(landmarks) {
  return calculateTiltScore(getLandmark(landmarks, 23), getLandmark(landmarks, 24));
}

function calculateSymmetry(landmarks) {
  const shoulderLeft = getLandmark(landmarks, 11);
  const shoulderRight = getLandmark(landmarks, 12);
  const hipLeft = getLandmark(landmarks, 23);
  const hipRight = getLandmark(landmarks, 24);
  if (!shoulderLeft || !shoulderRight || !hipLeft || !hipRight) return null;

  const shoulderWidth = Math.hypot(shoulderLeft.x - shoulderRight.x, shoulderLeft.y - shoulderRight.y);
  const hipWidth = Math.hypot(hipLeft.x - hipRight.x, hipLeft.y - hipRight.y);
  if (!shoulderWidth || !hipWidth) return null;

  const shoulderMid = midpoint(shoulderLeft, shoulderRight);
  const hipMid = midpoint(hipLeft, hipRight);
  const widthPenalty = Math.min(45, Math.abs((hipWidth / shoulderWidth) - 0.82) * 90);
  const centerOffset = Math.abs(shoulderMid.x - hipMid.x) / Math.max(shoulderWidth, 0.001);
  const centerPenalty = Math.min(55, Math.max(0, centerOffset - 0.08) * 100);
  return Math.round(clamp(100 - widthPenalty - centerPenalty));
}

function calculateKneePosture(landmarks) {
  const candidates = [
    { hip: getLandmark(landmarks, 23), knee: getLandmark(landmarks, 25), ankle: getLandmark(landmarks, 27), side: 'left' },
    { hip: getLandmark(landmarks, 24), knee: getLandmark(landmarks, 26), ankle: getLandmark(landmarks, 28), side: 'right' },
  ].filter((item) => item.hip && item.knee && item.ankle);

  if (!candidates.length) return null;
  const scored = candidates.map((item) => ({
    ...item,
    visibility: [item.hip, item.knee, item.ankle]
      .map((point) => typeof point.visibility === 'number' ? point.visibility : 0.5)
      .reduce((sum, value) => sum + value, 0),
    angle: angleBetween(item.hip, item.knee, item.ankle),
  })).filter((item) => item.angle != null);
  if (!scored.length) return null;

  const best = scored.sort((a, b) => b.visibility - a.visibility)[0];
  const seated = best.angle < 145;
  return {
    side: best.side,
    angle: Number(best.angle.toFixed(1)),
    seated,
    score: seated ? Math.round(clamp(100 - ((145 - best.angle) / 55) * 100)) : 100,
  };
}

function getSideLandmarks(landmarks) {
  const candidates = [
    { ear: getLandmark(landmarks, 7), shoulder: getLandmark(landmarks, 11), hip: getLandmark(landmarks, 23), side: 'left' },
    { ear: getLandmark(landmarks, 8), shoulder: getLandmark(landmarks, 12), hip: getLandmark(landmarks, 24), side: 'right' },
  ].filter((item) => item.ear && item.shoulder && item.hip);
  if (!candidates.length) return null;
  const visibilityScore = (item) => [item.ear, item.shoulder, item.hip]
    .map((point) => typeof point.visibility === 'number' ? point.visibility : 0.5)
    .reduce((sum, value) => sum + value, 0);
  return candidates.sort((a, b) => visibilityScore(b) - visibilityScore(a))[0];
}

function calculateSidePosture(landmarks) {
  const side = getSideLandmarks(landmarks);
  if (!side) return null;

  const torsoVector = { x: side.shoulder.x - side.hip.x, y: side.shoulder.y - side.hip.y };
  const torsoAngle = Math.atan2(Math.abs(torsoVector.x), Math.abs(torsoVector.y)) * (180 / Math.PI);
  const forwardHeadOffset = Math.abs(side.ear.x - side.shoulder.x) / Math.max(Math.abs(torsoVector.y), 0.05);
  const torsoScore = verticalDeviationScore(torsoAngle, 4, 22);
  const headScore = Math.round(clamp(100 - (Math.max(0, forwardHeadOffset - 0.08) / 0.42) * 100));
  const kneePosture = calculateKneePosture(landmarks);

  return {
    side: side.side,
    torsoScore,
    headScore,
    kneeScore: kneePosture?.score ?? 100,
    seated: Boolean(kneePosture?.seated),
    kneeAngle: kneePosture?.angle ?? null,
    torsoAngle: Number(torsoAngle.toFixed(2)),
    forwardHeadOffset: Number(forwardHeadOffset.toFixed(3)),
  };
}

function calculateDetectionConfidence(landmarks) {
  const visible = (landmarks || []).filter((point) => typeof point?.visibility === 'number');
  if (!visible.length) return null;
  return Number((visible.reduce((sum, point) => sum + point.visibility, 0) / visible.length).toFixed(3));
}

function normalizeLandmarks(landmarks) {
  if (!Array.isArray(landmarks)) return [];
  return landmarks.map((point) => {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number') return null;
    return {
      x: Number(point.x),
      y: Number(point.y),
      z: typeof point.z === 'number' ? Number(point.z) : 0,
      visibility: typeof point.visibility === 'number' ? Number(point.visibility) : undefined,
    };
  }).filter(Boolean);
}

function normalizeWorldLandmarks(landmarks) {
  if (!Array.isArray(landmarks)) return [];
  return landmarks.map((point) => {
    if (!point || typeof point.x !== 'number' || typeof point.y !== 'number' || typeof point.z !== 'number') return null;
    return {
      x: Number(point.x),
      y: Number(point.y),
      z: Number(point.z),
      visibility: typeof point.visibility === 'number' ? Number(point.visibility) : undefined,
    };
  }).filter(Boolean);
}

function analyzeLandmarks(landmarks, position = 'unknown') {
  const normalized = normalizeLandmarks(landmarks);
  const shoulderAlignment = calculateShoulderAlignment(normalized);
  const hipAlignment = calculateHipAlignment(normalized);
  const symmetryScore = calculateSymmetry(normalized);
  const sidePosture = ['left', 'right'].includes(String(position).toLowerCase())
    ? calculateSidePosture(normalized)
    : null;

  const frontBackComponents = [shoulderAlignment, hipAlignment, symmetryScore].filter((value) => typeof value === 'number');
  const frontBackScore = frontBackComponents.length
    ? frontBackComponents.reduce((sum, value) => sum + value, 0) / frontBackComponents.length
    : 0;
  const sideComponents = sidePosture
    ? [sidePosture.torsoScore, sidePosture.headScore, sidePosture.kneeScore].filter((value) => typeof value === 'number')
    : [];
  const sideScore = sideComponents.length
    ? sideComponents.reduce((sum, value) => sum + value, 0) / sideComponents.length
    : null;
  const postureScore = Math.round(clamp(sideScore == null ? frontBackScore : sideScore * 0.65 + frontBackScore * 0.35));

  const postureFlags = [];
  if (typeof shoulderAlignment === 'number' && shoulderAlignment < 75) postureFlags.push('Uneven shoulder alignment');
  if (typeof hipAlignment === 'number' && hipAlignment < 75) postureFlags.push('Uneven hip alignment');
  if (sidePosture?.torsoScore < 75) postureFlags.push('Torso lean detected');
  if (sidePosture?.headScore < 75) postureFlags.push('Forward head posture detected');
  if (sidePosture?.seated) postureFlags.push('Seated or deeply flexed knee posture detected');

  const postureStatus = postureScore < 60
    ? 'Significant posture deviation'
    : postureScore < 75
      ? 'Needs improvement'
      : postureScore < 88
        ? 'Moderate alignment'
        : 'Good posture';

  return {
    shoulderAlignment: shoulderAlignment ?? 0,
    hipAlignment: hipAlignment ?? 0,
    symmetryScore: symmetryScore ?? 0,
    postureScore,
    postureStatus,
    postureFlags,
    detectionConfidence: calculateDetectionConfidence(normalized),
    sidePosture,
  };
}

function analyzeLandmarkViews(viewResults = [], heightCm, weightKg) {
  const validViews = viewResults
    .filter((view) => Array.isArray(view?.landmarks) && view.landmarks.length >= 25)
    .map((view) => {
      const landmarks = normalizeLandmarks(view.landmarks);
      return {
        position: String(view.position || 'unknown'),
        label: String(view.label || view.position || 'Unknown'),
        landmarks,
        worldLandmarks: normalizeWorldLandmarks(view.worldLandmarks),
        metrics: analyzeLandmarks(landmarks, view.position),
      };
    });

  if (!validViews.length) {
    throw new Error('MediaPipe did not return enough body landmarks. Please upload clear full-body images.');
  }

  const average = (key) => {
    const values = validViews.map((view) => view.metrics[key]).filter((value) => typeof value === 'number');
    if (!values.length) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  };

  const postureValues = validViews.map((view) => view.metrics.postureScore).filter(Number.isFinite);
  const sortedPosture = [...postureValues].sort((a, b) => a - b);
  const medianPosture = sortedPosture.length ? sortedPosture[Math.floor(sortedPosture.length / 2)] : 0;
  const averagePosture = postureValues.length
    ? postureValues.reduce((sum, value) => sum + value, 0) / postureValues.length
    : 0;
  const postureScore = Math.round(clamp(averagePosture * 0.55 + medianPosture * 0.45));
  const postureStatus = postureScore < 60
    ? 'Significant posture deviation'
    : postureScore < 75
      ? 'Needs improvement'
      : postureScore < 88
        ? 'Moderate alignment'
        : 'Good posture';
  const postureFlags = [...new Set(validViews.flatMap((view) => view.metrics.postureFlags || []))];
  const confidenceValues = validViews.map((view) => view.metrics.detectionConfidence).filter((value) => typeof value === 'number');

  return {
    status: 'success',
    bmi: calculateBMI(heightCm, weightKg),
    postureScore,
    postureStatus,
    postureFlags,
    symmetryScore: average('symmetryScore'),
    shoulderAlignment: average('shoulderAlignment'),
    hipAlignment: average('hipAlignment'),
    detectionConfidence: confidenceValues.length
      ? Number((confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length).toFixed(3))
      : null,
    viewsAnalyzed: validViews.length,
    totalViews: viewResults.length,
    viewResults: validViews,
  };
}

async function analyzeImages(images, heightCm, weightKg, landmarkViews = []) {
  return {
    ...analyzeLandmarkViews(landmarkViews, heightCm, weightKg),
    imagesReceived: images?.length || 0,
  };
}

module.exports = {
  analyzeImages,
  analyzeLandmarks,
  analyzeLandmarkViews,
  calculateBMI,
  calculateShoulderAlignment,
  calculateHipAlignment,
  calculateSymmetry,
};
