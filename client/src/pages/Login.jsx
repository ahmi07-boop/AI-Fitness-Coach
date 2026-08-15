import { useState } from "react";
import { Dumbbell, Mail, Lock, ArrowRight, ShieldCheck } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!email || !password) return setError("Please enter your email and password.");
    setSubmitting(true);
    try {
      const user = await login(email.trim(), password);
      const destination = user.role === "admin" ? "/admin" : (location.state?.from || "/onboarding");
      navigate(destination, { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };


  return (
    <div className="login-page">
      <div className="login-background-circle circle-one" /><div className="login-background-circle circle-two" />
      <form className="login-card" onSubmit={submit}>
        <div className="brand-icon"><Dumbbell size={30} /></div>
        <h1>FitCoach AI</h1>
        <p className="subtitle">Your Personal AI Fitness Companion</p>
        {error && <div className="auth-error">{error}</div>}
        <div className="form-group"><label>Email</label><div className="input-wrapper"><Mail size={18} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your email" autoComplete="email" /></div></div>
        <div className="form-group"><label>Password</label><div className="input-wrapper"><Lock size={18} /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" /></div></div>
        <button className="primary-button" disabled={submitting}>{submitting ? "Signing in…" : "Sign In"}<ArrowRight size={18} /></button>
        <p className="footer-text">New to FitCoach AI? <Link to="/signup">Create an account</Link></p>
        <p className="footer-text"><ShieldCheck size={14} /> Admin accounts use the same secure sign-in.</p>
      </form>
    </div>
  );
}
export default Login;
