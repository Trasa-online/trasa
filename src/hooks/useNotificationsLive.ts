import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// GLOBALNY nasluch powiadomien in-app (2026-08-26): gdy user SIEDZI W APCE, nowe powiadomienie
// (INSERT do notifications) od razu 1) odswieza licznik nieprzeczytanych (badge/kropka wszedzie),
// 2) pokazuje toast "Zobacz". Realtime jest wlaczony na tabeli notifications. Montowane raz w
// AuthDrawerProviderWrapper (App.tsx), wiec dziala na WSZYSTKICH ekranach (tez /moj-profil, /route).
// (Push APNs to osobny kanal - trigger notify_push -> send-push; ten hook = in-app.)

// Tytuly in-app spojne z push (notify_push v_title). Klucz = notification_type.
const TITLES: Record<string, string> = {
  friend_request: "Nowe zaproszenie do znajomych 👋",
  friend_accept: "Masz nowego znajomego 🎉",
  follower: "Masz nowego obserwującego 👀",
  route_invite: "Nowy wspólny wyjazd 🗺️",
  group_invite: "Zaproszenie do sesji 🗺️",
  group_route_ready: "Trasa gotowa 🗺️",
  route_liked: "Ktoś polubił Twoją trasę ❤️",
  list_liked: "Ktoś polubił Twoją listę ❤️",
  list_saved: "Ktoś zapisał Twoją listę 🔖",
  list_updated: "Nowe miejsce na liście 📍",
  route_used: "Ktoś korzysta z Twojej trasy 🧭",
  trip_reminder: "Dokończ swój wyjazd 📸",
  trip_places_reminder: "Dodaj miejsca do wyjazdu 📍",
  trip_message: "Nowa wiadomość 💬",
  photo_like: "Ktoś polubił Twoje zdjęcie ❤️",
};

const urlFor = (n: any): string => {
  if (n?.type === "trip_reminder") return `/review-summary?route=${n.route_id}&edit=1`;
  if (n?.type === "group_invite") return `/sesja/${n?.metadata?.join_code ?? ""}`;
  if (n?.type === "list_liked" || n?.type === "list_saved" || n?.type === "list_updated") return `/lista/${n?.metadata?.collection_id ?? ""}`;
  if (n?.route_id) return `/route/${n.route_id}`;
  return "/moj-profil";
};

export function useNotificationsLive() {
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
          const title = TITLES[n.type] ?? "Masz nowe powiadomienie 🔔";
          toast(title, { action: { label: "Zobacz", onClick: () => navigate(urlFor(n)) } });
        },
      )
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);
}
