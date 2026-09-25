import { ReactNode, useRef, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TopBar from "./TopBar";
import BottomNav from "./BottomNav";
import { haptics } from "@/hooks/useHaptics";
import { scrollMainToTop } from "@/lib/scrollTop";
import { useTabSwipe, useTabEnter } from "@/hooks/useTabSwipe";
import OrbOverlay from "./OrbOverlay";
import OfflineBanner from "./OfflineBanner";
import GuestWelcomeSheet from "@/components/auth/GuestWelcomeSheet";
import OnboardingFlow, { useOnboardingGate } from "@/components/onboarding/OnboardingFlow";
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
  const onboarding = useOnboardingGate();
  // Gest w bok miedzy Eksploracja / Miejscami / Profilem + wjazd nowego ekranu (2026-09-25).
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useTabSwipe(mainRef, pathname);
  useTabEnter(mainRef, pathname);
  // Sasiednia zakladka Miejsca ma najciezsze dane (~1 MB wizytowek). Rozgrzewamy jej cache
  // w tle, gdy user stoi na Eksploracji albo Profilu - przesuniecie palcem ma od razu trafic
  // na gotowe karty. Dynamiczny import: PlaceSwiper nie moze wejsc do paczki layoutu.
  useEffect(() => {
    if (pathname !== "/eksploruj" && pathname !== "/moj-profil") return;
    const id = window.setTimeout(() => {
      void import("@/components/plan-wizard/PlaceSwiper").then((m) => m.prewarmPlaceRows()).catch(() => {});
    }, 2500);
    return () => window.clearTimeout(id);
  }, [pathname]);

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
      {/* PASEK STATUSU JAKO CEL TAPNIECIA (prosba Nat 2026-09-16, drugie podejscie).
          W Eksploracji i w Miejscach gorna belka jest w CALOSCI wypelniona polem
          wyszukiwania i dzwonkiem - nie ma w niej ani kawalka "pustego" miejsca, wiec
          `scrollTopTapProps` na belce nie mial czego lapac. Pas nad belka to dokladnie to
          miejsce, w ktore stuka sie w natywnym iOS, i na kazdym ekranie jest pusty
          (`pt-safe` spycha tresc nizej).
          ⚠️ `z-20`: wyzej niz tlo, ale DUZO nizej niz toasty (u gory ekranu) i arkusze -
          inaczej pas przechwytywalby ich tapniecia. Wysokosc = sam inset, wiec na webie
          (brak notcha) element ma 0 px i nie istnieje dla palca.
          ⛔ TYLKO na trasach `hideTopBar` (Eksploracja, Miejsca, Profil, /home). Tam `pt-safe`
          gwarantuje, ze pod insetem NIC nie ma. Na pozostalych ekranach tresc siega samej gory
          (np. pasek "masz zaproszenie" nad belka wyjazdu) i pas przechwytywalby jego guziki.
          Tamte widoki maja tapniecie na wlasnej belce (`scrollTopTapProps`), gdzie wolnego
          miejsca nie brakuje. */}
      {hideTopBar && (
        <div
          aria-hidden
          onClick={() => { if (scrollMainToTop()) haptics.light(); }}
          className="fixed inset-x-0 top-0 z-20"
          style={{ height: "env(safe-area-inset-top, 0px)" }}
        />
      )}
      <main ref={mainRef} className={`flex-1 flex flex-col min-h-0 max-w-lg mx-auto w-full${hideTopBar ? " pt-safe" : ""}`}>
        {children}
      </main>
      <OfflineBanner />
      <BottomNav />
      <GuestWelcomeSheet />
      {onboarding.show && <OnboardingFlow onDone={onboarding.hide} />}
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
