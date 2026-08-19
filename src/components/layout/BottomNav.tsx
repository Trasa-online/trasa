import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { BookOpen, Compass, Map, X, MapPin, User, Heart, ArrowLeft, Layers, Bookmark } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTodayLikes, type ExploreLike } from "@/lib/exploreLikes";
import { isNative } from "@/lib/platform";
import { PLANNING_DISABLED } from "@/lib/appMode";
import { haptics } from "@/hooks/useHaptics";

const HOME_FILTERS_KEY = "trasa_home_filters";

// Kafelek akcji w drawerze "+" (ikona w szarym kwadracie + podpis pod spodem),
// uklad wzorowany na arkuszu tworzenia z Pinteresta.
// Ikona nawigacji z pliku SVG (public/Ikona_*.svg). Uzywa CSS mask + currentColor, wiec
// przejmuje kolor tekstu rodzica (czarny #0E0E0E gdy aktywna, szary gdy nie) - jak ikony lucide.
const NavIcon = ({ src, className = "h-5 w-5" }: { src: string; className?: string }) => (
  <span
    aria-hidden
    className={className}
    style={{
      backgroundColor: "currentColor",
      WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`,
      WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
      WebkitMaskSize: "contain", maskSize: "contain",
      WebkitMaskPosition: "center", maskPosition: "center",
      display: "inline-block",
    }}
  />
);

const ActionTile = ({ icon: Icon, label, onClick }: { icon: LucideIcon; label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="flex flex-col items-center gap-2 w-20 active:scale-95 transition-transform"
  >
    <span className="h-[72px] w-[72px] rounded-2xl bg-secondary flex items-center justify-center">
      <Icon className="h-6 w-6 text-secondary-foreground" />
    </span>
    <span className="text-xs font-medium text-foreground text-center leading-tight">{label}</span>
  </button>
);

function getActiveHomeCity(): string {
  try {
    const raw = localStorage.getItem(HOME_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.city === "string" && parsed.city) return parsed.city;
    }
  } catch { /* unavailable */ }
  return "Warszawa";
}

const BottomNav = () => {
  const { t } = useTranslation("nav");
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [reusePrompt, setReusePrompt] = useState<{ city: string; likes: ExploreLike[] } | null>(null);
  // Menu "+": tworzenie wyjazdu SOLO / zestawienia. Trasy grupowe powstaja jako wyjazd solo,
  // a potem zapraszasz znajomych z widoku trasy (InviteFriendsSheet) - bez osobnej "sesji".
  // planStep uzywany tylko w legacy (nie-uproszczonym) trybie planowania.
  const [planStep, setPlanStep] = useState(false);
  useEffect(() => { if (!showMenu) setPlanStep(false); }, [showMenu]);

  // Inne ekrany (np. baner "Zaplanuj nową trasę" w dzienniku) moga otworzyc to
  // samo menu nad orba "+" zamiast wlasnego drawera.
  useEffect(() => {
    const open = () => setShowMenu(true);
    window.addEventListener("trasa:open-plan-menu", open);
    return () => window.removeEventListener("trasa:open-plan-menu", open);
  }, []);

  // Ukrywanie nawigacji (np. gdy fokus na wyszukiwarce eksploracji + klawiatura).
  // Inne ekrany dispatchuja "trasa:hide-bottomnav" z detail=true/false.
  const [navHidden, setNavHidden] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => setNavHidden(!!(e as CustomEvent).detail);
    window.addEventListener("trasa:hide-bottomnav", handler);
    return () => window.removeEventListener("trasa:hide-bottomnav", handler);
  }, []);
  // Zawsze pokaz nav przy zmianie ekranu (bezpiecznik).
  useEffect(() => { setNavHidden(false); }, [location.pathname]);

  // Publikuj wysokosc paska jako CSS var, zeby toasty (Sonner) siadaly tuz nad nawigacja
  // gdy jest widoczna, a przy samym dole gdy ukryta (np. przegladanie). Cleanup -> 0 gdy
  // BottomNav zniknie z ekranu (pelnoekranowe flow bez nawigacji).
  useEffect(() => {
    const root = document.documentElement;
    // Nav widoczny: 5rem + bezpieczna strefa. Ukryty: sama bezpieczna strefa (toast i tak
    // ma zostac nad home-indicatorem, nie pod nim). Toast dokłada tylko +10px odstepu.
    root.style.setProperty("--trasa-nav-offset", navHidden ? "env(safe-area-inset-bottom, 0px)" : "calc(5rem + env(safe-area-inset-bottom, 0px))");
    return () => { root.style.setProperty("--trasa-nav-offset", "env(safe-area-inset-bottom, 0px)"); };
  }, [navHidden]);

  // Badge kropka na ikonie Dziennik gdy uzytkownik ma niewidziane trasy
  // (routes.new_for_users zawiera user.id). Refetch przy navigation - gdy user
  // wraca na Home, kropka znika lub pojawia sie wedlug stanu DB. Query tylko w native
  // bo Dziennik dla web jest ukryty.
  const { data: hasNewJournalEntries = false, refetch: refetchJournalBadge } = useQuery({
    queryKey: ["journal-badge", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { count } = await (supabase as any)
        .from("routes")
        .select("id", { count: "exact", head: true })
        .contains("new_for_users", [user.id]);
      return (count ?? 0) > 0;
    },
    enabled: !!user?.id && isNative,
    staleTime: 30_000,
  });

  // Refetch przy zmianie route (np. wyjscie z /dziennik - kropka mogla zostac wyczyszczona)
  useEffect(() => {
    if (user?.id && isNative) refetchJournalBadge();
  }, [location.pathname, user?.id, refetchJournalBadge]);

  const handleSoloPlan = () => {
    setShowMenu(false);
    // Popup "wykorzystac polubione z dzis" przeniesiony do PlanWizard (krok swipera, PO
    // wyborze miasta+daty, bazujac na polubieniach w wybranym miescie). Tutaj tylko
    // wchodzimy w kreator - bez przedwczesnego pytania na menu "+".
    void getActiveHomeCity; void getTodayLikes; // helpery zostaja (reuse modal dormant)
    navigate("/plan");
  };

  // Tworzenie zestawienia (Lista / Plan) - ten sam flow co z eksploracji, ale dostepny
  // takze z menu "+" na kazdym ekranie z BottomNavem.
  const handleCreateCollection = () => {
    setShowMenu(false);
    // Lista NIE wymaga miasta (moze byc globalna) -> wprost do formy, bez drumu kraj+miasto.
    navigate("/zestawienie/nowe");
  };

  // Tryb uproszczony: "Stworz wyjazd" = miasto + daty + swiper miejsc -> wyjazd (bez planu AI).
  const handleCreateWyjazd = () => {
    setShowMenu(false);
    navigate("/plan", { state: { wyjazdMode: true } });
  };

  const handleReuseAccept = () => {
    if (!reusePrompt) return;
    const { city, likes } = reusePrompt;
    setReusePrompt(null);
    navigate("/plan", {
      state: {
        // Step 4 = PlaceSwiper (po refactor wizard: 1=City, 2=Date, 3=Starting,
        // 4=Swiper). Wczesniej step 3 byl CategoryPicker, ale ten zostal
        // usuniety - filtrowanie kategorii jest teraz w PlaceSwiper.
        step: 4,
        city,
        date: new Date().toISOString(),
        likedPlaceNames: likes.map(l => l.place_name),
      },
    });
  };

  const handleReuseDecline = () => {
    setReusePrompt(null);
    navigate("/plan");
  };

  return (
    <>
      {/* Menu "+" - dolny drawer w stylu kafelkow (ikona + podpis), wzor: arkusz
          tworzenia z Pinteresta. Krok 1 = [Stworz zestawienie | Stworz plan];
          "Stworz plan" -> krok 2 = [Solo | Grupowo | Dolacz do sesji]. */}
      {showMenu && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-5 pb-[max(28px,env(safe-area-inset-bottom))] flex flex-col gap-6 shadow-2xl animate-sheet-up"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: X (lub Wroc) po lewej, tytul wysrodkowany, spacer po prawej */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => (planStep ? setPlanStep(false) : setShowMenu(false))}
                className="h-9 w-9 -ml-1.5 flex items-center justify-center rounded-full text-foreground active:bg-muted transition-colors"
                aria-label={planStep ? t("back") : t("cancel")}
              >
                {planStep ? <ArrowLeft className="h-5 w-5" /> : <X className="h-5 w-5" />}
              </button>
              <h2 className="text-base font-black text-foreground">
                {planStep ? (PLANNING_DISABLED ? "Nowy wyjazd" : t("menu_plan_title")) : t("menu_title")}
              </h2>
              <div className="w-9" />
            </div>

            {/* Wiersz kafelkow akcji */}
            <div className="flex justify-center gap-6 pb-1">
              {PLANNING_DISABLED ? (
                // Tryb uproszczony: [Stworz wyjazd (solo) | Stworz zestawienie]. Grupowa trasa =
                // wyjazd solo + zaproszenie znajomych z widoku trasy (bez osobnej sesji).
                <>
                  <ActionTile icon={MapPin} label="Stwórz wyjazd" onClick={handleCreateWyjazd} />
                  <ActionTile icon={Layers} label={t("create_collection")} onClick={handleCreateCollection} />
                </>
              ) : !planStep ? (
                <>
                  <ActionTile icon={Layers} label={t("create_collection")} onClick={handleCreateCollection} />
                  <ActionTile icon={MapPin} label={t("plan")} onClick={() => setPlanStep(true)} />
                </>
              ) : (
                <>
                  <ActionTile icon={MapPin} label={t("plan_solo")} onClick={handleSoloPlan} />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reuse likes prompt */}
      {reusePrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setReusePrompt(null)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-black leading-snug">
                  {t("reuse_title")}
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {t("reuse_have")} <strong>{reusePrompt.likes.length}</strong>{" "}
                  {reusePrompt.likes.length === 1 ? t("reuse_place_one") : reusePrompt.likes.length < 5 ? t("reuse_place_few") : t("reuse_place_many")}{" "}
                  {t("reuse_from", { city: reusePrompt.city })}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleReuseAccept}
                className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
              >
                {t("reuse_accept")}
              </button>
              <button
                onClick={handleReuseDecline}
                className="w-full py-3 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
              >
                {t("reuse_decline")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* left-1/2 -translate-x-1/2 + w-full max-w-lg centruje cala nawigacje na web
          (na mobile w-full bo viewport < max-w-lg, ten sam efekt co left-0 right-0).
          Wczesniej left-0 right-0 rozciagal bg na pelna szerokosc na web ale ikonki
          byly w max-w-lg mx-auto - rozjazd. */}
      {/* Floating nav: biala karta odklejona od krawedzi + lekki cien (natywny feel).
          Outer = transparentny kontener (pointer-events-none) z marginesem + safe-area;
          inner = bialy pill z cieniem (pointer-events-auto). */}
      {!navHidden && (
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex justify-center px-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] pointer-events-none">
        {/* IA 2026-08-20: 3 pozycje. Native: Eksploruj · + · Profil. Web: Wyjazdy(/home) · + · Profil.
            Pill HUG (nie full-width) i wyśrodkowany - węższy pasek. Fat-thumb: każdy target w-16 (64px)
            × h-14 (56px), pill px-1.5. */}
        {/* Ikony + nazwy zakladek pod spodem (orange active). */}
        <div className="pointer-events-auto bg-white/70 backdrop-blur-2xl rounded-[26px] border border-white/50 shadow-[0_8px_28px_-8px_rgba(0,0,0,0.12)] px-4">
          <div className="flex items-center gap-3 h-14">

          {/* Eksploruj - landing (skrajnie z lewej). Tylko w native iOS/Android.
              Web/PWA ukrywa (na web B2C jest za waitlista). */}
          {isNative && (
            <NavLink
              to="/eksploruj"
              end={false}
              className="w-16 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-foreground"
            >
              {({ isActive }) => (
                <>
                  <NavIcon src="/Ikona_Eksploracja.svg" />
                  <span className="text-[9px] font-semibold leading-tight mt-0.5">Eksploruj</span>
                </>
              )}
            </NavLink>
          )}

          {/* Slot 2: TYLKO web (stary flow) -> Wyjazdy (/home). Native: brak - Wyjazdy to teraz
              zakładka profilu. */}
          {!PLANNING_DISABLED && (
            <NavLink
              to="/home"
              end
              className="w-16 flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-foreground"
            >
              {({ isActive }) => (
                <>
                  <NavIcon src="/Ikona_Trasy.svg" />
                  <span className="text-[9px] font-semibold leading-tight mt-0.5">Wyjazdy</span>
                </>
              )}
            </NavLink>
          )}

          {/* Center FAB. Tryb uproszczony: "+" prowadzi PROSTO na ekran kompozycji trasy
              (/wyjazd/nowy) - jedyna akcja tworzenia (zestawienia usuniete 2026-07-26).
              Stary flow (web): otwiera menu wyboru (plan/zestawienie). */}
          <button
            data-ob="nav-fab"
            onClick={() => {
              haptics.light();
              if (!PLANNING_DISABLED) { setShowMenu(!showMenu); return; }
              navigate("/utworz");
            }}
            className="w-16 flex items-center justify-center"
            aria-label={t("fab_aria")}
          >
            <span className={`h-11 w-11 rounded-full flex items-center justify-center active:scale-95 transition-transform ${showMenu ? "bg-primary shadow-sm" : ""}`}>
              {showMenu ? (
                <X className="h-6 w-6 text-white stroke-[2.5px]" />
              ) : (
                /* Ikona_Dodaj w brandowym pomaranczowym kole + bialy plus (wg zalacznika). */
                <img src="/Ikona_Dodaj_orange.svg" alt="" className="h-11 w-11 object-contain" draggable={false} />
              )}
            </span>
          </button>

          {/* Slot 4 (Zapisane/Dziennik) USUNIĘTY - Zapisane to teraz zakładka profilu (IA 2026-08-20). */}

          {/* Profil */}
          <NavLink
            to="/moj-profil"
            end={false}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
            activeClassName="text-foreground"
          >
            {({ isActive }) => (
              <>
                <NavIcon src="/Ikona_Profil.svg" />
                <span className="text-[9px] font-semibold leading-tight mt-0.5">Profil</span>
              </>
            )}
          </NavLink>

          </div>
        </div>
      </nav>
      )}
    </>
  );
};

export default BottomNav;
