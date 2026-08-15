import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  Flame,
  Leaf,
  Plus,
  RotateCcw,
  Target,
  Utensils,
} from "lucide-react";
import AIBadge from "../components/AIBadge";
import { getMyPlan } from "../services/planApi";
import { getTodayHabits, saveTodayNutrition } from "../services/habitApi";
import { todayKey } from "../utils/date";


const goalNames = {
  "weight-loss": "Weight Loss",
  "weight-gain": "Weight Gain",
  "muscle-building": "Muscle Building",
  maintenance: "Maintenance",
};

function Nutrition() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [planData, setPlanData] = useState(null);
  const [planError, setPlanError] = useState("");
  const goal = user?.profile?.goal || "maintenance";
  const [completedMeals, setCompletedMeals] = useState([]);
  const [water, setWater] = useState(0);

  useEffect(() => {
    let mounted = true;
    getMyPlan().then((data) => { if (mounted) setPlanData(data || null); }).catch((error) => { if (mounted) setPlanError(error.response?.data?.message || "Your personalized plan could not be loaded."); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    getTodayHabits(todayKey())
      .then((response) => {
        if (!mounted) return;
        const progress = response?.data?.progress;
        const nutrition = progress?.nutrition;
        setCompletedMeals(Array.isArray(nutrition?.completedMealIds) ? nutrition.completedMealIds : []);
        setWater(Number(progress?.waterLiters || 0));
      })
      .catch(() => {
        if (mounted) {
          setCompletedMeals([]);
          setWater(0);
        }
      });

    return () => { mounted = false; };
  }, []);

  const plan = planData ? {
    calories: Number(planData.calories || 0),
    protein: Number(planData.protein || 0),
    carbs: Number(planData.carbs || 0),
    fats: Number(planData.fat || 0),
    meals: (planData.meals || []).map((meal, index) => ({ ...meal, id: meal.id || String(index), fats: Number(meal.fats ?? meal.fat ?? 0) })),
  } : null;

  if (!plan) return <div className="nutrition-page"><div className="nutrition-container"><div className="nutrition-hero"><h1>{planError || "Your personalized nutrition plan is not available yet."}</h1><p>Generate your AI plan first to see meals, calories and macros.</p></div><button className="primary-button" onClick={() => navigate("/plan")}>Open My Plan</button></div></div>;

  const firstName =
    user?.name?.split(" ")[0] ||
    "there";

  const goalName =
    goalNames[goal] ||
    "Maintenance";

  const completedMealObjects =
    plan.meals.filter((meal) =>
      completedMeals.includes(
        meal.id
      )
    );

  const caloriesConsumed =
    completedMealObjects.reduce(
      (total, meal) =>
        total + meal.calories,
      0
    );

  const proteinConsumed =
    completedMealObjects.reduce(
      (total, meal) =>
        total + meal.protein,
      0
    );

  const carbsConsumed =
    completedMealObjects.reduce(
      (total, meal) =>
        total + meal.carbs,
      0
    );

  const fatsConsumed =
    completedMealObjects.reduce(
      (total, meal) =>
        total + meal.fats,
      0
    );

  const calorieProgress = Math.min(
    100,
    (caloriesConsumed /
      plan.calories) *
      100
  );

  const persistNutrition = async (nextMeals, nextWater) => {
    const mealObjects = plan.meals.filter((meal) => nextMeals.includes(meal.id));
    await saveTodayNutrition({
      date: todayKey(),
      completedMealIds: nextMeals,
      caloriesConsumed: mealObjects.reduce((sum, meal) => sum + Number(meal.calories || 0), 0),
      proteinConsumed: mealObjects.reduce((sum, meal) => sum + Number(meal.protein || 0), 0),
      carbsConsumed: mealObjects.reduce((sum, meal) => sum + Number(meal.carbs || 0), 0),
      fatConsumed: mealObjects.reduce((sum, meal) => sum + Number(meal.fats || 0), 0),
      waterLiters: nextWater,
    });
  };

  const toggleMeal = async (mealId) => {
    const previous = completedMeals;
    const updated = previous.includes(mealId)
      ? previous.filter((id) => id !== mealId)
      : [...previous, mealId];
    setCompletedMeals(updated);
    try {
      await persistNutrition(updated, water);
    } catch {
      setCompletedMeals(previous);
    }
  };

  const setWaterAmount = async (next) => {
    const previous = water;
    const normalized = Math.max(0, Math.min(8, Number(next)));
    setWater(normalized);
    try {
      await persistNutrition(completedMeals, normalized);
    } catch {
      setWater(previous);
    }
  };

  const addWater = async () => {
    await setWaterAmount(water + 1);
  };

  const resetNutrition = async () => {
    const previousMeals = completedMeals;
    const previousWater = water;
    setCompletedMeals([]);
    setWater(0);
    try {
      await persistNutrition([], 0);
    } catch {
      setCompletedMeals(previousMeals);
      setWater(previousWater);
    }
  };

  return (
    <div className="nutrition-page">

      {/* HEADER */}

      <header className="nutrition-header">

        <button
          className="nutrition-back"
          onClick={() =>
            navigate("/dashboard")
          }
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="nutrition-brand">
          <div className="nutrition-brand-icon">
            <Utensils size={17} />
          </div>

          <strong>
            Nutrition
          </strong>
        </div>

        <button
          className="nutrition-reset"
          onClick={resetNutrition}
          title="Reset today's nutrition"
        >
          <RotateCcw size={15} />
        </button>

      </header>

      <main className="nutrition-main">

        {/* HERO */}

        <section className="nutrition-hero">

          <div>
            <div className="nutrition-eyebrow">
              PERSONALIZED NUTRITION
              <AIBadge text="AI GENERATED" />
            </div>

            <h1>
              Eat smarter,
              <br />
              <span>
                {firstName}.
              </span>
            </h1>

            <p>
              Your meal recommendations
              are aligned with your{" "}
              <strong>
                {goalName}
              </strong>{" "}
              goal.
            </p>
          </div>

          <div className="nutrition-goal-card">

            <Target size={17} />

            <div>
              <span>
                CURRENT GOAL
              </span>

              <strong>
                {goalName}
              </strong>
            </div>

          </div>

        </section>

        {/* CALORIE OVERVIEW */}

        <section className="nutrition-overview">

          <div className="calorie-card">

            <div className="calorie-card-top">

              <div>
                <span>
                  DAILY CALORIE TARGET
                </span>

                <h2>
                  {plan.calories}
                  <small>
                    kcal
                  </small>
                </h2>
              </div>

              <div className="calorie-icon">
                <Flame size={20} />
              </div>

            </div>

            <div className="calorie-bar">

              <div
                style={{
                  width: `${calorieProgress}%`,
                }}
              />

            </div>

            <div className="calorie-bar-labels">

              <span>
                {caloriesConsumed} kcal
                consumed
              </span>

              <strong>
                {Math.max(
                  0,
                  plan.calories -
                    caloriesConsumed
                )}{" "}
                remaining
              </strong>

            </div>

          </div>

          <div className="macro-card">

            <MacroItem
              label="Protein"
              value={proteinConsumed}
              target={plan.protein}
              unit="g"
            />

            <MacroItem
              label="Carbs"
              value={carbsConsumed}
              target={plan.carbs}
              unit="g"
            />

            <MacroItem
              label="Fats"
              value={fatsConsumed}
              target={plan.fats}
              unit="g"
            />

          </div>

        </section>

        {/* WATER */}

        <section className="water-card">

          <div className="water-left">

            <div className="water-icon">
              💧
            </div>

            <div>
              <span>
                HYDRATION
              </span>

              <strong>
                {water} / 8 glasses
              </strong>
            </div>

          </div>

          <div className="water-glasses">

            {Array.from(
              { length: 8 },
              (_, index) => (
                <button
                  key={index}
                  className={
                    index < water
                      ? "water-glass filled"
                      : "water-glass"
                  }
                  onClick={() => {
                    const next =
                      index + 1;

                    setWater(next);
                  }}
                >
                  💧
                </button>
              )
            )}

          </div>

          <button
            className="water-add"
            onClick={addWater}
            disabled={water >= 8}
          >
            <Plus size={15} />
            Add
          </button>

        </section>

        {/* MEALS */}

        <section className="meals-section">

          <div className="section-heading">

            <div>
              <div className="nutrition-plan-label">
                <span>
                  TODAY'S PLAN
                </span>
                <AIBadge text="AI GENERATED" />
              </div>

              <h2>
                Your meals
              </h2>
            </div>

            <div className="meal-count">
              {completedMeals.length}
              /{plan.meals.length}{" "}
              complete
            </div>

          </div>

          <div className="meal-list">

            {plan.meals.map(
              (meal) => {
                const completed =
                  completedMeals.includes(
                    meal.id
                  );

                return (
                  <MealCard
                    key={meal.id}
                    meal={meal}
                    completed={completed}
                    toggleMeal={
                      toggleMeal
                    }
                  />
                );
              }
            )}

          </div>

        </section>

        {/* NUTRITION NOTE */}

        <section className="nutrition-note">

          <div className="nutrition-note-icon">
            <Leaf size={18} />
          </div>

          <div>

            <strong>
              Personalized for your goal
            </strong>

            <p>
              Your meals are structured
              around your selected goal,
              with balanced calories and
              macronutrients.
            </p>

          </div>

        </section>

        <button
          className="nutrition-next-button"
          onClick={() =>
            navigate("/habits")
          }
        >
          Continue to Progress
          <ArrowRight size={17} />
        </button>

      </main>

    </div>
  );
}

/* =========================================
   MEAL CARD
========================================= */

function MealCard({
  meal,
  completed,
  toggleMeal,
}) {
  return (
    <article
      className={`meal-card ${
        completed
          ? "meal-completed"
          : ""
      }`}
    >

      <div className="meal-time">
        <Clock size={14} />
        {meal.time}
      </div>

      <div className="meal-main">

        <div className="meal-type">
          {meal.type}
        </div>

        <h3>
          {meal.name}
        </h3>

        <div className="meal-ingredients">

          {meal.ingredients.map(
            (ingredient) => (
              <span
                key={ingredient}
              >
                {ingredient}
              </span>
            )
          )}

        </div>

      </div>

      <div className="meal-nutrition">

        <div>
          <strong>
            {meal.calories}
          </strong>

          <span>
            kcal
          </span>
        </div>

        <div>
          <strong>
            {meal.protein}g
          </strong>

          <span>
            protein
          </span>
        </div>

      </div>

      <button
        className={`meal-complete-button ${
          completed
            ? "completed"
            : ""
        }`}
        onClick={() =>
          toggleMeal(meal.id)
        }
      >
        {completed ? (
          <>
            <CheckCircle2 size={16} />
            Done
          </>
        ) : (
          <>
            <Check size={16} />
            Complete
          </>
        )}
      </button>

    </article>
  );
}

/* =========================================
   MACRO
========================================= */

function MacroItem({
  label,
  value,
  target,
  unit,
}) {
  const percentage =
    Math.min(
      100,
      (value / target) * 100
    );

  return (
    <div className="macro-item">

      <div className="macro-top">

        <span>
          {label}
        </span>

        <strong>
          {value}
          {unit}{" "}
          <small>
            / {target}
            {unit}
          </small>
        </strong>

      </div>

      <div className="macro-bar">

        <div
          style={{
            width: `${percentage}%`,
          }}
        />

      </div>

    </div>
  );
}

export default Nutrition;
