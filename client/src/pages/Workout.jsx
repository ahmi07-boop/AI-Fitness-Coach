import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { getMyPlan } from "../services/planApi";
import { saveWorkoutCompletion } from "../services/workoutApi";
import { todayKey } from "../utils/date";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Clock,
  Dumbbell,
  Flame,
  Pause,
  Play,
  RotateCcw,
  Target,
  X,
  Zap,
} from "lucide-react";


function Workout() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [planData, setPlanData] = useState(null);
  const [planError, setPlanError] = useState("");
  const goal = user?.profile?.goal || "maintenance";

  const [started, setStarted] = useState(false);
  const [currentExercise, setCurrentExercise] =
    useState(0);

  const [completedExercises, setCompletedExercises] =
    useState([]);

  const [completedSets, setCompletedSets] =
    useState(0);

  const [isPaused, setIsPaused] =
    useState(false);

  const [workoutFinished, setWorkoutFinished] =
    useState(false);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);
  const [workoutSessionId, setWorkoutSessionId] = useState(null);
  const [workoutStartedAt, setWorkoutStartedAt] = useState(null);
  const [completionError, setCompletionError] = useState("");

  useEffect(() => {
    let mounted = true;
    getMyPlan().then((data) => { if (mounted) setPlanData(data || null); }).catch((error) => { if (mounted) setPlanError(error.response?.data?.message || "Your personalized workout could not be loaded."); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!started || isPaused || workoutFinished) {
      return;
    }

    const timer = setInterval(() => {
      setElapsedSeconds(
        (previous) => previous + 1
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [
    started,
    isPaused,
    workoutFinished,
  ]);

  const firstName =
    user?.name?.split(" ")[0] || "there";

  const goalNames = {
    "weight-loss": "Weight Loss",
    "weight-gain": "Weight Gain",
    "muscle-building":
      "Muscle Building",
    maintenance: "Maintenance",
  };

  const goalName =
    goalNames[goal] || "Maintenance";

  const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(new Date());
  const workoutDay = planData?.workout?.weeklySplit?.find((day) => {
    const dayName = String(day.day || "").toLowerCase();
    return day.type?.toLowerCase() !== "rest" && dayName.includes(todayName.toLowerCase());
  }) || planData?.workout?.weeklySplit?.find((day) => day.type?.toLowerCase() !== "rest") || null;
  const workoutExercises = workoutDay?.exercises || [];

  if (!planData) return <div className="workout-page"><div className="workout-container"><div className="workout-hero"><h1>{planError || "Your personalized workout is not available yet."}</h1><p>Generate your AI plan first to start today's workout.</p></div><button className="primary-button" onClick={() => navigate("/plan")}>Open My Plan</button></div></div>;

  if (!workoutExercises.length) return <div className="workout-page"><div className="workout-container"><div className="workout-hero"><h1>No workout exercises available</h1><p>Your AI plan does not contain an exercise session yet.</p></div></div></div>;

  const getExerciseKey = (exercise, index) =>
    String(exercise?.id || `exercise-${index + 1}-${exercise?.name || "workout"}`);

  const current =
    workoutExercises[currentExercise];

  const totalExercises =
    workoutExercises.length;

  const progress =
    completedExercises.length /
    totalExercises *
    100;

  const totalSets =
    workoutExercises.reduce(
      (total, exercise) =>
        total + exercise.sets,
      0
    );

  const formatTime = (seconds) => {
    const minutes = Math.floor(
      seconds / 60
    );

    const remaining =
      seconds % 60;

    return `${String(minutes).padStart(
      2,
      "0"
    )}:${String(remaining).padStart(
      2,
      "0"
    )}`;
  };

  const startWorkout = () => {
    setWorkoutSessionId(`workout-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    setWorkoutStartedAt(new Date().toISOString());
    setStarted(true);
    setIsPaused(false);
  };

  const completeCurrentExercise = () => {
    const currentKey = getExerciseKey(current, currentExercise);
    if (completedExercises.includes(currentKey)) return;

    const updatedCompleted = [...completedExercises, currentKey];
    const updatedSets = completedSets + Number(current?.sets || 0);

    setCompletionError("");
    setCompletedExercises(updatedCompleted);
    setCompletedSets(updatedSets);

    // Completion is per exercise, not per screen. Moving to another exercise
    // must never mark the remaining exercises complete automatically.
    if (updatedCompleted.length === totalExercises) {
      finishWorkout(updatedCompleted, updatedSets);
      return;
    }

    if (currentExercise < totalExercises - 1) {
      setCurrentExercise((previous) => previous + 1);
    }
  };

  const finishWorkout = async (
    completed = completedExercises,
    completedSetsOverride = completedSets
  ) => {
    if (completed.length !== totalExercises) {
      setCompletionError("Complete every exercise before finishing today's workout.");
      return;
    }


    setCompletionError("");

    try {
      await saveWorkoutCompletion({
        date: todayKey(),
        sessionId: workoutSessionId || `workout-${Date.now()}`,
        startedAt: workoutStartedAt || new Date().toISOString(),
        durationSeconds: elapsedSeconds,
        totalExercises,
        completedExerciseIds: completed,
        exercisesCompleted: completed.length,
        totalSets,
        completedSets: completedSetsOverride,
      });

      setWorkoutFinished(true);
      setIsPaused(false);
    } catch (error) {
      setCompletionError(error?.response?.data?.message || "Workout completed locally, but the server could not save it. Please try again.");
    }
  };

  const resetWorkout = () => {
    setCompletionError("");
    setStarted(false);
    setCurrentExercise(0);
    setCompletedExercises([]);
    setCompletedSets(0);
    setIsPaused(false);
    setWorkoutFinished(false);
    setWorkoutSessionId(null);
    setWorkoutStartedAt(null);
    setElapsedSeconds(0);
  };

  const goNext = () => {
    if (
      currentExercise <
      totalExercises - 1
    ) {
      setCurrentExercise(
        (previous) =>
          previous + 1
      );
    }
  };

  const goPrevious = () => {
    if (currentExercise > 0) {
      setCurrentExercise(
        (previous) =>
          previous - 1
      );
    }
  };

  if (workoutFinished) {
    return (
      <WorkoutComplete
        firstName={firstName}
        elapsedSeconds={elapsedSeconds}
        completedExercises={
          completedExercises.length
        }
        totalExercises={totalExercises}
        completedSets={completedSets}
        navigate={navigate}
        resetWorkout={resetWorkout}
      />
    );
  }

  if (!started) {
    return (
      <WorkoutOverview
        firstName={firstName}
        goalName={goalName}
        totalExercises={totalExercises}
        totalSets={totalSets}
        workoutDay={workoutDay}
        workoutExercises={workoutExercises}
        current={current}
        navigate={navigate}
        startWorkout={startWorkout}
      />
    );
  }

  return (
    <WorkoutSession
      firstName={firstName}
      current={current}
      currentExercise={currentExercise}
      totalExercises={totalExercises}
      completedExercises={
        completedExercises
      }
      progress={progress}
      elapsedSeconds={elapsedSeconds}
      isPaused={isPaused}
      setIsPaused={setIsPaused}
      completeCurrentExercise={
        completeCurrentExercise
      }
      goNext={goNext}
      goPrevious={goPrevious}
      formatTime={formatTime}
      navigate={navigate}
      completionError={completionError}
    />
  );
}

/* =========================================
   WORKOUT OVERVIEW
========================================= */

function WorkoutOverview({
  firstName,
  goalName,
  totalExercises,
  totalSets,
  workoutDay,
  workoutExercises,
  current,
  navigate,
  startWorkout,
}) {
  return (
    <div className="workout-page">

      <header className="workout-header">

        <button
          className="workout-back"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="workout-brand">
          <div className="workout-brand-icon">
            <Dumbbell size={18} />
          </div>

          <strong>
            Today's Workout
          </strong>
        </div>

        <button
          className="workout-close"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          <X size={18} />
        </button>

      </header>

      <main className="workout-overview">

        <div className="workout-hero">

          <div className="workout-eyebrow">
            PERSONALIZED WORKOUT
          </div>

          <h1>
            Ready to train,
            <br />
            {firstName}?
          </h1>

          <p>
            Today's session is designed
            around your{" "}
            <strong>{goalName}</strong>{" "}
            goal.
          </p>

        </div>

        <div className="workout-stats">

          <WorkoutStat
            icon={<Dumbbell size={18} />}
            value={totalExercises}
            label="Exercises"
          />

          <WorkoutStat
            icon={<Target size={18} />}
            value={totalSets}
            label="Total Sets"
          />

          <WorkoutStat
            icon={<Clock size={18} />}
            value={workoutDay?.duration || "—"}
            label="Duration"
          />

          <WorkoutStat
            icon={<Flame size={18} />}
            value={current?.difficulty || "—"}
            label="Intensity"
          />

        </div>

        <section className="workout-list-card">

          <div className="workout-list-header">

            <div>
              <span>
                TODAY'S SESSION
              </span>

              <h2>
                Full Body Workout
              </h2>
            </div>

            <div className="workout-goal-badge">
              <Target size={13} />
              {goalName}
            </div>

          </div>

          <div className="exercise-list">

            {workoutExercises.map(
              (exercise, index) => (
                <div
                  className="exercise-preview"
                  key={exercise.id || `exercise-${index + 1}-${exercise.name || "workout"}`}
                >

                  <div className="exercise-number">
                    {String(index + 1).padStart(
                      2,
                      "0"
                    )}
                  </div>

                  <div className="exercise-info">

                    <strong>
                      {exercise.name}
                    </strong>

                    <span>
                      {exercise.category}
                    </span>

                  </div>

                  <div className="exercise-meta">

                    <strong>
                      {exercise.sets} ×{" "}
                      {exercise.reps}
                    </strong>

                    <span>
                      {exercise.duration}
                    </span>

                  </div>

                </div>
              )
            )}

          </div>

        </section>

        <button
          className="start-workout-button"
          onClick={startWorkout}
        >
          <Play size={18} fill="currentColor" />
          Start Today's Workout
          <ArrowRight size={17} />
        </button>

        <button
          className="skip-workout-button"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          Maybe later
        </button>

      </main>

    </div>
  );
}

/* =========================================
   WORKOUT SESSION
========================================= */

function WorkoutSession({
  firstName,
  current,
  currentExercise,
  totalExercises,
  completedExercises,
  progress,
  elapsedSeconds,
  isPaused,
  setIsPaused,
  completeCurrentExercise,
  goNext,
  goPrevious,
  formatTime,
  navigate,
  completionError,
}) {
  const currentKey = String(
    current?.id || `exercise-${currentExercise + 1}-${current?.name || "workout"}`
  );
  const isCompleted = completedExercises.includes(currentKey);

  return (
    <div className="workout-session-page">

      <header className="session-header">

        <button
          className="session-exit"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          <X size={18} />
        </button>

        <div className="session-title">
          <span>
            TODAY'S WORKOUT
          </span>

          <strong>
            {firstName}'s Training
          </strong>
        </div>

        <div className="session-timer">
          <Clock size={15} />
          {formatTime(elapsedSeconds)}
        </div>

      </header>

      <div className="session-progress-area">

        <div className="session-progress-text">
          <span>
            Exercise{" "}
            {currentExercise + 1} of{" "}
            {totalExercises}
          </span>

          <strong>
            {Math.round(progress)}%
          </strong>
        </div>

        <div className="session-progress">
          <div
            style={{
              width: `${progress}%`,
            }}
          />
        </div>

      </div>

      <main className="session-main">

        <div className="session-exercise-card">

          <div className="exercise-visual">

            <div className="exercise-glow" />

            <Dumbbell size={70} />

            <div className="exercise-visual-label">
              EXERCISE{" "}
              {String(
                currentExercise + 1
              ).padStart(2, "0")}
            </div>

          </div>

          <div className="session-exercise-content">

            <div className="session-category">
              {current.category}
            </div>

            <h1>
              {current.name}
            </h1>

            <p>
              {current.description}
            </p>

            <div className="exercise-targets">

              <TargetBox
                label="SETS"
                value={current.sets}
              />

              <TargetBox
                label="REPS"
                value={current.reps}
              />

              <TargetBox
                label="DURATION"
                value={current.duration}
              />

              <TargetBox
                label="REST"
                value={current.rest}
              />

            </div>

            <div className="exercise-difficulty">
              <Zap size={14} />
              {current.difficulty}
            </div>

          </div>

        </div>

        <div className="session-controls">

          <button
            className="session-secondary"
            onClick={goPrevious}
            disabled={
              currentExercise === 0
            }
          >
            <ChevronLeft size={17} />
            Previous
          </button>

          <button
            className="session-pause"
            onClick={() =>
              setIsPaused(
                (previous) =>
                  !previous
              )
            }
          >
            {isPaused ? (
              <>
                <Play
                  size={17}
                  fill="currentColor"
                />
                Resume
              </>
            ) : (
              <>
                <Pause size={17} />
                Pause
              </>
            )}
          </button>

          <button
            className={`session-complete ${
              isCompleted
                ? "completed"
                : ""
            }`}
            onClick={
              completeCurrentExercise
            }
            disabled={isCompleted}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 size={17} />
                Completed
              </>
            ) : (
              <>
                <Check size={17} />
                Complete Exercise
              </>
            )}
          </button>

          <button
            className="session-secondary"
            onClick={goNext}
            disabled={
              currentExercise ===
              totalExercises - 1
            }
          >
            Next
            <ChevronLeft
              size={17}
              style={{
                transform:
                  "rotate(180deg)",
              }}
            />
          </button>

        </div>

        {completionError && (
          <div className="pause-banner" role="alert">
            <X size={15} />
            {completionError}
          </div>
        )}

        {isPaused && (
          <div className="pause-banner">
            <Pause size={15} />
            Workout paused. Take a
            breath and resume when
            you're ready.
          </div>
        )}

      </main>

    </div>
  );
}

/* =========================================
   WORKOUT COMPLETE
========================================= */

function WorkoutComplete({
  firstName,
  elapsedSeconds,
  completedExercises,
  totalExercises,
  completedSets,
  navigate,
  resetWorkout,
}) {
  const minutes = Math.max(
    1,
    Math.round(
      elapsedSeconds / 60
    )
  );

  return (
    <div className="workout-complete-page">

      <div className="complete-glow" />

      <div className="complete-icon">
        <CheckCircle2 size={46} />
      </div>

      <div className="complete-eyebrow">
        WORKOUT COMPLETE
      </div>

      <h1>
        Great job,
        <br />
        {firstName}! 🔥
      </h1>

      <p>
        You completed today's workout.
        Keep building that consistency.
      </p>

      <div className="complete-stats">

        <CompleteStat
          value={`${minutes}m`}
          label="Duration"
        />

        <CompleteStat
          value={`${completedExercises}/${totalExercises}`}
          label="Exercises"
        />

        <CompleteStat
          value={completedSets}
          label="Sets"
        />

      </div>

      <div className="complete-actions">

        <button
          className="complete-primary"
          onClick={() =>
            navigate("/progress")
          }
        >
          View My Progress
          <ArrowRight size={17} />
        </button>

        <button
          className="complete-secondary"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          Back to Dashboard
        </button>

        <button
          className="complete-retry"
          onClick={resetWorkout}
        >
          <RotateCcw size={14} />
          Start Again
        </button>

      </div>

    </div>
  );
}

/* =========================================
   SMALL COMPONENTS
========================================= */

function WorkoutStat({
  icon,
  value,
  label,
}) {
  return (
    <div className="workout-stat">

      <div className="workout-stat-icon">
        {icon}
      </div>

      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>

    </div>
  );
}

function TargetBox({
  label,
  value,
}) {
  return (
    <div className="target-box">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function CompleteStat({
  value,
  label,
}) {
  return (
    <div className="complete-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export default Workout;