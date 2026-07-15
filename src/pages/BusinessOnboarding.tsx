import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ImagePlus, ShieldCheck, BarChart3, ArrowRight, Sparkles, DoorOpen } from "lucide-react";
import { cn } from "@/lib/utils";

// Widok pokazywany PO pierwszym ustawieniu hasla konta biznesowego (z SetPassword forceBusiness).
// Lokal wybiera: krotki przewodnik po panelu ("z onboardingiem") albo wejscie od razu ("bez").
// Osobny ekran - NIE dotyka zamrozonego BusinessDashboard.

const STEPS = [
  {
    icon: ImagePlus,
    title: "Uzupełnij wizytówkę",
    body: "Dodaj nazwę, kategorię, opis i zdjęcia swojego lokalu. To one przyciągają uwagę podróżnych.",
  },
  {
    icon: ShieldCheck,
    title: "Wyślij do akceptacji",
    body: "Gdy profil będzie gotowy, wyślij go do zatwierdzenia. Sprawdzimy wizytówkę i opublikujemy ją w aplikacji.",
  },
  {
    icon: BarChart3,
    title: "Zarządzaj i obserwuj",
    body: "Po publikacji Twój lokal pojawi się w trasach użytkowników, a Ty zobaczysz statystyki i dodania do trasy.",
  },
];

export default function BusinessOnboarding() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [phase, setPhase] = useState<"choice" | "guide">("choice");
  const [step, setStep] = useState(0);
  const [ready, setReady] = useState(false);

  // Musi byc zalogowany wlasciciel - inaczej na logowanie biznesowe.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user || user.is_anonymous) {
        navigate("/auth?business=true", { replace: true });
        return;
      }
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const enterPanel = async () => {
    // Best-effort: oznacz onboarding jako zobaczony, zeby nie wracal.
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase as any).from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
      }
    } catch { /* nie blokuj wejscia do panelu */ }
    navigate(`/biznes/${id}`, { replace: true });
  };

  const nextStep = () => {
    if (step < STEPS.length - 1) setStep((s) => s + 1);
    else enterPanel();
  };

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-blue-200 animate-pulse" />
          <p className="text-sm text-slate-500">Wczytuję panel…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-700 w-full" />

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <img src="/Icon_Trasa.png" alt="Trasa" className="h-12 w-12 object-contain shrink-0" />
            <div>
              <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest">trasa</p>
              <p className="text-lg font-black text-slate-800 leading-tight">Panel Biznesowy</p>
            </div>
          </div>

          {phase === "choice" ? (
            <>
              <h1 className="text-2xl font-black text-slate-800 mb-1">{`Witamy na Trasie!`}</h1>
              <p className="text-sm text-slate-500 mb-8 leading-relaxed">
                {`Witaj w panelu swojego lokalu. Chcesz, żebyśmy przeprowadzili Cię przez pierwsze kroki, czy wolisz zacząć samodzielnie?`}
              </p>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => { setStep(0); setPhase("guide"); }}
                  className="flex flex-col items-start gap-4 p-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-left shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all"
                >
                  <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight">Przeprowadź mnie</p>
                    <p className="text-sm text-blue-100/90 leading-snug mt-0.5">{`Krótki przewodnik po panelu`}</p>
                  </div>
                </button>

                <button
                  onClick={enterPanel}
                  className="flex flex-col items-start gap-4 p-4 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 text-left border border-slate-200 active:scale-[0.98] transition-all"
                >
                  <div className="h-11 w-11 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                    <DoorOpen className="h-5 w-5 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-base leading-tight">{`Wejdę samodzielnie`}</p>
                    <p className="text-sm text-slate-500 leading-snug mt-0.5">{`Przejdź od razu do panelu`}</p>
                  </div>
                </button>
              </div>
            </>
          ) : (
            <>
              {/* Progress dots */}
              <div className="flex gap-1.5 mb-8">
                {STEPS.map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-colors",
                      i <= step ? "bg-blue-600" : "bg-slate-200",
                    )}
                  />
                ))}
              </div>

              {(() => {
                const S = STEPS[step];
                const Icon = S.icon;
                return (
                  <div className="mb-8">
                    <div className="h-14 w-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
                      <Icon className="h-7 w-7 text-blue-600" />
                    </div>
                    <p className="text-xs font-semibold text-blue-600 mb-2">Krok {step + 1} z {STEPS.length}</p>
                    <h1 className="text-2xl font-black text-slate-800 mb-2 leading-tight">{S.title}</h1>
                    <p className="text-[15px] text-slate-500 leading-relaxed">{S.body}</p>
                  </div>
                );
              })()}

              <button
                onClick={nextStep}
                className="w-full py-3.5 rounded-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-lg shadow-blue-600/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                {step < STEPS.length - 1 ? "Dalej" : "Przejdź do panelu"}
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={enterPanel}
                className="w-full mt-3 text-sm text-slate-400 hover:text-slate-600 font-medium"
              >
                Pomiń przewodnik
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
