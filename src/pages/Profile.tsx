import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import TripFeedCard from "@/components/feed/TripFeedCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Settings, MapPin, Plus } from "lucide-react";

const Profile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId } = useParams<{ userId: string }>();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: friendsCount } = useQuery({
    queryKey: ["friends-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("followers")
        .select("*", { count: "exact", head: true })
        .eq("follower_id", userId!);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: routesCount } = useQuery({
    queryKey: ["user-routes-count", userId],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("routes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("status", "published");
      if (error) throw error;
      return count || 0;
    },
    enabled: !!userId,
  });

  const { data: routes } = useQuery({
    queryKey: ["user-routes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select(`
          *,
          profiles:user_id (username, avatar_url),
          pins (id, place_name, address, image_url, images, tags, rating, pin_order, expectation_met, pros, cons, trip_role, one_liner, recommended_for),
          likes (user_id),
          comments (id)
        `)
        .eq("user_id", userId!)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userId,
  });

  const { data: isFollowing } = useQuery({
    queryKey: ["is-following", user?.id, userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("followers")
        .select("*")
        .eq("follower_id", user!.id)
        .eq("following_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!userId && user.id !== userId,
  });

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("read", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Oblicz totalPlaces ze wszystkich tras
  const totalPlaces = routes?.reduce((sum, r) => sum + (r.pins?.length || 0), 0) || 0;

  // Zbierz unikalne tagi stylu podróżowania z recommended_for i pros wszystkich pinów
  const travelStyleTags = useMemo(() => {
    if (!routes) return [];
    const allTags: string[] = [];
    routes.forEach((route: any) => {
      route.pins?.forEach((pin: any) => {
        if (pin.recommended_for) allTags.push(...pin.recommended_for);
        if (pin.pros) allTags.push(...pin.pros);
      });
    });
    const freq = new Map<string, number>();
    allTags.forEach(tag => freq.set(tag, (freq.get(tag) || 0) + 1));
    return [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tag]) => tag);
  }, [routes]);

  // Wyciągnij kraje z adresów pinów
  const countriesData = useMemo(() => {
    if (!routes) return [];
    const countryRoutes = new Map<string, number>();
    routes.forEach((route: any) => {
      const firstPin = route.pins?.sort((a: any, b: any) => a.pin_order - b.pin_order)?.[0];
      if (!firstPin?.address) return;
      const parts = firstPin.address.split(",").map((s: string) => s.trim());
      const country = parts[parts.length - 1] || "Nieznany";
      countryRoutes.set(country, (countryRoutes.get(country) || 0) + 1);
    });
    return [...countryRoutes.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([country, count]) => ({ country, count }));
  }, [routes]);

  // Oblicz statystyki zaufania
  const trustStats = useMemo(() => {
    if (!routes) return null;
    const totalLikes = routes.reduce((sum, r) => sum + (r.likes?.length || 0), 0);
    const totalComments = routes.reduce((sum, r) => sum + (r.comments?.length || 0), 0);
    const allPins = routes.flatMap((r: any) => r.pins || []);
    const verifiedPins = allPins.filter((p: any) => p.expectation_met);
    const verificationRate = allPins.length > 0 ? Math.round((verifiedPins.length / allPins.length) * 100) : 0;
    const mustSeePins = allPins.filter((p: any) => p.trip_role === "must_see");
    return {
      totalLikes,
      totalComments,
      totalPins: allPins.length,
      verificationRate,
      mustSeeCount: mustSeePins.length,
      routesCount: routes.length,
    };
  }, [routes]);

  const handleFollowToggle = async () => {
    if (!user || !userId) return;

    if (isFollowing) {
      await supabase
        .from("followers")
        .delete()
        .eq("follower_id", user.id)
        .eq("following_id", userId);
    } else {
      await supabase
        .from("followers")
        .insert({
          follower_id: user.id,
          following_id: userId,
        });
    }

    queryClient.invalidateQueries({ queryKey: ["is-following", user?.id, userId] });
    queryClient.invalidateQueries({ queryKey: ["friends-count", userId] });
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return null;
  }

  return (
    <AppLayout>
      <PageHeader 
        title="Profil" 
        showBack 
        showBell 
        showSearch 
        unreadCount={unreadCount}
        rightAction={
          user?.id === userId ? (
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => navigate("/settings")}>
              <Settings className="h-5 w-5" />
            </Button>
          ) : undefined
        }
      />
      
      <div className="p-4 space-y-4">

      {profile && (
        <div className="space-y-3">
          {/* Górna część: avatar + info + akcja */}
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16 flex-shrink-0 border-2 border-primary/20">
              <AvatarImage src={profile.avatar_url || ""} alt={profile.username} />
              <AvatarFallback className="text-lg font-bold">{profile.username[0].toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 min-w-0 space-y-2">
              {/* Username + follow */}
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-base font-bold uppercase truncate">{profile.username}</h2>
                {user.id !== userId && (
                  <Button
                    onClick={handleFollowToggle}
                    variant={isFollowing ? "outline" : "default"}
                    size="sm"
                    className="flex-shrink-0 text-xs h-8"
                  >
                    {isFollowing ? "Obserwujesz" : "Obserwuj"}
                  </Button>
                )}
              </div>

              {/* Statystyki w jednej linii */}
              <div className="flex gap-4 text-sm">
                <button 
                  onClick={() => navigate(`/friends/${userId}`)}
                  className="hover:opacity-70 transition-opacity"
                >
                  <span className="font-semibold">{friendsCount}</span>
                  <span className="text-muted-foreground ml-1">obserwujących</span>
                </button>
                <div className="hover:opacity-70 transition-opacity">
                  <span className="font-semibold">{routesCount}</span>
                  <span className="text-muted-foreground ml-1">tras</span>
                </div>
                {totalPlaces > 0 && (
                  <div className="hover:opacity-70 transition-opacity">
                    <span className="font-semibold">{totalPlaces}</span>
                    <span className="text-muted-foreground ml-1">miejsc</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tagi stylu podróżowania */}
          {travelStyleTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {travelStyleTags.map((tag: string, idx: number) => (
                <span key={idx} className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Bio – jako cytat podróżniczy */}
          {profile.bio && (
            <p className="text-sm text-muted-foreground italic leading-relaxed">
              {profile.bio}
            </p>
          )}
        </div>
      )}

      {countriesData.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">
            Gdzie podróżuje
          </h3>
          <div className="flex flex-wrap gap-2">
            {countriesData.slice(0, 6).map(({ country, count }) => (
              <div
                key={country}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-lg border border-border/50"
              >
                <span className="text-sm font-medium">{country}</span>
                <span className="text-[11px] text-muted-foreground">
                  {count} {count === 1 ? 'trasa' : count < 5 ? 'trasy' : 'tras'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {user.id !== userId && trustStats && trustStats.routesCount > 0 && (
        <div className="space-y-3">
          <h3 className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">
            W liczbach
          </h3>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
              <p className="text-lg font-bold">{trustStats.totalPins}</p>
              <p className="text-[11px] text-muted-foreground">miejsc opisanych</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
              <p className="text-lg font-bold">{trustStats.mustSeeCount}</p>
              <p className="text-[11px] text-muted-foreground">obowiązkowych</p>
            </div>
            <div className="bg-muted/30 rounded-xl p-3 border border-border/50 text-center">
              <p className="text-lg font-bold">{trustStats.verificationRate}%</p>
              <p className="text-[11px] text-muted-foreground">zweryfikowanych</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {trustStats.verificationRate >= 80 && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 font-medium">
                ✓ Sprawdzone trasy
              </span>
            )}
            {trustStats.routesCount >= 3 && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 font-medium">
                ✓ Regularny twórca
              </span>
            )}
            {trustStats.totalPins >= 20 && (
              <span className="text-[11px] px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 font-medium">
                ⭐ Szczegółowe opisy
              </span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4">
        <h3 className="text-[13px] font-medium text-muted-foreground tracking-wide uppercase">
          {user.id === userId ? "Twoje trasy" : `Trasy (${routes?.length || 0})`}
        </h3>
        {routes && routes.length > 0 ? (
          <div className="space-y-4">
            {routes.map((route) => (
              <TripFeedCard key={route.id} route={route} currentUserId={user?.id} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="bg-muted rounded-full p-4 mb-3">
              <MapPin className="h-10 w-10 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium mb-1">
              {user.id === userId ? "Nie masz jeszcze opublikowanych tras" : "Brak opublikowanych tras"}
            </p>
            <p className="text-xs text-muted-foreground mb-3 max-w-[240px]">
              {user.id === userId ? "Stwórz trasę i podziel się swoimi podróżami" : "Ten podróżnik nie opublikował jeszcze żadnej trasy"}
            </p>
            {user.id === userId && (
              <Button variant="outline" size="sm" onClick={() => navigate("/create")}>
                <Plus className="h-4 w-4 mr-1.5" />
                Stwórz trasę
              </Button>
            )}
          </div>
        )}
      </div>
      </div>
    </AppLayout>
  );
};

export default Profile;
