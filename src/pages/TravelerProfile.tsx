import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { avatarSrc } from "@/lib/avatar";
import { useAuth } from "@/hooks/useAuth";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Settings, Copy, Check, Camera, UserCircle2, ArrowRight, ArrowUpRight, Map as MapIcon, Building2, Bell, Share2, Search, BarChart3, ListChecks } from "lucide-react";
import TabHeader from "@/components/layout/TabHeader";
import StatCard from "@/components/profile/StatCard";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { SHARE_BASE_URL } from "@/lib/shareUrl";
import { useShare } from "@/hooks/useShare";
import { isNative } from "@/lib/platform";
import { useFollowCounts, useFollowList } from "@/hooks/useFollow";
import { useMyRouteStats } from "@/hooks/useRouteStats";
import NotificationsDrawer from "@/components/layout/NotificationsDrawer";
import InviteFriendsBanner from "@/components/social/InviteFriendsBanner";
import { UserCheck } from "lucide-react";
import { Camera as CapCamera, CameraResultType, CameraSource } from "@capacitor/camera";

// ── InviteSlot ────────────────────────────────────────────────────────────────

function InviteSlot({ code, slot, usedByName, usedByEmail }: {
  code: string;
  slot: number;
  usedByName: string | null;
  usedByEmail: string | null;
}) {
  const { t } = useTranslation("profiles");
  const [copied, setCopied] = useState(false);
  const url = `${SHARE_BASE_URL}/#/join/${code}`;
  const isUsed = !!(usedByName || usedByEmail);
  const share = useShare();

  const handleCopy = async () => {
    const result = await share({ title: t("invite.share_title"), url });
    if (!result.ok) return;
    if (result.method === "clipboard") {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success(t("invite.link_copied"));
    } else {
      toast.success(t("invite.shared"));
    }
  };

  return (
    <div className="bg-card border border-border/50 rounded-2xl p-4 space-y-2.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("invite.slot_label", { slot })}
        </p>
        {isUsed ? (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
            {t("invite.pending")}
          </span>
        ) : (
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {t("invite.unused")}
          </span>
        )}
      </div>
      {isUsed ? (
        <p className="text-sm text-foreground/80">
          {t("invite.invited_label")} <span className="font-semibold">{usedByName || usedByEmail}</span>
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

// ── TravelerProfile ───────────────────────────────────────────────────────────

// ── Guest empty state (same visual rytm jak Journal dla goscia) ──────────────

function GuestProfile() {
  const { t } = useTranslation("profiles");
  const { open } = useAuthDrawer();
  return (
    // Wieksze pb (20vh zamiast 5rem) zeby grupa "ikona+tytul+CTA" landowala
    // wizualnie srodkowo - z mniejszym pb wpada zbyt nisko (Bottom-weight buttona).
    <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 pb-[20vh] text-center">
      <div className="h-20 w-20 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center">
        <UserCircle2 className="h-10 w-10 text-orange-600" />
      </div>
      <div className="space-y-2 max-w-[320px]">
        <p className="text-2xl font-black tracking-tight leading-tight">{t("guest.title")}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {t("guest.desc")}
        </p>
      </div>
      <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
        <button
          onClick={() => open({ mode: "register" })}
          className="w-full px-8 py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {t("guest.register")}
          <ArrowRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => open({ mode: "login" })}
          className="w-full px-8 py-3.5 rounded-full bg-secondary text-secondary-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-transform"
        >
          {t("guest.login")}
        </button>
      </div>
    </div>
  );
}

const TravelerProfile = () => {
  const { t } = useTranslation("profiles");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [followSheet, setFollowSheet] = useState<"followers" | "following" | null>(null);
  const share = useShare();
  // Asymetryczny follow: liczniki + listy obserwujacych/obserwowanych.
  const { data: followCounts = { followers: 0, following: 0 } } = useFollowCounts(user?.id);
  const followList = useFollowList(user?.id, followSheet === "following" ? "following" : "followers");
  const { data: routeStats } = useMyRouteStats();
  // Liczba wlasnych list miejsc (dawne "zestawienia") - do karty "Moje listy".
  const { data: myListsCount = 0 } = useQuery({
    queryKey: ["my-lists-count", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count } = await (supabase as any)
        .from("discovery_collections")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("kind", "ranking");
      return count ?? 0;
    },
  });

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    const allowed = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
    const ext = allowed[file.type as keyof typeof allowed];
    if (!ext) { toast.error(t("profile.avatar_type_error")); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error(t("profile.avatar_size_error")); return; }
    const fileName = `${user.id}/avatar.${ext}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(fileName, file, { upsert: true, contentType: file.type });
    if (uploadError) { toast.error(t("profile.avatar_upload_error")); return; }
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(fileName);
    const bustedUrl = `${publicUrl}?v=${Date.now()}`;
    const { error: updateError } = await supabase.from("profiles").update({ avatar_url: bustedUrl } as any).eq("id", user.id);
    if (updateError) { toast.error(t("profile.avatar_save_error")); return; }
    queryClient.invalidateQueries({ queryKey: ["profile-full", user.id] });
    toast.success(t("profile.avatar_updated"));
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
        toast.error(t("profile.photo_read_error"));
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
      toast.error(t("profile.photo_pick_error"));
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

  const handleShareProfile = async () => {
    if (!profile?.username) { toast.error(t("profile.share_no_username", { defaultValue: "Uzupełnij nazwę użytkownika, aby udostępnić profil." })); return; }
    const url = `${SHARE_BASE_URL}/#/profil/${profile.username}`;
    const res = await share({ title: `@${profile.username}`, url });
    if (res.ok && res.method === "clipboard") toast.success(t("invite.link_copied"));
  };

  const { data: stats } = useQuery({
    queryKey: ["profile-stats", user?.id],
    queryFn: async () => {
      // Ukonczone trasy solo = trip_type 'completed' (ustawiane przy finalizacji/odhaczeniu
      // ostatniego miejsca). Wczesniej liczylo chat_status='completed' ktory nigdy nie byl
      // ustawiany -> licznik zawsze 0.
      const { data: routes } = await (supabase as any)
        .from("routes")
        .select("city, start_date, trip_type, group_session_id")
        .eq("user_id", user!.id)
        .eq("trip_type", "completed")
        .is("group_session_id", null);

      const all = routes ?? [];
      const cities = new Set(all.map((r: any) => r.city).filter(Boolean)).size;
      const days = all.filter((r: any) => r.start_date).length;
      return { trips: all.length, completed: all.length, cities, days };
    },
    enabled: !!user,
    staleTime: 0,
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

  return (
    <div className="min-h-screen bg-background pb-[calc(7rem+env(safe-area-inset-bottom,0px))]">

      {/* Header zakladki: z lewej "Twój Profil", z prawej udostepnij / powiadomienia / ustawienia.
          AppLayout (hideTopBar) dodaje juz pt-safe do <main>, TabHeader dokłada tylko pt-1. */}
      <TabHeader
        title={t("profile.your_profile")}
        right={
          <>
            <button
              onClick={handleShareProfile}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label={t("profile.share_profile_aria")}
            >
              <Share2 className="h-5 w-5" />
            </button>
            {/* Dzwonek = WSZYSTKIE powiadomienia (nowi obserwujacy, sesje grupowe, itp.) */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label={t("profile.notifications_aria")}
            >
              <Bell className="h-5 w-5" />
            </button>
            <button
              onClick={() => navigate("/settings")}
              className="h-9 w-9 flex items-center justify-center rounded-full bg-muted text-foreground active:scale-90 transition-transform"
              aria-label={t("profile.settings_aria")}
            >
              <Settings className="h-5 w-5" />
            </button>
          </>
        }
      />

      <div className="px-4 space-y-6 max-w-lg mx-auto pt-6">

        {/* Avatar + nazwa - WYROWNANE DO LEWEJ (wg zalacznika) */}
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar className="h-[76px] w-[76px]">
              <AvatarImage src={avatarSrc(profile?.avatar_url)} className="object-cover bg-orange-100" />
              <AvatarFallback className="bg-orange-100 text-orange-600 text-3xl font-black">
                {displayName.charAt(0).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {/* Camera button (własna funkcja - upload awatara) */}
            {isNative ? (
              <button
                type="button"
                onClick={handleNativePhotoPick}
                className="absolute bottom-0 right-0 h-7 w-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer shadow-md ring-2 ring-background"
                aria-label={t("profile.change_photo_aria")}
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
            ) : (
              <label className="absolute bottom-0 right-0 h-7 w-7 bg-foreground text-background rounded-full flex items-center justify-center cursor-pointer shadow-md ring-2 ring-background">
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
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-display font-extrabold leading-tight truncate">
              {profile?.username || profile?.first_name || t("profile.user_fallback")}
            </h2>
            {profile?.username && profile?.first_name ? (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">@{profile.username}</p>
            ) : completionPct < 100 ? (
              <p className="text-sm text-muted-foreground mt-0.5">{t("profile.complete_profile", { pct: completionPct })}</p>
            ) : null}
          </div>
        </div>

        {/* Obserwujacy / Obserwowani (asymetryczny follow) + szukanie osob. */}
        <div className="flex items-end gap-8">
          <button onClick={() => setFollowSheet("followers")} className="text-left active:opacity-70 transition-opacity">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.followers")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{followCounts.followers}</p>
          </button>
          <button onClick={() => setFollowSheet("following")} className="text-left active:opacity-70 transition-opacity">
            <p className="text-xs font-medium text-muted-foreground">{t("profile.following")}</p>
            <p className="text-xl font-bold text-foreground mt-0.5 tabular-nums">{followCounts.following}</p>
          </button>
          <div className="flex-1" />
          <button
            onClick={() => navigate("/search")}
            className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-foreground active:scale-90 transition-transform"
            aria-label={t("profile.find_users_aria")}
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        {/* Plany + Miasta (2 kolumny) + Statystyki (pelna szerokosc, pomaranczowa). */}
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              value={stats?.trips ?? 0}
              title={t("sections.routes")}
              subtitle={t("sections.routes_sub")}
              icon={<MapIcon className="h-6 w-6" />}
              className="bg-secondary text-secondary-foreground"
              onClick={() => navigate("/dziennik")}
            />
            <StatCard
              value={stats?.cities ?? 0}
              title={t("sections.cities")}
              subtitle={t("sections.cities_sub")}
              icon={<Building2 className="h-6 w-6" />}
              className="bg-trasa-cream text-trasa-cream-ink"
            />
          </div>
          {/* Moje listy miejsc (polecajki) -> MyCollections. */}
          <StatCard
            full
            value={myListsCount}
            title="Moje listy"
            subtitle="Twoje polecajki miejsc"
            icon={<ListChecks className="h-6 w-6" />}
            className="bg-secondary text-secondary-foreground"
            onClick={() => navigate("/eksploruj", { state: { myCollections: true } })}
          />
          {/* Statystyki wykorzystania tras przez innych -> widok /statystyki. */}
          <StatCard
            full
            value={routeStats?.people ?? 0}
            title={t("sections.stats", "Statystyki")}
            subtitle={t("sections.stats_sub", "wykorzystanie Twoich tras")}
            icon={<BarChart3 className="h-6 w-6" />}
            className="bg-trasa-orange text-trasa-orange-ink"
            onClick={() => navigate("/statystyki")}
          />
        </div>

        {/* Viral: zaproszenie znajomych (ponizej statystyk) */}
        <InviteFriendsBanner />

      </div>


      {/* Obserwujacy / Obserwowani - lista (follow, asymetryczny) */}
      <Sheet open={followSheet !== null} onOpenChange={(v) => { if (!v) setFollowSheet(null); }}>
        <SheetContent side="bottom" className="h-[72dvh] flex flex-col rounded-t-2xl">
          <SheetHeader className="pb-3 border-b border-border/20">
            <SheetTitle>{followSheet === "following" ? t("profile.following") : t("profile.followers")}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-3">
            {followList.isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">…</p>
            ) : (followList.data ?? []).length === 0 ? (
              <div className="px-1 space-y-4 pt-2">
                <p className="text-sm text-muted-foreground text-center">
                  {followSheet === "following" ? t("profile.no_following", "Nie obserwujesz jeszcze nikogo.") : t("profile.no_followers", "Nikt Cię jeszcze nie obserwuje.")}
                </p>
                <InviteFriendsBanner />
                <button onClick={() => { setFollowSheet(null); navigate("/search"); }} className="w-full py-3 rounded-full bg-secondary text-secondary-foreground font-bold text-sm active:scale-[0.97] transition-transform">
                  {t("profile.find_friends")}
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                {(followList.data ?? []).map((p) => (
                  <button key={p.id} onClick={() => { setFollowSheet(null); navigate(`/profil/${p.username}`); }} className="w-full flex items-center gap-3 px-1 py-2 active:bg-muted/40 rounded-xl transition-colors text-left">
                    <Avatar className="h-10 w-10"><AvatarImage src={avatarSrc(p.avatar_url)} className="object-cover bg-orange-100" /><AvatarFallback className="bg-orange-100 text-orange-600 font-bold text-sm">{(p.first_name || p.username || "?").charAt(0).toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{p.first_name || p.username}</p>
                      {p.username && <p className="text-xs text-muted-foreground">@{p.username}</p>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {user && <NotificationsDrawer open={notificationsOpen} onClose={() => setNotificationsOpen(false)} userId={user.id} />}
    </div>
  );
};

export default TravelerProfile;
