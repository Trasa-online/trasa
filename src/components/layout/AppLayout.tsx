import { ReactNode, useRef, useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import OrbOverlay from "./OrbOverlay";
import GuestWelcomeSheet from "@/components/auth/GuestWelcomeSheet";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

interface AppLayoutProps {
  children: ReactNode;
  hideTopBar?: boolean;
}

const AppLayout = ({ children, hideTopBar }: AppLayoutProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation("home");

  // Global redirect po loginie - dziala dla wszystkich method logowania
  // (AuthDrawer password/OAuth/magic link, Auth.tsx page). User wybral miejsca jako
  // anon -> kliknal 'Zaplanuj trase' -> zalogowal/zarejestrowal sie -> tu lapiemy
  // transition (anon|null -> real user) i przenosimy bezposrednio do /create
  // (loading state generowania trasy), pomijajac StartingLocationPicker.
  const prevAuthRef = useRef<{ id: string | null; anon: boolean }>({ id: null, anon: true });
  useEffect(() => {
    const cur = { id: user?.id ?? null, anon: !!(user as any)?.is_anonymous };
    const prev = prevAuthRef.current;
    const justSignedIn = cur.id && !cur.anon && (prev.id !== cur.id || prev.anon);
    prevAuthRef.current = cur;
    if (!justSignedIn) return;
    try {
      const guestRaw = localStorage.getItem("trasa_guest_plan");
      if (guestRaw) {
        const guest = JSON.parse(guestRaw);
        localStorage.removeItem("trasa_guest_plan");
        // /create automatycznie generuje trase z dostarczonego state - od razu loading state
        // generowania, bez powrotu do wyboru startu (step 3) ani swipera (step 4).
        navigate("/create", { state: guest });
        return;
      }
      const demoRaw = localStorage.getItem("trasa_demo_liked");
      if (demoRaw) {
        const demo = JSON.parse(demoRaw);
        localStorage.removeItem("trasa_demo_liked");
        navigate("/create", { state: { city: demo.city, likedPlacesData: demo.places } });
      }
    } catch { /* parse error - ignoruj */ }
  }, [user, navigate]);
  const { data: profile } = useQuery({
    queryKey: ["profile-topbar", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles").select("username, dietary_prefs, travel_interests").eq("id", user.id).single();
      return data;
    },
    enabled: !!user,
  });

  const { data: activeRoutes } = useQuery({
    queryKey: ["active-routes-orb", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("routes")
        .select("id, city, folder_id, day_number")
        .eq("user_id", user.id)
        .in("trip_type", ["planning", "ongoing"])
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const [showOrbOverlay, setShowOrbOverlay] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const handleOrbClick = async () => {
    const greeting = profile?.username
      ? t("greeting_with_name", { name: profile.username })
      : t("greeting");
    setShowOrbOverlay(true);
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }

    // ElevenLabs disabled
  };

  const handleClose = () => {
    if (audioCtxRef.current) { audioCtxRef.current.close(); audioCtxRef.current = null; }
    setIsSpeaking(false);
    setShowOrbOverlay(false);
  };

  return (
    // h-[100dvh] (nie min-h-screen): STALA wysokosc shella = viewport. Dzieki temu
    // strony z wewnetrznym scrollerem (flex-1 min-h-0 + overflow-y-auto, np. Explore,
    // Journal) scrolluja SIE WEWNATRZ, a nie przez scroll body (ktory w natywnym iOS
    // WKWebView bywa martwy -> "nie da sie zjechac w dol"). Bez overflow-hidden:
    // strony oparte o min-h-screen (Profil, Settings) nadal spilluja do scrolla body.
    <div className="flex flex-col h-[100dvh] bg-background">
      {!hideTopBar && <TopBar onOrbClick={handleOrbClick} />}
      {/* hideTopBar routes (HomeSwipe, Explore, Journal, TravelerProfile) renderuja
          wlasny content od top main - bez safe-area trafia pod status bar na iPhone
          z notch. pt-safe (env(safe-area-inset-top, 0px) + 0.75rem) zalatwia globalnie.
          min-h-0: pozwala flex-childom (scrollerom) skurczyc sie ponizej contentu, zeby
          overflow-y:auto faktycznie sie wlaczyl. */}
      <main className={`flex-1 flex flex-col min-h-0 max-w-lg mx-auto w-full${hideTopBar ? " pt-safe" : ""}`}>
        {children}
      </main>
      <BottomNav />
      <GuestWelcomeSheet />
      {showOrbOverlay && (
        <OrbOverlay
          isSpeaking={isSpeaking}
          onClose={handleClose}
          activeRoutes={activeRoutes ?? []}
          userInterests={[...(profile?.dietary_prefs ?? []), ...(profile?.travel_interests ?? [])]}
        />
      )}
    </div>
  );
};

export default AppLayout;
