import { useNavigate } from "react-router-dom";
import { Settings } from "lucide-react";

const TopBar = () => {
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 py-3 flex items-center justify-between">
      <div className="w-8" />
      <button
        onClick={() => navigate("/")}
        className="text-xl font-black tracking-tight"
      >
        TRASA
      </button>
      <button
        onClick={() => navigate("/settings")}
        className="p-1 text-foreground/70 hover:text-foreground transition-colors"
      >
        <Settings className="h-5 w-5" />
      </button>
    </header>
  );
};

export default TopBar;
