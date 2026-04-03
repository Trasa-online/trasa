import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { X, Bell, Heart, MessageCircle, UserPlus, MapPin, Route, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { pl } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  actor_id: string;
  route_id: string | null;
  created_at: string;
  read: boolean;
  metadata?: Record<string, string> | null;
  actor?: { username: string | null; avatar_url: string | null };
}

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; label: (username: string, metadata?: Record<string, string> | null) => string }> = {
  like:           { icon: Heart,         color: "text-rose-500 bg-rose-100",      label: u => `${u} polubił(a) Twoją trasę` },
  comment:        { icon: MessageCircle, color: "text-blue-500 bg-blue-100",      label: u => `${u} skomentował(a) Twoją trasę` },
  follower:       { icon: UserPlus,      color: "text-violet-500 bg-violet-100",  label: u => `${u} zaczął(a) Cię obserwować` },
  new_route:      { icon: Route,         color: "text-emerald-500 bg-emerald-100",label: u => `${u} dodał(a) nową trasę` },
  route_updated:  { icon: Route,         color: "text-amber-500 bg-amber-100",    label: u => `${u} zaktualizował(a) trasę` },
  mention:        { icon: MessageCircle, color: "text-orange-500 bg-orange-100",  label: u => `${u} wspomniał(a) o Tobie` },
  pin_visit:      { icon: MapPin,        color: "text-teal-500 bg-teal-100",      label: u => `${u} odwiedził(a) Twoje miejsce` },
  group_match:    { icon: Users,         color: "text-orange-600 bg-orange-100",  label: (u, meta) => `${u} też polubił(a) ${meta?.place_name ?? "to samo miejsce"}! Match 🎉` },
};

interface Props {
  open: boolean;
  onClose: () => void;
  userId: string;
}

export default function NotificationsDrawer({ open, onClose, userId }: Props) {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, actor_id, route_id, created_at, read, metadata")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!data || data.length === 0) return [];

      // Fetch actor profiles
      const actorIds = [...new Set(data.map(n => n.actor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .in("id", actorIds);

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));

      return data.map(n => ({
        ...n,
        actor: profileMap[n.actor_id] ?? null,
      })) as Notification[];
    },
    enabled: open && !!userId,
  });

  const markReadMutation = useMutation({
    mutationFn: async () => {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;
      await supabase.from("notifications").update({ read: true }).in("id", unreadIds);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread", userId] });
    },
  });

  // Mark all as read when opened
  useEffect(() => {
    if (open && notifications.length > 0) {
      markReadMutation.mutate();
    }
  }, [open, notifications.length]);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative mt-auto w-full bg-background rounded-t-3xl flex flex-col overflow-hidden"
        style={{ height: "85dvh" }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center px-5 pb-4 pt-1">
          <h2 className="text-lg font-bold flex-1">
            Powiadomienia
            {unreadCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 rounded-full bg-orange-600 text-white text-[10px] font-bold px-1.5">
                {unreadCount}
              </span>
            )}
          </h2>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full bg-muted flex items-center justify-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto pb-8">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
              Ładowanie...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center gap-3">
              <Bell className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-foreground/70">Brak powiadomień</p>
              <p className="text-xs text-muted-foreground">Tutaj pojawią się powiadomienia o aktywności na Twoich trasach.</p>
            </div>
          ) : (
            <div className="mx-4 rounded-2xl bg-card border border-border/50 overflow-hidden divide-y divide-border/20">
              {notifications.map(n => {
                const cfg = TYPE_CONFIG[n.type] ?? {
                  icon: Bell,
                  color: "text-muted-foreground bg-muted",
                  label: (u: string) => `${u} wykonał(a) akcję`,
                };
                const Icon = cfg.icon;
                const username = n.actor?.username ?? "Ktoś";
                const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: pl });
                const labelText = cfg.label(username, n.metadata);

                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3.5 transition-colors ${!n.read ? "bg-orange-600/5" : ""}`}
                  >
                    <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center ${cfg.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm leading-snug text-foreground/80">{labelText}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{timeAgo}</p>
                    </div>
                    {!n.read && (
                      <div className="flex-shrink-0 h-2 w-2 rounded-full bg-orange-600 mt-1.5" />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
