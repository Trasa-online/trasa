import { useState, useEffect } from "react";
import { Bell, Heart, Shield } from "lucide-react";
import NotificationsDrawer from "@/components/layout/NotificationsDrawer";
import HomeTour, { useHomeTour } from "@/components/home/HomeTour";
import ProfileSetup, { useProfileSetup } from "@/components/home/ProfileSetup";
import ActiveTripsDashboard from "@/components/home/ActiveTripsDashboard";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { isHardcodedAdmin } from "@/lib/admins";

// Ekran glowny = dashboard "Aktywne" (ActiveTripsDashboard): aktywne trasy solo + grupowe,
// puste stany gdy brak. Swiper przegladania miejsc jest pod guzikiem "+" (FAB w BottomNav -> /plan).
const HomeSwipe = () => {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isHardcodedAdmin(user?.email);
  const { open: openAuthDrawer } = useAuthDrawer();
  const isGuest = !user || isAnonymous;
  const { showTour, dismissTour } = useHomeTour(isGuest);
  const { showSetup, finishSetup } = useProfileSetup();
  // Zalogowany nowy user: najpierw intro (czym jest apka), potem setup profilu.
  const [introSeen, setIntroSeen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const queryClient = useQueryClient();

  // Powiadomienia tylko dla zalogowanych non-anon (anon nie ma rekordow w notifications).
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
    enabled: !!user && !isAnonymous,
    refetchInterval: 30_000,
  });

  // Realtime: instant badge update on new notification.
  useEffect(() => {
    if (!user || isAnonymous) return;
    const channel = supabase
      .channel(`homeswipe-notif-badge-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isAnonymous]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {showTour && <HomeTour onDone={dismissTour} />}
      {showSetup && !introSeen && <HomeTour lastLabel="Dalej" onDone={() => setIntroSeen(true)} />}
      {showSetup && introSeen && <ProfileSetup onDone={finishSetup} />}

      {/* Top bar */}
      <div className="relative shrink-0 bg-background px-4 pt-3 pb-2.5 flex items-start justify-between gap-2 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-border/40">
        <div className="min-w-0">
          <h1 className="text-xl font-display font-extrabold tracking-tight">Twoje trasy</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Aktywne podróże, trasy grupowe i&nbsp;planowanie nowych.</p>
        </div>
        {/* Prawa: ikony w kolkach. */}
        <div className="flex items-center gap-1.5 shrink-0">
          {isGuest ? (
            <button
              onClick={() => openAuthDrawer({ mode: "login" })}
              className="text-xs font-semibold text-orange-600 px-3 py-2 rounded-full hover:bg-orange-50 active:scale-[0.97] transition-all"
            >
              Zaloguj się
            </button>
          ) : (
            <button
              onClick={() => setNotifOpen(true)}
              className="relative h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label="Powiadomienia"
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center px-1 leading-none ring-2 ring-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )}
          {!isGuest && (
            <button
              onClick={() => navigate("/polubione")}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label="Polubione miejsca"
              title="Polubione"
            >
              <Heart className="h-[18px] w-[18px]" />
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => navigate("/admin")}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-blue-50 text-blue-600 active:scale-90 transition-transform"
              aria-label="Panel admina"
              title="Panel admina"
            >
              <Shield className="h-[18px] w-[18px]" />
            </button>
          )}
        </div>
      </div>

      {/* Notifications drawer */}
      {notifOpen && user && !isAnonymous && (
        <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} userId={user.id} />
      )}

      <ActiveTripsDashboard userId={isGuest ? null : (user?.id ?? null)} />
    </div>
  );
};

export default HomeSwipe;
