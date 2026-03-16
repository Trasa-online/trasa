import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Send } from "lucide-react";
import { cn } from "@/lib/utils";

const OrbOverlay = ({ onClose, isSpeaking = false }: { onClose: () => void; isSpeaking?: boolean }) => {
  const navigate = useNavigate();
  const [showInput, setShowInput] = useState(false);
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setShowInput(true);
      setTimeout(() => inputRef.current?.focus(), 150);
    }, 500);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = () => {
    if (!message.trim()) return;
    onClose();
    navigate(`/create?q=${encodeURIComponent(message.trim())}`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 p-2 text-muted-foreground hover:text-foreground"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        aria-label="Zamknij"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Orb animates in from TopBar */}
      <div className={cn("h-32 w-32 rounded-full orb-gradient orb-emerge mb-10", isSpeaking && "orb-speaking")} />

      {/* Input fades in after orb lands */}
      <div
        className={cn(
          "w-full max-w-sm transition-all duration-500",
          showInput ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        <p className="text-2xl font-bold tracking-tight text-center mb-6">
          W czym mogę Ci pomóc?
        </p>
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Chcę zwiedzić Kraków przez 2 dni..."
            className="flex-1 bg-card border border-border rounded-full px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!message.trim()}
            className="h-11 w-11 rounded-full orb-gradient disabled:opacity-30 flex items-center justify-center shrink-0 active:scale-90 transition-transform"
          >
            <Send className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OrbOverlay;
