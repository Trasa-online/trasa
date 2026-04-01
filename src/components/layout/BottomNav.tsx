import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { Map, Compass, BookOpen, Home, Plus } from "lucide-react";

const LEFT_ITEMS = [
  { to: "/",           end: true,   icon: Home,    label: "Główna"   },
  { to: "/historia",   end: false,  icon: Compass, label: "Eksploruj" },
];

const RIGHT_ITEMS = [
  { to: "/dziennik",   end: false,  icon: BookOpen, label: "Dziennik" },
  { to: "/moje-trasy", end: false,  icon: Map,      label: "Trasy"    },
];

const BottomNav = () => {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40 z-50 pb-safe">
      <div className="grid grid-cols-5 h-12 max-w-lg mx-auto">

        {/* Left tabs */}
        {LEFT_ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
            activeClassName="text-orange-600"
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}

        {/* Center FAB */}
        <button
          onClick={() => navigate("/plan")}
          className="flex items-center justify-center"
          aria-label="Dodaj trasę"
        >
          <span className="h-10 w-10 rounded-full bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/30 active:scale-95 transition-transform">
            <Plus className="h-5 w-5 text-white stroke-[2.5px]" />
          </span>
        </button>

        {/* Right tabs */}
        {RIGHT_ITEMS.map(({ to, end, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
            activeClassName="text-orange-600"
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>{label}</span>
              </>
            )}
          </NavLink>
        ))}


      </div>
    </nav>
  );
};

export default BottomNav;
