import useScrollShadows from "../hooks/useScrollShadows";
import { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { getMyPlan } from "../services/planApi";
import { getTodayHabits, getProgressHistory } from "../services/habitApi";
import { getAnalysisHistory } from "../services/analysisApi";
import { getApiMessage } from "../services/api";
import { useAuth } from "../auth/AuthContext";
import JourneyProgress from "../components/JourneyProgress";
import { getDateKey, todayKey } from "../utils/date";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  BarChart3,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Flame,
  Footprints,
  HeartPulse,
  Home,
  MessageCircle,
  Play,
  Target,
  Trophy,
  User,
  Utensils,
  Zap,
  LogOut,
} from "lucide-react";

const goalNames = {
  "weight-loss": "Weight Loss",
  "weight-gain": "Weight Gain",
  "muscle-building": "Muscle Building",
  maintenance: "Maintenance",
};



const getDayKey = (date = new Date()) => getDateKey(date, import.meta.env.VITE_APP_TIMEZONE || "UTC");

function isToday(value) {
  if (!value) return false;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;

  return getDayKey(date) === getDayKey();
}

function calculateFitnessScore(analysis, habitProgress, workoutCount) {
  const posture = Number(analysis?.postureScore) || 0;
  const symmetry = Number(analysis?.symmetryScore) || 0;
  const habits = Number(habitProgress) || 0;
  const workouts = Math.min(100, Number(workoutCount) * 10);

  const available = [posture, symmetry, habits, workouts].filter(
    (value) => value > 0
  );

  if (!available.length) return 0;

  return Math.round(
    available.reduce((sum, value) => sum + value, 0) / available.length
  );
}

function Dashboard() {
  const sidebarRef = useRef(null);
  const { showTopShadow, showBottomShadow } = useScrollShadows(sidebarRef);

  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const goal = user?.profile?.goal || "maintenance";
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const [streak, setStreak] = useState(0);
  const [habits, setHabits] = useState({
    meals: false,
    water: false,
    workout: false,
    sleep: false,
  });
  const [nutrition, setNutrition] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fats: 0,
    water: 0,
  });
  const [analysis, setAnalysis] = useState(null);
  const [workoutCount, setWorkoutCount] = useState(0);
  const [lastWorkout, setLastWorkout] = useState(null);
  const [planData, setPlanData] = useState(null);
  const [progressEntries, setProgressEntries] = useState([]);
  const [dashboardError, setDashboardError] = useState("");

  const loadDashboardData = async () => {
    try {
      const [planResponse, todayResponse, progressResponse, analysisResponse] = await Promise.all([
        getMyPlan(),
        getTodayHabits(),
        getProgressHistory(),
        getAnalysisHistory(),
      ]);

      const remotePlan = planResponse || null;
      const entries = progressResponse?.data?.progress || progressResponse?.progress || [];
      const today = todayResponse?.data?.progress || todayResponse?.progress || null;
      const latestAnalysis = analysisResponse?.data?.[0] || null;
      setPlanData(remotePlan);
      setProgressEntries(entries);
      setStreak(todayResponse?.data?.streak || todayResponse?.streak || 0);
      setAnalysis(latestAnalysis);

      const todayHabits = today?.habits || { meals: false, water: false, workout: false, sleep: false };
      setHabits(todayHabits);
      setWorkoutComplete(Boolean(today?.workoutCompleted || todayHabits.workout));

      const sortedWorkouts = entries
        .filter((item) => item.workoutCompleted)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
      const currentWeek = getCurrentWeekEntries(entries);
      setWorkoutCount(currentWeek.filter((item) => item.workoutCompleted).length);
      setLastWorkout(sortedWorkouts[0] || null);
      setNutrition({
        calories: Number(today?.nutrition?.caloriesConsumed || today?.calories || 0),
        protein: Number(today?.nutrition?.proteinConsumed || 0),
        carbs: Number(today?.nutrition?.carbsConsumed || 0),
        fats: Number(today?.nutrition?.fatConsumed || 0),
        water: Number(today?.waterLiters || 0),
        targetCalories: Number(remotePlan?.calories || 0),
      });
      setDashboardError("");
    } catch (error) {
      setDashboardError(getApiMessage(error, "Some dashboard data could not be loaded."));
    }
  };

  useEffect(() => {
    loadDashboardData();

    const handleStorage = () => { loadDashboardData(); };
    window.addEventListener("storage", handleStorage);

    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const plan = useMemo(() => {
    if (planData) {
      const todayName = new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: import.meta.env.VITE_APP_TIMEZONE || "UTC" }).format(new Date()).toLowerCase();
      const todayWorkout = planData.workout?.weeklySplit?.find((day) =>
        day.type?.toLowerCase() !== "rest" && String(day.day || "").toLowerCase().includes(todayName)
      );
      const fallbackWorkout = planData.workout?.weeklySplit?.find((day) => day.type?.toLowerCase() !== "rest");
      const workoutDay = todayWorkout || fallbackWorkout;
      return {
        calories: Number(planData.calories || 0),
        protein: Number(planData.protein || 0),
        carbs: Number(planData.carbs || 0),
        fats: Number(planData.fat || 0),
        workout: workoutDay?.title || "Personalized Workout",
        duration: workoutDay?.duration || "—",
      };
    }
    return { calories: 0, protein: 0, carbs: 0, fats: 0, workout: "Your personalized workout", duration: "—" };
  }, [planData]);

  const firstName = user?.name?.split(" ")[0] || "there";

  const completedHabitCount = Object.values(habits).filter(Boolean).length;
  const habitProgress = Math.round((completedHabitCount / 4) * 100);

  const nutritionProgress = Math.min(
    100,
    Math.round((nutrition.calories / plan.calories) * 100)
  );

  const fitnessScore = calculateFitnessScore(
    analysis,
    habitProgress,
    workoutCount
  );

  const weeklyEntries = getCurrentWeekEntries(progressEntries);
  const weeklyCompletion = Math.round(
    (weeklyEntries.reduce((sum, item) => sum + Number(item.habitCompletionPercent || 0), 0) / 7)
  );

  const todayLabel = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    timeZone: import.meta.env.VITE_APP_TIMEZONE || "UTC",
  }).format(new Date());

  const workoutIsToday = isToday(lastWorkout?.date);

  return (
    <div className="dashboard-page">
      <aside ref={sidebarRef} className="app-sidebar dashboard-sidebar">
        <div className="dashboard-logo">
          <div className="dashboard-logo-icon">
            <Activity size={21} />
          </div>
          <div>
            <strong>FitCoach AI</strong>
            <span>Smart Fitness</span>
          </div>
        </div>

        <nav className="dashboard-nav">
          <button className="dashboard-nav-item active">
            <Home size={18} />
            Dashboard
          </button>
          <button
            className="dashboard-nav-item"
            onClick={() => navigate("/plan")}
          >
            <CalendarDays size={18} />
            My Plan
          </button>
          <button
            className="dashboard-nav-item"
            onClick={() => navigate("/progress")}
          >
            <BarChart3 size={18} />
            Progress
          </button>
          <button
            className="dashboard-nav-item"
            onClick={() => navigate("/coach")}
          >
            <MessageCircle size={18} />
            AI Coach
          </button>
        </nav>

        <div className="dashboard-sidebar-bottom">
          <button
            className="dashboard-nav-item"
            onClick={() => navigate("/profile")}
          >
            <User size={18} />
            Profile
          </button>
          <button
            className="dashboard-nav-item dashboard-signout-button"
            onClick={() => {
              logout();
              navigate("/login", { replace: true });
            }}
          >
            <LogOut size={18} />
            Sign out
          </button>
          <div className="dashboard-user-mini">
            <div className="dashboard-avatar">
              {firstName.charAt(0).toUpperCase()}
            </div>
            <div>
              <strong>{firstName}</strong>
              <span>{goalNames[goal]}</span>
            </div>
          </div>
        </div>
      </aside>

      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div className="dashboard-mobile-logo">
            <div className="dashboard-logo-icon">
              <Activity size={19} />
            </div>
            <strong>FitCoach AI</strong>
          </div>
          <div className="dashboard-top-actions">
            
            <div className="dashboard-date">
              <CalendarDays size={15} />
              Today
            </div>
          </div>
        </header>

        <div className="dashboard-content">
          <JourneyProgress currentStep={5} compact />
          {dashboardError && <div className="dashboard-disclaimer">{dashboardError}</div>}
          <section className="dashboard-welcome">
            <div>
              <div className="dashboard-eyebrow">YOUR FITNESS DASHBOARD</div>
              <h1>Good morning, {firstName}! 👋</h1>
              <p>
                Stay consistent today and keep moving toward your {goalNames[
                  goal
                ].toLowerCase()} goal.
              </p>
            </div>
            <div className="dashboard-goal-pill">
              <Target size={16} />
              {goalNames[goal]}
            </div>
          </section>

          <section className="dashboard-stats">
            <StatCard
              icon={<Flame size={20} />}
              title="Calories"
              value={plan.calories}
              unit="kcal"
              note={`${nutritionProgress}% tracked`}
            />
            <StatCard
              icon={<Footprints size={20} />}
              title="Workout Streak"
              value={streak}
              unit="days"
              note={streak > 0 ? "Keep it going!" : "Start your streak today"}
            />
            <StatCard
              icon={<Trophy size={20} />}
              title="Weekly Progress"
              value={weeklyCompletion}
              unit="%"
              note={`${completedHabitCount} of 4 habits today`}
            />
            <StatCard
              icon={<HeartPulse size={20} />}
              title="Fitness Score"
              value={fitnessScore || "--"}
              unit={fitnessScore ? "/100" : ""}
              note={
                analysis
                  ? "Based on AI analysis + tracking"
                  : "Complete body analysis to score"
              }
            />
          </section>

          <div className="dashboard-grid">
            <section className="dashboard-card today-workout-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="card-label">TODAY'S WORKOUT</div>
                  <h2>{plan.workout}</h2>
                </div>
                <div className="workout-card-icon">
                  <Activity size={21} />
                </div>
              </div>

              <div className="workout-meta">
                <span>
                  <CalendarDays size={14} />
                  {todayLabel}
                </span>
                <span>
                  <Activity size={14} />
                  Strength
                </span>
                <span>
                  <Zap size={14} />
                  {plan.duration}
                </span>
              </div>

              <div className="workout-exercises">
                <Exercise number="01" title="Warm-up" detail="5 min" />
                <Exercise
                  number="02"
                  title="Main Strength Circuit"
                  detail="30 min"
                />
                <Exercise number="03" title="Core Training" detail="5 min" />
                <Exercise number="04" title="Cool Down" detail="5 min" />
              </div>

              <button
                className={`workout-start-button ${
                  workoutComplete || workoutIsToday
                    ? "workout-complete-button"
                    : ""
                }`}
                onClick={() => navigate("/workout")}
              >
                {workoutComplete || workoutIsToday ? (
                  <>
                    <CheckCircle2 size={19} />
                    Workout Completed
                  </>
                ) : (
                  <>
                    <Play size={18} fill="currentColor" />
                    Start Today's Workout
                  </>
                )}
              </button>
            </section>

            <section className="dashboard-card nutrition-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="card-label">DAILY NUTRITION</div>
                  <h2>Nutrition Targets</h2>
                </div>
                <div className="nutrition-card-icon-main">
                  <Utensils size={20} />
                </div>
              </div>

              <div className="calorie-ring">
                <div className="calorie-ring-inner">
                  <strong>{nutrition.calories || plan.calories}</strong>
                  <span>{nutrition.calories ? "kcal tracked" : "kcal target"}</span>
                </div>
              </div>

              <div className="macro-list">
                <MacroRow
                  label="Protein"
                  value={`${plan.protein}g`}
                  percent={`${Math.min(
                    100,
                    Math.round((nutrition.protein / plan.protein) * 100)
                  ) || 0}%`}
                />
                <MacroRow
                  label="Carbohydrates"
                  value={`${plan.carbs}g`}
                  percent={`${Math.min(
                    100,
                    Math.round((nutrition.carbs / plan.carbs) * 100)
                  ) || 0}%`}
                />
                <MacroRow
                  label="Healthy Fats"
                  value={`${plan.fats}g`}
                  percent={`${Math.min(
                    100,
                    Math.round((nutrition.fats / plan.fats) * 100)
                  ) || 0}%`}
                />
              </div>

              <button
                className="text-action-button"
                onClick={() => navigate("/plan")}
              >
                View full nutrition plan
                <ChevronRight size={16} />
              </button>
            </section>
          </div>

          <div className="dashboard-bottom-grid">
            <section className="dashboard-card progress-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="card-label">THIS WEEK</div>
                  <h2>Weekly Activity</h2>
                </div>
                <button
                  className="small-link"
                  onClick={() => navigate("/progress")}
                >
                  View details
                  <ArrowRight size={14} />
                </button>
              </div>

              <div className="weekly-bars">
                {getWeeklyBars(progressEntries).map((day) => (
                  <DayBar
                    key={`${day.day}-${day.date}`}
                    day={day.day}
                    value={day.value}
                    completed={day.completed}
                  />
                ))}
              </div>

              <div className="weekly-summary">
                <div>
                  <strong>{workoutCount}</strong>
                  <span>Workouts</span>
                </div>
                <div>
                  <strong>{
                    lastWorkout?.duration
                      ? `${(Number(lastWorkout.duration) / 3600).toFixed(1)}h`
                      : "0h"
                  }</strong>
                  <span>Last training</span>
                </div>
                <div>
                  <strong>{weeklyCompletion}%</strong>
                  <span>Completion</span>
                </div>
              </div>
            </section>

            <section className="dashboard-card quick-actions-card">
              <div className="dashboard-card-header">
                <div>
                  <div className="card-label">FITNESS TOOLS</div>
                  <h2>Jump back into your fitness journey</h2>
                </div>
              </div>

              <div className="quick-actions">
                <QuickAction
                  icon={<BrainCircuit size={19} />}
                  title="Body Analysis"
                  text="Review your AI body insights"
                  onClick={() => navigate("/analysis")}
                />
                <QuickAction
                  icon={<MessageCircle size={19} />}
                  title="AI Chat"
                  text="Ask your fitness AI"
                  onClick={() => navigate("/chat")}
                />
                <QuickAction
                  icon={<Target size={19} />}
                  title="Goal"
                  text="Update your fitness objective"
                  onClick={() => navigate("/goal")}
                />
                <QuickAction
                  icon={<CheckCircle2 size={19} />}
                  title="Habits"
                  text="Track today's healthy habits"
                  onClick={() => navigate("/habits")}
                />
                <QuickAction
                  icon={<Utensils size={19} />}
                  title="Nutrition"
                  text="View meals and macros"
                  onClick={() => navigate("/nutrition")}
                />
                <QuickAction
                  icon={<Activity size={19} />}
                  title="Workout"
                  text="Start your workout plan"
                  onClick={() => navigate("/workout")}
                />
              </div>
            </section>
          </div>

          <section className="dashboard-motivation">
            <div className="motivation-icon">
              <Flame size={21} />
            </div>
            <div>
              <strong>Consistency beats perfection.</strong>
              <p>You're building a healthier version of yourself one day at a time.</p>
            </div>
            <div className="motivation-streak">
              <strong>{streak}</strong>
              <span>day streak</span>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function getCurrentWeekEntries(entries = []) {
  const nowKey = todayKey();
  const base = new Date(`${nowKey}T12:00:00Z`);
  const mondayOffset = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - mondayOffset);
  const weekKeys = new Set(Array.from({ length: 7 }, (_, index) => {
    const day = new Date(base);
    day.setUTCDate(base.getUTCDate() + index);
    return getDateKey(day, import.meta.env.VITE_APP_TIMEZONE || "UTC");
  }));
  return entries.filter((item) => weekKeys.has(getDateKey(item.date, import.meta.env.VITE_APP_TIMEZONE || "UTC")));
}

function getWeeklyBars(progressEntries = []) {
  const nowKey = todayKey();
  const base = new Date(`${nowKey}T12:00:00Z`);
  const mondayOffset = (base.getUTCDay() + 6) % 7;
  base.setUTCDate(base.getUTCDate() - mondayOffset);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(base);
    date.setUTCDate(base.getUTCDate() + index);
    const key = getDateKey(date, import.meta.env.VITE_APP_TIMEZONE || "UTC");
    const entry = progressEntries.find((item) => getDateKey(item.date, import.meta.env.VITE_APP_TIMEZONE || "UTC") === key);
    const completed = Boolean(entry?.workoutCompleted);
    return {
      date: key,
      day: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: import.meta.env.VITE_APP_TIMEZONE || "UTC" }).format(date).slice(0, 1),
      value: completed ? 100 : 0,
      completed,
    };
  });
}

function StatCard({ icon, title, value, unit, note }) {
  return (
    <div className="dashboard-stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-title">{title}</div>
      <div className="stat-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

function Exercise({ number, title, detail }) {
  return (
    <div className="exercise-row">
      <div className="exercise-number">{number}</div>
      <div className="exercise-info">
        <strong>{title}</strong>
        <span>{detail}</span>
      </div>
      <Check size={16} />
    </div>
  );
}

function MacroRow({ label, value, percent }) {
  return (
    <div className="macro-row">
      <div className="macro-header">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <div className="macro-track">
        <div className="macro-fill" style={{ width: percent }} />
      </div>
    </div>
  );
}

function DayBar({ day, value, completed }) {
  return (
    <div className="day-bar-wrapper">
      <div className="day-bar">
        <div
          className={`day-bar-fill ${completed ? "day-completed" : ""}`}
          style={{ height: `${Math.max(value, 8)}%` }}
        />
      </div>
      <span>{day}</span>
    </div>
  );
}

function QuickAction({ icon, title, text, onClick }) {
  return (
    <button className="quick-action" onClick={onClick}>
      <div className="quick-action-icon">{icon}</div>
      <div>
        <strong>{title}</strong>
        <span>{text}</span>
      </div>
      <ChevronRight size={16} />
    </button>
  );
}

export default Dashboard;
