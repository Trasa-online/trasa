import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { avatarSrc } from "@/lib/avatar";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FollowButton from "./FollowButton";
import SheetSkeleton from "@/components/layout/SheetSkeleton";

interface SuggestedUsersProps {
  currentUserId: string;
  onProfileTap: (username: string) => void;
}

export default function SuggestedUsers({ currentUserId, onProfileTap }: SuggestedUsersProps) {
  const { t } = useTranslation("social");
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ["suggested-users", currentUserId],
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("suggested_users_by_city", {
        p_user_id: currentUserId,
      });
      const rows = (data ?? []) as Array<{
        id: string;
        username: string;
        first_name: string | null;
        avatar_url: string | null;
        shared_city: string;
      }>;
      // Wyklucz konta-gosci (anon): username user_xxxxxxxx (8 hex).
      return rows.filter(u => !/^user_[0-9a-f]{8}$/.test(u.username ?? ""));
    },
  });

  if (isLoading) return (
    <SheetSkeleton variant="people" rows={2} />
  );

  if (suggestions.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
        {t("suggested.maybe_know")}
      </p>
      <div className="space-y-2">
        {suggestions.map(user => {
          const displayName = user.first_name || user.username;
          return (
            <div key={user.id} className="flex items-center gap-3 py-2">
              <button onClick={() => onProfileTap(user.username)}>
                <Avatar className="h-10 w-10">
                  <AvatarImage src={avatarSrc(user.avatar_url)} className="object-cover bg-orange-100" />
                  <AvatarFallback className="bg-orange-100 text-orange-600 text-sm font-bold">
                    {displayName?.charAt(0).toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
              </button>
              <div className="flex-1 min-w-0" onClick={() => onProfileTap(user.username)}>
                <p className="text-sm font-semibold leading-tight truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground">@{user.username} · {t("suggested.been_in", { city: user.shared_city })}</p>
              </div>
              <FollowButton targetUserId={user.id} initialIsFollowing={false} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
