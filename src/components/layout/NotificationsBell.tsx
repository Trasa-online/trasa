import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { haptics } from "@/hooks/useHaptics";
import NotificationsDrawer from "./NotificationsDrawer";

// Dzwonek powiadomien + licznik nieprzeczytanych + drawer, w jednym kawalku.
// Powstal, gdy powiadomienia trafily takze do gornej belki Eksploracji (prosba Nat
// 2026-09-11) - ten sam licznik zyl juz w dwoch miejscach (TopBar, TravelerProfile),
// a trzecia kopia zapytania i subskrypcji realtime byla proszeniem sie o rozjazd.
//
// Klucz zapytania jest CELOWO wspolny z pozostalymi licznikami (`notifications-unread`),
// wiec odczytanie powiadomien w jednym miejscu gasi plakietke wszedzie.
export default function NotificationsBell({ userId, className }: { userId: string; className?: string }) {
  const { t } = useTranslation("profiles");
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: unread = 0 } = useQuery({
    queryKey: ["notifications-unread", userId],
    enabled: !!userId,
    // BATERIA: licznik odswieza realtime (nizej); poll to rzadki fallback (patrz TopBar).
    refetchInterval: 300_000,
    queryFn: async () => {
      const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true })
        .eq("user_id", userId).eq("read", false).neq("type", "group_match");
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`notif-bell-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [userId, queryClient]);

  return (
    <>
      <button
        onClick={() => { haptics.light(); setOpen(true); }}
        aria-label={t("profile.notifications_aria")}
        className={className ?? "relative shrink-0 h-8 w-8 flex items-center justify-center rounded-xl bg-muted text-foreground active:scale-95 transition-transform"}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center leading-none">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && <NotificationsDrawer open={open} onClose={() => setOpen(false)} userId={userId} />}
    </>
  );
}
