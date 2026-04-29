import { useState, useEffect, useRef, useCallback, forwardRef } from "react";
import {
  motion, AnimatePresence, useMotionValue, useTransform, animate,
  type MotionValue, type PanInfo,
} from "framer-motion";
import { Star, Clock, Globe } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Demo data ────────────────────────────────────────────────────────────────

type DemoPlace = {
  id: string; name: string; category: string; address: string;
  rating: number; reviews: number; event: string | null;
  tags: string[]; gradient: string; logoChar: string; description: string;
};

const DEMO_PLACES: DemoPlace[] = [
  { id: "1", name: "Wanderlust Coffee", category: "Kawiarnia", address: "Nowy Swiat 12", rating: 4.8, reviews: 312, event: "Nowe single origin: Etiopia 🫘", tags: ["kawiarnia", "kawa", "slow food"], gradient: "from-amber-800 via-orange-700 to-amber-600", logoChar: "W", description: "Specialty coffee w sercu Warszawy. Trzecia fala, lokalne wypieki, spokojne miejsce." },
  { id: "2", name: "Stolowka Gdanska", category: "Restauracja", address: "Dlugie Ogrody 27", rating: 4.7, reviews: 234, event: "Dzisiaj zupa+drugie za 29,90zl", tags: ["restauracja", "jedzenie", "lokalne"], gradient: "from-slate-700 via-slate-600 to-slate-800", logoChar: "S", description: "Kultowe miejsce w centrum. Domowe obiady, prosty wystoj i zawsze pelna sala." },
  { id: "3", name: "Lody Mariacka", category: "Lodziarnia", address: "Mariacka 16", rating: 4.9, reviews: 412, event: "Nowy smak: mango-chili 🌶️", tags: ["lody", "kawiarnia", "instagramowe"], gradient: "from-pink-500 via-rose-500 to-pink-600", logoChar: "L", description: "Najlepsza lodziarnia rzemielnicza. Sezonowe smaki, kolejki od rana." },
];

// ─── CardInner ────────────────────────────────────────────────────────────────

function CardInner({ place, likeOpacity, skipOpacity }: {
  place: DemoPlace; likeOpacity?: MotionValue<number>; skipOpacity?: MotionValue<number>;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      <div className={`absolute inset-0 bg-gradient-to-br ${place.gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />
      {likeOpacity && <motion.div className="absolute left-3 top-5 z-20 border-2 border-green-400 rounded-lg px-2 py-0.5 -rotate-12" style={{ opacity: likeOpacity }}><span className="text-green-400 font-black text-[10px] tracking-widest">TAK</span></motion.div>}
      {skipOpacity && <motion.div className="absolute right-3 top-5 z-20 border-2 border-red-400 rounded-lg px-2 py-0.5 rotate-12" style={{ opacity: skipOpacity }}><span className="text-red-400 font-black text-[10px] tracking-widest">NIE</span></motion.div>}
      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white border-2 border-white/30 shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}>{place.logoChar}</div>
          <span className="text-white/70 text-[10px] font-medium">{place.category} · @trasa</span>
        </div>
        <h3 className="text-white font-black text-[17px] leading-tight">{place.name}</h3>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /><span className="text-white text-[10px] font-semibold">{place.rating}</span></span>
          <span className="text-white/55 text-[9px]">📍 {place.address}</span>
        </div>
        {place.event && <div className="inline-flex items-center gap-1 bg-gradient-to-r from-[#F4A259] to-[#F9662B] rounded-full px-2.5 py-[3px]"><span className="text-[8px]">🎉</span><span className="text-white font-semibold text-[8.5px]">{place.event}</span></div>}
        <div className="flex flex-wrap gap-1">
          {place.tags.map(t => <span key={t} className="text-white/55 text-[8px] bg-white/10 rounded-full px-2 py-0.5 whitespace-nowrap">{t}</span>)}
        </div>
      </div>
    </div>
  );
}

// ─── Phases ───────────────────────────────────────────────────────────────────

function PhaseB({ onNext }: { onNext: () => void }) {
  const [cardIdx, setCardIdx] = useState(0);
  const [decided, setDecided] = useState(false);
  const dragX = useMotionValue(0);
  const rotate = useTransform(dragX, [-120, 0, 120], [-12, 0, 12]);
  const likeOpacity = useTransform(dragX, [20, 80], [0, 1]);
  const skipOpacity = useTransform(dragX, [-80, -20], [1, 0]);

  const flyOut = (dir: "like" | "skip") => {
    if (decided) return;
    setDecided(true);
    animate(dragX, dir === "like" ? 450 : -450, { duration: 0.36 });
    setTimeout(() => {
      dragX.set(0);
      const next = cardIdx + 1;
      if (next >= DEMO_PLACES.length) onNext();
      else { setCardIdx(next); setDecided(false); }
    }, 400);
  };
  const flyOutRef = useRef(flyOut);
  useEffect(() => { flyOutRef.current = flyOut; });
  useEffect(() => {
    const t1 = setTimeout(() => flyOutRef.current("like"), 1800);
    const t2 = setTimeout(() => flyOutRef.current("like"), 3400);
    const t3 = setTimeout(() => flyOutRef.current("like"), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  const remaining = DEMO_PLACES.length - cardIdx;
  return (
    <motion.div key="B" className="absolute inset-0 flex flex-col bg-[#f5f5f5]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className="relative flex-1 min-h-0 mx-1.5 mt-1.5">
        {remaining >= 3 && <div className="absolute inset-0 rounded-3xl overflow-hidden" style={{ transform: "scale(0.88) translateY(10px)", zIndex: 1, opacity: 0.6 }}><div className={`w-full h-full bg-gradient-to-br ${DEMO_PLACES[cardIdx + 2]?.gradient ?? DEMO_PLACES[0].gradient}`} /></div>}
        {remaining >= 2 && <div className="absolute inset-0 rounded-3xl overflow-hidden" style={{ transform: "scale(0.94) translateY(5px)", zIndex: 2, opacity: 0.8 }}><div className={`w-full h-full bg-gradient-to-br ${DEMO_PLACES[cardIdx + 1]?.gradient ?? DEMO_PLACES[0].gradient}`} /></div>}
        <motion.div drag="x" dragConstraints={{ left: 0, right: 0 }} dragElastic={0.72}
          onDragEnd={(_: unknown, info: PanInfo) => { if (decided) return; if (info.offset.x > 60) flyOut("like"); else if (info.offset.x < -60) flyOut("skip"); else animate(dragX, 0, { type: "spring", stiffness: 300, damping: 30 }); }}
          style={{ x: dragX, rotate, zIndex: 10, touchAction: "pan-y" }} className="absolute inset-0 rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing shadow-xl">
          <CardInner place={DEMO_PLACES[cardIdx]} likeOpacity={likeOpacity} skipOpacity={skipOpacity} />
        </motion.div>
      </div>
    </motion.div>
  );
}

function PhaseC({ onNext }: { onNext: () => void }) {
  useEffect(() => { const t = setTimeout(onNext, 4000); return () => clearTimeout(t); }, [onNext]);
  const place = DEMO_PLACES[0];
  return (
    <motion.div key="C" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <div className={`absolute inset-0 bg-gradient-to-br ${place.gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute top-4 left-0 right-0 px-4"><p className="text-white/65 text-[9px]">{place.category}</p><h3 className="text-white font-black text-sm">{place.name}</h3></div>
      <motion.div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[26px] overflow-hidden" style={{ height: "72%" }} initial={{ y: "100%" }} animate={{ y: 0 }} transition={{ type: "spring", stiffness: 260, damping: 34, delay: 0.15 }}>
        <div className="flex justify-center pt-2.5 pb-1"><div className="w-8 h-1 rounded-full bg-slate-200" /></div>
        <div className="flex gap-1.5 px-3 mb-3">{[place.gradient, "from-slate-400 to-slate-500", "from-amber-300 to-amber-500"].map((g, i) => <div key={i} className={`rounded-xl bg-gradient-to-br ${g} flex-1`} style={{ height: 56 }} />)}</div>
        <div className="px-3 space-y-2.5">
          <div className="flex items-start justify-between"><div><h3 className="font-black text-sm text-[#0E0E0E]">{place.name}</h3><p className="text-[10px] text-[#979797]">{place.category} · Warszawa</p></div><div className="flex items-center gap-0.5 bg-slate-50 rounded-xl px-2 py-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /><span className="text-[10px] font-bold">{place.rating}</span></div></div>
          <p className="text-[9px] text-[#979797] leading-relaxed">{place.description}</p>
          <div className="flex gap-3 text-[9px] text-[#979797]"><span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> pon-pt 8:00-20:00</span><span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> wanderlust.pl</span></div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function PhaseE({ onNext, onComplete }: { onNext: () => void; onComplete?: () => void }) {
  useEffect(() => {
    const t = setTimeout(() => { onComplete ? onComplete() : onNext(); }, 6000);
    return () => clearTimeout(t);
  }, [onNext, onComplete]);
  return (
    <motion.div key="E" className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 to-slate-800" />
      <video
        ref={el => { if (!el) return; el.muted = true; el.play().catch(() => {}); }}
        src="/founders_business.mp4"
        autoPlay playsInline muted preload="auto" loop
        className="absolute inset-0 w-full h-full object-cover"
        style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
      <motion.div className="absolute bottom-0 left-0 right-0 px-4 pb-6 flex flex-col items-center gap-2"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <p className="text-white font-black text-[14px] text-center leading-tight">Dolacz przed launchem</p>
        <p className="text-white/55 text-[10px] text-center">Trasa - speed dating z miastem 🧡</p>
        <button onClick={() => onComplete ? onComplete() : onNext()} className="mt-2 text-white/45 text-[8px] tracking-widest uppercase font-semibold">Dalej →</button>
      </motion.div>
    </motion.div>
  );
}

// ─── PhoneMockup ──────────────────────────────────────────────────────────────

type Phase = "B" | "C" | "E";

const PhoneMockup = forwardRef<HTMLDivElement, { onComplete?: () => void }>(({ onComplete }, ref) => {
  const [phase, setPhase] = useState<Phase>("B");
  const [phaseKey, setPhaseKey] = useState(0);

  const nextPhase = useCallback(() => {
    setPhase(p => (p === "B" ? "C" : p === "C" ? "E" : "B"));
    setPhaseKey(k => k + 1);
  }, []);

  const phaseEl: Record<Phase, React.ReactNode> = {
    B: <PhaseB key={`B-${phaseKey}`} onNext={nextPhase} />,
    C: <PhaseC key={`C-${phaseKey}`} onNext={nextPhase} />,
    E: <PhaseE key={`E-${phaseKey}`} onNext={nextPhase} onComplete={onComplete} />,
  };

  const phoneStyle = { width: "clamp(270px, 42vw, 310px)", aspectRatio: "9/19.5" };

  return (
    <div className="flex flex-col items-center">
      <div ref={ref} className="relative mx-auto select-none rounded-[42px] bg-slate-800" style={phoneStyle}>
        <div className="absolute inset-0 rounded-[42px] pointer-events-none" style={{ boxShadow: "0 32px 80px -12px rgba(0,0,0,0.4)" }} />
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -right-[3px] top-[22%] w-[4px] h-10 bg-slate-700 rounded-r-full" />
          <div className="absolute -left-[3px] top-[18%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
          <div className="absolute -left-[3px] top-[27%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
          <div className="absolute top-[9px] left-1/2 -translate-x-1/2 w-14 h-[14px] bg-slate-800 rounded-full" style={{ zIndex: 10 }} />
        </div>
        <div className="absolute inset-[9px] rounded-[34px] overflow-hidden bg-black" style={{ zIndex: 1 }}>
          <AnimatePresence mode="wait">{phaseEl[phase]}</AnimatePresence>
        </div>
      </div>
    </div>
  );
});
PhoneMockup.displayName = "PhoneMockup";

// ─── Postcard (1:1 z WaitlistPage) ───────────────────────────────────────────

function PostcardFront({ w, h }: { w: number; h: number }) {
  const pad = Math.round(w * 0.05);
  const bottomPad = Math.round(w * 0.18);
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden bg-white shadow-md flex flex-col"
      style={{ padding: `${pad}px ${pad}px ${bottomPad}px` }}>
      <div className="relative flex-1 overflow-hidden rounded-sm bg-slate-200">
        <img src="/IMG_9609.jpg" alt="Nat i Bart" className="absolute inset-0 w-full h-full object-cover object-top" />
      </div>
      <div className="flex items-end justify-between" style={{ paddingTop: pad * 0.7 }}>
        <p className="font-black text-[#0E0E0E]" style={{ fontSize: w * 0.105 }}>2026</p>
        <div className="text-right">
          <p className="font-bold text-[#0E0E0E]" style={{ fontSize: w * 0.062 }}>Nat i Bart</p>
          <p style={{ fontSize: w * 0.052, color: "#979797" }}>trasa.travel</p>
        </div>
      </div>
    </div>
  );
}

const BACK_MESSAGE = [
  "Hej!",
  "",
  "Ile frajdy będziemy",
  "mieć razem,",
  "odkrywając nowe miasta.",
  "Nie możemy się doczekać!",
  "",
  "do zobaczenia,",
];

function PostcardBack({ w, h, isVisible }: { w: number; h: number; isVisible: boolean }) {
  const pad = Math.round(w * 0.09);
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-md flex flex-col"
      style={{ background: "#FEFEFE", padding: `${pad}px` }}>
      <div className="mb-3 flex justify-between items-baseline w-full">
        <span style={{ fontFamily: "monospace", fontSize: w * 0.038, color: "#aaa", letterSpacing: "0.05em", textTransform: "uppercase" }}>Nat i Bart</span>
        <span style={{ fontFamily: "monospace", fontSize: w * 0.038, color: "#aaa", letterSpacing: "0.05em", textTransform: "uppercase" }}>Gdańsk · 2026</span>
      </div>
      <div className="mb-3" style={{ height: 1, background: "#e8e0d5" }} />
      <div className="flex-1 flex flex-col justify-start">
        {BACK_MESSAGE.map((line, i) => (
          <motion.p key={i}
            style={{ fontFamily: "'Caveat', 'Bradley Hand', cursive", fontSize: w * 0.082, color: "#2d1505", lineHeight: 1.5, minHeight: line ? undefined : `${w * 0.082 * 0.75}px` }}
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.3 + i * 0.07, duration: 0.3 }}>
            {line || ""}
          </motion.p>
        ))}
      </div>
      <motion.div className="mt-auto"
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}>
        <div className="mb-2" style={{ height: 1, background: "#e8e0d5" }} />
        <p style={{ fontFamily: "'Caveat', cursive", fontSize: w * 0.088, color: "#2d1505", fontWeight: 600, textAlign: "center" }}>Nat i Bart 🧡</p>
      </motion.div>
    </div>
  );
}

function PostcardReveal({ large = false, targetH }: { large?: boolean; targetH?: number }) {
  const baseW = large ? 300 : 238;
  const baseH = large ? 530 : 423;
  const scale = targetH ? targetH / baseH : 1;
  const w = Math.round(baseW * scale);
  const h = Math.round(baseH * scale);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    const delay = flipped ? 8000 : 3000;
    const id = setTimeout(() => setFlipped(f => !f), delay);
    return () => clearTimeout(id);
  }, [flipped]);

  return (
    <div>
      <div style={{ width: w, height: h, perspective: "900px" }}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.85, type: "spring", stiffness: 82, damping: 17 }}
          style={{ transformStyle: "preserve-3d", WebkitTransformStyle: "preserve-3d", width: w, height: h, position: "relative" }}>
          <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", position: "absolute", inset: 0 }}>
            <PostcardFront w={w} h={h} />
          </div>
          <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)", WebkitTransform: "rotateY(180deg)", position: "absolute", inset: 0 }}>
            <PostcardBack w={w} h={h} isVisible={flipped} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── AppStoreBadge ────────────────────────────────────────────────────────────

function AppStoreBadge({ store }: { store: "ios" | "android" }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 select-none h-[52px]">
      {store === "ios"
        ? <svg className="h-5 w-5 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
        : <svg className="h-5 w-5 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76a2 2 0 0 0 2.37-.08l.11-.08 9.5-5.48-2.35-2.35zM1.5 2.27A2 2 0 0 0 1 3.73v16.54a2 2 0 0 0 .5 1.46l.08.08 9.26-9.26v-.22zM20.49 10.7l-2.7-1.56-2.62 2.62 2.62 2.62 2.71-1.56a2 2 0 0 0 0-3.12zM5.55.4 14.93 5.8l-2.35 2.35L5.18.65A2 2 0 0 1 5.55.4z" /></svg>}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">{store === "ios" ? "Pobierz w" : "Dostepne w"}</p>
        <p className="text-[12px] font-semibold text-slate-600 leading-tight whitespace-nowrap">{store === "ios" ? "App Store" : "Google Play"}</p>
      </div>
      <span className="text-[9px] text-slate-400 font-medium bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0">Wkrotce</span>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

type Scene = "demo" | "postcard";

export default function BusinessLanding() {
  const navigate = useNavigate();
  const [scene, setScene] = useState<Scene>("demo");
  const goPostcard = useCallback(() => setScene("postcard"), []);

  return (
    <div style={{ background: "#FEFEFE", minHeight: "100dvh" }}>

      {/* ── MOBILE ── */}
      <div className="lg:hidden flex flex-col items-center px-5 pt-12 pb-10 gap-8">
        <div className="w-14 h-14 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)", boxShadow: "0 0 32px rgba(249,102,43,0.3)" }} />
        <div className="text-center">
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#F4A259" }}>PRZED LAUNCHEM</p>
          <h1 className="text-4xl font-black text-[#0E0E0E] leading-[1.05] mb-4">
            Dolacz do Trasy<br />jako Founding<br />Partner
          </h1>
          <p className="text-[#979797] text-base leading-relaxed max-w-xs mx-auto mb-5">
            Budujemy aplikacje do grupowego planowania podrozy. Szukamy pierwszych 100 lokali w Warszawie - wchodzisz bezplatnie i zostajesz na mapie zanim uzytkownicy tu trafią.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white">
            <span className="text-base">🚀</span>
            <span className="text-sm font-semibold text-[#0E0E0E]">Premiera: czerwiec 2026</span>
          </div>
        </div>

        {/* Phone → Postcard */}
        <AnimatePresence mode="wait">
          {scene === "demo" ? (
            <motion.div key="phone-mobile" exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.35 }}>
              <PhoneMockup onComplete={goPostcard} />
            </motion.div>
          ) : (
            <motion.div key="postcard-mobile"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 26 }}>
              <PostcardReveal targetH={Math.min(Math.round(window.innerWidth * 0.50 * (19.5 / 9) * 0.88), 380)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-col gap-3 w-full max-w-xs">
          <button
            onClick={() => navigate("/biznes/start")}
            className="w-full rounded-2xl text-white font-bold py-4 text-base active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)", boxShadow: "0 8px 24px -6px rgba(249,102,43,0.4)" }}
          >
            Zakladam konto
          </button>
          <button
            onClick={() => navigate("/biznes/start")}
            className="w-full rounded-2xl border border-slate-200 text-[#0E0E0E] font-semibold py-3.5 text-sm hover:bg-slate-50 transition-colors"
          >
            Zobacz jak to dziala →
          </button>
          <div className="flex gap-2 pt-1">
            <div className="flex-1"><AppStoreBadge store="ios" /></div>
            <div className="flex-1"><AppStoreBadge store="android" /></div>
          </div>
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden lg:flex min-h-screen items-center justify-center gap-20 px-8 py-16 max-w-5xl mx-auto">
        {/* Left */}
        <div className="flex flex-col items-start text-left max-w-sm w-full">
          <div className="w-14 h-14 rounded-full mb-6 shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)", boxShadow: "0 0 32px rgba(249,102,43,0.35), 0 0 64px rgba(249,102,43,0.10)" }} />
          <p className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: "#F4A259" }}>PRZED LAUNCHEM</p>
          <h1 className="text-5xl font-black text-[#0E0E0E] leading-[1.05] mb-5">
            Dolacz do Trasy<br />jako Founding<br />Partner
          </h1>
          <p className="text-[#979797] text-base leading-relaxed mb-6 max-w-xs">
            Budujemy aplikacje do grupowego planowania podrozy po Polsce. Szukamy pierwszych 100 lokali w Warszawie - wchodzisz bezplatnie i zostajesz na mapie zanim uzytkownicy tu trafią.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white mb-8">
            <span className="text-lg">🚀</span>
            <span className="text-sm font-semibold text-[#0E0E0E]">Premiera: czerwiec 2026</span>
          </div>
          <div className="flex gap-3 w-full mb-4">
            <button
              onClick={() => navigate("/biznes/start")}
              className="flex-1 rounded-2xl text-white font-bold py-4 text-sm active:scale-[0.98] transition-all"
              style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)", boxShadow: "0 8px 24px -6px rgba(249,102,43,0.4)" }}
            >
              Zakladam konto
            </button>
            <button
              onClick={() => navigate("/biznes/start")}
              className="flex-1 rounded-2xl border border-slate-200 text-[#0E0E0E] font-semibold py-4 text-sm hover:bg-slate-50 transition-colors"
            >
              Zobacz jak to dziala →
            </button>
          </div>
          <div className="flex gap-3 w-full">
            <div className="flex-1"><AppStoreBadge store="ios" /></div>
            <div className="flex-1"><AppStoreBadge store="android" /></div>
          </div>
        </div>

        {/* Right: phone → postcard */}
        <div className="shrink-0">
          <AnimatePresence mode="wait">
            {scene === "demo" ? (
              <motion.div key="phone-desk" exit={{ opacity: 0, scale: 0.88 }} transition={{ duration: 0.4 }}>
                <PhoneMockup onComplete={goPostcard} />
              </motion.div>
            ) : (
              <motion.div key="postcard-desk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
                <PostcardReveal large />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

    </div>
  );
}
