import { useParams, useNavigate } from "react-router-dom";
import { avatarSrc } from "@/lib/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, MapPin, Map as MapIcon, Building2, Layers } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import FriendButton from "@/components/social/FriendButton";
import SectionCard from "@/components/profile/SectionCard";

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
            <AvatarImage src={avatarSrc(profile.avatar_url)} className="object-cover bg-orange-100" />
            <AvatarFallback className="bg-orange-100 text-orange-600 text-4xl font-black">
              {displayName?.charAt(0).toUpperCase() || "?"}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-2xl font-black">{displayName}</h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>
          <FriendButton targetUserId={profile.id} className="h-10 px-5 text-sm" />
        </div>

        {/* Sekcje - TEN SAM uklad/kolory co wlasny profil (jeden model mentalny) */}
        <div className="space-y-3">
          <SectionCard bg="bg-trasa-violet" icon={<MapIcon className="h-5 w-5 text-trasa-violet-ink" />} title="Trasy" subtitle="ukończone podróże" value={stats?.trips ?? 0} />
          <SectionCard bg="bg-trasa-cream" icon={<Building2 className="h-5 w-5 text-trasa-cream-ink" />} title="Miasta" subtitle="odwiedzone miejsca" value={stats?.cities ?? 0} />
          <SectionCard bg="bg-trasa-orange" icon={<Layers className="h-5 w-5 text-trasa-orange-ink" />} title="Zestawienia" subtitle="kolekcje miejsc" value={0} />
        </div>

        {/* Udostepnione trasy (lista) */}
        {sharedRoutes.length > 0 && (
          <section className="space-y-3">
            <p className="text-sm font-bold">Udostępnione trasy</p>
            {sharedRoutes.map((route: any) => (
              <button
                key={route.id}
                onClick={() => navigate(`/route/${route.id}`)}
                className="w-full text-left bg-card border border-border/50 rounded-full px-4 py-3 active:scale-[0.98] transition-transform"
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
