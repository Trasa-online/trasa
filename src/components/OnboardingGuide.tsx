import { createContext, useContext, useState, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowRight, Compass, Bookmark, BookOpen, Sparkles, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { clearHistory as clearExploreLikes } from "@/lib/exploreLikes";

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding v3 - learn-by-doing NA REALNYCH EKRANACH (2026-08-14).
// Gosc = anon user (useAuth sam go tworzy). Podczas onboardingu flaga `active`
// OMIJA blokade anonima (patrz useOnboarding w PlaceSwiper/PlanWizard/Journal),
// wiec zapis miejsc i tworzenie wyjazdu REALNIE dzialaja - user przechodzi pelna
// petle jak na prawdziwym koncie, prowadzony coach-bannerem. Po "Okej!" sprzatamy
// fejk-dane (wyjazdy + reakcje anon usera + zapisane) i gosc dalej TYLKO przeglada.
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
  const { user } = useAuth();
  const [active, setActive] = useState(() => {
    if (!isNative) return false;
    try { return localStorage.getItem(DONE_KEY) !== "1"; } catch { return false; }
  });

  const finish = useCallback(async () => {
    // Sprzatanie fejk-danych onboardingu (anon user): wyjazdy (routes+pins), reakcje, zapisane.
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
    try { localStorage.setItem(DONE_KEY, "1"); } catch { /* unavailable */ }
    setActive(false);
    navigate("/eksploruj", { replace: true });
  }, [user?.id, navigate]);

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

type Phase = "intro" | "browse" | "saved" | "wyjazdy" | "creating" | "done";

const STEP_META: Record<Exclude<Phase, "creating">, { icon: typeof Compass; label: string; title: string; body: string; cta: string }> = {
  intro: {
    icon: Compass,
    label: "EKSPLORUJ",
    title: "Zacznijmy od przeglądania",
    body: "To Twój start: polecane trasy i zestawienia innych. Pokażę Ci jak przeglądać i zapisywać miejsca.",
    cta: "Pokaż mi",
  },
  browse: {
    icon: Bookmark,
    label: "PRZEGLĄDANIE",
    title: "Zapisz co Ci się podoba",
    body: "Przesuwaj karty i kliknij „Zapisz” przy miejscu, które Cię ciekawi. Śmiało, zapisz jedno lub dwa.",
    cta: "Zapisane, dalej",
  },
  saved: {
    icon: Bookmark,
    label: "ZAPISANE",
    title: "Tu masz swoje miejsca",
    body: "Wszystko co zapiszesz ląduje w Zapisanych - to materiał na Twój wyjazd.",
    cta: "Dalej",
  },
  wyjazdy: {
    icon: BookOpen,
    label: "WYJAZDY",
    title: "Zrób z nich wyjazd",
    body: "Tu tworzysz wyjazd z zapisanych miejsc i prowadzisz dziennik. Kliknij „Nowy wyjazd” i przejdź kroki: miasto, daty, wybór miejsc.",
    cta: "Tworzę wyjazd",
  },
  done: {
    icon: Sparkles,
    label: "GOTOWE",
    title: "To pełna pętla Trasy!",
    body: "Twój wyjazd trafił do dziennika - odhaczasz miejsca i dodajesz notki. Przeglądaj → zapisz → wyjazd → dziennik.",
    cta: "Okej! Przechodzę do aplikacji",
  },
};

function OnboardingCoach({ finish }: { finish: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [phase, setPhase] = useState<Phase>("intro");

  // Gdy user utworzy wyjazd (wejdzie w edytor /review-summary) w fazie "creating" -> "done".
  useEffect(() => {
    if (phase === "creating" && location.pathname.startsWith("/review-summary")) setPhase("done");
  }, [location.pathname, phase]);

  const advance = () => {
    if (phase === "intro") { navigate("/plan", { state: { exploreMode: true } }); setPhase("browse"); }
    else if (phase === "browse") { navigate("/polubione"); setPhase("saved"); }
    else if (phase === "saved") { navigate("/dziennik"); setPhase("wyjazdy"); }
    else if (phase === "wyjazdy") { navigate("/plan", { state: { wyjazdMode: true } }); setPhase("creating"); }
    else if (phase === "done") { finish(); }
  };

  // Faza tworzenia wyjazdu: nie zaslaniaj kreatora bannerem, tylko maly "Pomin".
  if (phase === "creating") {
    return (
      <button
        onClick={finish}
        className="fixed z-[60] right-3 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1.5 active:scale-95 transition-transform"
        style={{ top: "calc(env(safe-area-inset-top, 12px) + 8px)" }}
      >
        Pomiń onboarding
      </button>
    );
  }

  const meta = STEP_META[phase];
  const Icon = meta.icon;
  const progress = (["intro", "browse", "saved", "wyjazdy", "done"] as Phase[]).indexOf(phase);

  return (
    <div className="fixed top-0 left-0 right-0 z-[55] px-4 pointer-events-none" style={{ paddingTop: "calc(env(safe-area-inset-top, 12px) + 10px)" }}>
      <div className="max-w-lg mx-auto rounded-3xl bg-card border border-border/60 shadow-xl shadow-black/10 p-4 pointer-events-auto">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 text-orange-600 text-[11px] font-bold tracking-wide">
            <Icon className="h-3.5 w-3.5" /> {meta.label}
          </div>
          <div className="flex items-center gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === progress ? "w-4 bg-primary" : i < progress ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"}`} />
            ))}
          </div>
        </div>
        <p className="text-base font-black leading-tight">{meta.title}</p>
        <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{meta.body}</p>
        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={advance}
            className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            {phase === "wyjazdy" ? <Plus className="h-4 w-4" /> : null}
            {meta.cta}
            {phase !== "wyjazdy" && phase !== "done" ? <ArrowRight className="h-4 w-4" /> : null}
          </button>
          {phase !== "done" && (
            <button onClick={finish} className="px-3 py-3 text-xs font-semibold text-muted-foreground active:opacity-60">
              Pomiń
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
