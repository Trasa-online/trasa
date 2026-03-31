import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FollowButton from "./FollowButton";

interface SuggestedUsersProps {
  currentUserId: string;
  onProfileTap: (username: string) => void;
}

export default function SuggestedUsers({ currentUserId, onProfileTap }: SuggestedUsersProps) {
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["suggested-users", currentUserId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("suggested_users_by_city", {
        p_user_id: currentUserId,
      });
      return (data ?? []) as Array<{
        id: string;
        username: string;
        first_name: string | null;
        avatar_url: string | null;
        shared_city: string;
      }>;
    },
  });

  if (isLoading) return (
    <p className="text-xs text-muted-foreground text-center py-4">Ładowanie propozycji...</p>
  );

  if (suggestions.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        Może znasz?
      </p>
      <div className="space-y-2">
        {suggestions.map(user => {
          const displayName = user.first_name || user.username;
          return (
            <div key={user.id} className="flex items-center gap-3 py-2">
              <button onClick={() => onProfileTap(user.username)}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url || ""} />
                  <AvatarFallback className="bg-orange-100 text-orange-600 text-sm font-bold">
                    {displayName?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="flex-1 min-w-0" onClick={() => onProfileTap(user.username)}>
                <p className="text-sm font-semibold leading-tight truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">@{user.username} · był(a) w {user.shared_city}</p>
              </div>
              <FollowButton targetUserId={user.id} initialIsFollowing={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
