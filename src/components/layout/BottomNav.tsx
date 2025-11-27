import { NavLink } from "@/components/NavLink";
import { Rss, MapPin, Plus, Bookmark, Settings } from "lucide-react";

const BottomNav = () => {
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-foreground border-t border-background/20 z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        <NavLink
          to="/"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-background/60 relative"
          activeClassName="text-background"
        >
          {({ isActive }) => (
            <>
              <Rss className="h-5 w-5" />
              <span className="text-xs">Feed</span>
              {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-background rounded-full" />}
            </>
          )}
        </NavLink>
        
        <NavLink
          to="/my-routes"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-background/60 relative"
          activeClassName="text-background"
        >
          {({ isActive }) => (
            <>
              <MapPin className="h-5 w-5" />
              <span className="text-xs">Trasy</span>
              {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-background rounded-full" />}
            </>
          )}
        </NavLink>
        
        <NavLink
          to="/create"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2"
        >
          <div className="bg-background text-foreground rounded-full p-3">
            <Plus className="h-6 w-6" />
          </div>
        </NavLink>
        
        <NavLink
          to="/saved"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-background/60 relative"
          activeClassName="text-background"
        >
          {({ isActive }) => (
            <>
              <Bookmark className="h-5 w-5" />
              <span className="text-xs">Zapisane</span>
              {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-background rounded-full" />}
            </>
          )}
        </NavLink>
        
        <NavLink
          to="/settings"
          className="flex flex-col items-center justify-center gap-1 px-4 py-2 text-background/60 relative"
          activeClassName="text-background"
        >
          {({ isActive }) => (
            <>
              <Settings className="h-5 w-5" />
              <span className="text-xs">Ustawienia</span>
              {isActive && <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 bg-background rounded-full" />}
            </>
          )}
        </NavLink>
      </div>
    </nav>
  );
};

export default BottomNav;
