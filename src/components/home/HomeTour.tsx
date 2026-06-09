import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const GUEST_TOUR_KEY = "trasa_guest_tour_session";

// Polskie sieroty: po pojedynczych literach (a i o u w z) twarda spacja.
const nbsp = (s: string) => s.replace(/ ([aiouwzAIOUWZ]) /g, (_m, l) => " " + l + String.fromCharCode(160));

const ORANGE_ORB = "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)";

// Wszystkie animacje czystym CSS (bez bibliotek) - niezawodne na native WebView.
const STYLES = `
@keyframes onb-pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.07)} }
@keyframes onb-float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
@keyframes onb-rise { 0%{opacity:0;transform:translateY(22px)} 14%,70%{opacity:1;transform:translateY(0)} 100%{opacity:0;transform:translateY(22px)} }
@keyframes onb-ripple { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.4);opacity:0} }
@keyframes onb-pop { 0%{opacity:0;transform:scale(0)} 18%{opacity:1;transform:scale(1.15)} 28%,82%{opacity:1;transform:scale(1)} 100%{opacity:0;transform:scale(0)} }
@keyframes onb-char { 0%,8%{opacity:0} 16%,88%{opacity:1} 100%{opacity:0} }
@keyframes onb-press { 0%,70%,100%{transform:scale(1)} 80%{transform:scale(.93)} }
@keyframes onb-slidein { 0%{opacity:0;transform:translateX(38px)} 100%{opacity:1;transform:translateX(0)} }
@keyframes onb-scroll { 0%,55%{transform:translateY(0)} 80%,100%{transform:translateY(-34px)} }
@keyframes onb-screenfade { from{opacity:0;transform:translateX(28px)} to{opacity:1;transform:translateX(0)} }
@keyframes onb-finger { 0%{top:86%;opacity:0} 18%{opacity:1} 45%,100%{top:42%;opacity:0} }
`;

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative w-[230px] h-[330px] rounded-[28px] bg-white border border-slate-200 shadow-xl overflow-hidden">
      {children}
    </div>
  );
}

// 1. Intro - orb + dryfujace kategorie
function AnimIntro() {
  const chips: [string, string, number, number][] = [
    ["☕", "Kawiarnia", -82, -64], ["🍺", "Bar", 74, -82], ["🏛️", "Kultura", -96, 30],
    ["🌿", "Natura", 86, 34], ["🍽️", "Jedzenie", -6, 104],
  ];
  return (
    <div className="relative w-full h-full flex items-center justify-center">
      <div className="h-24 w-24 rounded-full shadow-lg" style={{ background: ORANGE_ORB, animation: "onb-pulse 2.6s ease-in-out infinite" }} />
      {chips.map(([emoji, label, x, y], i) => (
        <div key={label} className="absolute" style={{ left: "50%", top: "50%", transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-200 shadow-md text-xs font-semibold"
            style={{ animation: `onb-float ${2.4 + i * 0.25}s ease-in-out ${i * 0.2}s infinite` }}>
            <span>{emoji}</span><span className="text-slate-700">{label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 2. Solo - + otwiera menu, "Zaplanuj solo" podswietlone
function AnimSolo() {
  const items = [
    { icon: "🔗", label: "Dołącz do sesji", cls: "bg-white border border-slate-200 text-slate-700" },
    { icon: "👥", label: "Zaplanuj grupowo", cls: "bg-slate-900 text-white" },
    { icon: "📍", label: "Zaplanuj solo", cls: "bg-orange-600 text-white", hi: true },
  ];
  return (
    <Screen>
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 pb-16 px-4">
        {items.map((it, i) => (
          <div key={it.label} className={`relative flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold shadow ${it.cls}`}
            style={{ animation: `onb-rise 4s ease-in-out ${0.4 + i * 0.12}s infinite`, opacity: 0 }}>
            <span>{it.icon}</span>{it.label}
            {it.hi && <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-orange-400" style={{ animation: "onb-ripple 1.4s ease-out infinite" }} />}
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-0 h-14 bg-white border-t border-slate-100 flex items-center justify-center">
        <div className="h-11 w-11 rounded-full flex items-center justify-center text-white text-2xl font-light shadow-lg" style={{ background: ORANGE_ORB }}>+</div>
      </div>
      <div className="absolute h-6 w-6 rounded-full bg-black/25" style={{ left: "50%", transform: "translateX(-50%)", animation: "onb-finger 4s ease-in-out infinite" }} />
    </Screen>
  );
}

// 3. Grupowo - kod + dolaczajacy znajomi
function AnimGroup() {
  const avatars = ["O", "B", "C"];
  return (
    <Screen>
      <div className="absolute inset-0 flex flex-col items-center pt-9 px-4">
        <div className="text-[11px] font-bold text-slate-400 mb-1">Sesja grupowa</div>
        <div className="px-4 py-2 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 font-black tracking-widest text-base" style={{ animation: "onb-pulse 2s ease-in-out infinite" }}>#GRUPA7</div>
        <div className="text-[10px] text-slate-400 mt-1.5 mb-5">Udostępnij kod znajomym</div>
        <div className="flex -space-x-2">
          {avatars.map((a, i) => (
            <div key={a} className="h-10 w-10 rounded-full bg-orange-100 border-2 border-white flex items-center justify-center text-sm font-bold text-orange-700"
              style={{ animation: `onb-pop 4s ease-in-out ${0.5 + i * 0.4}s infinite`, opacity: 0 }}>{a}</div>
          ))}
        </div>
        <div className="mt-4 text-[11px] font-semibold text-green-600" style={{ animation: "onb-char 4s ease-in-out 1.6s infinite", opacity: 0 }}>3 osoby w sesji ✓</div>
      </div>
    </Screen>
  );
}

// 4. Dolacz - wpisywanie kodu
function AnimJoin() {
  const code = "GRUPA7".split("");
  return (
    <Screen>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-5">
        <div className="text-xs font-bold text-slate-700 mb-1">Dołącz do sesji</div>
        <div className="text-[10px] text-slate-400 mb-4 text-center">Wpisz kod od znajomych</div>
        <div className="flex gap-1.5 mb-5">
          {code.map((ch, i) => (
            <div key={i} className="h-9 w-7 rounded-lg border-2 border-slate-200 bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-800">
              <span style={{ animation: `onb-char 4s steps(1) ${i * 0.32}s infinite`, opacity: 0 }}>{ch}</span>
            </div>
          ))}
        </div>
        <div className="px-6 py-2.5 rounded-full bg-orange-600 text-white text-xs font-bold shadow" style={{ animation: "onb-press 4s ease-in-out infinite" }}>Dołącz</div>
      </div>
    </Screen>
  );
}

// 5. Trasa - miejsca ukladaja sie w plan + scroll
function AnimRoute() {
  const places = [
    { n: 1, emoji: "🏛️", name: "Tate Liverpool", time: "11:30" },
    { n: 2, emoji: "🍳", name: "The Egg Cafe", time: "14:15" },
    { n: 3, emoji: "🚶", name: "Royal Albert Dock", time: "16:00" },
    { n: 4, emoji: "📍", name: "Liverpool Cathedral", time: "17:45" },
  ];
  return (
    <Screen>
      <div className="absolute inset-x-0 top-0 px-4 pt-7 pb-2 bg-white z-10 border-b border-slate-50">
        <div className="text-[10px] text-slate-400 font-semibold">PLAN DNIA</div>
        <div className="text-sm font-black text-slate-800">Twoja trasa</div>
      </div>
      <div className="absolute inset-x-0 px-4 flex flex-col gap-2 pt-[60px]" style={{ animation: "onb-scroll 5s ease-in-out infinite" }}>
        {places.map((p, i) => (
          <div key={p.n} className="flex items-center gap-2.5 bg-white rounded-xl border border-slate-100 shadow-sm px-2.5 py-2"
            style={{ animation: `onb-slidein 0.5s ease-out ${0.3 + i * 0.5}s both` }}>
            <div className="h-6 w-6 rounded-full bg-orange-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{p.n}</div>
            <span className="text-base">{p.emoji}</span>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-800 truncate">{p.name}</div>
              <div className="text-[9px] text-slate-400">🕐 {p.time}</div>
            </div>
          </div>
        ))}
      </div>
    </Screen>
  );
}

const STEPS = [
  { title: "Witaj w Trasie!", desc: "Trasa to speed dating z miastem. W kilka minut ułożysz plan dnia: przeglądasz miejsca, dodajesz te które Cię ciekawią, dostajesz gotową trasę.", Anim: AnimIntro },
  { title: "Planuj solo", desc: "Kliknij przycisk + na środku paska i wybierz „Zaplanuj solo”. Sam przeglądasz miejsca i dodajesz te, które chcesz odwiedzić.", Anim: AnimSolo },
  { title: "Planuj grupowo", desc: "Przycisk + → „Zaplanuj grupowo”. Tworzysz sesję, udostępniasz znajomym kod, a Trasa pokaże Wasze wspólne dopasowania.", Anim: AnimGroup },
  { title: "Dołącz do znajomych", desc: "Masz kod od znajomych? Przycisk + → „Dołącz do sesji”, wpisz kod i parujecie się razem.", Anim: AnimJoin },
  { title: "Z dopasowań powstaje trasa", desc: "Z polubionych i wspólnych miejsc Trasa układa gotowy plan dnia w sensownej kolejności. Plan edytujesz i zapisujesz w dzienniku.", Anim: AnimRoute },
];

interface HomeTourProps { onDone: () => void; }

const HomeTour = ({ onDone }: HomeTourProps) => {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const Anim = current.Anim;

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

      {/* Animacja */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6 overflow-hidden">
        <div key={step} className="w-full h-full flex items-center justify-center" style={{ animation: "onb-screenfade 0.32s ease-out" }}>
          <Anim />
        </div>
      </div>

      {/* Tekst */}
      <div className="px-7 pb-2 text-center">
        <h2 className="text-2xl font-black mb-2 leading-tight">{nbsp(current.title)}</h2>
        <p className="text-[15px] text-muted-foreground leading-relaxed">{nbsp(current.desc)}</p>
      </div>

      {/* Przycisk */}
      <div className="px-6 pt-4" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 1.5rem)" }}>
        <button onClick={next}
          className="w-full py-4 rounded-full text-white font-bold text-base shadow-lg active:scale-[0.98] transition-transform"
          style={{ background: "linear-gradient(to right, #F4A259, #F9662B)" }}>
          {isLast ? "Zaczynamy! 🚀" : "Dalej"}
        </button>
      </div>
    </div>
  );
};

export const useHomeTour = (isGuest: boolean) => {
  const { user } = useAuth();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (isGuest) {
      if (!sessionStorage.getItem(GUEST_TOUR_KEY)) setShowTour(true);
      return;
    }
    if (!user) return;
    supabase.from("profiles").select("onboarding_completed").eq("id", user.id).single()
      .then(({ data }) => { if (!data?.onboarding_completed) setShowTour(true); });
  }, [isGuest, user]);

  const dismissTour = () => {
    setShowTour(false);
    if (isGuest) { sessionStorage.setItem(GUEST_TOUR_KEY, "1"); return; }
    if (!user) return;
    supabase.from("profiles").update({ onboarding_completed: true }).eq("id", user.id);
  };

  return { showTour, dismissTour };
};

export default HomeTour;
