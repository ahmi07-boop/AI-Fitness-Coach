import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Activity, ArrowLeft, ArrowRight, Beef, CalendarDays, CheckCircle2, Clock3, Flame, Leaf, Target, Utensils, Zap, RefreshCw } from "lucide-react";
import AIBadge from "../components/AIBadge";
import JourneyProgress from "../components/JourneyProgress";
import { generateMyPlan, getMyPlan, getPlanUsage } from "../services/planApi";
import { getApiMessage } from "../services/api";

let initialPlanGenerationPromise = null;

const goalNames = { "weight-loss": "Weight Loss", "weight-gain": "Weight Gain", "muscle-building": "Muscle Building", muscle: "Muscle Building", maintenance: "Maintenance" };

function Plan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [goal, setGoal] = useState(user?.profile?.goal || "maintenance");
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState("");
  const [usage, setUsage] = useState(null);
  const [subscriptionRequired, setSubscriptionRequired] = useState(false);
  const generationRequestInFlight = useRef(false);
  const initialGoal = useRef(goal);

  useEffect(() => {
    if (user?.profile?.goal) {
      setGoal(user.profile.goal);
      initialGoal.current = user.profile.goal;
    }
  }, [user?.profile?.goal]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const existing = await getMyPlan();
        try { setUsage(await getPlanUsage()); } catch { /* Plan generation will surface billing errors if needed. */ }
        if (existing) {
          if (mounted) { setPlan(existing); setGoal((currentGoal) => existing.goal || currentGoal); }
          return;
        }
        // React StrictMode can mount the page twice in development. A module-level
        // promise makes the initial generation request single-flight, so one visit
        // consumes exactly one free generation (4 -> 3 -> 2 -> 1 -> 0).
        if (!initialPlanGenerationPromise) {
          initialPlanGenerationPromise = generateMyPlan(initialGoal.current).finally(() => {
            initialPlanGenerationPromise = null;
          });
        }
        const generated = await initialPlanGenerationPromise;
        if (mounted) {
          setPlan(generated);
          try { setUsage(await getPlanUsage()); } catch { /* keep the generated plan visible */ }
        }
      } catch (err) {
        if (mounted) {
          if (err?.response?.status === 402 || err?.response?.data?.code === 'SUBSCRIPTION_REQUIRED') {
            setSubscriptionRequired(true);
          }
          setError(getApiMessage(err, "We could not generate your AI plan."));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const regenerate = async () => {
    if (generationRequestInFlight.current) return;
    generationRequestInFlight.current = true;
    try {
      setRegenerating(true); setError("");
      const generated = await generateMyPlan(goal);
      setPlan(generated);
      try { setUsage(await getPlanUsage()); } catch { /* keep current usage */ }
    } catch (err) {
      if (err?.response?.status === 402 || err?.response?.data?.code === 'SUBSCRIPTION_REQUIRED') setSubscriptionRequired(true);
      setError(getApiMessage(err, "We could not regenerate your AI plan."));
    } finally {
      generationRequestInFlight.current = false;
      setRegenerating(false);
    }
  };

  if (loading) return <div className="plan-page"><div className="plan-container"><JourneyProgress currentStep={4} compact /><div className="plan-hero"><div><div className="plan-eyebrow">AI PLAN GENERATION <AIBadge text="GENERATING" /></div><h1>Building your personalized plan...</h1><p>FitCoach AI is using your profile, goal, activity level and body-analysis data.</p></div></div></div></div>;

  if (subscriptionRequired) return <div className="plan-page"><div className="plan-container"><JourneyProgress currentStep={4} compact /><div className="plan-hero"><div><div className="plan-eyebrow">SUBSCRIPTION REQUIRED</div><h1>Your 4 free AI plans are used.</h1><p>Subscribe to keep generating personalized diet and workout plans. Your existing plan, progress and AI Coach remain available.</p></div></div><div className="plan-actions"><button className="secondary-button" onClick={() => navigate("/dashboard")}><ArrowLeft size={18} /> Back to Dashboard</button><button className="primary-button" onClick={() => navigate("/billing")}>View Subscription <ArrowRight size={18} /></button></div></div></div>

  if (!plan) return <div className="plan-page"><div className="plan-container"><JourneyProgress currentStep={4} compact /><div className="plan-hero"><div><div className="plan-eyebrow">AI PLAN GENERATION</div><h1>We couldn't create your plan yet.</h1><p>{error || "Please try again."}</p></div></div><div className="plan-actions"><button className="secondary-button" onClick={() => navigate("/goal")}><ArrowLeft size={18} /> Change Goal</button><button className="primary-button" onClick={regenerate} disabled={regenerating}><RefreshCw size={18} /> {regenerating ? "Generating..." : "Generate AI Plan"}</button></div></div></div>;

  const workouts = plan.workout?.weeklySplit || [];
  const meals = plan.meals || [];
  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="plan-page">
      <div className="plan-container">
        <JourneyProgress currentStep={4} compact />
        <div className="plan-header"><div className="plan-brand"><div className="plan-brand-icon"><Activity size={21} /></div><div><strong>FitCoach AI</strong><span>Personalized Fitness Plan</span></div></div><div className="plan-week"><CalendarDays size={16} /> Week 1 of 4 {usage && !usage.subscriptionActive && <span>· {usage.freeGenerationsRemaining} free left</span>}</div></div>
        <div className="plan-hero"><div><div className="plan-eyebrow">YOUR PERSONALIZED PLAN <AIBadge text="AI GENERATED" /></div><h1>Let's get started, {firstName}.</h1><p>{plan.summary || `Your plan is optimized around your primary goal: ${goalNames[plan.goal] || plan.goal}.`}</p></div><div className="plan-goal-badge"><Target size={18} /> {goalNames[plan.goal] || plan.goal}</div></div>
        {error && <div className="plan-disclaimer" style={{ marginBottom: 20 }}>{error}</div>}

        <div className="plan-section"><div className="plan-section-header"><div><div className="plan-section-title-row"><h2>Daily Targets</h2><AIBadge text="AI GENERATED" /></div><p>Targets generated from your profile, activity and selected goal.</p></div></div><div className="target-grid"><TargetCard icon={<Flame size={21} />} title="Calories" value={Math.round(plan.calories)} unit="kcal" /><TargetCard icon={<Beef size={21} />} title="Protein" value={Math.round(plan.protein)} unit="g" /><TargetCard icon={<Zap size={21} />} title="Carbohydrates" value={Math.round(plan.carbs)} unit="g" /><TargetCard icon={<Leaf size={21} />} title="Healthy Fats" value={Math.round(plan.fat)} unit="g" /></div></div>

        <div className="plan-section"><div className="plan-section-header"><div><div className="plan-section-title-row"><h2>Weekly Workout</h2><AIBadge text="AI GENERATED" /></div><p>{plan.workout?.daysPerWeek || 0} focused training days this week.</p></div><div className="workout-count">{plan.workout?.daysPerWeek || 0} workouts</div></div><div className="workout-list">{workouts.map((workout) => <WorkoutRow key={`${workout.day}-${workout.title}`} workout={workout} />)}</div></div>

        <div className="plan-section"><div className="plan-section-header"><div><div className="plan-section-title-row"><h2>Personalized Nutrition</h2><AIBadge text="AI GENERATED" /></div><p>{Number(plan.hydrationLiters || 2).toFixed(1)} L daily hydration target.</p></div><Utensils size={21} /></div><div className="nutrition-grid">{meals.map((meal) => <NutritionCard key={`${meal.type}-${meal.name}`} meal={meal} />)}</div></div>

        {plan.notes?.length > 0 && <div className="plan-ai-note"><div className="plan-ai-icon"><Zap size={20} /></div><div><strong>AI plan notes</strong><ul>{plan.notes.map((note, index) => <li key={index}>{note}</li>)}</ul></div></div>}

        <div className="plan-actions"><button className="secondary-button" onClick={() => navigate("/goal")}><ArrowLeft size={18} /> Change Goal</button><button className="secondary-button" onClick={regenerate} disabled={regenerating}><RefreshCw size={18} /> {regenerating ? "Regenerating..." : "Regenerate AI Plan"}</button><button className="primary-button plan-continue-button" onClick={() => navigate("/dashboard")}>Continue to Dashboard <ArrowRight size={18} /></button></div>
        <div className="plan-disclaimer"><CheckCircle2 size={15} /> AI-generated fitness guidance is for general fitness purposes and is not medical advice.</div>
      </div>
    </div>
  );
}

function TargetCard({ icon, title, value, unit }) { return <div className="target-card"><div className="target-icon">{icon}</div><div className="target-title">{title}</div><div className="target-value">{value}<span>{unit}</span></div></div>; }
function WorkoutRow({ workout }) { const isRest = workout.type?.toLowerCase() === "rest"; const isRecovery = workout.type?.toLowerCase() === "recovery"; return <div className={`workout-row ${isRest ? "workout-rest" : ""}`}><div className="workout-day">{workout.day}</div><div className="workout-main"><strong>{workout.title}</strong><span>{workout.type}</span></div><div className="workout-duration">{!isRest && <Clock3 size={15} />}{workout.duration}</div><div className={`workout-status ${isRest ? "status-rest" : isRecovery ? "status-recovery" : ""}`}>{isRest ? "Rest" : isRecovery ? "Recovery" : "Workout"}</div></div>; }
function NutritionCard({ meal }) { return <div className="nutrition-card"><div className="nutrition-card-icon"><Utensils size={17} /></div><div><strong>{meal.type}: {meal.name}</strong><p>{meal.time} · {Math.round(meal.calories)} kcal · {Math.round(meal.protein)}g protein · {Math.round(meal.carbs)}g carbs</p><p>{meal.ingredients?.slice(0, 5).join(", ")}</p>{meal.notes && <small>{meal.notes}</small>}</div></div>; }

export default Plan;
