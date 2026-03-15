import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const OrbOverlay = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  const [showText, setShowText] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowText(true), 480);
    return () => clearTimeout(t);
  }, []);

  const handleProceed = () => {
    onClose();
    navigate("/create");
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center"
      onClick={handleProceed}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 p-2 text-muted-foreground hover:text-foreground"
        style={{ top: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}
        aria-label="Zamknij"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Orb animates in from top-right to center */}
      <div className="h-32 w-32 rounded-full orb-gradient orb-emerge" />

      <div
        className={cn(
          "mt-8 text-center transition-all duration-500",
          showText ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
        )}
      >
        <p className="text-2xl font-bold tracking-tight">W czym mogę Ci pomóc?</p>
        <p className="text-sm text-muted-foreground mt-2">Dotknij aby zacząć planować</p>
      </div>
    </div>
  );
};

export default OrbOverlay;
