import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode, CSSProperties } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Compass, Bookmark, BookOpen, Sparkles, Plus, Hand } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { clearHistory as clearExploreLikes } from "@/lib/exploreLikes";

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding v3 - learn-by-doing NA REALNYCH EKRANACH ze spotlight-tourem.
// Gosc = anon user (useAuth sam go tworzy). Podczas onboardingu flaga `active`
// OMIJA blokade anonima (patrz useOnboarding w PlaceSwiper/PlanWizard/Journal),
// wiec zapis miejsc i tworzenie wyjazdu REALNIE dzialaja. Coach prowadzi KROK PO
// KROKU: podswietla konkretna akcje (maska z dziura wokol elementu), baner na
// DOLE tlumaczy co zrobic, a przejscie do kolejnego kroku nastepuje DOPIERO po
// realnym wykonaniu akcji (zapis miejsca / nawigacja), nie po klikniciu "Dalej".
// Po "Okej!" sprzatamy fejk-dane anon usera i gosc dalej TYLKO przeglada.
// ─────────────────────────────────────────────────────────────────────────────

const DONE_KEY = "trasa_onboarding_v3_done";

interface OnboardingCtxType {
  active: boolean;
  finish: () => void;
  restart: () => void;
}
const OnboardingCtx = createContext<OnboardingCtxType>({ active: false, finish: () => {}, restart: () => {} });
export const useOnboarding = () => useContext(OnboardingCtx);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const { user, isAnonymous } = useAuth();
  const [active, setActive] = useState(() => {
    if (!isNative) return false;
    try { return localStorage.getItem(DONE_KEY) !== "1"; } catch { return false; }
  });

  const finish = useCallback(async () => {
    // ⚠️ KRYTYCZNE: sprzatanie fejk-danych onboardingu WYLACZNIE dla anonimowego konta-gosca.
    // Dla realnego (zalogowanego mailem) konta NIGDY nie kasujemy tras/reakcji/zapisanych -
    // to sa PRAWDZIWE dane usera. Wczesniej brak tego guardu skasowal prawdziwe trasy adminowi,
    // ktory odpalil onboarding przez guzik resetu w Ustawieniach.
    if (isAnonymous) {
      try {
        if (user?.id) {
          const { data: routes } = await (supabase as any).from("routes").select("id").eq("user_id", user.id);
          const ids = (routes ?? []).map((r: any) => r.id);
          if (ids.length) {
            await (supabase as any).from("pins").delete().in("route_id", ids);
            await (supabase as any).from("routes").delete().in("id", ids);
          }
          await (supabase as any).from("user_place_reactions").delete().eq("user_id", user.id);
        }
        clearExploreLikes();
      } catch (e) { console.warn("[onboarding] cleanup failed:", e); }
    }
    try { localStorage.setItem(DONE_KEY, "1"); } catch { /* unavailable */ }
    setActive(false);
    navigate("/eksploruj", { replace: true });
  }, [user?.id, isAnonymous, navigate]);

  const restart = useCallback(() => {
    try { localStorage.removeItem(DONE_KEY); localStorage.removeItem("trasa_onboarding_v2_1_done"); } catch { /* unavailable */ }
    setActive(true);
    navigate("/eksploruj", { replace: true });
  }, [navigate]);

  return (
    <OnboardingCtx.Provider value={{ active, finish, restart }}>
      {children}
      {active && <OnboardingCoach finish={finish} />}
    </OnboardingCtx.Provider>
  );
}

// ─── Spotlight-tour ──────────────────────────────────────────────────────────

type Step = "welcome" | "save" | "back" | "saved" | "create" | "creating" | "done";

interface StepCfg {
  icon: typeof Compass;
  label: string;
  title: string;
  body: string;
  target: string | null;             // selektor CSS elementu do podswietlenia (data-ob)
  placement: "bottom" | "above-target" | "top";
  cta?: string;                       // gdy jest przycisk (welcome / done); inaczej krok domyka realna akcja
  progress: number;                   // indeks kropki (0..4)
}

const STEPS: Record<Step, StepCfg> = {
  welcome: {
    icon: Compass, label: "START", progress: 0, target: null, placement: "bottom",
    title: "Poprowadzę Cię krok po kroku",
    body: "Pokażę Ci pełną pętlę Trasy na żywo: przeglądasz, zapisujesz, robisz wyjazd. Zaczynamy od przeglądania.",
    cta: "Zaczynamy",
  },
  save: {
    icon: Bookmark, label: "PRZEGLĄDANIE", progress: 1, target: '[data-ob="swipe-save"]', placement: "above-target",
    title: "Zapisz to miejsce",
    body: "Kliknij podświetlony przycisk „Zapisz” przy miejscu, które Cię ciekawi.",
  },
  back: {
    icon: Compass, label: "PRZEGLĄDANIE", progress: 1, target: '[data-ob="wizard-back"]', placement: "bottom",
    title: "Zapisane! Wróć do eksploracji",
    body: "Twoje miejsce jest już zapisane. Kliknij strzałkę w lewym górnym rogu, żeby wrócić.",
  },
  saved: {
    icon: Bookmark, label: "ZAPISANE", progress: 2, target: '[data-ob="nav-zapisane"]', placement: "bottom",
    title: "Zajrzyj do Zapisanych",
    body: "Zapisane miejsce trafiło do zakładki „Zapisane”. Kliknij ją na dole.",
  },
  create: {
    icon: Plus, label: "WYJAZD", progress: 3, target: '[data-ob="nav-fab"]', placement: "bottom",
    title: "Zrób z tego wyjazd",
    body: "Kliknij „+”, wybierz „Stwórz wyjazd” → „Solo” i przejdź kreator.",
  },
  creating: {
    icon: BookOpen, label: "KREATOR", progress: 3, target: null, placement: "top",
    title: "Dokończ kreator wyjazdu",
    body: "Wybierz miasto, daty i miejsca, a na końcu kliknij „Stwórz wyjazd”.",
  },
  done: {
    icon: Sparkles, label: "GOTOWE", progress: 4, target: null, placement: "bottom",
    title: "To pełna pętla Trasy!",
    body: "Wyjazd trafił do dziennika - odhaczasz miejsca i dodajesz notki. Przeglądaj → zapisz → wyjazd → dziennik.",
    cta: "Okej! Przechodzę do aplikacji",
  },
};

const DOTS = [0, 1, 2, 3, 4];

function OnboardingCoach({ finish }: { finish: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState<Step>("welcome");
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const cfg = STEPS[step];

  // Przejscia sterowane REALNA akcja usera (nawigacja / event zapisu), nie przyciskiem.
  useEffect(() => {
    const p = location.pathname;
    if (step === "back" && p === "/eksploruj") setStep("saved");
    else if (step === "saved" && p === "/polubione") setStep("create");
    else if (step === "create" && p === "/plan") setStep("creating");
    else if (step === "creating" && p.startsWith("/review-summary")) setStep("done");
  }, [location.pathname, step]);

  useEffect(() => {
    const onSaved = () => setStep((s) => (s === "save" ? "back" : s));
    window.addEventListener("trasa:ob-saved", onSaved);
    return () => window.removeEventListener("trasa:ob-saved", onSaved);
  }, []);

  // Pomiar pozycji podswietlanego elementu (rAF - nadaza za animacja kart / layoutem).
  useEffect(() => {
    if (!cfg.target) { setRect(null); return; }
    const tick = () => {
      const el = document.querySelector(cfg.target as string);
      const r = el ? el.getBoundingClientRect() : null;
      setRect((prev) => {
        if (!r) return prev ? null : prev;
        if (prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5
          && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5) return prev;
        return r;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [cfg.target]);

  const advanceButton = () => {
    if (step === "welcome") { navigate("/plan", { state: { exploreMode: true } }); setStep("save"); }
    else if (step === "done") { finish(); }
  };

  const Icon = cfg.icon;
  const PAD = 8;
  const hole = rect
    ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
    : null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;

  const DIM = "rgba(15,15,15,0.62)";
  // Baner: domyslnie na dole (nad BottomNavem). W trybie "above-target" siada tuz nad
  // podswietlonym elementem (np. przycisk Zapisz jest sam nisko - nie zaslaniamy go).
  // W kroku "creating" baner idzie na GORE - nie zaslania dolnych przyciskow kreatora.
  const bannerStyle: CSSProperties = cfg.placement === "top"
    ? { position: "fixed", left: 0, right: 0, top: "calc(env(safe-area-inset-top, 0px) + 10px)", zIndex: 57 }
    : (cfg.placement === "above-target" && hole)
      ? { position: "fixed", left: 0, right: 0, bottom: Math.max(12, vh - hole.top + 12), zIndex: 57 }
      : { position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)", zIndex: 57 };

  return (
    <>
      {/* Maska: cztery przyciemnione prostokaty wokol elementu (dziura = klikalny target).
          Gdy brak targetu (welcome/done) - lekkie pelne przyciemnienie. Krok "creating"
          nie ma maski (user swobodnie korzysta z kreatora). */}
      {hole ? (
        <>
          <div style={{ position: "fixed", left: 0, top: 0, width: "100%", height: Math.max(0, hole.top), background: DIM, zIndex: 55 }} />
          <div style={{ position: "fixed", left: 0, top: hole.top + hole.height, width: "100%", height: Math.max(0, vh - hole.top - hole.height), background: DIM, zIndex: 55 }} />
          <div style={{ position: "fixed", left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height, background: DIM, zIndex: 55 }} />
          <div style={{ position: "fixed", left: hole.left + hole.width, top: hole.top, width: Math.max(0, vw - hole.left - hole.width), height: hole.height, background: DIM, zIndex: 55 }} />
          {/* Pierscien wokol dziury (nie lapie klikniec) */}
          <div
            style={{
              position: "fixed", left: hole.left, top: hole.top, width: hole.width, height: hole.height,
              borderRadius: 9999, boxShadow: "0 0 0 3px rgba(249,102,43,0.95), 0 0 22px 4px rgba(249,102,43,0.45)",
              pointerEvents: "none", zIndex: 56,
            }}
            className="animate-pulse"
          />
        </>
      ) : (!cfg.target && step !== "creating") ? (
        // welcome / done: brak konkretnego targetu - lekkie pelne przyciemnienie.
        // Krok z targetem ale bez zmierzonego rect (element sie jeszcze laduje) -> bez maski.
        <div style={{ position: "fixed", inset: 0, background: DIM, zIndex: 55 }} />
      ) : null}

      {/* Krok "creating": kompaktowa pigulka top-center - NIE zaslania kontrolek kreatora
          (back/miasto na gorze, CTA na dole). User swobodnie korzysta z wlasnego kreatora. */}
      {step === "creating" ? (
        <div style={{ position: "fixed", left: 0, right: 0, top: "calc(env(safe-area-inset-top, 0px) + 8px)", zIndex: 57 }} className="px-4 flex justify-center pointer-events-none">
          <div className="pointer-events-auto inline-flex items-center gap-2 max-w-[92%] rounded-full bg-card border border-border/60 shadow-lg shadow-black/20 pl-3 pr-1.5 py-1.5">
            <BookOpen className="h-3.5 w-3.5 text-orange-600 shrink-0" />
            <span className="text-xs font-semibold text-foreground truncate">Dokończ kreator: miasto → daty → miejsca → „Stwórz wyjazd”</span>
            <button onClick={finish} className="text-[11px] font-semibold text-muted-foreground px-2 py-1 rounded-full bg-muted shrink-0 active:opacity-60">Pomiń</button>
          </div>
        </div>
      ) : (
      <div style={bannerStyle} className="px-4">
        <div className="max-w-md mx-auto rounded-3xl bg-card border border-border/60 shadow-xl shadow-black/20 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-orange-600 text-[11px] font-bold tracking-wide">
              <Icon className="h-3.5 w-3.5" /> {cfg.label}
            </div>
            <div className="flex items-center gap-1">
              {DOTS.map((i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === cfg.progress ? "w-4 bg-primary" : i < cfg.progress ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
          </div>
          <p className="text-base font-black leading-tight">{cfg.title}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{cfg.body}</p>

          <div className="flex items-center gap-2 mt-3">
            {cfg.cta ? (
              <button
                onClick={advanceButton}
                className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
              >
                {step === "welcome" ? <Sparkles className="h-4 w-4" /> : null}
                {cfg.cta}
              </button>
            ) : (
              // Kroki domykane realna akcja: podpowiedz "wykonaj podświetloną akcję".
              <div className="flex-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground py-2">
                <Hand className="h-4 w-4 text-orange-600 animate-bounce" />
                Wykonaj podświetloną akcję, aby przejść dalej
              </div>
            )}
            {step !== "done" && (
              <button onClick={finish} className="px-3 py-3 text-xs font-semibold text-muted-foreground active:opacity-60 shrink-0">
                Pomiń
              </button>
            )}
          </div>
        </div>
      </div>
      )}
    </>
  );
}
