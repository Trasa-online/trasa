import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// GLOBALNY nasluch powiadomien in-app (2026-08-26): gdy user SIEDZI W APCE, nowe powiadomienie
// (INSERT do notifications) od razu 1) odswieza licznik nieprzeczytanych (badge/kropka wszedzie),
// 2) pokazuje toast "Zobacz". Realtime jest wlaczony na tabeli notifications. Montowane raz w
// AuthDrawerProviderWrapper (App.tsx), wiec dziala na WSZYSTKICH ekranach (tez /moj-profil, /route).
// (Push APNs to osobny kanal - trigger notify_push -> send-push; ten hook = in-app.)

// Tytuly in-app spojne z push (notify_push v_title). Klucz mapy = notification_type,
// wartosc = KLUCZ TLUMACZENIA (mapa zyje poza hookiem, wiec nie ma tu jeszcze t()).
const TITLES: Record<string, string> = {
  friend_request: "live.friend_request",
  friend_accept: "live.friend_accept",
  follower: "live.follower",
  route_invite: "live.route_invite",
  group_invite: "live.group_invite",
  group_route_ready: "live.route_ready",
  route_liked: "live.route_liked",
  list_liked: "live.list_liked",
  list_saved: "live.list_saved",
  list_updated: "live.list_updated",
  route_used: "live.route_used",
  trip_reminder: "live.trip_reminder",
  trip_places_reminder: "live.trip_places",
  trip_message: "live.trip_message",
  photo_like: "live.photo_like",
};

const urlFor = (n: any): string => {
  // Zawsze widok wyjazdu - tam sie uzupelnia zdjecia/notki/opis i publikuje (2026-08-30).
  if (n?.type === "trip_reminder") return `/route/${n.route_id}`;
  if (n?.type === "group_invite") return `/sesja/${n?.metadata?.join_code ?? ""}`;
  if (n?.type === "list_liked" || n?.type === "list_saved" || n?.type === "list_updated") return `/lista/${n?.metadata?.collection_id ?? ""}`;
  if (n?.route_id) return `/route/${n.route_id}`;
  return "/moj-profil";
};

export function useNotificationsLive() {
  const { t } = useTranslation("social");
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`notif-live-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n = payload.new as any;
          // group_match jest pomijany w liczniku (patrz TopBar) - nie pokazujemy tez toasta.
          if (!n || n.type === "group_match" || n.read === true) return;
          queryClient.invalidateQueries({ queryKey: ["notifications-unread", user.id] });
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          // Czat: nie dubluj toastem, gdy user JUZ oglada ten wyjazd (dymek czatu + licznik na nim
          // to pokazuja). Poza tym widokiem (inny ekran w apce) toast jest przydatny -> pokazujemy.
          if (n.type === "trip_message" && n.route_id && window.location.hash.includes(`/route/${n.route_id}`)) return;
          const title = t(TITLES[n.type] ?? "live.generic");
          toast(title, { action: { label: "Zobacz", onClick: () => navigate(urlFor(n)) } });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
