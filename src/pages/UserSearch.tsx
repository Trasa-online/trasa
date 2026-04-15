import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, Search } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FollowButton from "@/components/social/FollowButton";

type Profile = { id: string; username: string; first_name: string | null; avatar_url: string | null };

export default function UserSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  // Load all profiles up front — filter client-side (no API call on type = no Face ID)
  const { data: allProfiles = [], isLoading } = useQuery({
    queryKey: ["all-profiles", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .neq("id", user?.id ?? "")
        .not("username", "is", null)
        .order("username")
        .limit(200);
      return (data ?? []) as Profile[];
    },
    enabled: !!user,
  });

  const { data: followingIds = [] } = useQuery({
    queryKey: ["following-ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase.from("followers").select("following_id").eq("follower_id", user.id);
      return (data ?? []).map(r => r.following_id as string);
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // Client-side filter — no network call
  const trimmed = query.trim().replace(/^@/, "").toLowerCase();
  const visible = trimmed
    ? allProfiles.filter(p =>
        p.username?.toLowerCase().includes(trimmed) ||
        p.first_name?.toLowerCase().includes(trimmed)
      )
    : allProfiles;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/40 sticky top-0 bg-background z-10">
        <button
          onClick={() => navigate(-1)}
          className="h-9 w-9 flex items-center justify-center rounded-2xl text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-muted rounded-2xl px-3 h-10">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Szukaj @username..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-8">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-12">Ładowanie...</p>
        ) : visible.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">Brak wyników</p>
        ) : (
          <div className="divide-y divide-border/30">
            {visible.map(profile => {
              const displayName = profile.username || profile.first_name;
              return (
                <div key={profile.id} className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => navigate(`/profil/${profile.username}`)}>
                    <Avatar className="h-11 w-11">
                      <AvatarImage src={profile.avatar_url || ""} />
                      <AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-sm">
                        {displayName?.charAt(0).toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => navigate(`/profil/${profile.username}`)}
                  >
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
        )}
      </div>
    </div>
  );
}
