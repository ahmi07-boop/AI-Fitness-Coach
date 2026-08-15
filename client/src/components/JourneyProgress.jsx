import { Check } from "lucide-react";

const STEPS = [
  { number: 1, label: "Your profile" },
  { number: 2, label: "Body analysis" },
  { number: 3, label: "Choose your goal" },
  { number: 4, label: "Build your plan" },
  { number: 5, label: "Start your journey" },
];

function JourneyProgress({ currentStep, compact = false }) {
  const safeStep = Math.min(STEPS.length, Math.max(1, Number(currentStep) || 1));
  const progress = `${(safeStep / STEPS.length) * 100}%`;

  return (
    <section className={`journey-progress ${compact ? "journey-progress-compact" : ""}`} aria-label={`Fitness journey step ${safeStep} of ${STEPS.length}`}>
      <div className="journey-progress-head">
        <div>
          <span className="journey-progress-eyebrow">YOUR FITNESS JOURNEY</span>
          <strong>Step {safeStep} of {STEPS.length}</strong>
        </div>
        <span className="journey-progress-current">{STEPS[safeStep - 1].label}</span>
      </div>

      <div className="journey-progress-track" role="progressbar" aria-valuemin="1" aria-valuemax={STEPS.length} aria-valuenow={safeStep}>
        <div className="journey-progress-fill" style={{ width: progress }} />
      </div>

      <div className="journey-progress-steps">
        {STEPS.map((step) => {
          const completed = step.number < safeStep;
          const active = step.number === safeStep;
          return (
            <div
              key={step.number}
              className={`journey-progress-step ${completed ? "is-complete" : ""} ${active ? "is-active" : ""}`}
            >
              <span className="journey-progress-dot">
                {completed ? <Check size={11} strokeWidth={3} /> : step.number}
              </span>
              <span className="journey-progress-label">{step.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default JourneyProgress;
