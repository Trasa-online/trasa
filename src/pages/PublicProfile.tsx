import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MapPin } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FollowButton from "@/components/social/FollowButton";

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex-1 bg-card border border-border/40 rounded-2xl py-4 flex flex-col items-center gap-1">
      <span className="text-2xl font-black">{value}</span>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default function PublicProfile() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["public-profile", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .eq("username", username!)
        .maybeSingle();
      return data as { id: string; username: string; first_name: string | null; avatar_url: string | null } | null;
    },
    enabled: !!username,
  });

  const { data: counts } = useQuery({
    queryKey: ["profile-follow-counts", profile?.id],
    queryFn: async () => {
      const [{ count: followers }, { count: following }] = await Promise.all([
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("following_id", profile!.id),
        supabase.from("followers").select("*", { count: "exact", head: true }).eq("follower_id", profile!.id),
      ]);
      return { followers: followers ?? 0, following: following ?? 0 };
    },
    enabled: !!profile?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["public-profile-stats", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("routes")
        .select("city")
        .eq("user_id", profile!.id);
      const all = data ?? [];
      const cities = new Set(all.map(r => r.city).filter(Boolean)).size;
      return { trips: all.length, cities };
    },
    enabled: !!profile?.id,
  });

  const { data: isFollowing = false } = useQuery({
    queryKey: ["is-following", user?.id, profile?.id],
    queryFn: async () => {
      if (!user || !profile) return false;
      const { data } = await supabase
        .from("followers")
        .select("follower_id")
        .eq("follower_id", user.id)
        .eq("following_id", profile.id)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!profile?.id,
  });

  const { data: sharedRoutes = [] } = useQuery({
    queryKey: ["public-routes", profile?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("routes")
        .select("id, city, start_date, ai_summary")
        .eq("user_id", profile!.id)
        .order("created_at", { ascending: false })
        .limit(10);
      return data ?? [];
    },
    enabled: !!profile?.id,
  });

  if (isLoading) return null;
  if (!profile) return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-3">
      <p className="text-muted-foreground">Nie znaleziono użytkownika</p>
      <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="text-orange-600 font-semibold text-sm">Wróć</button>
    </div>
  );

  const displayName = profile.username || profile.first_name;

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-safe-4 pb-3 border-b border-border/40">
        <button onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate("/")} className="h-9 w-9 flex items-center justify-center text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-base font-bold text-center">@{profile.username}</h1>
        <div className="w-9" />
      </div>

      <div className="px-5 max-w-lg mx-auto space-y-6 pt-6">
        {/* Avatar + name + follow */}
        <div className="flex flex-col items-center gap-4">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profile.avatar_url || ""} />
            <AvatarFallback className="bg-orange-100 text-orange-600 text-4xl font-black">
              {displayName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-black">{displayName}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>
          <FollowButton targetUserId={profile.id} initialIsFollowing={isFollowing} />
        </div>

        {/* Counts */}
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <p className="text-xl font-black">{counts?.followers ?? 0}</p>
            <p className="text-xs text-muted-foreground">Obserwujący</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-black">{counts?.following ?? 0}</p>
            <p className="text-xs text-muted-foreground">Obserwuje</p>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <StatCard value={stats?.trips ?? 0} label="Tras" />
          <StatCard value={stats?.cities ?? 0} label="Miast" />
        </div>

        {/* Routes */}
        {sharedRoutes.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-bold">Trasy</p>
            {sharedRoutes.map((route: any) => (
              <button
                key={route.id}
                onClick={() => navigate(`/route/${route.id}`)}
                className="w-full text-left bg-card border border-border/50 rounded-2xl px-4 py-3 active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-2 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-orange-600" />
                  <span className="font-semibold text-sm">{route.city}</span>
                </div>
                {route.ai_summary && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{route.ai_summary}</p>
                )}
              </button>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
