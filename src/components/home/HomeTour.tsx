import { useState, useEffect } from "react";
import { ArrowLeft, MapPin, Users, Link2, Plus, Map } from "lucide-react";

// localStorage (NIE sessionStorage) - onboarding raz na urzadzenie, przetrwa restart apki.
const GUEST_TOUR_KEY = "trasa_onboarding_done_v1";

// Polskie sieroty: po pojedynczych literach (a i o u w z) twarda spacja.
const nbsp = (s: string) => s.replace(/ ([aiouwzAIOUWZ]) /g, (_m, l) => " " + l + String.fromCharCode(160));

const ORANGE_ORB = "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)";

// Jedyna animacja: spokojne "oddychanie" orby (jak na waitliscie). Reszta slajdow
// statyczna - klasyczny step-by-step zamiast animowanego demo (mniej "modalowo").
const STYLES = `@keyframes onb-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.05)} }`;

// 1. Intro - orba + kategorie ktore przegladasz
function VisualIntro() {
  const chips = [["☕", "Kawiarnia"], ["🏛️", "Kultura"], ["🌿", "Natura"], ["🍽️", "Jedzenie"], ["🍺", "Bar"]];
  return (
    <div className="flex flex-col items-center gap-7">
      <div className="h-28 w-28 rounded-full shadow-lg" style={{ background: ORANGE_ORB, animation: "onb-pulse 2.8s ease-in-out infinite" }} />
      <div className="flex flex-wrap items-center justify-center gap-2 max-w-[280px]">
        {chips.map(([emoji, label]) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-semibold text-slate-700">
            <span>{emoji}</span>{label}
          </span>
        ))}
      </div>
    </div>
  );
}

// 2. Planuj sam lub z grupa - opcje spod guzika "+"
function VisualPlan() {
  const items = [
    { icon: <MapPin className="h-4 w-4" />, label: "Zaplanuj solo", cls: "bg-orange-600 text-white" },
    { icon: <Users className="h-4 w-4" />, label: "Zaplanuj grupowo", cls: "bg-slate-900 text-white" },
    { icon: <Link2 className="h-4 w-4 text-orange-600" />, label: "Dołącz do sesji", cls: "bg-white border border-slate-200 text-slate-700" },
  ];
  return (
    <div className="flex flex-col items-center gap-3 w-full max-w-[260px]">
      {items.map((it) => (
        <div key={it.label} className={`w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-full text-sm font-semibold shadow-sm ${it.cls}`}>
          {it.icon}{it.label}
        </div>
      ))}
      <div className="mt-1 h-12 w-12 rounded-full flex items-center justify-center text-white shadow-lg" style={{ background: ORANGE_ORB }}>
        <Plus className="h-6 w-6" />
      </div>
    </div>
  );
}

// 3. Gotowa trasa - lista miejsc w dobrej kolejnosci
function VisualRoute() {
  const places = [["🏛️", "Muzeum Narodowe"], ["🥟", "Bar Mleczny Prasowy"], ["🌳", "Łazienki Królewskie"]];
  return (
    <div className="w-full max-w-[260px] rounded-3xl bg-white border border-slate-200 shadow-md p-5 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 tracking-wide">
        <Map className="h-3.5 w-3.5 text-orange-600" /> TWOJA TRASA
      </div>
      {places.map(([emoji, name], i) => (
        <div key={name} className="flex items-center gap-2.5">
          <div className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</div>
          <span className="text-base">{emoji}</span>
          <span className="text-[13px] font-semibold text-slate-700 truncate">{name}</span>
        </div>
      ))}
    </div>
  );
}

// 4. Dostepne miasta - na start Polska, wkrotce Europa
function VisualCities() {
  const cities: [string, boolean][] = [
    ["Warszawa", true], ["Gdańsk", true], ["Kraków", false], ["Wrocław", false],
  ];
  return (
    <div className="w-full max-w-[260px] rounded-3xl bg-white border border-slate-200 shadow-md p-5 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 tracking-wide">
        <Map className="h-3.5 w-3.5 text-orange-600" /> DOSTĘPNE MIASTA
      </div>
      <div className="flex flex-wrap gap-2">
        {cities.map(([name, on]) => (
          <span key={name} className={`px-3 py-1.5 rounded-full text-[13px] font-semibold ${on ? "bg-orange-600 text-white" : "bg-slate-100 text-slate-400"}`}>
            {on ? "📍 " : "🔒 "}{name}
          </span>
        ))}
      </div>
      <p className="text-[12px] text-slate-500 leading-snug">i&nbsp;kolejne polskie miasta, a&nbsp;wkrótce cała Europa 🇪🇺</p>
    </div>
  );
}

// Skondensowane intro (mniej klikania): czym jest Trasa -> dostepne miasta -> jak
// planujesz solo/grupa -> gotowa trasa. Setup profilu (username/awatar/powiadomienia)
// to osobny etap po zalogowaniu (ProfileSetup).
const STEPS = [
  { title: "Witaj w Trasie!", desc: "Trasa to speed dating z miastem. W kilka minut ułożysz plan dnia: przeglądasz miejsca, dodajesz te które Cię ciekawią i dostajesz gotową trasę.", highlight: "", Visual: VisualIntro },
  { title: "Na start: polskie miasta", desc: "Zaczynamy od Warszawy i Gdańska, a kolejne miasta dochodzą na bieżąco. Trasa cały czas rośnie - wkrótce zaplanujesz podróż po całej Europie.", highlight: "", Visual: VisualCities },
  { title: "Planuj sam lub z grupą", desc: "Kliknij + na pasku i wybierz: planuj solo, zaproś grupę kodem albo dołącz do znajomych. Wy przeglądacie miejsca, a Trasa zbiera Wasze dopasowania.", highlight: "", Visual: VisualPlan },
  { title: "Gotowa trasa na mapie", desc: "Z dopasowań Trasa układa plan dnia w dobrej kolejności i pokazuje go na mapie. Plan dopracujesz i zapiszesz we wspomnieniach.", highlight: "Nawigujesz od punktu do punktu przez Google Maps.", Visual: VisualRoute },
];

interface HomeTourProps { onDone: () => void; lastLabel?: string; }

const HomeTour = ({ onDone, lastLabel }: HomeTourProps) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Visual = current.Visual;

  const next = () => { if (isLast) onDone(); else setStep(step + 1); };
  const back = () => { if (step === 0) onDone(); else setStep(step - 1); };

  return (
    <div className="fixed inset-0 z-[70] bg-[#FEFEFE] flex flex-col">
      <style>{STYLES}</style>

      {/* Top: wstecz + pasek postepu + pomin */}
      <div className="flex items-center gap-3 px-4 pb-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 1rem)" }}>
        <button onClick={back} aria-label="Wstecz" className="h-9 w-9 -ml-1 flex items-center justify-center rounded-full text-foreground active:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-orange-600 rounded-full transition-all duration-300" style={{ width: i <= step ? "100%" : "0%" }} />
            </div>
          ))}
        </div>
        <button onClick={onDone} className="text-sm font-medium text-muted-foreground px-1">Pomiń</button>
      </div>

      {/* Slajd (statyczny) */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6 overflow-hidden">
        <div key={step} className="w-full flex items-center justify-center transition-opacity duration-300">
          <Visual />
        </div>
      </div>

      {/* Tekst */}
      <div className="px-7 pb-2 text-center">
        <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(current.title)}</h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(current.desc)}</p>
        {current.highlight && (
          <p className="text-[15px] font-bold text-foreground leading-relaxed mt-2">{nbsp(current.highlight)}</p>
        )}
      </div>

      {/* Przycisk */}
      <div className="px-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        <button onClick={next}
          className="w-full py-4 rounded-full text-white font-bold text-base shadow-lg active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(to right, #F4A259, #F9662B)" }}>
          {isLast ? (lastLabel ?? "Zaczynamy! 🚀") : "Dalej"}
        </button>
      </div>
    </div>
  );
};

// Intro-tour (Witaj / solo+grupa / mapa) pokazujemy GOSCIOM (niezalogowanym).
// Zalogowany user dostaje osobny setup profilu (ProfileSetup: username + awatar
// + powiadomienia) - patrz useProfileSetup. Dzieki temu intro tlumaczy aplikacje
// zanim ktos zalozy konto, a setup uzupelnia profil dopiero po zalogowaniu.
export const useHomeTour = (isGuest: boolean) => {
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    // localStorage = raz na URZADZENIE, niezawodne (przetrwa restart + nawigacje).
    if (localStorage.getItem(GUEST_TOUR_KEY)) return;
    if (isGuest) setShowTour(true);
  }, [isGuest]);

  const dismissTour = () => {
    setShowTour(false);
    try { localStorage.setItem(GUEST_TOUR_KEY, "1"); } catch { /* ignore */ } // blokuje ponowne otwarcie na tym urzadzeniu
  };

  return { showTour, dismissTour };
};

export default HomeTour;
