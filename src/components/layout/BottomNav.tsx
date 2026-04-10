import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { BookOpen, Home, Plus } from "lucide-react";

const BottomNav = () => {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40 z-50 pb-safe">
      <div className="grid grid-cols-3 h-12 max-w-lg mx-auto">

        {/* Główna */}
        <NavLink
          to="/"
          end
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
          activeClassName="text-orange-600"
        >
          {({ isActive }) => (
            <>
              <Home className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
              <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>Główna</span>
            </>
          )}
        </NavLink>

        {/* Center FAB */}
        <button
          onClick={() => navigate("/sesja/nowa")}
          className="flex items-center justify-center"
          aria-label="Dodaj trasę"
        >
          <span className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center active:scale-95 transition-transform">
            <Plus className="h-5 w-5 text-white stroke-[2.5px]" />
          </span>
        </button>

        {/* Dziennik */}
        <NavLink
          to="/dziennik"
          end={false}
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
          activeClassName="text-orange-600"
        >
          {({ isActive }) => (
            <>
              <BookOpen className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
              <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>Dziennik</span>
            </>
          )}
        </NavLink>

      </div>
    </nav>
  );
};

export default BottomNav;
