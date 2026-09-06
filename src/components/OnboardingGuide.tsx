import { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode, CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { Compass, Layers, Bookmark, Plus } from "lucide-react";
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
  titleKey: string;
  bodyKey: string;
  target: string | null;   // selektor data-ob elementu do podswietlenia
  ctaKey: string;
  view?: "feed" | "browse"; // przelacz widok eksploracji, zeby user widzial zmiane zakladki pod spodem
}

const STEPS: StepCfg[] = [
  {
    icon: Compass, target: '[data-ob="toggle-trasy"]', view: "feed",
    titleKey: "guide.trips_title",
    bodyKey: "guide.trips_desc",
    ctaKey: "guide.next",
  },
  {
    icon: Layers, target: '[data-ob="toggle-miejsca"]', view: "browse",
    titleKey: "guide.places_title",
    bodyKey: "guide.places_desc",
    ctaKey: "guide.next",
  },
  {
    icon: Bookmark, target: null,
    titleKey: "guide.save_title",
    bodyKey: "guide.save_desc",
    ctaKey: "guide.next",
  },
  {
    icon: Plus,
    target: '[data-ob="nav-fab"]',
    titleKey: "guide.create_title",
    bodyKey: "guide.create_desc",
    ctaKey: "guide.done",
  },
];

function OnboardingCoach({ finish }: { finish: () => void }) {
  const { t } = useTranslation("onboarding");
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

  // Przelacz widok eksploracji POD spodem, zeby user widzial zmiane zakladki (Trasy -> feed,
  // Miejsca -> swiper). Explore.tsx nasluchuje "trasa:explore-set-view".
  useEffect(() => {
    const v = STEPS[idx].view;
    if (v) window.dispatchEvent(new CustomEvent("trasa:explore-set-view", { detail: v }));
  }, [idx]);

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

  const PAD = 8;
  const hole = rect
    ? { left: rect.left - PAD, top: rect.top - PAD, width: rect.width + 2 * PAD, height: rect.height + 2 * PAD }
    : null;
  const DIM = "rgba(15,15,15,0.62)";

  // Baner NA GORZE (pod TabTopBarem) - zeby user widzial, jak pod spodem zmienia sie zakladka
  // (Trasy/Miejsca) i podswietlone elementy. Nie zaslania contentu na srodku ekranu.
  const bannerTop = "calc(env(safe-area-inset-top, 0px) + 76px)";

  return (
    <>
      {/* Wyszarzenie z zaokraglona "dziura" na podswietlonym elemencie (box-shadow spread).
          Bez pomaranczowego pierscienia - samo wyszarzenie + widoczny element. */}
      {hole ? (
        <div
          style={{
            position: "fixed", left: hole.left, top: hole.top, width: hole.width, height: hole.height,
            borderRadius: Math.round(hole.height / 2), boxShadow: `0 0 0 9999px ${DIM}`,
            zIndex: 55, pointerEvents: "none",
          } as CSSProperties}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, background: DIM, zIndex: 55 }} />
      )}

      {/* Baner: czarny naglowek + body, stepper na dole nad guzikiem (16px radius). Bez ikon. */}
      <div style={{ position: "fixed", left: 0, right: 0, top: bannerTop, zIndex: 57 } as CSSProperties} className="px-4">
        <div className="max-w-md mx-auto rounded-3xl bg-card border border-border/60 shadow-xl shadow-black/20 p-5">
          <p className="text-lg font-black leading-tight text-foreground">{t(cfg.titleKey)}</p>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{t(cfg.bodyKey)}</p>

          <div className="flex items-center justify-center gap-1.5 mt-4">
            {STEPS.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === idx ? "w-5 bg-primary" : "w-1.5 bg-muted"}`} />
            ))}
          </div>

          <button
            onClick={next}
            className="w-full mt-4 py-3.5 rounded-2xl bg-primary text-white font-bold text-sm active:scale-[0.98] transition-transform"
          >
            {t(cfg.ctaKey)}
          </button>
          {!isLast && (
            <button onClick={finish} className="w-full py-2.5 mt-1 text-xs font-semibold text-muted-foreground active:opacity-60">{t("guide.skip")}</button>
          )}
        </div>
      </div>
    </>
  );
}
