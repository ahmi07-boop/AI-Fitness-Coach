import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Flame,
  Moon,
  Minus,
  Plus,
  RotateCcw,
  Utensils,
  Dumbbell,
  Droplets,
  Trophy,
} from "lucide-react";
import { getApiMessage, getTodayHabits, saveTodayHabits } from "../services/habitApi";
import { getSocket } from "../services/socket";
import { todayKey, getDateKey } from "../utils/date";

const habitDefinitions = [
  {
    id: "meals",
    title: "Complete your meals",
    description: "Follow today's personalized nutrition plan",
    icon: Utensils,
    color: "green",
  },
  {
    id: "water",
    title: "Drink enough water",
    description: "Reach your daily hydration target",
    icon: Droplets,
    color: "blue",
  },
  {
    id: "workout",
    title: "Complete today's workout",
    description: "Finish your planned training session",
    icon: Dumbbell,
    color: "orange",
  },
  {
    id: "sleep",
    title: "Get enough sleep",
    description: "Aim for at least 7 hours tonight",
    icon: Moon,
    color: "purple",
  },
];

const EMPTY_HABITS = {
  meals: false,
  water: false,
  workout: false,
  sleep: false,
};

function Habits() {
  const navigate = useNavigate();
  const today = useMemo(() => todayKey(), []);

  const [completed, setCompleted] = useState(EMPTY_HABITS);
  const [streak, setStreak] = useState(0);
  const [sleepHours, setSleepHours] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  const loadToday = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getTodayHabits(today);
      const progress = response?.data?.progress;
      const serverHabits = progress?.habits;

      if (serverHabits) {
        const nextHabits = { ...EMPTY_HABITS, ...serverHabits };
        setCompleted(nextHabits);

      }

      if (progress?.sleepHours !== undefined && progress.sleepHours !== null) {
        setSleepHours(String(progress.sleepHours));
      }

      const nextStreak = Number(response?.data?.streak) || 0;
      setStreak(nextStreak);
      setSavedMessage("");
    } catch (requestError) {
      // Preserve the existing local state so the page remains usable if the API is temporarily unavailable.
      setError(getApiMessage(requestError, "Could not sync today's habits."));
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadToday();
  }, [loadToday]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return undefined;

    const handleProgressUpdate = (payload) => {
      const progress = payload?.progress;
      if (!progress?.date) return;

      const dateKey = getDateKey(progress.date);
      if (dateKey !== today) return;

      if (progress.habits) {
        const nextHabits = { ...EMPTY_HABITS, ...progress.habits };
        setCompleted(nextHabits);

      }

      if (progress.sleepHours !== undefined && progress.sleepHours !== null) {
        setSleepHours(String(progress.sleepHours));
      }

      if (payload.streak !== undefined) {
        const nextStreak = Number(payload.streak) || 0;
        setStreak(nextStreak);
        }
    };

    socket.on("progress:updated", handleProgressUpdate);
    return () => socket.off("progress:updated", handleProgressUpdate);
  }, [today]);

  const persist = async (nextHabits, nextSleepHours = sleepHours) => {
    setSaving(true);
    setError("");
    setSavedMessage("");


    try {
      const response = await saveTodayHabits({
        date: today,
        habits: nextHabits,
        sleepHours:
          nextSleepHours === "" ? undefined : Number(nextSleepHours),
        workoutCompleted: nextHabits.workout,
      });

      setCompleted(nextHabits);
      const nextStreak = Number(response?.data?.streak) || 0;
      setStreak(nextStreak);
      setSavedMessage("Saved");
      return true;
    } catch (requestError) {
      setError(getApiMessage(requestError, "Could not save today's habits."));
      return false;
    } finally {
      setSaving(false);
      window.setTimeout(() => setSavedMessage(""), 1600);
    }
  };

  const completedCount = Object.values(completed).filter(Boolean).length;
  const progress = (completedCount / habitDefinitions.length) * 100;

  const toggleHabit = async (habitId) => {
    if (saving) return;

    const nextHabits = {
      ...completed,
      [habitId]: !completed[habitId],
    };

    setCompleted(nextHabits);
    await persist(nextHabits);
  };

  const adjustSleep = (delta) => {
    const current = Number(sleepHours);
    const base = Number.isFinite(current) ? current : 0;
    const next = Math.min(24, Math.max(0, Math.round((base + delta) * 2) / 2));
    setSleepHours(String(next));
  };

  const saveSleep = async () => {
    const hours = Number(sleepHours);
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      setError("Enter a sleep duration between 0 and 24 hours.");
      return;
    }

    const nextHabits = {
      ...completed,
      sleep: hours >= 7,
    };

    setCompleted(nextHabits);
    await persist(nextHabits, hours);
  };

  const completeToday = async () => {
    if (completedCount !== 4 || saving) return;
    await persist(completed, sleepHours);
  };

  const resetToday = async () => {
    if (saving) return;

    const reset = { ...EMPTY_HABITS };
    setCompleted(reset);
    setSleepHours("");
    await persist(reset, "");
  };

  return (
    <div className="habits-page">

      {/* HEADER */}

      <header className="habits-header">

        <button
          className="habits-back"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          <ArrowLeft size={16} />
          Dashboard
        </button>

        <div className="habits-brand">
          <div className="habits-brand-icon">
            <CheckCircle2 size={17} />
          </div>

          <strong>
            Daily Habits
          </strong>
        </div>

        <button
          className="habits-reset"
          onClick={resetToday}
          disabled={saving}
          aria-label="Reset today's habits"
        >
          <RotateCcw size={14} />
        </button>

      </header>

      <main className="habits-main">

        {(loading || saving || error || savedMessage) && (
          <div className="habit-sync-status" role="status">
            {loading && "Syncing today's habits..."}
            {!loading && saving && "Saving..."}
            {!loading && !saving && savedMessage && savedMessage}
            {!loading && !saving && error && error}
          </div>
        )}

        {/* HERO */}

        <section className="habits-hero">

          <div>

            <div className="habits-eyebrow">
              DAILY HABIT TRACKER
            </div>

            <h1>
              Build consistency.
              <br />
              <span>
                Become stronger.
              </span>
            </h1>

            <p>
              Small habits completed every
              day create long-term results.
            </p>

          </div>

          <div className="streak-card">

            <div className="streak-icon">
              <Flame size={25} />
            </div>

            <div>
              <span>
                CURRENT STREAK
              </span>

              <strong>
                {streak}
                <small>
                  days
                </small>
              </strong>
            </div>

          </div>

        </section>

        {/* PROGRESS */}

        <section className="habit-progress-card">

          <div className="habit-progress-top">

            <div>
              <span>
                TODAY'S PROGRESS
              </span>

              <h2>
                {completedCount}
                <small>
                  / 4 habits
                </small>
              </h2>
            </div>

            <div className="progress-percentage">
              {Math.round(progress)}%
            </div>

          </div>

          <div className="habit-progress-bar">

            <div
              style={{
                width: `${progress}%`,
              }}
            />

          </div>

          <div className="progress-message">

            {completedCount === 0 && (
              <>
                Let's get started.
              </>
            )}

            {completedCount === 1 && (
              <>
                Great start. Keep going!
              </>
            )}

            {completedCount === 2 && (
              <>
                You're halfway there!
              </>
            )}

            {completedCount === 3 && (
              <>
                One more habit to go!
              </>
            )}

            {completedCount === 4 && (
              <>
                🔥 All habits completed!
              </>
            )}

          </div>

        </section>

        {/* HABITS */}

        <section className="habits-section">

          <div className="habits-section-heading">

            <div>
              <span>
                TODAY
              </span>

              <h2>
                Your habits
              </h2>
            </div>

            <div className="today-label">
              <Clock3 size={13} />
              Today
            </div>

          </div>

          <div className="habit-list">

            {habitDefinitions.map(
              (habit) => {
                const Icon =
                  habit.icon;

                const isCompleted =
                  completed[habit.id];

                return (
                  <article
                    key={habit.id}
                    className={`habit-card ${
                      isCompleted
                        ? "habit-done"
                        : ""
                    }`}
                  >

                    <div
                      className={`habit-icon ${habit.color}`}
                    >
                      <Icon size={19} />
                    </div>

                    <div className="habit-content">

                      <div className="habit-title-row">

                        <h3>
                          {habit.title}
                        </h3>

                        {isCompleted && (
                          <span className="done-label">
                            COMPLETED
                          </span>
                        )}

                      </div>

                      <p>
                        {habit.description}
                      </p>

                    </div>

                    <button
                      className={`habit-check ${
                        isCompleted
                          ? "checked"
                          : ""
                      }`}
                      onClick={() =>
                        toggleHabit(
                          habit.id
                        )
                      }
                      disabled={saving || loading}
                    >
                      {isCompleted ? (
                        <Check size={17} />
                      ) : (
                        ""
                      )}
                    </button>

                  </article>
                );
              }
            )}

          </div>

        </section>

        {/* SLEEP */}

        <section className="sleep-card">

          <div className="sleep-card-icon">
            <Moon size={18} />
          </div>

          <div className="sleep-card-content">

            <span>
              SLEEP TRACKING
            </span>

            <strong>
              How many hours did you sleep?
            </strong>

            <p>
              Sleeping 7–9 hours can help
              support recovery and consistency.
            </p>

          </div>

          <div className="sleep-input-area">
            <div className="sleep-stepper" aria-label="Adjust sleep hours">
              <button type="button" onClick={() => adjustSleep(-0.5)} disabled={Number(sleepHours) <= 0} aria-label="Decrease sleep hours"><Minus size={15} /></button>
              <input
                type="number"
                min="0"
                max="24"
                step="0.5"
                value={sleepHours}
                onChange={(event) => setSleepHours(event.target.value)}
                placeholder="7.5"
                aria-label="Sleep hours"
              />
              <button type="button" onClick={() => adjustSleep(0.5)} disabled={Number(sleepHours) >= 24} aria-label="Increase sleep hours"><Plus size={15} /></button>
            </div>

            <span>hours</span>

            <button
              onClick={saveSleep}
              disabled={saving}
            >
              Save
            </button>
          </div>

        </section>

        {/* STREAK */}

        <section className="streak-section">

          <div className="streak-large-icon">
            <Trophy size={22} />
          </div>

          <div>

            <span>
              KEEP YOUR STREAK ALIVE
            </span>

            <h2>
              {streak} day streak
            </h2>

            <p>
              Complete all four habits today
              to build your consistency.
            </p>

          </div>

          <button
            className="streak-button"
            onClick={completeToday}
            disabled={
              completedCount !== 4 || saving || loading
            }
          >
            {completedCount === 4
              ? "Complete Day"
              : "Complete All Habits"}
          </button>

        </section>

        {/* NEXT */}

        <button
          className="habits-next-button"
          onClick={() =>
            navigate("/progress")
          }
        >
          Continue to Progress
          <ArrowRight size={17} />
        </button>

      </main>

    </div>
  );
}

export default Habits;
