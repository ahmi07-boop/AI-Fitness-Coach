import { Sparkles } from "lucide-react";

function AIBadge({ text = "AI GENERATED" }) {
  return (
    <span className="ai-badge">
      <Sparkles size={13} />
      {text}
      <span className="ai-badge-dot" />
    </span>
  );
}

export default AIBadge;