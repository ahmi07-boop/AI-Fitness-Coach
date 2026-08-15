import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import JourneyProgress from "../components/JourneyProgress";
import {
  ArrowLeft,
  ArrowRight,
  Flame,
  TrendingUp,
  Dumbbell,
  ShieldCheck,
  Check,
  Target,
} from "lucide-react";

const goals = [
  {
    id: "weight-loss",
    title: "Weight Loss",
    description:
      "Lose body fat, improve fitness and build healthier habits.",
    icon: Flame,
  },
  {
    id: "weight-gain",
    title: "Weight Gain",
    description:
      "Increase healthy body weight with nutrition and strength training.",
    icon: TrendingUp,
  },
  {
    id: "muscle-building",
    title: "Muscle Building",
    description:
      "Build strength, muscle mass and improve overall body composition.",
    icon: Dumbbell,
  },
  {
    id: "maintenance",
    title: "Maintenance",
    description:
      "Maintain your current fitness level and build consistent habits.",
    icon: ShieldCheck,
  },
];

function Goal() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();

  const [selectedGoal, setSelectedGoal] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const savedGoal = user?.profile?.goal;
    if (savedGoal) setSelectedGoal(savedGoal);
  }, [user?.profile?.goal]);

  const selectGoal = (goalId) => setSelectedGoal(goalId);

  const continueToPlan = async () => {
    if (!selectedGoal) {
      alert("Please select your primary fitness goal.");
      return;
    }

    try {
      setSaving(true);
      await updateProfile({ goal: selectedGoal });
      navigate("/plan");
    } catch (error) {
      alert(error.message || "Could not save your goal.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="goal-page">

      <div className="goal-container">

        {/* Header */}

        <div className="goal-header">

          <div className="goal-brand">

            <div className="goal-brand-icon">
              <Target size={20} />
            </div>

            <div>
              <strong>FitCoach AI</strong>

              <span>
                Personalized Fitness Journey
              </span>
            </div>

          </div>

        </div>

        <JourneyProgress currentStep={3} />

        {/* Main Content */}

        <div className="goal-content">

          <div className="goal-heading">

            <div className="goal-heading-icon">
              <Target size={27} />
            </div>

            <div>

              <div className="goal-eyebrow">
                YOUR PRIMARY GOAL
              </div>

              <h1>
                What's your goal?
              </h1>

              <p>
                Choose the primary goal you want
                to focus on during your fitness journey.
              </p>

            </div>

          </div>

          {/* Goal Cards */}

          <div className="goal-grid">

            {goals.map((goal) => {

              const Icon = goal.icon;

              const isSelected =
                selectedGoal === goal.id;

              return (
                <button
                  key={goal.id}
                  type="button"
                  className={`goal-card ${
                    isSelected
                      ? "goal-card-selected"
                      : ""
                  }`}
                  onClick={() =>
                    selectGoal(goal.id)
                  }
                >

                  {isSelected && (
                    <div className="goal-check">
                      <Check size={16} />
                    </div>
                  )}

                  <div className="goal-icon">
                    <Icon size={28} />
                  </div>

                  <h2>
                    {goal.title}
                  </h2>

                  <p>
                    {goal.description}
                  </p>

                  <div className="goal-select-text">
                    {isSelected
                      ? "Selected"
                      : "Select goal"}
                  </div>

                </button>
              );
            })}

          </div>

          {/* Selected goal message */}

          <div className="goal-selection-info">

            <div className="goal-info-icon">
              <Target size={18} />
            </div>

            <div>

              <strong>
                {selectedGoal
                  ? "Goal selected"
                  : "Choose one primary goal"}
              </strong>

              <p>
                {selectedGoal
                  ? "We'll use this goal to personalize your fitness plan."
                  : "You can change your goal later from your profile."}
              </p>

            </div>

          </div>

          {/* Navigation */}

          <div className="goal-actions">

            <button
              className="secondary-button"
              onClick={() =>
                navigate("/analysis")
              }
            >
              <ArrowLeft size={18} />
              Back
            </button>

            <button
              className="primary-button goal-continue-button"
              onClick={continueToPlan}
            >
              {saving ? "Saving goal..." : "Continue to Plan"}
              {!saving && <ArrowRight size={18} />}
            </button>

          </div>

        </div>

        <p className="goal-footer">
          Your goal helps FitCoach AI personalize
          your recommendations.
        </p>

      </div>

    </div>
  );
}

export default Goal;