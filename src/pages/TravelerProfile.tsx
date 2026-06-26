import { useState } from "react";
import { avatarSrc } from "@/lib/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, Copy, Check, Camera, UserCircle2, ArrowRight, ArrowUpRight, Map as MapIcon, Building2, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SHARE_BASE_URL } from "@/lib/shareUrl";
import { useShare } from "@/hooks/useShare";
import { isNative } from "@/lib/platform";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";

// ── InviteSlot ────────────────────────────────────────────────────────────────

function InviteSlot({ code, slot, usedByName, usedByEmail }: {
  code: string;
  slot: number;
  usedByName: string | null;
  usedByEmail: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const url = `${SHARE_BASE_URL}/#/join/${code}`;
  const isUsed = !!(usedByName || usedByEmail);
  const share = useShare();

  const handleCopy = async () => {
    const result = await share({ title: "Zaproszenie do Trasy", url });
    if (!result.ok) return;
    if (result.method === "clipboard") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success("Link skopiowany");
    } else {
      toast.success("Udostępniono");
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Zaproszenie {slot}
        </p>
        {isUsed ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            Czeka na akceptację
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            Niewykorzystane
          </span>
        )}
      </div>
      {isUsed ? (
        <p className="text-sm text-foreground/80">
          Zaproszono: <span className="font-semibold">{usedByName || usedByEmail}</span>
        </p>
      ) : (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-muted rounded-2xl px-3 py-2 text-xs text-muted-foreground font-mono truncate">
            {url}
          </div>
          <button
            onClick={handleCopy}
            className="h-9 w-9 flex items-center justify-center rounded-2xl border border-border bg-background active:bg-muted transition-colors flex-shrink-0"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
          </button>
        </div>
      )}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

// ── SectionCard ─────────────────────────────────────────────────────────────
// Kolorowa, ulozona w stos "sekcja" jak w zalaczniku koncepcyjnym: ikona w bialym
// zaokraglonym kwadracie (lewy gorny rog), strzalka (prawy gorny), tytul + podtytul
// na dole-lewej, duza liczba po prawej. Trzy odcienie odrozniaja sekcje od siebie.
function SectionCard({ icon, title, subtitle, value, bg, onClick }: {
  icon: React.ReactNode; title: string; subtitle: string; value: number | string;
  bg: string; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("w-full text-left rounded-3xl p-5 active:scale-[0.99] transition-transform", bg)}
    >
      <div className="flex items-start justify-between">
        <div className="h-11 w-11 rounded-2xl bg-white shadow-sm flex items-center justify-center">{icon}</div>
        <ArrowUpRight className="h-5 w-5 text-[#0E0E0E]/55" />
      </div>
      <div className="flex items-end justify-between gap-3 mt-7">
        <div className="min-w-0">
          <p className="text-xl font-display font-extrabold leading-tight text-[#0E0E0E]">{title}</p>
          <p className="text-xs font-medium text-[#0E0E0E]/55 mt-0.5">{subtitle}</p>
        </div>
        <span className="text-4xl font-black text-[#0E0E0E] leading-none tabular-nums shrink-0">{value}</span>
      </div>
    </button>
  );
}

// ── TravelerProfile ───────────────────────────────────────────────────────────

// ── Guest empty state (same visual rytm jak Journal dla goscia) ──────────────

function GuestProfile() {
  const { open } = useAuthDrawer();
  return (
    // Wieksze pb (20vh zamiast 5rem) zeby grupa "ikona+tytul+CTA" landowala
    // wizualnie srodkowo - z mniejszym pb wpada zbyt nisko (Bottom-weight buttona).
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-[20vh] text-center">
      <div className="h-20 w-20 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
        <UserCircle2 className="h-10 w-10 text-orange-600" />
      </div>
      <div className="space-y-2 max-w-[320px]">
        <p className="text-2xl font-black tracking-tight leading-tight">Twój profil podróżnika</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Załóż konto, żeby zbudować swój profil, zapraszać znajomych i&nbsp;śledzić podróże w&nbsp;jednym miejscu.
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
        <button
          onClick={() => open({ mode: "register" })}
          className="w-full px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          Załóż konto
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => open({ mode: "login" })}
          className="w-full px-8 py-3.5 rounded-full bg-white border-2 border-orange-600 text-orange-600 font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          Zaloguj się
        </button>
      </div>
    </div>
  );
}

const TravelerProfile = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const allowed = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
    const ext = allowed[file.type as keyof typeof allowed];
    if (!ext) { toast.error("Tylko JPG, PNG lub WebP"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Maks 5 MB"); return; }
    const fileName = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error("Błąd podczas przesyłania zdjęcia"); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const bustedUrl = `${publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: bustedUrl } as any).eq("id", user.id);
    if (updateError) { toast.error("Błąd zapisu profilu"); return; }
    queryClient.invalidateQueries({ queryKey: ["profile-full", user.id] });
    toast.success("Zdjęcie zaktualizowane!");
  };

  const handleNativePhotoPick = async () => {
    try {
      const photo = await CapCamera.getPhoto({
        resultType: CameraResultType.Base64,
        source: CameraSource.Photos,
        quality: 90,
        width: 800,
        height: 800,
      });
      if (!photo.base64String) {
        toast.error("Nie udało się odczytać zdjęcia");
        return;
      }
      const format = photo.format || "jpeg";
      const mime = format === "png" ? "image/png" : format === "webp" ? "image/webp" : "image/jpeg";
      const binary = atob(photo.base64String);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], `avatar.${format}`, { type: mime });
      await handleAvatarUpload(file);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (msg.toLowerCase().includes("cancel") || msg.toLowerCase().includes("denied")) return;
      console.error("[TravelerProfile] native photo pick failed:", msg);
      toast.error("Nie udało się wybrać zdjęcia");
    }
  };

  const { data: profile } = useQuery({
    queryKey: ["profile-full", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username, avatar_url, first_name")
        .eq("id", user!.id)
        .single();
      return data as any;
    },
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      // Only count solo (non-group-session) completed routes
      const { data: routes } = await (supabase as any)
        .from("routes")
        .select("city, start_date, chat_status, group_session_id")
        .eq("user_id", user!.id)
        .eq("chat_status", "completed")
        .is("group_session_id", null);

      const all = routes ?? [];
      const cities = new Set(all.map((r: any) => r.city).filter(Boolean)).size;
      const days = all.filter((r: any) => r.start_date).length;
      return { trips: all.length, completed: all.length, cities, days };
    },
    enabled: !!user,
    staleTime: 0,
  });

  // Liczba zestawien (discovery_collections) stworzonych przez uzytkownika.
  const { data: collectionsCount = 0 } = useQuery({
    queryKey: ["profile-collections-count", user?.id],
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("discovery_collections")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user!.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const { data: followersList = [] } = useQuery({
    queryKey: ["followers-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("followers")
        .select("follower_id, profiles!followers_follower_id_fkey(username, first_name, avatar_url)")
        .eq("following_id", user.id);
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });
  const { data: followingList = [] } = useQuery({
    queryKey: ["following-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("followers")
        .select("following_id, profiles!followers_following_id_fkey(username, first_name, avatar_url)")
        .eq("follower_id", user.id);
      return (data ?? []) as any[];
    },
    enabled: !!user,
  });

  if (loading) return null;

  // Guest lub anon: wycentrowany empty state. Anon traktujemy jak gosc bo
  // profil bez maila/username nie ma sensownej zawartosci do pokazania.
  if (!user || user.is_anonymous) {
    return <GuestProfile />;
  }

  const displayName = profile?.username || profile?.first_name || "";

  // Profile completion: avatar, first_name, username = 3 fields
  const completionFields = [!!profile?.avatar_url, !!profile?.first_name, !!profile?.username];
  const completionPct = Math.round((completionFields.filter(Boolean).length / completionFields.length) * 100);

  // "Znajomi" = obserwacje wzajemne (ja obserwuje ich I oni obserwuja mnie).
  const followerIdSet = new Set((followersList ?? []).map((f: any) => f.follower_id));
  const friendsCount = (followingList ?? []).filter((f: any) => followerIdSet.has(f.following_id)).length;

  return (
    <div className="min-h-screen bg-background pb-24">

      {/* Header - tytul do lewej, jak strona glowna ("Twoje trasy") */}
      <div className="relative flex items-center justify-between gap-2 px-5 pt-3 pb-2.5 after:content-[''] after:absolute after:bottom-0 after:left-4 after:right-4 after:h-px after:bg-border/40">
        <h1 className="text-xl font-display font-extrabold tracking-tight">Mój profil</h1>
        <button
          onClick={() => navigate("/settings")}
          className="h-9 w-9 flex items-center justify-center rounded-2xl text-muted-foreground hover:bg-muted transition-colors active:scale-90"
          aria-label="Ustawienia"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>

      <div className="px-5 space-y-5 max-w-lg mx-auto">

        {/* Header: avatar + username (lewo), znajomi (prawo) */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="relative shrink-0">
              <Avatar className="h-[72px] w-[72px]">
                <AvatarImage src={avatarSrc(profile?.avatar_url)} className="object-cover bg-orange-100" />
                <AvatarFallback className="bg-orange-100 text-orange-600 text-2xl font-black">
                  {displayName.charAt(0).toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              {/* Camera button */}
              {isNative ? (
                <button
                  type="button"
                  onClick={handleNativePhotoPick}
                  className="absolute -bottom-1 -right-1 h-7 w-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer shadow-md"
                  aria-label="Zmień zdjęcie profilowe"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              ) : (
                <label className="absolute -bottom-1 -right-1 h-7 w-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer shadow-md">
                  <Camera className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }}
                  />
                </label>
              )}
            </div>
            <div className="min-w-0">
              <h2 className="text-2xl font-display font-extrabold leading-tight truncate">
                {profile?.username || profile?.first_name || "Użytkownik"}
              </h2>
              {profile?.username && profile?.first_name ? (
                <p className="text-sm text-muted-foreground mt-0.5 truncate">@{profile.username}</p>
              ) : completionPct < 100 ? (
                <p className="text-sm text-muted-foreground mt-0.5">Uzupełnij profil ({completionPct}%)</p>
              ) : null}
            </div>
          </div>

          {/* Znajomi (obserwacje wzajemne) - po prawej */}
          <button
            onClick={() => setFollowSheet("following")}
            className="shrink-0 flex flex-col items-center px-2 active:opacity-60 transition-opacity"
          >
            <span className="text-2xl font-black leading-none">{friendsCount}</span>
            <span className="text-xs text-muted-foreground font-medium mt-1">znajomi</span>
          </button>
        </div>

        {/* Trzy sekcje (stacked, kolorowe) - jak w zalaczniku */}
        <div className="space-y-3">
          <SectionCard
            bg="bg-trasa-violet"
            icon={<MapIcon className="h-5 w-5 text-trasa-violet-ink" />}
            title="Trasy"
            subtitle="ukończone podróże"
            value={stats?.trips ?? 0}
            onClick={() => navigate("/dziennik")}
          />
          <SectionCard
            bg="bg-trasa-cream"
            icon={<Building2 className="h-5 w-5 text-trasa-cream-ink" />}
            title="Miasta"
            subtitle="odwiedzone miejsca"
            value={stats?.cities ?? 0}
            onClick={() => navigate("/dziennik")}
          />
          <SectionCard
            bg="bg-trasa-orange"
            icon={<Layers className="h-5 w-5 text-trasa-orange-ink" />}
            title="Zestawienia"
            subtitle="Twoje kolekcje miejsc"
            value={collectionsCount}
            onClick={() => navigate("/eksploruj", { state: { myCollections: true } })}
          />
        </div>

      </div>

      <Sheet open={followSheet !== null} onOpenChange={(v) => { if (!v) setFollowSheet(null); }}>
        <SheetContent side="bottom" className="h-[60dvh] flex flex-col rounded-t-2xl">
          <SheetHeader className="pb-3 border-b border-border/20">
            <SheetTitle>{followSheet === "followers" ? "Obserwujący" : "Obserwuje"}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-2">
            {(followSheet === "followers" ? followersList : followingList).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Brak użytkowników</p>
            ) : (
              <div className="space-y-1">
                {(followSheet === "followers" ? followersList : followingList).map((item: any) => {
                  const profile = item.profiles;
                  const name = profile?.first_name || profile?.username || "Użytkownik";
                  return (
                    <div key={item.follower_id ?? item.following_id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="h-9 w-9 rounded-full bg-orange-100 flex items-center justify-center text-sm font-bold text-orange-600 shrink-0">
                        {name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{name}</p>
                        {profile?.username && <p className="text-xs text-muted-foreground">@{profile.username}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TravelerProfile;
