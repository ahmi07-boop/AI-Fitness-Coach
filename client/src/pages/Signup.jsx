import { useState } from "react";
import { ArrowRight, Check, Dumbbell, Lock, Mail, User, Eye, EyeOff, ShieldCheck, Sparkles } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function Signup() {
  const navigate = useNavigate();
  const location = useLocation();
  const { register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const passwordChecks = [
    { label: "8+ characters", valid: form.password.length >= 8 },
    { label: "Upper & lowercase", valid: /[a-z]/.test(form.password) && /[A-Z]/.test(form.password) },
    { label: "Number", valid: /\d/.test(form.password) },
  ];

  const passwordStrength = passwordChecks.filter((item) => item.valid).length;

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.name.trim() || !form.email.trim()) return setError("Please complete your name and email.");
    if (form.password.length < 8) return setError("Password must be at least 8 characters.");
    if (form.password !== form.confirm) return setError("Passwords do not match.");
    setSubmitting(true);
    try {
      await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate(location.state?.from || "/onboarding", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-page signup-page">
      <div className="login-background-circle circle-one" />
      <div className="login-background-circle circle-two" />
      <div className="signup-orb signup-orb-one" />
      <div className="signup-orb signup-orb-two" />

      <div className="signup-card">
        <aside className="signup-benefits">
          <div className="signup-brand">
            <div className="brand-icon"><Dumbbell size={27} /></div>
            <div>
              <strong>FitCoach AI</strong>
              <span>Smart fitness coaching</span>
            </div>
          </div>

          <div className="signup-benefits-content">
            <div className="signup-eyebrow">
              <Sparkles size={13} />
              PERSONALIZED FROM DAY ONE
            </div>
            <h1>Build a healthier routine that fits <span>you.</span></h1>
            <p>
              Create your account and let FitCoach AI turn your goals,
              progress and habits into a more focused fitness journey.
            </p>

            <div className="signup-benefit-list">
              <div><span className="signup-benefit-icon"><Check size={15} /></span><span><strong>Personalized plans</strong><small>Workouts and nutrition shaped around your goal.</small></span></div>
              <div><span className="signup-benefit-icon"><Check size={15} /></span><span><strong>AI body analysis</strong><small>Use your onboarding data to create a stronger starting point.</small></span></div>
              <div><span className="signup-benefit-icon"><Check size={15} /></span><span><strong>Progress tracking</strong><small>Keep your consistency, habits and results in one place.</small></span></div>
            </div>
          </div>

          <div className="signup-security-note">
            <ShieldCheck size={17} />
            <span>Your account is protected with secure authentication.</span>
          </div>
        </aside>

        <form className="signup-form-panel" onSubmit={submit}>
          <div className="signup-mobile-brand">
            <div className="brand-icon"><Dumbbell size={25} /></div>
            <span>FitCoach AI</span>
          </div>

          <div className="signup-form-heading">
            <div className="signup-step">GET STARTED <span>01</span></div>
            <h2>Create your account</h2>
            <p>Start your personalized FitCoach AI journey.</p>
          </div>

          {error && <div className="auth-error signup-error" role="alert">{error}</div>}

          <div className="signup-form-grid">
            <div className="form-group signup-field-full">
              <label htmlFor="signup-name">Full Name</label>
              <div className="input-wrapper">
                <User size={18} />
                <input id="signup-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Muhammad Ahmed" autoComplete="name" />
              </div>
            </div>

            <div className="form-group signup-field-full">
              <label htmlFor="signup-email">Email Address</label>
              <div className="input-wrapper">
                <Mail size={18} />
                <input id="signup-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="you@example.com" autoComplete="email" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <div className="input-wrapper">
                <Lock size={18} />
                <input id="signup-password" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Create a strong password" autoComplete="new-password" />
                <button type="button" className="password-toggle" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-confirm">Confirm Password</label>
              <div className="input-wrapper">
                <Lock size={18} />
                <input id="signup-confirm" type={showConfirmPassword ? "text" : "password"} value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} placeholder="Repeat your password" autoComplete="new-password" />
                <button type="button" className="password-toggle" aria-label={showConfirmPassword ? "Hide confirmation" : "Show confirmation"} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>{showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button>
              </div>
            </div>
          </div>

          <div className={`signup-password-strength strength-${passwordStrength}`}>
            <div className="signup-strength-top">
              <span>Password strength</span>
              <strong>{passwordStrength === 0 ? "Not set" : passwordStrength === 3 ? "Strong" : passwordStrength === 2 ? "Good" : "Needs work"}</strong>
            </div>
            <div className="signup-strength-bars">
              {[1, 2, 3].map((bar) => <span key={bar} className={bar <= passwordStrength ? "filled" : ""} />)}
            </div>
            <div className="signup-password-checks">
              {passwordChecks.map((item) => <span key={item.label} className={item.valid ? "valid" : ""}><Check size={12} />{item.label}</span>)}
            </div>
          </div>

          <button className="primary-button signup-submit" disabled={submitting}>
            <span>{submitting ? "Creating your account…" : "Create Account"}</span>
            <ArrowRight size={18} />
          </button>

          <p className="signup-terms">By creating an account, you agree to use FitCoach AI responsibly.</p>
          <p className="footer-text signup-footer">Already have an account? <Link to="/login">Sign in</Link></p>
        </form>
      </div>
    </div>
  );
}

export default Signup;
