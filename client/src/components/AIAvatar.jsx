import { Sparkles } from "lucide-react";

function AIAvatar({ size = "medium", pulse = true }) {
  return (
    <div
      className={`ai-avatar ai-avatar-${size} ${
        pulse ? "ai-avatar-pulse" : ""
      }`}
    >
      <Sparkles size={size === "small" ? 15 : 19} />
    </div>
  );
}

export default AIAvatar;