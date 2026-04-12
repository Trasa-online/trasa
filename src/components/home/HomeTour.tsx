import { useState, useEffect } from "react";
import { X } from "lucide-react";

const TOUR_KEY = "trasa_home_tour_v1";

const STEPS = [
  {
    emoji: "👥",
    title: "Planuj razem ze znajomymi",
    desc: "Stwórz sesję grupową, zaproś znajomych i razem swipe'ujcie miejsca. Trasa układa się sama z Waszych wspólnych wyborów.",
    hint: "↑ Aktywne sesje i przycisk „Zaplanuj razem" powyżej",
    arrowUp: true,
  },
  {
    emoji: "🗺️",
    title: "Odkrywaj miasta",
    desc: "Wybierz miasto i datę, wybierz gotowy szablon trasy lub zaplanuj od zera z pomocą AI.",
    hint: "↑ Kliknij „Zaplanuj razem" żeby zacząć",
    arrowUp: true,
  },
  {
    emoji: "📖",
    title: "Dziennik podróży",
    desc: "Każda zakończona trasa ląduje w dzienniku. Oceń miejsca, dodaj zdjęcia i wspomnienia.",
    hint: "↓ Zakładka „Dziennik" na dole ekranu",
    arrowUp: false,
  },
];

interface HomeTourProps {
  onDone: () => void;
}

const HomeTour = ({ onDone }: HomeTourProps) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const handleNext = () => {
    if (!isLast) setStep(step + 1);
    else onDone();
  };

  return (
    <>
      {/* Dark overlay — clicking dismisses */}
      <div
        className="fixed inset-0 z-40 bg-black/55"
        onClick={onDone}
      />

      {/* Tooltip card pinned to bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-50 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pointer-events-none">
        <div className="bg-card rounded-3xl shadow-2xl border border-border/20 overflow-hidden pointer-events-auto">
          {/* Header row */}
          <div className="flex items-center justify-between px-5 pt-5 pb-1">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-6 bg-orange-600"
                      : i < step
                      ? "w-1.5 bg-orange-600/40"
                      : "w-1.5 bg-muted"
                  }`}
                />
              ))}
            </div>
            <button
              onClick={onDone}
              className="h-7 w-7 flex items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-5 pt-3 pb-2">
            <div className="text-4xl mb-3">{current.emoji}</div>
            <h2 className="text-lg font-black mb-1.5 leading-tight">{current.title}</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-2">{current.desc}</p>
            <p className="text-xs font-medium text-orange-600">{current.hint}</p>
          </div>

          {/* Actions */}
          <div className="px-5 pb-5 pt-2 flex items-center gap-3">
            <button onClick={onDone} className="text-sm text-muted-foreground py-2 px-1">
              Pomiń
            </button>
            <button
              onClick={handleNext}
              className="flex-1 py-3 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.97] transition-transform"
            >
              {isLast ? "Zaczynamy! 🚀" : "Dalej →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const useHomeTour = () => {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(TOUR_KEY)) setShowTour(true);
  }, []);

  const dismissTour = () => {
    localStorage.setItem(TOUR_KEY, "1");
    setShowTour(false);
  };

  return { showTour, dismissTour };
};

export default HomeTour;
