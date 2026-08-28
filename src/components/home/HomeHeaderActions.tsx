import { useState, useEffect } from "react";
import { Bell, Bookmark, Shield, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import NotificationsDrawer from "@/components/layout/NotificationsDrawer";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { supabase } from "@/integrations/supabase/client";
import { isHardcodedAdmin } from "@/lib/admins";

// Wspolny cluster ikon akcji w naglowku (dzwonek powiadomien + licznik, szukanie
// znajomych, zapisane miejsca, panel admina). Uzywany na landingu (Eksploruj)
// oraz na ekranie "Twoje trasy" (HomeSwipe). Propsy pozwalaja ukryc pojedyncze
// ikony per ekran (landing pokazuje tylko wyszukiwarke).
interface HomeHeaderActionsProps {
  showNotifications?: boolean;
  showSearch?: boolean;
  showSaved?: boolean;
  showAdmin?: boolean;
}

const HomeHeaderActions = ({
  showNotifications = true,
  showSearch = true,
  showSaved = true,
  showAdmin = true,
}: HomeHeaderActionsProps = {}) => {
  const { user, isAnonymous } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("homecreator");
  const isAdmin = isHardcodedAdmin(user?.email);
  const { open: openAuthDrawer } = useAuthDrawer();
  const isGuest = !user || isAnonymous;
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
    // BATERIA: licznik odswieza realtime (kanal ponizej) + resume aplikacji. Poll co 30s byl
    // czystym marnotrawstwem radia (2 komponenty x 120 zapytan/h); zostaje rzadki fallback
    // na wypadek zerwanej subskrypcji realtime.
    refetchInterval: 300_000,
  });

  // Realtime: instant badge update on new notification.
  useEffect(() => {
    if (!user || isAnonymous) return;
    const channel = supabase
      .channel(`home-header-notif-badge-${user.id}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isAnonymous]);

  return (
    <>
      <div className="flex items-center gap-1.5 shrink-0">
        {isGuest ? (
          <button
            onClick={() => openAuthDrawer({ mode: "login" })}
            className="text-xs font-semibold text-orange-600 px-3 py-2 rounded-full hover:bg-orange-50 active:scale-[0.97] transition-all"
          >
            {t("header.login")}
          </button>
        ) : (
          showNotifications && (
            <button
              onClick={() => setNotifOpen(true)}
              className="relative h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label={t("header.notifications")}
            >
              <Bell className="h-[18px] w-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 rounded-full bg-primary text-white text-[8px] font-bold flex items-center justify-center px-1 leading-none ring-2 ring-background">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </button>
          )
        )}
        {!isGuest && showSearch && (
          <button
            onClick={() => navigate("/search")}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
            aria-label={t("header.search_friends")}
            title={t("header.search_friends")}
          >
            <Search className="h-[18px] w-[18px]" />
          </button>
        )}
        {!isGuest && showSaved && (
          <button
            onClick={() => navigate("/moj-profil?tab=zapisane")}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
            aria-label={t("header.saved_places")}
            title={t("header.saved")}
          >
            <Bookmark className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {/* Notifications drawer */}
      {notifOpen && user && !isAnonymous && (
        <NotificationsDrawer open={notifOpen} onClose={() => setNotifOpen(false)} userId={user.id} />
      )}
    </>
  );
};

export default HomeHeaderActions;
