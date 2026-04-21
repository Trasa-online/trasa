import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, UserCircle2 } from "lucide-react";
import NotificationsDrawer from "./NotificationsDrawer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

const TopBar = (_props: { onOrbClick?: () => void }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["notifications-unread", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false)
        .neq("type", "group_match");
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Realtime: instant badge update on new notification
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notif-badge-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
        queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const { data: profile } = useQuery({
    queryKey: ["profile-topbar", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("avatar_url, first_name")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  if (!user) return (
    <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-2 flex items-center">
      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
        <UserCircle2 className="h-5 w-5 text-muted-foreground" />
      </div>
    </header>
  );

  return (
    <>
      <header className="sticky top-0 z-50 bg-background border-b border-border/40 px-4 pt-safe-4 pb-2 flex items-center justify-between">
        {/* Left: Avatar */}
        <button
          onClick={() => navigate("/moj-profil")}
          className="flex items-center justify-center"
          aria-label="Mój profil"
        >
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile?.avatar_url || ""} />
            <AvatarFallback className="bg-orange-100 text-orange-600 text-sm font-bold">
              {profile?.first_name ? profile.first_name.charAt(0).toUpperCase() : "?"}
            </AvatarFallback>
          </Avatar>
        </button>

        {/* Right: Bell */}
        <button
          onClick={() => setNotifOpen(true)}
          className="relative h-9 w-9 flex items-center justify-center text-muted-foreground"
          aria-label="Powiadomienia"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-3.5 min-w-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center px-1 leading-none">
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
