import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell } from "lucide-react";
import NotificationsDrawer from "./NotificationsDrawer";

const TopBar = (_props: { onOrbClick?: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  if (!user) return null;

  return (
    <>
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-3 flex items-center justify-between">
        {/* Left placeholder to keep title centered */}
        <div className="w-11" />

        <button
          onClick={() => navigate("/")}
          className="text-xl font-black tracking-tight"
        >
          TRASA
        </button>

        {/* Bell */}
        <button
          onClick={() => setNotifOpen(true)}
          className="relative h-11 w-11 flex items-center justify-center text-muted-foreground"
          aria-label="Powiadomienia"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 min-w-4 rounded-full bg-orange-600 text-white text-[9px] font-bold flex items-center justify-center px-1 leading-none">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </header>

      {notifOpen && user && (
        <NotificationsDrawer
          open={notifOpen}
          onClose={() => setNotifOpen(false)}
          userId={user.id}
        />
      )}
    </>
  );
};

export default TopBar;
