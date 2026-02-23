import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

interface TourStep {
  selector: string;
  title: string;
  description: string;
}

const STEPS: TourStep[] = [
  {
    selector: '[data-tour="cta"]',
    title: "Zaplanuj podróż z AI",
    description: "Kliknij tutaj, żeby zacząć planować trasę. Powiedz AI dokąd jedziesz — dostaniesz gotowy plan z prawdziwymi miejscami i godzinami.",
  },
  {
    selector: '[data-tour="trips"]',
    title: "Aktywne podróże",
    description: "Tu widzisz swoje zaplanowane podróże. W dniu wyjazdu odhaczaj odwiedzone miejsca i podsumuj dzień z AI.",
  },
  {
    selector: '[data-tour="journal"]',
    title: "Dziennik podróży",
    description: "Po każdym dniu Twoje wspomnienia zapisują się tutaj. Wracaj do nich kiedy tylko chcesz.",
  },
];

const PAD = 10;
const OVERLAY = "rgba(0,0,0,0.65)";

interface HomeTourProps {
  onDone: () => void;
}

const HomeTour = ({ onDone }: HomeTourProps) => {
  const [step, setStep] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const selector = STEPS[step].selector;

    const updateRect = () => {
      const el = document.querySelector(selector);
      if (!el) { setRect(null); return; }
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
      setTimeout(() => {
        const updated = document.querySelector(selector);
        if (updated) setRect(updated.getBoundingClientRect());
      }, 320);
    };

    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [step]);

  const next = () => {
    if (step < STEPS.length - 1) setStep(s => s + 1);
    else onDone();
  };

  const current = STEPS[step];

  const sTop = rect ? rect.top - PAD : 0;
  const sLeft = rect ? rect.left - PAD : 0;
  const sW = rect ? rect.width + PAD * 2 : 0;
  const sH = rect ? rect.height + PAD * 2 : 0;

  const wH = typeof window !== "undefined" ? window.innerHeight : 800;
  const CARD_H = 160;
  const belowSpace = rect ? wH - (rect.bottom + PAD + 16) : 0;
  const captionTop = rect
    ? belowSpace >= CARD_H
      ? sTop + sH + 16
      : Math.max(sTop - CARD_H - 16, 16)
    : wH / 2 - CARD_H / 2;

  return (
    <div className="fixed inset-0 z-50" style={{ pointerEvents: "none" }}>
      {/* 4-panel overlay with spotlight hole */}
      {rect ? (
        <>
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: sTop, background: OVERLAY }} />
          <div style={{ position: "fixed", top: sTop + sH, left: 0, right: 0, bottom: 0, background: OVERLAY }} />
          <div style={{ position: "fixed", top: sTop, left: 0, width: sLeft, height: sH, background: OVERLAY }} />
          <div style={{ position: "fixed", top: sTop, left: sLeft + sW, right: 0, height: sH, background: OVERLAY }} />
          <div style={{
            position: "fixed",
            top: sTop, left: sLeft,
            width: sW, height: sH,
            borderRadius: 12,
            border: "2px solid rgba(255,255,255,0.3)",
          }} />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: OVERLAY }} />
      )}

      {/* Caption card */}
      <div
        style={{
          position: "fixed",
          top: captionTop,
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(320px, calc(100vw - 32px))",
          pointerEvents: "auto",
        }}
        className="bg-card rounded-2xl border border-border shadow-xl p-5"
      >
        <p className="text-sm font-semibold mb-1">{current.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{current.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 items-center">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  i === step ? "w-4 bg-foreground" : "w-1.5 bg-border"
                }`}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onDone} className="text-xs text-muted-foreground px-2 py-1">
              Pomiń
            </button>
            <Button size="sm" onClick={next} className="rounded-full text-xs h-7 px-4">
              {step < STEPS.length - 1 ? "Dalej" : "Gotowe!"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomeTour;
