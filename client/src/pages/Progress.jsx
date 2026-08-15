import useScrollShadows from "../hooks/useScrollShadows";
import { useRef,  useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getProgressHistory, saveTodayHabits, getWeeklyInsights, uploadProgressPhoto, getProgressPhoto } from "../services/habitApi";
import { getApiMessage } from "../services/api";
import { getDateKey, todayKey } from "../utils/date";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Award,
  BarChart3,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  Droplets,
  Flame,
  Home,
  Scale,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
  Weight,
  Minus,
  Plus,
} from "lucide-react";

function getEntryDateKey(value) {
  return getDateKey(value) || "";
}

function Progress() {
  const sidebarRef = useRef(null);
  const { showTopShadow, showBottomShadow } = useScrollShadows(sidebarRef);

  const navigate = useNavigate();
  const { user } = useAuth();

  const goal = user?.profile?.goal || "maintenance";

  const [currentWeight, setCurrentWeight] = useState(0);
  const [weightInput, setWeightInput] = useState("");

  const [weightHistory, setWeightHistory] = useState([]);

  const [workoutCount, setWorkoutCount] =
    useState(0);

  const [streak, setStreak] = useState(0);

  const [waterDays, setWaterDays] = useState(0);
  const [sleepDays, setSleepDays] = useState(0);

  const [beforePhoto, setBeforePhoto] =
    useState(null);

  const [currentPhoto, setCurrentPhoto] =
    useState(null);
  const [aiInsights, setAiInsights] = useState([]);
  const [remoteError, setRemoteError] = useState("");
  const [progressEntries, setProgressEntries] = useState([]);

  useEffect(() => {

    let mounted = true;
    (async () => {
      try {
        const [historyResponse, insightResponse] = await Promise.all([
          getProgressHistory(),
          getWeeklyInsights(),
        ]);
        const entries = historyResponse?.data?.progress || [];
        setProgressEntries(entries);
        setStreak(Number(historyResponse?.data?.streak || 0));
        if (!mounted) return;

        const thisWeekEntries = getCurrentWeekEntries(entries);

        const weights = entries
          .filter((entry) => Number.isFinite(Number(entry.weightKg)))
          .sort((a, b) => new Date(a.date) - new Date(b.date))
          .map((entry) => Number(entry.weightKg));
        if (weights.length) {
          setWeightHistory(weights.slice(-7));
          setCurrentWeight(weights[weights.length - 1]);
        }

        setWorkoutCount(thisWeekEntries.filter((entry) => entry.workoutCompleted).length);
        setWaterDays(thisWeekEntries.filter((entry) => entry.habits?.water).length);
        setSleepDays(thisWeekEntries.filter((entry) => entry.habits?.sleep).length);

        const photoEntries = entries.filter((entry) => entry.photos?.before?.path || entry.photos?.current?.path);
        const beforeEntry = [...photoEntries].reverse().find((entry) => entry.photos?.before?.path);
        const currentWeekPhotoEntry = [...thisWeekEntries].reverse().find((entry) => entry.photos?.current?.path);
        const currentEntry = currentWeekPhotoEntry || photoEntries.find((entry) => entry.photos?.current?.path);

        const loadPhoto = async (entry, type, setter) => {
          if (!entry?._id || !entry.photos?.[type]?.path) return;
          try {
            const response = await getProgressPhoto(entry._id, type);
            if (!mounted) return;
            const url = URL.createObjectURL(response.data);
            setter((previous) => {
              if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
              return url;
            });
          } catch {
            // Preserve an existing local fallback if the remote photo is unavailable.
          }
        };

        await Promise.all([
          loadPhoto(beforeEntry, "before", setBeforePhoto),
          loadPhoto(currentEntry, "current", setCurrentPhoto),
        ]);
        const insights = insightResponse?.data?.insights || [];
        setAiInsights(insights);
        setRemoteError("");
      } catch (error) {
        if (mounted) setRemoteError(getApiMessage(error, "Progress data could not be loaded."));
      }
    })();
    return () => { mounted = false; };
  }, []);

  /* =========================================
     BASIC USER DATA
  ========================================= */

  const firstName =
    user?.name?.split(" ")[0] || "there";

  const startingWeight =
    weightHistory.length > 0
      ? Number(weightHistory[0])
      : currentWeight;

  const totalChange =
    currentWeight - startingWeight;

  const absoluteChange =
    Math.abs(totalChange);

  const averageWeight =
    weightHistory.length > 0
      ? weightHistory.reduce(
          (sum, weight) =>
            sum + Number(weight),
          0
        ) / weightHistory.length
      : currentWeight;

  /* =========================================
     FITNESS SCORE
  ========================================= */

  const weeklyCompletion = Math.round((Math.min(workoutCount, 7) / 7) * 100);

  /* =========================================
     GOAL LABEL
  ========================================= */

  const goalLabel = useMemo(() => {
    const names = {
      "weight-loss": "Weight Loss",
      "weight-gain": "Weight Gain",
      "muscle-building":
        "Muscle Building",
      maintenance: "Maintenance",
    };

    return (
      names[goal] ||
      "Maintenance"
    );
  }, [goal]);

  /* =========================================
     WEEKLY CONSISTENCY
  ========================================= */

  const weeklyConsistency =
    Math.round(
      ((workoutCount +
        waterDays +
        sleepDays) /
        21) *
        100
    );

  const displayedConsistency =
    Math.max(
      0,
      Math.min(
        100,
        Math.max(
          weeklyConsistency,
          weeklyCompletion
        )
      )
    );

  const weekDays = useMemo(() => {
    const currentKey = todayKey();
    const monday = new Date(`${currentKey}T12:00:00Z`);
    const mondayOffset = (monday.getUTCDay() + 6) % 7;
    monday.setUTCDate(monday.getUTCDate() - mondayOffset);

    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(monday);
      day.setUTCDate(monday.getUTCDate() + index);
      const key = getDateKey(day);
      return {
        key,
        label: new Intl.DateTimeFormat("en-US", {
          weekday: "narrow",
          timeZone: import.meta.env.VITE_APP_TIMEZONE || "UTC",
        }).format(day),
        date: day,
      };
    });
  }, []);

  /* =========================================
     AI PROGRESS SCORE
  ========================================= */

  const aiProgressScore =
    useMemo(() => {
      const hasData = workoutCount > 0 || waterDays > 0 || sleepDays > 0 || weightHistory.length > 0;
      if (!hasData) return 0;

      const workoutScore =
        Math.min(
          workoutCount / 7,
          1
        ) * 35;

      const hydrationScore =
        Math.min(
          waterDays / 7,
          1
        ) * 20;

      const sleepScore =
        Math.min(
          sleepDays / 7,
          1
        ) * 20;

      let weightScore = 12;

      if (
        goal === "weight-loss" &&
        totalChange < 0
      ) {
        weightScore = 25;
      } else if (
        goal === "weight-gain" &&
        totalChange > 0
      ) {
        weightScore = 25;
      } else if (
        totalChange === 0
      ) {
        weightScore = 18;
      }

      return Math.round(
        Math.min(
          workoutScore +
            hydrationScore +
            sleepScore +
            weightScore,
          100
        )
      );
    }, [
      workoutCount,
      waterDays,
      sleepDays,
      goal,
      totalChange,
      weightHistory.length,
    ]);

  const fitnessScore = aiProgressScore;

  const aiProgressStatus =
    useMemo(() => {
      if (aiProgressScore >= 85) {
        return "Excellent momentum";
      }

      if (aiProgressScore >= 70) {
        return "Strong progress";
      }

      if (aiProgressScore >= 50) {
        return "Building consistency";
      }

      return "Getting started";
    }, [aiProgressScore]);

  /* =========================================
     AI WEEKLY INSIGHTS
  ========================================= */

  const weeklyInsights = aiInsights.map((text, index) => ({
    type: index === 0 ? "success" : index === 1 ? "progress" : "focus",
    icon: index === 0 ? <Sparkles size={17} /> : index === 1 ? <TrendingUp size={17} /> : <Target size={17} />,
    title: "AI weekly insight",
    text,
  }));

  /* =========================================
     UPDATE WEIGHT
  ========================================= */


  const updateWeight = async () => {
    const newWeight =
      Number(weightInput);

    if (
      !newWeight ||
      newWeight < 30 ||
      newWeight > 250
    ) {
      return;
    }

    const newHistory = [
      ...weightHistory,
      newWeight,
    ].slice(-7);

    setCurrentWeight(
      newWeight
    );

    setWeightHistory(
      newHistory
    );

    setWeightInput("");

    try {
      const response = await saveTodayHabits({
        date: todayKey(),
        weightKg: newWeight,
      });
      const savedProgress = response?.data?.progress;
      if (savedProgress) {
        setProgressEntries((previous) => {
          const savedKey = String(savedProgress._id || getEntryDateKey(savedProgress.date));
          const withoutSaved = previous.filter(
            (entry) => String(entry._id || getEntryDateKey(entry.date)) !== savedKey
          );
          return [savedProgress, ...withoutSaved].sort(
            (a, b) => new Date(b.date) - new Date(a.date)
          );
        });
      }
      setRemoteError("");
    } catch (error) {
      setRemoteError(getApiMessage(error, "Weight could not be saved."));
    }
  };

  /* =========================================
     PHOTO UPLOAD
  ========================================= */

  const handleProgressPhotoUpload = async (
    event,
    type
  ) => {
    const file =
      event.target.files?.[0];

    if (!file) {
      return;
    }

    if (
      file.size >
      5 * 1024 * 1024
    ) {
      alert(
        "Please choose an image smaller than 5 MB."
      );

      event.target.value = "";
      return;
    }

    try {
      const result = await uploadProgressPhoto(file, type, todayKey());
      const progress = result?.data?.progress;
      if (!progress?._id) throw new Error("Photo was uploaded but no progress record was returned.");

      const response = await getProgressPhoto(progress._id, type);
      const url = URL.createObjectURL(response.data);
      if (type === "before") setBeforePhoto((previous) => { if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous); return url; });
      if (type === "current") setCurrentPhoto((previous) => { if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous); return url; });
      setRemoteError("");
    } catch (error) {
      setRemoteError(getApiMessage(error, "Progress photo could not be uploaded."));
    } finally {
      event.target.value = "";
    }
  };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <div className="progress-page">

      {/* =====================================
          SIDEBAR
      ===================================== */}

      <aside ref={sidebarRef} className="app-sidebar progress-sidebar">

        <div className="progress-logo">

          <div className="progress-logo-icon">
            <Activity size={20} />
          </div>

          <div>
            <strong>
              FitCoach AI
            </strong>

            <span>
              Smart Fitness
            </span>
          </div>

        </div>

        <nav className="progress-nav">

          <button
            className="progress-nav-item"
            onClick={() =>
              navigate(
                "/dashboard"
              )
            }
          >
            <Home size={18} />
            Dashboard
          </button>

          <button
            className="progress-nav-item"
            onClick={() =>
              navigate("/plan")
            }
          >
            <CalendarDays
              size={18}
            />
            My Plan
          </button>

          <button
            className="progress-nav-item active"
            onClick={() =>
              navigate(
                "/progress"
              )
            }
          >
            <BarChart3 size={18} />
            Progress
          </button>

          <button
            className="progress-nav-item"
            onClick={() =>
              navigate("/coach")
            }
          >
            <Target size={18} />
            AI Coach
          </button>

        </nav>

        <div className="progress-sidebar-bottom">

          <button
            className="progress-nav-item"
            onClick={() =>
              navigate("/profile")
            }
          >
            <User size={18} />
            Profile
          </button>

          <div className="progress-user">

            <div className="progress-avatar">
              {firstName
                .charAt(0)
                .toUpperCase()}
            </div>

            <div>

              <strong>
                {firstName}
              </strong>

              <span>
                {goalLabel}
              </span>

            </div>

          </div>

        </div>

      </aside>


      {/* =====================================
          MAIN
      ===================================== */}

      <main className="progress-main">
        {remoteError && <div className="progress-disclaimer">{remoteError}</div>}

        {/* HEADER */}

        <header className="progress-header">

          <button
            className="progress-back-button"
            onClick={() =>
              navigate(
                "/dashboard"
              )
            }
          >
            <ArrowLeft
              size={17}
            />

            Dashboard
          </button>

          <div className="progress-header-title">

            <BarChart3 size={18} />

            Progress Tracking

          </div>

        </header>


        <div className="progress-content">

          {/* =================================
              PAGE INTRO
          ================================= */}

          <section className="progress-intro">

            <div>

              <div className="progress-eyebrow">
                YOUR JOURNEY
              </div>

              <h1>
                Your progress,{" "}
                {firstName}.
              </h1>

              <p>
                Small improvements
                add up. Keep
                tracking your
                journey toward{" "}
                {goalLabel.toLowerCase()}.
              </p>

            </div>

            <div className="progress-goal">

              <Target size={16} />

              <span>
                {goalLabel}
              </span>

            </div>

          </section>


          {/* =================================
              WEEKLY SUMMARY
          ================================= */}

          <section className="weekly-progress-banner">

            <div className="weekly-progress-heading">

              <div className="weekly-progress-icon">
                <Sparkles
                  size={19}
                />
              </div>

              <div>

                <span>
                  THIS WEEK
                </span>

                <h2>
                  Weekly Progress
                </h2>

              </div>

            </div>


            <div className="weekly-progress-score">

              <div className="weekly-score-number">
                {displayedConsistency}
                <small>%</small>
              </div>

              <div>

                <span>
                  WEEKLY CONSISTENCY
                </span>

                <strong>
                  {displayedConsistency >=
                  75
                    ? "Great work"
                    : displayedConsistency >=
                      50
                    ? "Keep going"
                    : "Getting started"}
                </strong>

              </div>

            </div>


            <div className="weekly-progress-items">

              <WeeklyProgressItem
                icon={
                  <Flame size={15} />
                }
                label="Workouts"
                value={`${workoutCount}/7`}
              />

              <WeeklyProgressItem
                icon={
                  <Droplets
                    size={15}
                  />
                }
                label="Hydration"
                value={`${waterDays}/7`}
              />

              <WeeklyProgressItem
                icon={
                  <Activity
                    size={15}
                  />
                }
                label="Sleep"
                value={`${sleepDays}/7`}
              />

              <WeeklyProgressItem
                icon={
                  <Scale size={15} />
                }
                label="Weight"
                value={`${currentWeight.toFixed(
                  1
                )} kg`}
              />

            </div>

          </section>


          {/* =================================
              SCORE CARDS
          ================================= */}

          <section className="progress-stat-grid">

            <ProgressStat
              icon={
                <Trophy size={20} />
              }
              label="Fitness Score"
              value={fitnessScore}
              unit="/100"
              change="+7"
              positive
            />

            <ProgressStat
              icon={
                <Weight size={20} />
              }
              label="Current Weight"
              value={currentWeight.toFixed(
                1
              )}
              unit="kg"
              change={
                totalChange === 0
                  ? "No change"
                  : `${
                      totalChange >
                      0
                        ? "+"
                        : ""
                    }${totalChange.toFixed(
                      1
                    )} kg`
              }
              positive={
                goal ===
                "weight-loss"
                  ? totalChange <=
                    0
                  : totalChange >=
                    0
              }
            />

            <ProgressStat
              icon={
                <Flame size={20} />
              }
              label="Workout Streak"
              value={streak}
              unit="days"
              change="+2 this week"
              positive
            />

            <ProgressStat
              icon={
                <CheckCircle2
                  size={20}
                />
              }
              label="Weekly Goal"
              value={
                weeklyCompletion
              }
              unit="%"
              change={
                workoutCount > 0
                  ? `${workoutCount} workout${
                      workoutCount ===
                      1
                        ? ""
                        : "s"
                    } completed`
                  : "In progress"
              }
              positive
            />

          </section>


          {/* =================================
              MAIN CHART GRID
          ================================= */}

          <div className="progress-main-grid">

            {/* WEIGHT CHART */}

            <section className="progress-card weight-chart-card">

              <div className="progress-card-header">

                <div>

                  <div className="progress-card-label">
                    BODY WEIGHT
                  </div>

                  <h2>
                    Weight Progress
                  </h2>

                </div>

                <div className="progress-change-badge">

                  {totalChange <=
                  0 ? (
                    <TrendingDown
                      size={15}
                    />
                  ) : (
                    <TrendingUp
                      size={15}
                    />
                  )}

                  {absoluteChange.toFixed(
                    1
                  )}{" "}
                  kg

                </div>

              </div>


              <div className="weight-summary">

                <div>
                  <span>
                    Starting
                  </span>

                  <strong>
                    {Number(
                      startingWeight
                    ).toFixed(1)}
                    <small>
                      {" "}
                      kg
                    </small>
                  </strong>
                </div>

                <div>
                  <span>
                    Current
                  </span>

                  <strong>
                    {currentWeight.toFixed(
                      1
                    )}
                    <small>
                      {" "}
                      kg
                    </small>
                  </strong>
                </div>

                <div>
                  <span>
                    Average
                  </span>

                  <strong>
                    {averageWeight.toFixed(
                      1
                    )}
                    <small>
                      {" "}
                      kg
                    </small>
                  </strong>
                </div>

              </div>


              <WeightChart
                data={
                  weightHistory
                }
              />

              <div className="chart-labels">
                <span>
                  Week 1
                </span>
                <span>
                  Week 2
                </span>
                <span>
                  Week 3
                </span>
                <span>
                  Week 4
                </span>
                <span>
                  Today
                </span>
              </div>

            </section>


            {/* UPDATE WEIGHT */}

            <section className="progress-card update-weight-card">

              <div className="progress-card-header">

                <div>

                  <div className="progress-card-label">
                    UPDATE METRICS
                  </div>

                  <h2>
                    Track Your Weight
                  </h2>

                </div>

                <div className="weight-icon">
                  <Scale size={19} />
                </div>

              </div>

              <p className="update-weight-text">
                Enter your latest
                weight to update
                your progress chart.
              </p>

              <div className="weight-stepper" aria-label="Weight input controls">

                <button
                  type="button"
                  className="weight-stepper-button"
                  aria-label="Decrease weight by 0.1 kilograms"
                  disabled={!weightInput || Number(weightInput) <= 30}
                  onClick={() => {
                    const current = Number(weightInput);
                    if (!Number.isFinite(current)) return;
                    setWeightInput(Math.max(30, current - 0.1).toFixed(1));
                  }}
                >
                  <Minus size={16} />
                </button>

                <div className="weight-stepper-input-wrap">
                  <input
                    type="number"
                    step="0.1"
                    min="30"
                    max="250"
                    placeholder={currentWeight > 0 ? currentWeight.toFixed(1) : "Enter weight"}
                    value={weightInput}
                    onChange={(event) => setWeightInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") updateWeight();
                    }}
                    aria-label="Weight in kilograms"
                  />
                  <span>kg</span>
                </div>

                <button
                  type="button"
                  className="weight-stepper-button"
                  aria-label="Increase weight by 0.1 kilograms"
                  disabled={!!weightInput && Number(weightInput) >= 250}
                  onClick={() => {
                    const current = Number(weightInput);
                    const next = Number.isFinite(current) && current >= 30 ? current + 0.1 : 30;
                    setWeightInput(Math.min(250, next).toFixed(1));
                  }}
                >
                  <Plus size={16} />
                </button>

              </div>

              <button
                className="update-weight-button"
                onClick={
                  updateWeight
                }
              >
                Update Weight
                <ArrowRight
                  size={16}
                />
              </button>

              <div className="metric-tip">

                <span>
                  💡
                </span>

                <p>
                  For better
                  tracking,
                  measure your
                  weight at the
                  same time each
                  day.
                </p>

              </div>

            </section>

          </div>


          {/* =================================
              PHOTO COMPARISON
          ================================= */}

          <section className="progress-card photo-comparison-card">

            <div className="progress-card-header">

              <div>

                <div className="progress-card-label">
                  BODY TRANSFORMATION
                </div>

                <h2>
                  Photo Comparison
                </h2>

              </div>

              <Camera size={20} />

            </div>

            <p className="photo-comparison-description">
              Compare your starting
              photo with your latest
              progress photo to visually
              track your journey.
            </p>

            <div className="progress-photo-grid">

              <ProgressPhoto
                label="START"
                image={
                  beforePhoto
                }
                emptyText="Upload starting photo"
                onChange={(
                  event
                ) =>
                  handleProgressPhotoUpload(
                    event,
                    "before"
                  )
                }
              />

              <ProgressPhoto
                label="THIS WEEK"
                image={
                  currentPhoto
                }
                emptyText="Upload current photo"
                onChange={(
                  event
                ) =>
                  handleProgressPhotoUpload(
                    event,
                    "current"
                  )
                }
              />

            </div>

            <div className="photo-progress-tip">

              <Camera size={14} />

              <span>
                For better
                comparisons, take
                photos with similar
                lighting, clothing
                and camera position.
              </span>

            </div>

          </section>


          {/* =================================
              ACTIVITY + BODY METRICS
          ================================= */}

          <div className="progress-secondary-grid">

            {/* WEEKLY WORKOUTS */}

            <section className="progress-card activity-card">

              <div className="progress-card-header">

                <div>

                  <div className="progress-card-label">
                    WORKOUT ACTIVITY
                  </div>

                  <h2>
                    This Week
                  </h2>

                </div>

                <span className="activity-total">
                  {workoutCount}{" "}
                  completed
                </span>

              </div>


              <div className="activity-days">
                {weekDays.map((day) => {
                  const entry = progressEntries.find((item) => getEntryDateKey(item.date) === day.key);
                  const completed = Boolean(entry?.workoutCompleted);
                  const isToday = day.key === todayKey();
                  return (
                    <ActivityDay
                      key={day.key}
                      day={day.label}
                      active={isToday && !completed}
                      completed={completed}
                    />
                  );
                })}
              </div>


              <div className="activity-progress">

                <div className="activity-progress-header">

                  <span>
                    Weekly completion
                  </span>

                  <strong>
                    {weeklyCompletion}%
                  </strong>

                </div>

                <div className="activity-track">

                  <div
                    className="activity-fill"
                    style={{
                      width: `${weeklyCompletion}%`,
                    }}
                  />

                </div>

              </div>

            </section>


            {/* BODY METRICS */}

            <section className="progress-card metrics-card">

              <div className="progress-card-header">

                <div>

                  <div className="progress-card-label">
                    BODY ANALYSIS
                  </div>

                  <h2>
                    Fitness Metrics
                  </h2>

                </div>

                <button
                  className="metrics-arrow"
                  onClick={() =>
                    navigate(
                      "/analysis"
                    )
                  }
                  aria-label="View body analysis"
                >
                  <ChevronRight
                    size={17}
                  />
                </button>

              </div>


              <MetricRow
                label="Posture"
                value={88}
                status="Excellent"
              />

              <MetricRow
                label="Shoulder Alignment"
                value={84}
                status="Good"
              />

              <MetricRow
                label="Body Balance"
                value={79}
                status="Good"
              />

              <MetricRow
                label="Mobility"
                value={76}
                status="Good"
              />

            </section>

          </div>


          {/* =================================
              UPGRADED AI PROGRESS ANALYSIS
          ================================= */}

          <section className="progress-card ai-weekly-insights-card">

            {/* AI HEADER */}

            <div className="ai-weekly-top">

              <div className="ai-weekly-header">

                <div className="ai-weekly-icon">
                  <Sparkles size={20} />
                </div>

                <div>

                  <div className="progress-card-label">
                    AI PROGRESS ANALYSIS
                  </div>

                  <h2>
                    Your week at a glance
                  </h2>

                  <p className="ai-weekly-subtitle">
                    Personalized insights
                    based on your recent
                    activity and progress.
                  </p>

                </div>

              </div>


              {/* AI SCORE */}

              <div className="ai-score-box">

                <div className="ai-score-ring">

                  <strong>
                    {aiProgressScore}
                  </strong>

                  <span>
                    /100
                  </span>

                </div>

                <div className="ai-score-info">

                  <span>
                    PROGRESS SCORE
                  </span>

                  <strong>
                    {aiProgressStatus}
                  </strong>

                </div>

              </div>

            </div>


            {/* QUICK METRICS */}

            <div className="ai-weekly-metrics">

              <div className="ai-mini-metric">

                <div className="ai-mini-icon">
                  <Flame
                    size={16}
                  />
                </div>

                <div>

                  <span>
                    Workouts
                  </span>

                  <strong>
                    {workoutCount}/7
                  </strong>

                </div>

              </div>


              <div className="ai-mini-metric">

                <div className="ai-mini-icon">
                  <Droplets
                    size={16}
                  />
                </div>

                <div>

                  <span>
                    Hydration
                  </span>

                  <strong>
                    {waterDays}/7
                  </strong>

                </div>

              </div>


              <div className="ai-mini-metric">

                <div className="ai-mini-icon">
                  <Activity
                    size={16}
                  />
                </div>

                <div>

                  <span>
                    Sleep
                  </span>

                  <strong>
                    {sleepDays}/7
                  </strong>

                </div>

              </div>


              <div className="ai-mini-metric">

                <div className="ai-mini-icon">
                  <Scale
                    size={16}
                  />
                </div>

                <div>

                  <span>
                    Weight
                  </span>

                  <strong>
                    {currentWeight.toFixed(
                      1
                    )}{" "}
                    kg
                  </strong>

                </div>

              </div>

            </div>


            {/* AI INSIGHTS */}

            <div className="ai-insight-list">

              {weeklyInsights.map(
                (
                  insight,
                  index
                ) => (

                  <div
                    className={`ai-insight-item ai-insight-${insight.type}`}
                    key={index}
                  >

                    <div className="ai-insight-item-icon">
                      {insight.icon}
                    </div>

                    <div className="ai-insight-content">

                      <strong>
                        {insight.title}
                      </strong>

                      <p>
                        {insight.text}
                      </p>

                    </div>

                  </div>

                )
              )}

            </div>


            {/* AI RECOMMENDATION */}

            <div className="ai-recommendation">

              <div className="ai-recommendation-icon">
                <Sparkles
                  size={17}
                />
              </div>

              <div>

                <span>
                  AI RECOMMENDATION
                </span>

                <p>

                  {aiProgressScore >=
                  85
                    ? "You're having a strong week. Keep your current routine and focus on maintaining consistency rather than dramatically increasing your workload."
                    : aiProgressScore >=
                      70
                    ? "Your progress is moving in a positive direction. Focus on consistency this week and strengthen the habit that needs the most attention."
                    : aiProgressScore >=
                      50
                    ? "You're building a foundation. Prioritize regular workouts, hydration and sleep before increasing training intensity."
                    : "Start small and focus on one consistent habit at a time. Completing your next workout is a great first step."}

                </p>

              </div>

            </div>


            {/* AI CTA */}

            <div className="ai-weekly-footer">

              <div>

                <strong>
                  Want a deeper analysis?
                </strong>

                <span>
                  Ask FitCoach AI about
                  your workouts,
                  nutrition or progress.
                </span>

              </div>

              <button
                onClick={() =>
                  navigate(
                    "/coach"
                  )
                }
              >
                Ask AI Coach
                <ArrowRight
                  size={15}
                />
              </button>

            </div>


            {/* DISCLAIMER */}

            <div className="ai-insight-disclaimer">

              <Sparkles
                size={13}
              />

              <span>
                AI-generated fitness
                insights are for general
                fitness guidance and are
                not medical advice.
              </span>

            </div>

          </section>


          {/* =================================
              ACHIEVEMENTS
          ================================= */}

          <section className="progress-card achievements-card">

            <div className="progress-card-header">

              <div>

                <div className="progress-card-label">
                  ACHIEVEMENTS
                </div>

                <h2>
                  Your Milestones
                </h2>

              </div>

              <Award size={20} />

            </div>


            <div className="achievement-grid">

              <Achievement
                icon="🔥"
                title="5 Day Streak"
                description="Worked out for 5 consecutive days."
                unlocked
              />

              <Achievement
                icon="🏆"
                title="First Week"
                description="Completed your first week."
                unlocked
              />

              <Achievement
                icon="⚡"
                title="Consistency"
                description="Complete 10 workouts."
                progress={`${Math.min(
                  workoutCount,
                  10
                )} / 10`}
              />

              <Achievement
                icon="🎯"
                title="Goal Crusher"
                description="Reach your first fitness goal."
                progress="68%"
              />

            </div>

          </section>


          {/* =================================
              BOTTOM CTA
          ================================= */}

          <section className="progress-bottom-cta">

            <div className="progress-cta-icon">
              <Flame size={21} />
            </div>

            <div>

              <strong>
                You're making progress.
              </strong>

              <p>
                Keep your streak alive
                and stay consistent
                with your plan.
              </p>

            </div>

            <button
              onClick={() =>
                navigate("/plan")
              }
            >
              Continue Training
              <ArrowRight
                size={15}
              />
            </button>

          </section>

        </div>

      </main>

    </div>
  );
}


/* =========================================
   PROGRESS STAT
========================================= */

function ProgressStat({
  icon,
  label,
  value,
  unit,
  change,
  positive,
}) {
  return (
    <div className="progress-stat">

      <div className="progress-stat-icon">
        {icon}
      </div>

      <span className="progress-stat-label">
        {label}
      </span>

      <div className="progress-stat-value">
        {value}
        <small>
          {unit}
        </small>
      </div>

      <span
        className={`progress-stat-change ${
          positive
            ? "progress-positive"
            : "progress-negative"
        }`}
      >
        {change}
      </span>

    </div>
  );
}


/* =========================================
   WEEKLY SUMMARY ITEM
========================================= */

function WeeklyProgressItem({
  icon,
  label,
  value,
}) {
  return (
    <div className="weekly-progress-item">

      <div className="weekly-progress-item-icon">
        {icon}
      </div>

      <div>

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

      </div>

    </div>
  );
}


/* =========================================
   PHOTO COMPONENT
========================================= */

function ProgressPhoto({
  label,
  image,
  emptyText,
  onChange,
}) {
  return (
    <div className="progress-photo">

      <div className="progress-photo-header">

        <span>
          {label}
        </span>

        <label className="progress-photo-upload">

          {image
            ? "Change Photo"
            : "Upload Photo"}

          <input
            type="file"
            accept="image/*"
            onChange={
              onChange
            }
          />

        </label>

      </div>

      <div className="progress-photo-preview">

        {image ? (
          <img
            src={image}
            alt={`${label} progress`}
          />
        ) : (
          <div className="progress-photo-empty">

            <Camera
              size={25}
            />

            <span>
              {emptyText}
            </span>

            <small>
              JPG, PNG or WEBP
            </small>

          </div>
        )}

      </div>

    </div>
  );
}


/* =========================================
   WEIGHT CHART
========================================= */

function WeightChart({
  data,
}) {
  if (
    !data ||
    data.length === 0
  ) {
    return null;
  }

  const numericData =
    data
      .map(Number)
      .filter(
        Number.isFinite
      );

  if (
    numericData.length === 0
  ) {
    return null;
  }

  const width = 700;
  const height = 210;
  const padding = 25;

  const dataMin =
    Math.min(
      ...numericData
    );

  const dataMax =
    Math.max(
      ...numericData
    );

  const min =
    dataMin - 1;

  const max =
    dataMax === dataMin
      ? dataMax + 1
      : dataMax + 1;

  const points =
    numericData.map(
      (value, index) => {
        const x =
          padding +
          (index *
            (width -
              padding *
                2)) /
            Math.max(
              numericData.length -
                1,
              1
            );

        const y =
          height -
          padding -
          ((value - min) /
            (max - min)) *
            (height -
              padding *
                2);

        return `${x},${y}`;
      }
    );

  const polylinePoints =
    points.join(" ");

  return (
    <div className="weight-chart">

      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label="Weight progress chart"
      >

        <line
          x1="25"
          y1="45"
          x2="675"
          y2="45"
          className="chart-grid-line"
        />

        <line
          x1="25"
          y1="105"
          x2="675"
          y2="105"
          className="chart-grid-line"
        />

        <line
          x1="25"
          y1="165"
          x2="675"
          y2="165"
          className="chart-grid-line"
        />

        <polyline
          points={
            polylinePoints
          }
          className="weight-line"
          fill="none"
        />

        {numericData.map(
          (
            value,
            index
          ) => {
            const [
              x,
              y,
            ] =
              points[index]
                .split(",")
                .map(Number);

            return (
              <circle
                key={`${value}-${index}`}
                cx={x}
                cy={y}
                r="4"
                className="weight-point"
              />
            );
          }
        )}

      </svg>

    </div>
  );
}


/* =========================================
   ACTIVITY DAY
========================================= */

function ActivityDay({
  day,
  completed,
  active,
}) {
  return (
    <div
      className={`activity-circle ${
        completed
          ? "activity-completed"
          : active
          ? "activity-active"
          : ""
      }`}
    >

      {completed ? (
        <CheckCircle2
          size={15}
        />
      ) : active ? (
        <span className="activity-active-dot" />
      ) : null}

      <span>
        {day}
      </span>

    </div>
  );
}


/* =========================================
   METRIC ROW
========================================= */

function MetricRow({
  label,
  value,
  status,
}) {
  const numericValue =
    Number(value);

  return (
    <div className="metric-row">

      <div className="metric-info">

        <strong>
          {label}
        </strong>

        <span>
          {status}
        </span>

      </div>

      <div className="metric-score">

        <strong>
          {numericValue}
        </strong>

        <div className="metric-track">

          <div
            className="metric-fill"
            style={{
              width: `${Math.min(
                Math.max(
                  numericValue,
                  0
                ),
                100
              )}%`,
            }}
          />

        </div>

      </div>

    </div>
  );
}


/* =========================================
   ACHIEVEMENT
========================================= */

function Achievement({
  icon,
  title,
  description,
  unlocked,
  progress,
}) {
  return (
    <div
      className={`achievement ${
        unlocked
          ? "achievement-unlocked"
          : ""
      }`}
    >

      <div className="achievement-icon">
        {icon}
      </div>

      <div className="achievement-info">

        <strong>
          {title}
        </strong>

        <span>
          {description}
        </span>

        {progress && (
          <small>
            Progress:{" "}
            {progress}
          </small>
        )}

      </div>

      {unlocked && (
        <CheckCircle2
          size={17}
          className="achievement-check"
        />
      )}

    </div>
  );
}

function getCurrentWeekEntries(entries = []) {
  const currentKey = todayKey();
  const monday = new Date(`${currentKey}T12:00:00Z`);
  const mondayOffset = (monday.getUTCDay() + 6) % 7;
  monday.setUTCDate(monday.getUTCDate() - mondayOffset);
  const keys = new Set(Array.from({ length: 7 }, (_, index) => {
    const day = new Date(monday);
    day.setUTCDate(monday.getUTCDate() + index);
    return getDateKey(day);
  }));
  return entries.filter((entry) => keys.has(getDateKey(entry.date)));
}

export default Progress;
