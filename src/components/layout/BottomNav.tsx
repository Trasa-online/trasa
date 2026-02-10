import { useState } from "react";
import { NavLink } from "@/components/NavLink";
import { Rss, MapPin, Plus, Bookmark, User } from "lucide-react";
import { CreateModeDrawer } from "@/components/route/CreateModeDrawer";
import { useAuth } from "@/hooks/useAuth";

const BottomNav = () => {
  const { user } = useAuth();
  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-foreground border-t border-background/20 z-50">
        <div className="grid grid-cols-5 h-16 max-w-lg mx-auto">
          <NavLink
            to="/"
            end
            className="flex flex-col items-center justify-center gap-1 text-background/60 relative"
            activeClassName="text-background"
          >
            {({ isActive }) => (
              <>
                <Rss className="h-5 w-5" />
                <span className="text-xs">Feed</span>
                {isActive && <div className="absolute bottom-1 w-1 h-1 bg-background rounded-full" />}
              </>
            )}
          </NavLink>
          
          <NavLink
            to="/my-routes"
            className="flex flex-col items-center justify-center gap-1 text-background/60 relative"
            activeClassName="text-background"
          >
            {({ isActive }) => (
              <>
                <MapPin className="h-5 w-5" />
                <span className="text-xs">Trasy</span>
                {isActive && <div className="absolute bottom-1 w-1 h-1 bg-background rounded-full" />}
              </>
            )}
          </NavLink>
          
          {/* Create button - opens drawer */}
          <button
            onClick={() => setShowCreateDrawer(true)}
            className="flex flex-col items-center justify-center"
          >
            <div className="bg-background text-foreground rounded-full p-3">
              <Plus className="h-6 w-6" />
            </div>
          </button>
          
          <NavLink
            to="/saved"
            className="flex flex-col items-center justify-center gap-1 text-background/60 relative"
            activeClassName="text-background"
          >
            {({ isActive }) => (
              <>
                <Bookmark className="h-5 w-5" />
                <span className="text-xs">Zapisane</span>
                {isActive && <div className="absolute bottom-1 w-1 h-1 bg-background rounded-full" />}
              </>
            )}
          </NavLink>
          
          <NavLink
            to={user ? `/profile/${user.id}` : "/auth"}
            className="flex flex-col items-center justify-center gap-1 text-background/60 relative"
            activeClassName="text-background"
          >
            {({ isActive }) => (
              <>
                <User className="h-5 w-5" />
                <span className="text-xs">Profil</span>
                {isActive && <div className="absolute bottom-1 w-1 h-1 bg-background rounded-full" />}
              </>
            )}
          </NavLink>
        </div>
      </nav>

      <CreateModeDrawer 
        open={showCreateDrawer} 
        onOpenChange={setShowCreateDrawer} 
      />
    </>
  );
};

export default BottomNav;
