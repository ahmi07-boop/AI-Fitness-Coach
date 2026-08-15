import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function Coach() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate("/chat", { replace: true });
  }, [navigate]);

  return (
    <main className="coach-page">
      <div className="coach-container">
        <h1>Opening your AI Coach…</h1>
        <p>Your AI Coach uses your saved plan, progress and RAG context.</p>
      </div>
    </main>
  );
}
