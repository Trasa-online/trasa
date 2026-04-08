import { useNavigate, Link, Navigate } from "react-router-dom";
import { useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UserPlus, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import FeedActivityCard from "@/components/social/FeedActivityCard";

const Home = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("home");

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  // Single query: get following IDs + their routes in one go
  // Pull-to-refresh state
  const touchStartY = useRef<number>(0);
  const [pulling, setPulling] = useState(false);
  const [pullDist, setPullDist] = useState(0);
  const PULL_THRESHOLD = 64;

  // No two-query chain — avoids race conditions with cache
  const { data: feed, isLoading: feedLoading, refetch: refetchFeed } = useQuery({
    queryKey: ["social-feed-v2", user?.id],
    queryFn: async () => {
      if (!user) return { followingIds: [], items: [] };

      // Step 1: who do I follow?
      const { data: followRows } = await supabase
        .from("followers")
        .select("following_id")
        .eq("follower_id", user.id);

      const followingIds = (followRows ?? []).map(r => r.following_id as string);

      // Step 2: routes from followed users + own routes
      const feedUserIds = [...new Set([...followingIds, user.id])];
      const { data: routes } = await supabase
        .from("routes")
        .select("id, city, created_at, ai_summary, user_id, review_photos, likes(user_id), pins(place_name, category, pin_order, latitude, longitude)")
        .in("user_id", feedUserIds)
        .eq("is_shared", true)
        .order("created_at", { ascending: false })
        .limit(30);

      if (!routes || routes.length === 0) return { followingIds, items: [] };

      // Step 3: profiles for all actors
      const actorIds = [...new Set(routes.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, username, first_name, avatar_url")
        .in("id", actorIds);

      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
      const items = routes
        .map(r => ({ route: r, actor: profileMap[r.user_id] ?? null }))
        .filter(i => i.actor);

      return { followingIds, items };
    },
    enabled: !!user,
    staleTime: 0,
    refetchOnMount: "always",
  });

  if (loading) return null;

  // ── Redirect unauthenticated users straight to auth ──
  if (!user) return <Navigate to="/auth" replace />;

  const firstName = (profile as any)?.first_name;
  const feedItems = feed?.items ?? [];

  // ── Feed view (own routes + following) ──
  if (feedLoading || feedItems.length > 0) {
    const handleTouchStart = (e: React.TouchEvent) => {
      touchStartY.current = e.touches[0].clientY;
    };
    const handleTouchMove = (e: React.TouchEvent) => {
      const el = e.currentTarget as HTMLElement;
      if (el.scrollTop > 0) return;
      const dist = Math.max(0, e.touches[0].clientY - touchStartY.current);
      setPullDist(Math.min(dist, PULL_THRESHOLD * 1.5));
    };
    const handleTouchEnd = async () => {
      if (pullDist >= PULL_THRESHOLD) {
        setPulling(true);
        await refetchFeed();
        setPulling(false);
      }
      setPullDist(0);
    };

    return (
      <div
        className="flex-1 flex flex-col pt-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] overflow-y-auto"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Pull indicator */}
        {pullDist > 0 && (
          <div
            className="flex items-center justify-center text-muted-foreground transition-all"
            style={{ height: pullDist, opacity: pullDist / PULL_THRESHOLD }}
          >
            <div className={`h-5 w-5 rounded-full border-2 border-orange-600 border-t-transparent ${pulling ? "animate-spin" : ""}`}
              style={{ transform: `rotate(${(pullDist / PULL_THRESHOLD) * 360}deg)` }}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-2 pb-2 px-4">
          <h1 className="text-xl font-black tracking-tight">Aktywność</h1>
          <button
            onClick={() => navigate("/search")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          >
            <Users className="h-3.5 w-3.5" />
            Znajdź
          </button>
        </div>

        {feedLoading ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Ładowanie...</div>
        ) : (
          <div className="divide-y divide-border/30">
            {feedItems.map(({ route, actor }) => (
              <FeedActivityCard key={route.id} route={route as any} actor={actor as any} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Empty state (no routes at all yet) ──
  return (
    <div className="flex-1 flex flex-col px-4 pt-3 pb-[calc(5rem+env(safe-area-inset-bottom,0px))] gap-3">
      <div className="flex-1 w-full bg-card border border-border/40 rounded-3xl flex flex-col items-center justify-center gap-6 px-8 py-10">
        <div className="relative">
          <div className="w-24 h-24 rounded-full bg-orange-50 flex items-center justify-center">
            <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
              <circle cx="18" cy="16" r="8" fill="#fdba74" />
              <path d="M4 44c0-7.732 6.268-14 14-14s14 6.268 14 14" fill="#fdba74" />
              <circle cx="38" cy="14" r="9" fill="#ea580c" />
              <path d="M22 44c0-8.284 6.716-15 15-15s15 6.716 15 15" fill="#ea580c" />
            </svg>
          </div>
          <div className="absolute -top-1 -right-1 h-7 w-7 rounded-full bg-orange-600 flex items-center justify-center shadow-md">
            <UserPlus className="h-3.5 w-3.5 text-white" />
          </div>
        </div>

        <div className="text-center space-y-2">
          {firstName && <p className="text-sm text-muted-foreground">Hej {firstName} 👋</p>}
          <p className="text-xl font-bold tracking-tight">Nie masz jeszcze znajomych</p>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">
            Zaproś znajomych do TRASA i razem planujcie podróże, śledźcie trasy i inspirujcie się nawzajem.
          </p>
        </div>

        <button
          onClick={() => navigate("/search")}
          className="w-full py-3.5 rounded-2xl bg-orange-600 hover:bg-orange-700 active:scale-[0.98] transition-all text-white font-bold text-base shadow-lg shadow-orange-600/20"
        >
          Dodaj znajomych
        </button>
      </div>

      {user.email === "nat.maz98@gmail.com" && (
        <button
          onClick={() => navigate("/admin/routes")}
          className="self-center text-xs bg-orange-600/10 text-orange-600 font-semibold px-4 py-2 rounded-full"
        >
          🗺️ Trasy wzorcowe
        </button>
      )}
    </div>
  );
};

export default Home;
