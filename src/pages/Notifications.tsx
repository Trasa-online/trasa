import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Heart, MessageCircle, UserPlus, MapPin, ArrowLeft } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type NotificationType = "like" | "comment" | "follower" | "new_route";

interface Notification {
  id: string;
  type: NotificationType;
  actor_id: string;
  route_id: string | null;
  comment_id: string | null;
  created_at: string;
  read: boolean;
  actor: {
    username: string;
    avatar_url: string | null;
  };
  route?: {
    title: string;
  };
}

const Notifications = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select(`
          *,
          actor:actor_id(username, avatar_url),
          route:route_id(title)
        `)
        .eq("user_id", user?.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!user,
  });

  // Real-time subscription for new notifications
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('notifications-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Refetch notifications when a new one arrives
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
          toast.success("Nowe powiadomienie!");
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          // Refetch when notification is marked as read
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", notificationId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user?.id)
        .eq("read", false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success("Wszystkie powiadomienia oznaczone jako przeczytane");
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      markAsReadMutation.mutate(notification.id);
    }

    if (notification.type === "follower") {
      navigate(`/profile/${notification.actor_id}`);
    } else if (notification.route_id) {
      navigate(`/route/${notification.route_id}`);
    }
  };

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "like":
        return <Heart className="h-5 w-5 text-red-500 fill-red-500" />;
      case "comment":
        return <MessageCircle className="h-5 w-5 text-blue-500" />;
      case "follower":
        return <UserPlus className="h-5 w-5 text-green-500" />;
      case "new_route":
        return <MapPin className="h-5 w-5 text-purple-500" />;
    }
  };

  const getNotificationText = (notification: Notification) => {
    switch (notification.type) {
      case "like":
        return (
          <>
            <span className="font-semibold">{notification.actor.username}</span> polubił Twoją trasę{" "}
            <span className="font-semibold">{notification.route?.title}</span>
          </>
        );
      case "comment":
        return (
          <>
            <span className="font-semibold">{notification.actor.username}</span> skomentował Twoją trasę{" "}
            <span className="font-semibold">{notification.route?.title}</span>
          </>
        );
      case "follower":
        return (
          <>
            <span className="font-semibold">{notification.actor.username}</span> zaczął Cię obserwować
          </>
        );
      case "new_route":
        return (
          <>
            <span className="font-semibold">{notification.actor.username}</span> dodał nową trasę:{" "}
            <span className="font-semibold">{notification.route?.title}</span>
          </>
        );
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "teraz";
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min temu`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} godz. temu`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)} dni temu`;
    return date.toLocaleDateString("pl-PL");
  };

  if (loading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-muted-foreground">Ładowanie...</div>
        </div>
      </AppLayout>
    );
  }

  if (!user) return null;

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  return (
    <AppLayout>
      <div className="min-h-screen pb-20">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background border-b border-border">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
              className="h-9 w-9"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-lg font-semibold">Powiadomienia</h1>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="text-xs"
              >
                Oznacz jako przeczytane
              </Button>
            )}
            {unreadCount === 0 && <div className="w-9" />}
          </div>
        </div>

        {/* Notifications List */}
        <div className="divide-y divide-border">
          {!notifications || notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <div className="text-4xl mb-4">🔔</div>
              <h3 className="text-lg font-semibold mb-2">Brak powiadomień</h3>
              <p className="text-sm text-muted-foreground">
                Gdy ktoś polubi Twoje trasy, doda komentarz lub zacznie Cię obserwować, zobaczysz to tutaj
              </p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className={`flex items-start gap-3 p-4 cursor-pointer transition-colors hover:bg-accent ${
                  !notification.read ? "bg-accent/50" : ""
                }`}
              >
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={notification.actor.avatar_url || ""} />
                  <AvatarFallback>
                    {notification.actor.username.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 mb-1">
                    <div className="flex-shrink-0 mt-1">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <p className="text-sm flex-1">
                      {getNotificationText(notification)}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {getTimeAgo(notification.created_at)}
                  </p>
                </div>

                {!notification.read && (
                  <div className="flex-shrink-0 mt-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Notifications;
