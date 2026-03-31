import { NavLink } from "@/components/NavLink";
import { Home, Map, Heart, BookOpen, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const NAV_ITEMS = [
  { to: "/",          end: true,  icon: Home,     label: "Dom"      },
  { to: "/moje-trasy",end: false, icon: Map,      label: "Trasy"    },
  { to: "/historia",  end: false, icon: Heart,    label: "Historia" },
  { to: "/dziennik",  end: false, icon: BookOpen, label: "Dziennik" },
];

const BottomNav = () => {
  const { user } = useAuth();
  const profileTo = user ? "/moj-profil" : "/auth";

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40 z-50 pb-safe">
      <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
        {NAV_ITEMS.map(({ to, end, icon: Icon, label }) => (
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

        {/* Profile */}
        <NavLink
          to={profileTo}
          className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
          activeClassName="text-orange-600"
        >
          {({ isActive }) => (
            <>
              <User className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
              <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>Profil</span>
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
