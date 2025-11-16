import { NavLink } from "@/components/NavLink";
import { Users, MapPin, Plus, Bookmark, Settings } from "lucide-react";

const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <NavLink
          to="/"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-muted-foreground"
          activeClassName="text-foreground"
        >
          <Users className="h-5 w-5" />
          <span className="text-xs">Znajomi</span>
        </NavLink>
        
        <NavLink
          to="/my-routes"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-muted-foreground"
          activeClassName="text-foreground"
        >
          <MapPin className="h-5 w-5" />
          <span className="text-xs">Trasy</span>
        </NavLink>
        
        <NavLink
          to="/create"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2"
        >
          <div className="bg-foreground text-background rounded-full p-3">
            <Plus className="h-6 w-6" />
          </div>
        </NavLink>
        
        <NavLink
          to="/saved"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-muted-foreground"
          activeClassName="text-foreground"
        >
          <Bookmark className="h-5 w-5" />
          <span className="text-xs">Zapisane</span>
        </NavLink>
        
        <NavLink
          to="/settings"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-muted-foreground"
          activeClassName="text-foreground"
        >
          <Settings className="h-5 w-5" />
          <span className="text-xs">Ustawienia</span>
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
