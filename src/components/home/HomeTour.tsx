import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";

// localStorage (NIE sessionStorage) - onboarding raz na urzadzenie, przetrwa restart apki.
const GUEST_TOUR_KEY = "trasa_onboarding_done_v1";

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
@keyframes onb-draw { 0%{stroke-dashoffset:400} 55%,100%{stroke-dashoffset:0} }
@keyframes onb-drop { 0%{opacity:0;transform:translateY(-14px)} 30%,100%{opacity:1;transform:translateY(0)} }
@keyframes onb-frame { 0%{opacity:0;transform:translateY(10px) scale(.96)} 3%{opacity:1;transform:translateY(0) scale(1)} 11.4%{opacity:1;transform:translateY(0) scale(1)} 14.3%{opacity:0;transform:translateY(-10px) scale(.96)} 100%{opacity:0;transform:translateY(-10px) scale(.96)} }
@keyframes onb-stepon { 0%,2%{background-color:#e2e8f0;width:6px} 3%,11%{background-color:#F9662B;width:18px} 13%,100%{background-color:#e2e8f0;width:6px} }
@keyframes onb-live { 0%,100%{opacity:1} 50%{opacity:.35} }
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

// 6. Mapa - trasa na mapie + podglad
function AnimMap() {
  const pins: [number, number][] = [[28, 30], [62, 26], [70, 58], [38, 72]];
  return (
    <Screen>
      <div className="absolute inset-0 bg-slate-50">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(#e2e8f0 1px,transparent 1px),linear-gradient(90deg,#e2e8f0 1px,transparent 1px)", backgroundSize: "26px 26px" }} />
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 230 330" preserveAspectRatio="none">
          <polyline points="64,99 143,86 161,191 87,238" fill="none" stroke="#F9662B" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="400" style={{ animation: "onb-draw 2.6s ease-out infinite" }} />
        </svg>
        {pins.map(([x, y], i) => (
          <div key={i} className="absolute" style={{ left: `${x}%`, top: `${y}%`, transform: "translate(-50%, -100%)" }}>
            <div className="h-6 w-6 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shadow-lg ring-2 ring-white"
              style={{ animation: `onb-drop 2.6s ease-out ${i * 0.35}s infinite`, opacity: 0 }}>{i + 1}</div>
          </div>
        ))}
        <div className="absolute right-2 top-2 h-7 w-7 rounded-lg bg-white shadow flex items-center justify-center text-slate-500 text-xs" style={{ animation: "onb-pulse 2s ease-in-out infinite" }}>⤢</div>
      </div>
    </Screen>
  );
}

// 7. Cykl trasy - cala droga "od + do wspomnien" jako jeden auto-grajacy ekran.
// Kazda klatka widoczna ~2s w 14s petli (onb-frame, delay i*2s). Stepper u gory
// (onb-stepon) podswietla aktywny etap. Pokazuje: + > solo/grupowo > miejsca >
// dopasowania > trasa > w trakcie > po trasie (oceny + dziennik).
function FrameShell({ i, emoji, caption, children }: { i: number; emoji: string; caption: string; children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 top-9 flex flex-col items-center justify-center gap-3 px-4"
      style={{ animation: `onb-frame 14s ease-in-out ${i * 2}s infinite`, opacity: 0 }}>
      <div className="flex-1 min-h-0 w-full flex items-center justify-center">{children}</div>
      <div className="shrink-0 flex items-center gap-1.5 text-[11px] font-bold text-slate-600 text-center leading-tight">
        <span className="text-sm">{emoji}</span>{nbsp(caption)}
      </div>
    </div>
  );
}

function AnimLifecycle() {
  const tiles = ["#fdba74,#fb7185", "#7dd3fc,#3b82f6", "#86efac,#16a34a", "#c4b5fd,#7c3aed"];
  const route = [
    { n: 1, emoji: "🏛️", name: "Muzeum" },
    { n: 2, emoji: "🍳", name: "Brunch" },
    { n: 3, emoji: "🌿", name: "Park" },
  ];
  return (
    <Screen>
      {/* Stepper - 7 etapow cyklu */}
      <div className="absolute inset-x-0 top-3 flex items-center justify-center gap-1.5 px-4">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="h-1.5 rounded-full block" style={{ width: 6, backgroundColor: "#e2e8f0", animation: `onb-stepon 14s ease-in-out ${i * 2}s infinite` }} />
        ))}
      </div>

      {/* 1. Klik + */}
      <FrameShell i={0} emoji="➕" caption="Kliknij + aby zacząć">
        <div className="w-[156px] h-12 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-around">
          <span className="text-slate-300 text-lg">🏠</span>
          <div className="h-11 w-11 -mt-7 rounded-full flex items-center justify-center text-white text-2xl font-light shadow-lg" style={{ background: ORANGE_ORB, animation: "onb-press 2s ease-in-out infinite" }}>+</div>
          <span className="text-slate-300 text-lg">📖</span>
        </div>
      </FrameShell>

      {/* 2. Solo / grupowo */}
      <FrameShell i={1} emoji="🧭" caption="Solo czy grupowe parowanie">
        <div className="flex flex-col gap-2.5 w-[150px]">
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-orange-600 text-white text-xs font-bold shadow"><span>📍</span>Planuj solo</div>
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow"><span>👥</span>Planuj grupowo</div>
        </div>
      </FrameShell>

      {/* 3. Przegladanie miejsc */}
      <FrameShell i={2} emoji="🔎" caption="Przeglądasz miejsca w mieście">
        <div className="relative w-[118px] h-[148px]">
          <div className="absolute inset-0 rounded-2xl shadow-md border border-slate-200 bg-slate-100" style={{ transform: "rotate(6deg) translate(8px,4px)" }} />
          <div className="absolute inset-0 rounded-2xl overflow-hidden shadow-lg border border-slate-200" style={{ background: "linear-gradient(160deg,#fdba74,#fb7185)" }}>
            <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/55 to-transparent">
              <div className="text-white text-[11px] font-black leading-tight">Kawiarnia Lato</div>
              <div className="text-white/80 text-[9px]">☕ Śródmieście</div>
            </div>
            <div className="absolute top-2 right-2 h-6 w-6 rounded-full bg-white/90 flex items-center justify-center text-orange-600 text-sm font-bold shadow" style={{ animation: "onb-press 2s ease-in-out infinite" }}>+</div>
          </div>
        </div>
      </FrameShell>

      {/* 4. Dopasowania */}
      <FrameShell i={3} emoji="✨" caption="Zbieracie dopasowania">
        <div className="grid grid-cols-2 gap-2 w-[140px]">
          {tiles.map((g, k) => (
            <div key={k} className="relative h-14 rounded-xl shadow-sm" style={{ background: `linear-gradient(150deg,${g})` }}>
              <div className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-green-500 border-2 border-white flex items-center justify-center text-white text-[10px] font-bold"
                style={{ animation: `onb-pop 4s ease-in-out ${0.3 + k * 0.4}s infinite`, opacity: 0 }}>✓</div>
            </div>
          ))}
        </div>
      </FrameShell>

      {/* 5. Gotowa trasa */}
      <FrameShell i={4} emoji="🗺️" caption="Trasa układa plan dnia">
        <div className="flex flex-col gap-1.5 w-[150px]">
          {route.map((p, k) => (
            <div key={p.n} className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 shadow-sm px-2 py-1.5"
              style={{ animation: `onb-slidein 0.5s ease-out ${0.2 + k * 0.45}s both` }}>
              <div className="h-5 w-5 rounded-full bg-orange-600 text-white text-[10px] font-bold flex items-center justify-center shrink-0">{p.n}</div>
              <span className="text-sm">{p.emoji}</span>
              <span className="text-[11px] font-bold text-slate-800">{p.name}</span>
            </div>
          ))}
        </div>
      </FrameShell>

      {/* 6. W trakcie */}
      <FrameShell i={5} emoji="🚶" caption="Ruszacie w miasto: trasa w trakcie">
        <div className="flex flex-col items-center gap-3 w-[150px]">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200 text-green-700 text-[11px] font-black">
            <span className="h-2 w-2 rounded-full bg-green-500" style={{ animation: "onb-live 1.4s ease-in-out infinite" }} />W TRAKCIE
          </div>
          <div className="relative w-full h-px bg-slate-200">
            {[0, 1, 2].map((k) => (
              <div key={k} className="absolute -top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white shadow flex items-center justify-center"
                style={{ left: `${k * 50}%`, transform: "translateX(-50%)", background: k === 1 ? "#F9662B" : "#cbd5e1", animation: k === 1 ? "onb-pulse 1.6s ease-in-out infinite" : undefined }} />
            ))}
          </div>
          <div className="text-[10px] font-semibold text-slate-500">Przystanek 2 z 3 🕐</div>
        </div>
      </FrameShell>

      {/* 7. Po trasie - oceny + dziennik */}
      <FrameShell i={6} emoji="📔" caption="Po trasie: oceny i dziennik">
        <div className="flex flex-col items-center gap-2.5 w-[150px]">
          <div className="relative w-[112px] h-[78px] rounded-xl shadow-lg border-2 border-white overflow-hidden" style={{ background: "linear-gradient(150deg,#fb923c,#f43f5e)", transform: "rotate(-4deg)" }}>
            <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-black/30 text-white text-[9px] font-bold">Pocztówka z trasy</div>
          </div>
          <div className="flex gap-0.5 text-base" style={{ animation: "onb-char 4s ease-in-out 0.5s infinite", opacity: 0 }}>
            <span>⭐</span><span>⭐</span><span>⭐</span><span>⭐</span><span className="opacity-30">⭐</span>
          </div>
        </div>
      </FrameShell>
    </Screen>
  );
}

// Skondensowane intro (mniej klikania): tworzenie trasy solo+grupowo+kod = JEDEN
// ekran, a powstanie trasy + mapa = jeden ekran. Setup profilu (username/awatar/
// powiadomienia) to osobny etap po zalogowaniu (ProfileSetup).
const STEPS = [
  { title: "Witaj w Trasie!", desc: "Trasa to speed dating z miastem. W kilka minut ułożysz plan dnia: przeglądasz miejsca, dodajesz te które Cię ciekawią i dostajesz gotową trasę.", Anim: AnimIntro },
  { title: "Planuj sam lub z grupą", desc: "Kliknij + na pasku i wybierz: planuj solo, zaproś grupę kodem albo dołącz do znajomych. Przeglądacie miejsca, a Trasa zbiera Wasze dopasowania.", Anim: AnimSolo },
  { title: "Tak powstaje Twoja trasa", desc: "Cała droga w jednym miejscu: klikasz +, wybierasz tryb solo lub grupowe parowanie, przeglądacie miejsca, zbieracie dopasowania, dostajecie gotową trasę, ruszacie w miasto, a po wszystkim oceniacie i zapisujecie wspomnienia w dzienniku.", Anim: AnimLifecycle },
  { title: "Gotowa trasa na mapie", desc: "Z dopasowań Trasa układa plan dnia w dobrej kolejności i pokazuje go na mapie. Plan dopracujesz i zapiszesz w dzienniku.", Anim: AnimMap },
];

interface HomeTourProps { onDone: () => void; lastLabel?: string; }

const HomeTour = ({ onDone, lastLabel }: HomeTourProps) => {
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
