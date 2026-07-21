import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { BookOpen, Compass, Map, Plus, X, MapPin, Users, Link2, User, Heart, ArrowLeft, Layers, Bookmark } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getTodayLikes, type ExploreLike } from "@/lib/exploreLikes";
import { isNative } from "@/lib/platform";
import { PLANNING_DISABLED } from "@/lib/appMode";

const HOME_FILTERS_KEY = "trasa_home_filters";

// Kafelek akcji w drawerze "+" (ikona w szarym kwadracie + podpis pod spodem),
// uklad wzorowany na arkuszu tworzenia z Pinteresta.
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
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [reusePrompt, setReusePrompt] = useState<{ city: string; likes: ExploreLike[] } | null>(null);
  // Menu "+" ma 2 kroki: krok 1 = [Zaplanuj | Przegladaj miejsca]; po "Zaplanuj" ->
  // krok 2 = [Solo | Grupowo | Dolacz do sesji]. Reset przy zamknieciu/otwarciu.
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

  const handleJoinSubmit = () => {
    const code = joinCode.trim();
    if (!code) return;
    setShowJoinModal(false);
    setJoinCode("");
    navigate(`/sesja/${code}`);
  };

  const handleGroupPlan = () => {
    setShowMenu(false);
    // Group sessions dzialaja dla goscia (sesja jest identyfikowana po join_code,
    // nie po user identity - mozna zaprosic przez kod, nie po username).
    navigate("/sesja/nowa");
  };

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
                {planStep ? t("menu_plan_title") : t("menu_title")}
              </h2>
              <div className="w-9" />
            </div>

            {/* Wiersz kafelkow akcji */}
            <div className="flex justify-center gap-6 pb-1">
              {PLANNING_DISABLED ? (
                // Tryb uproszczony: menu "+" = Stworz wyjazd (miasto+daty+swiper) lub zestawienie.
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
                  <ActionTile icon={Users} label={t("plan_group")} onClick={handleGroupPlan} />
                  <ActionTile
                    icon={Link2}
                    label={t("join_session")}
                    onClick={() => { setShowMenu(false); setJoinCode(""); setShowJoinModal(true); }}
                  />
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

      {/* Join session modal */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h2 className="font-black text-lg">{t("join_title")}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t("join_desc")}</p>
            </div>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") handleJoinSubmit(); }}
              placeholder={t("join_placeholder")}
              maxLength={10}
              className="w-full px-4 py-3.5 rounded-2xl border border-border bg-muted/40 text-base font-mono font-semibold tracking-widest text-center placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-3 rounded-full border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
              >
                {t("cancel")}
              </button>
              <button
                onClick={handleJoinSubmit}
                disabled={!joinCode.trim()}
                className="flex-[2] py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                {t("join_submit")}
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
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pointer-events-none">
        {/* Web: 3 kolumny (Glowna, Plus, Profil - Eksploruj i Dziennik ukryte).
            Native: 5 kolumn (wszystko). */}
        {/* Same ikony, bez nazw (jak w zalaczniku) - zachowana kolorystyka (orange active). */}
        <div className="pointer-events-auto bg-white rounded-[26px] border border-black/[0.04] shadow-[0_8px_28px_-6px_rgba(0,0,0,0.18)]">
          <div className={`grid ${isNative ? "grid-cols-5" : "grid-cols-3"} h-16`}>

          {/* Eksploruj - landing (skrajnie z lewej). Tylko w native iOS/Android.
              Web/PWA ukrywa (na web B2C jest za waitlista). */}
          {isNative && (
            <NavLink
              to="/eksploruj"
              end={false}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-orange-600"
            >
              {({ isActive }) => (
                <>
                  <Compass className="h-6 w-6 stroke-2" />
                  <span className={`h-0.5 w-5 rounded-full transition-colors ${isActive ? "bg-orange-600" : "bg-transparent"}`} />
                </>
              )}
            </NavLink>
          )}

          {/* Slot 2: Tryb uproszczony -> Wyjazdy (dawny Dziennik). Stary flow -> Twoje trasy. */}
          {PLANNING_DISABLED ? (
            <NavLink
              to="/dziennik"
              end={false}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-orange-600"
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <BookOpen className="h-6 w-6 stroke-2" />
                    {hasNewJournalEntries && !isActive && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-600 ring-2 ring-background" />
                    )}
                  </div>
                  <span className={`h-0.5 w-5 rounded-full transition-colors ${isActive ? "bg-orange-600" : "bg-transparent"}`} />
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              to="/home"
              end
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-orange-600"
            >
              {({ isActive }) => (
                <>
                  <Map className="h-6 w-6 stroke-2" />
                  <span className={`h-0.5 w-5 rounded-full transition-colors ${isActive ? "bg-orange-600" : "bg-transparent"}`} />
                </>
              )}
            </NavLink>
          )}

          {/* Center FAB */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center justify-center"
            aria-label={t("fab_aria")}
          >
            <span className="h-11 w-11 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform shadow-md shadow-orange-500/25">
              {showMenu
                ? <X className="h-5 w-5 text-white stroke-[2.5px]" />
                : <Plus className="h-5 w-5 text-white stroke-[2.5px]" />
              }
            </span>
          </button>

          {/* Slot 4: Tryb uproszczony -> Zapisane (polubione miejsca). Stary flow -> Dziennik.
              Dziennik/Zapisane tylko w native - na web/PWA ukryte. */}
          {PLANNING_DISABLED ? (
            <NavLink
              to="/polubione"
              end={false}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-orange-600"
            >
              {({ isActive }) => (
                <>
                  <Bookmark className="h-6 w-6 stroke-2" />
                  <span className={`h-0.5 w-5 rounded-full transition-colors ${isActive ? "bg-orange-600" : "bg-transparent"}`} />
                </>
              )}
            </NavLink>
          ) : isNative && (
            <NavLink
              to="/dziennik"
              end={false}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-orange-600"
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <BookOpen className="h-6 w-6 stroke-2" />
                    {hasNewJournalEntries && !isActive && (
                      <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-orange-600 ring-2 ring-background" />
                    )}
                  </div>
                  <span className={`h-0.5 w-5 rounded-full transition-colors ${isActive ? "bg-orange-600" : "bg-transparent"}`} />
                </>
              )}
            </NavLink>
          )}

          {/* Profil */}
          <NavLink
            to="/moj-profil"
            end={false}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
            activeClassName="text-orange-600"
          >
            {({ isActive }) => (
              <>
                <User className="h-6 w-6 stroke-2" />
                <span className={`h-0.5 w-5 rounded-full transition-colors ${isActive ? "bg-orange-600" : "bg-transparent"}`} />
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
