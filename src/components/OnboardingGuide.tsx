import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Layers, Bookmark, Plus, Sparkles } from "lucide-react";
import { isNative } from "@/lib/platform";
import { COACH_PENDING_KEY } from "@/components/onboarding/OnboardingFlow";

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding Czesc B - coach-marki (spotlight-tour). Odpalane PO Czesci A
// (welcome+ankieta+profil) sygnalem localStorage COACH_PENDING_KEY + eventem
// "spontaway:start-coach". Prowadzi "Dalej" przez 4 elementy: toggle Trasy,
// toggle Miejsca, akcja Zapis, guzik "+". Login-only (bez logiki anon/cleanup).
// ─────────────────────────────────────────────────────────────────────────────

const DONE_KEY = "spontaway_coach_done";

interface OnboardingCtxType {
  active: boolean;
  finish: () => void;
  restart: () => void;
}
const OnboardingCtx = createContext<OnboardingCtxType>({ active: false, finish: () => {}, restart: () => {} });
export const useOnboarding = () => useContext(OnboardingCtx);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [active, setActive] = useState(false);

  // Start touru: Czesc A ustawia COACH_PENDING i dispatchuje "spontaway:start-coach".
  // Sprawdzamy tez na mount (gdyby flaga byla ustawiona wczesniej, np. przeladowanie).
  useEffect(() => {
    if (!isNative) return;
    const maybeStart = () => {
      try {
        if (localStorage.getItem(COACH_PENDING_KEY) === "1" && localStorage.getItem(DONE_KEY) !== "1") {
          setActive(true);
        }
      } catch { /* unavailable */ }
    };
    maybeStart();
    window.addEventListener("spontaway:start-coach", maybeStart);
    return () => window.removeEventListener("spontaway:start-coach", maybeStart);
  }, []);

  const finish = useCallback(() => {
    try {
      localStorage.setItem(DONE_KEY, "1");
      localStorage.removeItem(COACH_PENDING_KEY);
    } catch { /* unavailable */ }
    setActive(false);
  }, []);

  // Reset z Ustawien: odpal tour ponownie (od pierwszego kroku, na eksploracji).
  const restart = useCallback(() => {
    try { localStorage.removeItem(DONE_KEY); localStorage.setItem(COACH_PENDING_KEY, "1"); } catch { /* unavailable */ }
    navigate("/eksploruj", { replace: true });
    setActive(true);
  }, [navigate]);

  return (
    <OnboardingCtx.Provider value={{ active, finish, restart }}>
      {children}
      {active && <OnboardingCoach finish={finish} />}
    </OnboardingCtx.Provider>
  );
}

// ─── Spotlight-tour ──────────────────────────────────────────────────────────

interface StepCfg {
  icon: typeof Compass;
  label: string;
  title: string;
  body: string;
  target: string | null;   // selektor data-ob elementu do podswietlenia
  cta: string;
}

const STEPS: StepCfg[] = [
  {
    icon: Compass, label: "TRASY", target: '[data-ob="toggle-trasy"]',
    title: "Zakładka Trasy",
    body: "Tu przeglądasz gotowe trasy stworzone przez innych. Wejdź w trasę, żeby zobaczyć miejsca i zainspirować się do własnej.",
    cta: "Dalej",
  },
  {
    icon: Layers, label: "MIEJSCA", target: '[data-ob="toggle-miejsca"]',
    title: "Zakładka Miejsca",
    body: "Tu przeglądasz pojedyncze miejsca w Twoim mieście, jedno po drugim: kawiarnie, restauracje, bary, miejsca kultury i natury.",
    cta: "Dalej",
  },
  {
    icon: Bookmark, label: "ZAPISYWANIE", target: null,
    title: "Zapisuj ulubione",
    body: "Miejsca i trasy, które Ci się podobają, zapisujesz jednym tapnięciem. Wracasz do nich w zakładce Zapisane.",
    cta: "Dalej",
  },
  {
    icon: Plus, label: "TWÓRZ", target: '[data-ob="nav-fab"]',
    title: "Twórz własne trasy",
    body: "Guzikiem „+” tworzysz własną trasę z ulubionych miejsc. Twoja trasa trafia do eksploracji, żeby inni mogli się nią zainspirować.",
    cta: "Gotowe",
  },
];

function OnboardingCoach({ finish }: { finish: () => void }) {
  const navigate = useNavigate();
  const [idx, setIdx] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);

  const cfg = STEPS[idx];
  const isLast = idx === STEPS.length - 1;

  // Tour dzieje sie na /eksploruj (tam jest toggle i BottomNav) - wejdz tam na start.
  useEffect(() => {
    navigate("/eksploruj", { replace: true });
  }, [navigate]);

  // Pomiar pozycji podswietlanego elementu (rAF - nadaza za layoutem).
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

  const next = () => { if (isLast) finish(); else setIdx((i) => i + 1); };

  const Icon = cfg.icon;
  const PAD = 8;
  const hole = rect
    ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
    : null;
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const DIM = "rgba(15,15,15,0.62)";

  return (
    <>
      {/* Maska: cztery przyciemnione prostokaty wokol elementu (dziura = widoczny target).
          Bez targetu (krok "Zapisuj") - lekkie pelne przyciemnienie. */}
      {hole ? (
        <>
          <div style={{ position: "fixed", left: 0, top: 0, width: "100%", height: Math.max(0, hole.top), background: DIM, zIndex: 55 }} />
          <div style={{ position: "fixed", left: 0, top: hole.top + hole.height, width: "100%", height: Math.max(0, vh - hole.top - hole.height), background: DIM, zIndex: 55 }} />
          <div style={{ position: "fixed", left: 0, top: hole.top, width: Math.max(0, hole.left), height: hole.height, background: DIM, zIndex: 55 }} />
          <div style={{ position: "fixed", left: hole.left + hole.width, top: hole.top, width: Math.max(0, vw - hole.left - hole.width), height: hole.height, background: DIM, zIndex: 55 }} />
          <div
            style={{
              position: "fixed", left: hole.left, top: hole.top, width: hole.width, height: hole.height,
              borderRadius: 9999, boxShadow: "0 0 0 3px rgba(249,102,43,0.95), 0 0 22px 4px rgba(249,102,43,0.45)",
              pointerEvents: "none", zIndex: 56,
            }}
            className="animate-pulse"
          />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: DIM, zIndex: 55 }} />
      )}

      {/* Baner na dole (nad BottomNavem) - nie zaslania podswietlonych elementow u gory. */}
      <div style={{ position: "fixed", left: 0, right: 0, bottom: "calc(env(safe-area-inset-bottom, 0px) + 84px)", zIndex: 57 } as CSSProperties} className="px-4">
        <div className="max-w-md mx-auto rounded-3xl bg-card border border-border/60 shadow-xl shadow-black/20 p-4">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2 text-orange-600 text-[11px] font-bold tracking-wide">
              <Icon className="h-3.5 w-3.5" /> {cfg.label}
            </div>
            <div className="flex items-center gap-1">
              {STEPS.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-4 bg-primary" : i < idx ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"}`} />
              ))}
            </div>
          </div>
          <p className="text-base font-black leading-tight">{cfg.title}</p>
          <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{cfg.body}</p>

          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={next}
              className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
            >
              {isLast ? <Sparkles className="h-4 w-4" /> : null}
              {cfg.cta}
            </button>
            {!isLast && (
              <button onClick={finish} className="px-3 py-3 text-xs font-semibold text-muted-foreground active:opacity-60 shrink-0">
                Pomiń
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
