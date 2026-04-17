import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { BookOpen, Home, Plus, X, MapPin, Users } from "lucide-react";

const BottomNav = () => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);

  return (
    <>
      {/* Backdrop */}
      {showMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowMenu(false)}
        />
      )}

      {/* Popup menu above "+" button */}
      {showMenu && (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pb-3">
          <button
            onClick={() => { setShowMenu(false); navigate("/sesja/nowa"); }}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-foreground text-background font-semibold text-sm shadow-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            <Users className="h-4 w-4" />
            Zaplanuj grupowo
          </button>
          <button
            onClick={() => { setShowMenu(false); navigate("/plan"); }}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-primary text-white font-semibold text-sm shadow-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            <MapPin className="h-4 w-4" />
            Zaplanuj solo
          </button>
        </div>
      )}

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
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center justify-center"
            aria-label="Dodaj trasę"
          >
            <span className="h-10 w-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform">
              {showMenu
                ? <X className="h-5 w-5 text-white stroke-[2.5px]" />
                : <Plus className="h-5 w-5 text-white stroke-[2.5px]" />
              }
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
    </>
  );
};

export default BottomNav;
