import { useState, useEffect } from "react";
import { X } from "lucide-react";

const TOUR_KEY = "trasa_home_tour_v1";
const GUEST_TOUR_KEY = "trasa_guest_tour_session";

const STEPS = [
  {
    emoji: "➕",
    title: "Zacznij od przycisku +",
    desc: "Na środku paska nawigacji masz przycisk +. Wybierz „Zaplanuj solo" żeby samodzielnie układać trasę, albo „Zaplanuj grupowo" żeby eksplorować ze znajomymi.",
    hint: "↓ Przycisk + na środku paska nawigacji",
    arrowUp: false,
  },
  {
    emoji: "👥",
    title: "Planuj razem ze znajomymi",
    desc: "Stwórz sesję grupową, udostępnij kod znajomym i razem przeglądajcie miejsca. Trasa pokaże, co Was łączy!",
    hint: "↑ '+' → Zaplanuj grupowo",
    arrowUp: true,
  },
  {
    emoji: "📖",
    title: "Dziennik i trasy 🔒",
    desc: "Chcesz zapisywać trasy i wracać do wspomnień z podróży? Dziennik i historia tras są dostępne po założeniu darmowego konta.",
    hint: "↓ Zakładka „Dziennik" • wymaga konta",
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
      {/* Dark overlay — covers BottomNav (z-50) */}
      <div
        className="fixed inset-0 z-[55] bg-black/55"
        onClick={onDone}
      />

      {/* Tooltip card pinned to bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] pointer-events-none">
        <div className="bg-card rounded-3xl shadow-2xl border border-border/20 overflow-hidden pointer-events-auto">
          {/* Header row */}
          <div className="flex items-center justify-between px-5 pt-5 pb-1">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-6 bg-primary"
                      : i < step
                      ? "w-1.5 bg-primary/40"
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
              className="flex-1 py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform"
            >
              {isLast ? "Zaczynamy! 🚀" : "Dalej →"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export const useHomeTour = (isGuest: boolean) => {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (isGuest) {
      // Show once per browser session for guests (sessionStorage resets on tab close)
      if (!sessionStorage.getItem(GUEST_TOUR_KEY)) setShowTour(true);
    } else {
      if (!localStorage.getItem(TOUR_KEY)) setShowTour(true);
    }
  }, [isGuest]);

  const dismissTour = () => {
    if (isGuest) {
      sessionStorage.setItem(GUEST_TOUR_KEY, "1");
    } else {
      localStorage.setItem(TOUR_KEY, "1");
    }
    setShowTour(false);
  };

  return { showTour, dismissTour };
};

export default HomeTour;
