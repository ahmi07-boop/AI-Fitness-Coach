import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import AIBadge from "../components/AIBadge";
import AIAvatar from "../components/AIAvatar";
import JourneyProgress from "../components/JourneyProgress";
import { analyzeBody } from "../services/analysisApi";
import {
  Activity,
  Brain,
  Check,
  CheckCircle2,
  Scan,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Ruler,
  Weight,
  AlertCircle,
} from "lucide-react";
import {
  FilesetResolver,
  PoseLandmarker,
} from "@mediapipe/tasks-vision";

const MEDIAPIPE_WASM_URLS = [
  "/mediapipe/wasm",
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm",
];

const POSE_MODEL_URL = "/models/pose_landmarker_lite.task";

const VIEW_LABELS = {
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
};

const STAGES = [
  { progress: 15, text: "Preparing your images..." },
  { progress: 30, text: "Loading MediaPipe Pose Landmarker..." },
  { progress: 45, text: "Detecting body landmarks..." },
  { progress: 65, text: "Analyzing posture and alignment..." },
  { progress: 82, text: "Calculating body metrics..." },
  { progress: 100, text: "Finalizing your analysis..." },
];

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function getLandmark(landmarks, index, minVisibility = 0.35) {
  const point = landmarks?.[index];
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
  if (typeof point.visibility === "number" && point.visibility < minVisibility) return null;
  return point;
}

function isValidLandmarkPoint(point) {
  return Boolean(
    point &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    (point.z === undefined || Number.isFinite(point.z))
  );
}

function sanitizeLandmarks(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length < 25) return null;

  const sanitized = landmarks.map((point) => {
    if (!isValidLandmarkPoint(point)) return null;

    return {
      x: Number(point.x),
      y: Number(point.y),
      z: Number.isFinite(point.z) ? Number(point.z) : 0,
      ...(Number.isFinite(point.visibility) &&
      point.visibility >= 0 &&
      point.visibility <= 1
        ? { visibility: Number(point.visibility) }
        : {}),
    };
  });

  return sanitized.every(Boolean) ? sanitized : null;
}

function sanitizeWorldLandmarks(landmarks) {
  if (!Array.isArray(landmarks)) return [];

  return landmarks
    .filter(isValidLandmarkPoint)
    .map((point) => ({
      x: Number(point.x),
      y: Number(point.y),
      z: Number.isFinite(point.z) ? Number(point.z) : 0,
      ...(Number.isFinite(point.visibility) &&
      point.visibility >= 0 &&
      point.visibility <= 1
        ? { visibility: Number(point.visibility) }
        : {}),
    }));
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
    { hip: getLandmark(landmarks, 23), knee: getLandmark(landmarks, 25), ankle: getLandmark(landmarks, 27) },
    { hip: getLandmark(landmarks, 24), knee: getLandmark(landmarks, 26), ankle: getLandmark(landmarks, 28) },
  ].filter((item) => item.hip && item.knee && item.ankle);
  if (!candidates.length) return null;
  const scored = candidates.map((item) => ({
    ...item,
    visibility: [item.hip, item.knee, item.ankle]
      .map((point) => typeof point.visibility === "number" ? point.visibility : 0.5)
      .reduce((sum, value) => sum + value, 0),
    angle: angleBetween(item.hip, item.knee, item.ankle),
  })).filter((item) => item.angle != null);
  if (!scored.length) return null;
  const best = scored.sort((a, b) => b.visibility - a.visibility)[0];
  const seated = best.angle < 145;
  return { score: seated ? Math.round(clamp(100 - ((145 - best.angle) / 55) * 100)) : 100, seated };
}

function calculateSidePosture(landmarks) {
  const candidates = [
    { ear: getLandmark(landmarks, 7), shoulder: getLandmark(landmarks, 11), hip: getLandmark(landmarks, 23) },
    { ear: getLandmark(landmarks, 8), shoulder: getLandmark(landmarks, 12), hip: getLandmark(landmarks, 24) },
  ].filter((item) => item.ear && item.shoulder && item.hip);
  if (!candidates.length) return null;
  const visibilityScore = (item) => [item.ear, item.shoulder, item.hip]
    .map((point) => typeof point.visibility === "number" ? point.visibility : 0.5)
    .reduce((sum, value) => sum + value, 0);
  const side = candidates.sort((a, b) => visibilityScore(b) - visibilityScore(a))[0];
  const torsoVector = { x: side.shoulder.x - side.hip.x, y: side.shoulder.y - side.hip.y };
  const torsoAngle = Math.atan2(Math.abs(torsoVector.x), Math.abs(torsoVector.y)) * (180 / Math.PI);
  const forwardHeadOffset = Math.abs(side.ear.x - side.shoulder.x) / Math.max(Math.abs(torsoVector.y), 0.05);
  const torsoScore = verticalDeviationScore(torsoAngle, 4, 22);
  const headScore = Math.round(clamp(100 - (Math.max(0, forwardHeadOffset - 0.08) / 0.42) * 100));
  const kneePosture = calculateKneePosture(landmarks);
  return { torsoScore, headScore, kneeScore: kneePosture?.score ?? 100, seated: Boolean(kneePosture?.seated) };
}

function analyzeLandmarks(landmarks, position = "unknown") {
  const shoulderAlignment = calculateShoulderAlignment(landmarks);
  const hipAlignment = calculateHipAlignment(landmarks);
  const symmetryScore = calculateSymmetry(landmarks);
  const frontBack = [shoulderAlignment, hipAlignment, symmetryScore].filter((value) => typeof value === "number");
  const frontBackScore = frontBack.length ? frontBack.reduce((sum, value) => sum + value, 0) / frontBack.length : 0;
  const sidePosture = ["left", "right"].includes(String(position).toLowerCase()) ? calculateSidePosture(landmarks) : null;
  const side = sidePosture ? [sidePosture.torsoScore, sidePosture.headScore, sidePosture.kneeScore] : [];
  const sideScore = side.length ? side.reduce((sum, value) => sum + value, 0) / side.length : null;
  const postureScore = Math.round(clamp(sideScore == null ? frontBackScore : sideScore * 0.65 + frontBackScore * 0.35));
  const postureFlags = [];
  if ((shoulderAlignment ?? 100) < 75) postureFlags.push("Uneven shoulder alignment");
  if ((hipAlignment ?? 100) < 75) postureFlags.push("Uneven hip alignment");
  if ((sidePosture?.torsoScore ?? 100) < 75) postureFlags.push("Torso lean detected");
  if ((sidePosture?.headScore ?? 100) < 75) postureFlags.push("Forward head posture detected");
  if (sidePosture?.seated) postureFlags.push("Seated or deeply flexed knee posture detected");
  return {
    shoulderAlignment: shoulderAlignment ?? 0,
    hipAlignment: hipAlignment ?? 0,
    symmetryScore: symmetryScore ?? 0,
    postureScore,
    postureStatus: postureScore < 60 ? "Significant posture deviation" : postureScore < 75 ? "Needs improvement" : postureScore < 88 ? "Moderate alignment" : "Good posture",
    postureFlags,
  };
}
function calculateBMI(height, weight) {
  const heightCm = Number(height);
  const weightKg = Number(weight);

  if (!Number.isFinite(heightCm) || !Number.isFinite(weightKg) || heightCm <= 0 || weightKg <= 0) {
    return null;
  }

  return Number((weightKg / (heightCm / 100) ** 2).toFixed(1));
}

function getProfileMeasurements(user) {
  const profile = user?.profile || user || {};

  return {
    heightCm: profile.heightCm ?? profile.height,
    weightKg: profile.weightKg ?? profile.weight,
  };
}

function getBmiLabel(bmi) {
  if (!bmi) return "Not available";
  if (bmi < 18.5) return "Below typical range";
  if (bmi < 25) return "Within typical range";
  if (bmi < 30) return "Above typical range";
  return "High range";
}

function alignmentLabel(score) {
  const numericScore = Number(score);

  if (!Number.isFinite(numericScore) || numericScore <= 0) {
    return "Not available";
  }

  if (numericScore < 60) return "Significant alignment deviation";
  if (numericScore < 75) return "Needs improvement";
  if (numericScore < 88) return "Moderate alignment";
  return "Good alignment";
}

function getAnalysisImages(locationState) {
  const source = locationState?.analysisData?.images;

  if (!source) {
    return null;
  }

  return source;
}

function buildAnalysisFormData(images, profile, viewResults) {
  const formData = new FormData();

  Object.entries(images || {}).forEach(([position, image]) => {
    if (image?.file) formData.append(position, image.file);
  });

  formData.append("heightCm", String(profile?.heightCm ?? profile?.height ?? ""));
  formData.append("weightKg", String(profile?.weightKg ?? profile?.weight ?? ""));
  formData.append("landmarkViews", JSON.stringify(viewResults));

  return formData;
}


async function withTimeout(promise, timeoutMs, message) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
}

async function loadPoseLandmarker() {
  let lastError = null;

  for (const wasmPath of MEDIAPIPE_WASM_URLS) {
    try {
      const vision = await withTimeout(
        FilesetResolver.forVisionTasks(wasmPath),
        30000,
        "MediaPipe initialization timed out. Please check your connection and try again."
      );

      return await withTimeout(
        PoseLandmarker.createFromOptions(vision, {
          // CPU is deliberate: it avoids browser WebGL/OpenGL initialization failures
          // while remaining fully supported for still-image body analysis.
          baseOptions: {
            modelAssetPath: POSE_MODEL_URL,
            delegate: "CPU",
          },
          runningMode: "IMAGE",
          numPoses: 1,
          minPoseDetectionConfidence: 0.5,
          minPosePresenceConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }),
        30000,
        "MediaPipe model loading timed out. Please try again."
      );
    } catch (error) {
      lastError = error;
      console.warn(`MediaPipe initialization failed for ${wasmPath}`, error);
    }
  }

  throw lastError || new Error("Unable to initialize MediaPipe.");
}

function Analysis() {
  const navigate = useNavigate();
  const location = useLocation();

  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [analysisComplete, setAnalysisComplete] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStage, setCurrentStage] = useState(
    "Preparing your analysis..."
  );
  const [analysisError, setAnalysisError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [images, setImages] = useState(
    getAnalysisImages(location.state)
  );
  const { user, loading: authLoading } = useAuth();

  const { heightCm, weightKg } = useMemo(
    () => getProfileMeasurements(user),
    [user]
  );

  const bmi = useMemo(
    () => calculateBMI(heightCm, weightKg),
    [heightCm, weightKg]
  );

  const startAnalysis = async () => {
    if (analysisStarted) return;

    setAnalysisStarted(true);
    setAnalysisError("");
    setAnalysisComplete(false);
    setProgress(0);

    let poseLandmarker = null;

    try {
      if (!user) {
        throw new Error("Your authenticated profile could not be loaded. Please sign in again.");
      }

      if (!images) {
        throw new Error("Your uploaded images are no longer available. Please return to onboarding and upload them again.");
      }

      const entries = Object.entries(images).filter(([, image]) => image?.file);
      if (entries.length !== 4) {
        throw new Error("Please upload all four body views (front, back, left and right) before starting analysis.");
      }

      setProgress(STAGES[1].progress);
      setCurrentStage(STAGES[1].text);
      poseLandmarker = await loadPoseLandmarker();

      const viewResults = [];
      const previewImages = {};

      for (let index = 0; index < entries.length; index += 1) {
        const [position, image] = entries[index];
        setProgress(Math.round(30 + ((index + 1) / entries.length) * 35));
        setCurrentStage(`Detecting landmarks in your ${VIEW_LABELS[position] || position.toLowerCase()} view...`);

        const objectUrl = URL.createObjectURL(image.file);
        const imageElement = new Image();

        try {
          await new Promise((resolve, reject) => {
            imageElement.onload = resolve;
            imageElement.onerror = reject;
            imageElement.src = objectUrl;
          });

          const result = poseLandmarker.detect(imageElement);
          const rawLandmarks = result?.landmarks?.[0] || [];
          const landmarks = sanitizeLandmarks(rawLandmarks);
          const worldLandmarks = sanitizeWorldLandmarks(result?.worldLandmarks?.[0] || []);

          if (landmarks) {
            viewResults.push({
              position,
              label: VIEW_LABELS[position] || position,
              landmarks,
              worldLandmarks,
              metrics: analyzeLandmarks(landmarks, position),
            });
          }

          previewImages[position] = {
            url: objectUrl,
            detected: Boolean(landmarks),
          };
        } catch (error) {
          URL.revokeObjectURL(objectUrl);
          console.warn(`MediaPipe failed for ${position} image`, error);
        }
      }

      if (viewResults.length !== entries.length) {
        const detectedPositions = new Set(viewResults.map((view) => view.position));
        const failedPositions = entries
          .map(([position]) => position)
          .filter((position) => !detectedPositions.has(position));

        const failedLabels = failedPositions
          .map((position) => VIEW_LABELS[position] || position)
          .join(", ");

        throw new Error(
          `MediaPipe could not produce a valid pose for: ${failedLabels}. Please retake those images with your full body visible, good lighting, and the camera held straight.`
        );
      }

      setProgress(STAGES[4].progress);
      setCurrentStage(STAGES[4].text);

      const profile = user?.profile || user || {};
      const average = (key) => Math.round(
        viewResults.reduce((sum, view) => sum + (view.metrics[key] || 0), 0) / viewResults.length
      );

      const postureValues = viewResults.map((view) => view.metrics.postureScore).filter(Number.isFinite);
      const sortedPosture = [...postureValues].sort((a, b) => a - b);
      const medianPosture = sortedPosture.length ? sortedPosture[Math.floor(sortedPosture.length / 2)] : 0;
      const averagePosture = postureValues.length ? postureValues.reduce((sum, value) => sum + value, 0) / postureValues.length : 0;
      const clientPostureScore = Math.round(clamp(averagePosture * 0.55 + medianPosture * 0.45));
      const clientPostureFlags = [...new Set(viewResults.flatMap((view) => view.metrics.postureFlags || []))];

      const clientMetrics = {
        postureScore: clientPostureScore,
        postureStatus: clientPostureScore < 60 ? "Significant posture deviation" : clientPostureScore < 75 ? "Needs improvement" : clientPostureScore < 88 ? "Moderate alignment" : "Good posture",
        postureFlags: clientPostureFlags,
        symmetryScore: average("symmetryScore"),
        shoulderAlignment: average("shoulderAlignment"),
        hipAlignment: average("hipAlignment"),
      };

      const formData = buildAnalysisFormData(images, profile, viewResults);
      const response = await analyzeBody(formData);
      const savedAnalysis = response?.data || response;

      const completedAnalysis = {
        bmi: savedAnalysis?.bmi ?? bmi,
        postureScore: savedAnalysis?.postureScore ?? clientMetrics.postureScore,
        postureStatus: savedAnalysis?.postureStatus ?? clientMetrics.postureStatus,
        postureFlags: savedAnalysis?.postureFlags ?? clientMetrics.postureFlags,
        symmetryScore: savedAnalysis?.symmetryScore ?? clientMetrics.symmetryScore,
        shoulderAlignment: savedAnalysis?.shoulderAlignment ?? clientMetrics.shoulderAlignment,
        hipAlignment: savedAnalysis?.hipAlignment ?? clientMetrics.hipAlignment,
        detectionConfidence: savedAnalysis?.detectionConfidence ?? null,
        viewsAnalyzed: savedAnalysis?.viewsAnalyzed ?? viewResults.length,
        totalViews: savedAnalysis?.totalViews ?? entries.length,
        viewResults: savedAnalysis?.viewResults ?? viewResults,
        generatedAt: savedAnalysis?.createdAt || new Date().toISOString(),
        id: savedAnalysis?._id,
        note: viewResults.length === entries.length
          ? "MediaPipe detected and saved a pose in all four uploaded views."
          : "MediaPipe detected poses in some uploaded views; scores are based on the successful detections.",
      };

      setImages((previous) => {
        if (!previous) return previous;
        return Object.fromEntries(Object.entries(previous).map(([position, image]) => [
          position,
          image ? {
            ...image,
            url: previewImages[position]?.url || image.url,
            detected: previewImages[position]?.detected || false,
          } : image,
        ]));
      });

      setAnalysis(completedAnalysis);
      setProgress(100);
      setCurrentStage(STAGES[5].text);
      setAnalysisComplete(true);
    } catch (error) {
      console.error("MediaPipe body analysis failed:", error);
      setAnalysisError(error?.response?.data?.message || error?.message || "Body analysis failed. Please try again.");
      setAnalysisStarted(false);
    } finally {
      poseLandmarker?.close?.();
    }
  };

  useEffect(() => {
    if (authLoading) return;

    // The route is normally entered from onboarding with File objects in
    // navigation state. Do not start until auth/profile hydration has finished;
    // otherwise the first request can race with authentication/profile hydration and send
    // empty height/weight values to the API.
    startAnalysis();

    return () => {
      // Object URLs are intentionally kept while this page is mounted
      // so the analyzed images remain visible on the results screen.
    };
    // startAnalysis is intentionally a stable one-shot workflow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  const result = analysis || {
    bmi,
    postureScore: 0,
    shoulderAlignment: 0,
    symmetryScore: 0,
    hipAlignment: 0,
  };

  return (
    <div className="analysis-container">
      <header className="analysis-header">
        <div className="analysis-brand">
          <div className="analysis-brand-icon">
            <Activity size={21} />
          </div>

          <div>
            <strong>FitCoach AI</strong>
            <span>AI Body Analysis</span>
          </div>
        </div>

        <div className="analysis-header-ai">
          <AIBadge text="MediaPipe Powered" />

          <div className="analysis-ai-live">
            <span className="ai-status-dot" />
            AI Active
          </div>
        </div>

        <div className="analysis-security">
          <ShieldCheck size={16} />
          Private Analysis
        </div>
      </header>

      <JourneyProgress currentStep={2} />

      {!analysisComplete ? (
        <div className="analysis-loading-card">
          <div className="analysis-ai-avatar-wrapper">
            <div className="analysis-ai-pulse" />
            <AIAvatar />

            <div className="analysis-ai-online">
              <span />
            </div>
          </div>

          <div className="analysis-animation">
            <div className="scan-ring ring-one" />
            <div className="scan-ring ring-two" />
            <div className="scan-ring ring-three" />

            <div className="scan-center">
              <Scan size={42} />
            </div>

            <div className="analysis-scan-line" />
          </div>

          <div className="analysis-loading-content">
            <div className="analysis-ai-label-row">
              <AIBadge text="MediaPipe AI" />

              <div className="ai-processing-label">
                <Sparkles size={15} />
                COMPUTER VISION
              </div>
            </div>

            <h1>Analyzing Your Body</h1>

            <p>
              FitCoach AI is using MediaPipe Pose Landmarker
              to detect body landmarks and estimate posture
              and alignment from your uploaded images.
            </p>

            <div className="analysis-progress-wrapper">
              <div className="analysis-progress-top">
                <span>{currentStage}</span>
                <strong>{progress}%</strong>
              </div>

              <div className="analysis-progress">
                <div
                  className="analysis-progress-fill"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>

            {analysisError && (
              <div
                className="analysis-disclaimer"
                role="alert"
              >
                <AlertCircle size={17} />
                <span>{analysisError}</span>
              </div>
            )}

            <div className="analysis-ai-processing-status">
              <div className="ai-processing-dot">
                <span />
                <span />
                <span />
              </div>

              <span>
                MediaPipe is processing your body images
              </span>
            </div>

            <div className="analysis-stages">
              <AnalysisStage
                icon={<Scan size={18} />}
                text="Body landmarks"
                active={progress >= 45}
              />

              <AnalysisStage
                icon={<Activity size={18} />}
                text="Posture analysis"
                active={progress >= 65}
              />

              <AnalysisStage
                icon={<Brain size={18} />}
                text="Fitness metrics"
                active={progress >= 82}
              />
            </div>

            {analysisError && (
              <div className="analysis-action-stack">
                <button
                  className="analysis-continue-button"
                  onClick={startAnalysis}
                >
                  Try Analysis Again
                  <ArrowRight size={19} />
                </button>

                <button
                  className="analysis-secondary-button"
                  onClick={() => navigate("/onboarding")}
                >
                  <ArrowLeft size={19} />
                  Back to Onboarding
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="analysis-results">
          <div className="results-heading">
            <div className="success-icon">
              <CheckCircle2 size={30} />
            </div>

            <div className="results-heading-content">
              <div className="analysis-ai-label-row">
                <AIBadge text="MediaPipe AI" />

                <div className="ai-label">
                  <Sparkles size={15} />
                  ANALYSIS COMPLETE
                </div>
              </div>

              <h1>Your Body Analysis</h1>

              <p>
                MediaPipe completed your initial fitness
                assessment from {result.viewsAnalyzed} of{" "}
                {result.totalViews} uploaded views.
              </p>
            </div>

            <div className="analysis-result-avatar">
              <AIAvatar />
            </div>
          </div>

          {images && (
            <div className="analysis-images-section">
              <div className="result-section-heading">
                <div>
                  <div className="result-section-title">
                    Your uploaded images
                  </div>

                  <span className="ai-generated-label">
                    <Sparkles size={12} />
                    MediaPipe analyzed
                  </span>
                </div>
              </div>

              <div className="analysis-images">
                {Object.entries(images).map(
                  ([position, image]) =>
                    image && (
                      <AnalysisImage
                        key={position}
                        src={image.url}
                        label={
                          VIEW_LABELS[position] || position
                        }
                        detected={image.detected}
                        postureFlags={result.viewResults?.find((view) => view.position === position)?.metrics?.postureFlags || []}
                      />
                    )
                )}
              </div>
            </div>
          )}

          <div className="result-section-heading">
            <div>
              <div className="result-section-title">
                Your estimated metrics
              </div>

              <span className="ai-generated-label">
                <Sparkles size={12} />
                MediaPipe + profile data
              </span>
            </div>
          </div>

          <div className="metrics-grid">
            <MetricCard
              icon={<Weight size={21} />}
              title="Estimated BMI"
              value={result.bmi || "--"}
              description={getBmiLabel(result.bmi)}
            />

            <MetricCard
              icon={<Activity size={21} />}
              title="Posture Score"
              value={
                result.postureScore
                  ? `${result.postureScore}%`
                  : "--"
              }
              description={result.postureStatus || alignmentLabel(result.postureScore)}
            />

            <MetricCard
              icon={<Ruler size={21} />}
              title="Shoulder Alignment"
              value={
                result.shoulderAlignment
                  ? `${result.shoulderAlignment}%`
                  : "--"
              }
              description={alignmentLabel(
                result.shoulderAlignment
              )}
            />

            <MetricCard
              icon={<Scan size={21} />}
              title="Body Balance"
              value={
                result.symmetryScore
                  ? `${result.symmetryScore}%`
                  : "--"
              }
              description={alignmentLabel(
                result.symmetryScore
              )}
            />
          </div>

          {result.postureFlags?.length > 0 && (
            <div className="analysis-posture-alert" role="status">
              <AlertCircle size={18} />
              <div>
                <strong>Posture findings</strong>
                <span>{result.postureFlags.join(" • ")}</span>
              </div>
            </div>
          )}

          <div className="analysis-insight">
            <div className="analysis-insight-avatar">
              <AIAvatar />
            </div>

            <div className="analysis-insight-content">
              <div className="analysis-insight-heading">
                <strong>AI Fitness Insight</strong>
                <AIBadge text="MediaPipe Generated" />
              </div>

              <p>
                Your current posture and alignment scores
                provide a starting point for your
                personalized fitness plan. Focus areas can
                be refined as more progress data is collected.
              </p>
            </div>
          </div>

          <div className="analysis-ai-status-card">
            <div className="analysis-ai-status-icon">
              <Brain size={20} />
            </div>

            <div>
              <strong>
                MediaPipe body analysis completed
              </strong>

              <span>
                {result.note ||
                  "Your results are ready to personalize your fitness goals."}
              </span>
            </div>

            <div className="analysis-ai-status-check">
              <Check size={17} />
            </div>
          </div>

          <div className="analysis-disclaimer">
            <ShieldCheck size={17} />

            <span>
              Body analysis is an estimate, not medical advice.
              MediaPipe landmark detection and derived scores
              can vary with pose, lighting, camera angle and
              image quality.
            </span>
          </div>

          <div className="analysis-result-actions">
            <button
              className="analysis-continue-button"
              onClick={() => navigate("/goal")}
            >
              Continue to Goals
              <ArrowRight size={19} />
            </button>

            <button
              className="analysis-secondary-button"
              onClick={() => navigate("/dashboard")}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisStage({ icon, text, active }) {
  return (
    <div
      className={`analysis-stage ${
        active ? "stage-active" : ""
      }`}
    >
      <div className="analysis-stage-icon">
        {active ? <Check size={17} /> : icon}
      </div>

      <span>{text}</span>

      {active && (
        <span className="analysis-stage-status">
          Complete
        </span>
      )}
    </div>
  );
}

function AnalysisImage({
  src,
  label,
  detected = false,
  postureFlags = [],
}) {
  return (
    <div className="analysis-image-card">
      <div className="analysis-image-wrapper">
        <img
          src={src}
          alt={`${label} body`}
        />

        <div className="analysis-image-ai-scan">
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="analysis-image-footer">
        <span>{label}</span>

        <span className={`analysis-image-status ${postureFlags.length ? "analysis-image-status-warning" : ""}`}>
          {detected ? <Check size={12} /> : <AlertCircle size={12} />}
          {!detected ? "No pose detected" : postureFlags.length ? "Posture issue detected" : "Landmarks detected"}
        </span>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  description,
}) {
  const numericValue =
    typeof value === "string"
      ? Number(value.replace("%", ""))
      : Number(value);

  const hasProgress =
    Number.isFinite(numericValue) &&
    numericValue > 0 &&
    numericValue <= 100;

  return (
    <div className="metric-card">
      <div className="metric-card-top">
        <div className="metric-icon">
          {icon}
        </div>

        <span className="metric-ai-label">
          <Sparkles size={11} />
          AI
        </span>
      </div>

      <div className="metric-title">{title}</div>

      <div className="metric-value">{value}</div>

      <div className="metric-description">
        {description}
      </div>

      {hasProgress && (
        <div className="metric-progress">
          <div
            className="metric-progress-fill"
            style={{
              width: `${numericValue}%`,
            }}
          />
        </div>
      )}
    </div>
  );
}

export default Analysis;
