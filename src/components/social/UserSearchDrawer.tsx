import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { X, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FollowButton from "./FollowButton";
import SuggestedUsers from "./SuggestedUsers";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function UserSearchDrawer({ open, onClose }: Props) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const trimmed = query.trim().replace(/^@/, "");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["user-search", trimmed],
    queryFn: async () => {
      if (!trimmed) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .ilike("username", `%${trimmed}%`)
        .neq("id", user?.id ?? "")
        .limit(20);
      return (data ?? []) as Array<{ id: string; username: string; first_name: string | null; avatar_url: string | null }>;
    },
    enabled: trimmed.length > 0,
  });

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id);
      return (data ?? []).map(r => r.following_id);
    },
    enabled: !!user,
  });

  const handleProfileTap = (username: string) => {
    onClose();
    navigate(`/profil/${username}`);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative mt-auto w-full bg-background rounded-t-3xl flex flex-col overflow-hidden" style={{ height: "88dvh" }}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          <div className="flex-1 flex items-center gap-2 bg-muted rounded-xl px-3 h-10">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Szukaj @username..."
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button onClick={() => setQuery("")}>
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 pb-8">
          {trimmed.length > 0 ? (
            isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Szukam...</p>
            ) : results.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nie znaleziono użytkownika @{trimmed}</p>
            ) : (
              <div className="space-y-1">
                {results.map(profile => {
                  const displayName = profile.first_name || profile.username;
                  return (
                    <div key={profile.id} className="flex items-center gap-3 py-2.5">
                      <button onClick={() => handleProfileTap(profile.username)}>
                        <Avatar className="h-11 w-11">
                          <AvatarImage src={profile.avatar_url || ""} />
                          <AvatarFallback className="bg-orange-100 text-orange-600 font-bold">
                            {displayName?.charAt(0).toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </button>
                      <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleProfileTap(profile.username)}>
                        <p className="text-sm font-semibold leading-tight">{displayName}</p>
                        <p className="text-xs text-muted-foreground">@{profile.username}</p>
                      </div>
                      <FollowButton
                        targetUserId={profile.id}
                        initialIsFollowing={followingIds.includes(profile.id)}
                      />
                    </div>
                  );
                })}
              </div>
            )
          ) : (
            user && (
              <SuggestedUsers
                currentUserId={user.id}
                onProfileTap={handleProfileTap}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}
