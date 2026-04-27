import { useState, useRef, useEffect, useCallback, forwardRef, type RefObject } from "react";
import {
  motion, AnimatePresence, useMotionValue, useTransform, animate,
  type MotionValue, type PanInfo,
} from "framer-motion";
import { Check, Star, Clock, Globe, VolumeX, Volume2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

// ─── Types & Data ─────────────────────────────────────────────────────────────

type Phase = "A" | "B" | "C" | "E";

type DemoPlace = {
  id: string; name: string; category: string; address: string;
  rating: number; reviews: number; event: string | null;
  tags: string[]; gradient: string; logoChar: string; description: string;
};

const DEMO_PLACES: DemoPlace[] = [
  { id: "1", name: "Stołówka Gdańska", category: "Restauracja", address: "Długie Ogrody 27", rating: 4.7, reviews: 234, event: "Dzisiaj zupa+drugie za 29,90zł", tags: ["restauracja", "jedzenie", "lokalne"], gradient: "from-amber-800 via-orange-700 to-amber-600", logoChar: "S", description: "Kultowe miejsce w centrum Gdańska. Domowe obiady, prosty wystrój i zawsze pełna sala." },
  { id: "2", name: "Brovarnia Gdańsk", category: "Bar & Browar", address: "Szafarnia 9", rating: 4.5, reviews: 189, event: null, tags: ["piwo", "craft", "centrum"], gradient: "from-slate-700 via-slate-600 to-slate-800", logoChar: "B", description: "Jeden z najlepszych browarów w Trójmieście. Piwo warzone na miejscu." },
  { id: "3", name: "Lody Mariacka", category: "Kawiarnia", address: "Mariacka 16", rating: 4.9, reviews: 412, event: "Nowy smak: mango-chili 🌶️", tags: ["lody", "kawiarnia", "instagramowe"], gradient: "from-pink-500 via-rose-500 to-pink-600", logoChar: "L", description: "Najlepsza lodziarnia rzemieślnicza na Mariackiej. Sezonowe smaki, kolejki od rana." },
];

// ─── CardInner ────────────────────────────────────────────────────────────────

function CardInner({ place, likeOpacity, skipOpacity }: {
  place: DemoPlace;
  likeOpacity?: MotionValue<number>; skipOpacity?: MotionValue<number>;
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
          {place.tags.map((t) => <span key={t} className="text-white/55 text-[8px] bg-white/10 rounded-full px-2 py-0.5 whitespace-nowrap">{t}</span>)}
        </div>
      </div>
    </div>
  );
}

// ─── Phases ───────────────────────────────────────────────────────────────────

function PhaseA({ onNext }: { onNext: () => void }) {
  useEffect(() => { const t = setTimeout(onNext, 9000); return () => clearTimeout(t); }, [onNext]);
  return (
    <motion.div key="A" className="absolute inset-0 bg-black cursor-pointer" onClick={onNext} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.35 }}>
      <video
        ref={(el) => { if (!el) return; el.muted = true; el.play().catch(() => {}); }}
        src="/founders_intro.mp4"
        autoPlay playsInline muted preload="auto"
        onEnded={onNext}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
      />
    </motion.div>
  );
}

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
    setTimeout(() => { dragX.set(0); const next = cardIdx + 1; if (next >= DEMO_PLACES.length) onNext(); else { setCardIdx(next); setDecided(false); } }, 400);
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
          <div className="flex items-start justify-between"><div><h3 className="font-black text-sm text-[#0E0E0E]">{place.name}</h3><p className="text-[10px] text-[#979797]">{place.category} · Gdańsk</p></div><div className="flex items-center gap-0.5 bg-slate-50 rounded-xl px-2 py-1"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /><span className="text-[10px] font-bold">{place.rating}</span></div></div>
          <p className="text-[9px] text-[#979797] leading-relaxed">{place.description}</p>
          <div className="flex gap-3 text-[9px] text-[#979797]"><span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> pon-pt 11:00-20:00</span><span className="flex items-center gap-1"><Globe className="h-2.5 w-2.5" /> stolowkagdanska.pl</span></div>
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
        ref={(el) => { if (!el) return; el.muted = true; el.play().catch(() => {}); }}
        src="/founders_business.mp4"
        autoPlay playsInline muted preload="auto" loop
        className="absolute inset-0 w-full h-full object-cover"
        style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />
      <motion.div className="absolute bottom-0 left-0 right-0 px-4 pb-6 flex flex-col items-center gap-2"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <p className="text-white font-black text-[14px] text-center leading-tight">Dołącz do pierwszych użytkowników</p>
        <p className="text-white/55 text-[10px] text-center">Trasa — speed dating z miastem 🧡</p>
        <button onClick={() => onComplete ? onComplete() : onNext()}
          className="mt-2 text-white/45 text-[8px] tracking-widest uppercase font-semibold">
          Dalej →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Phone Mockup ─────────────────────────────────────────────────────────────

type PhoneMockupProps = {
  compact?: boolean;
  initialPhase?: Phase;
  onComplete?: () => void;
  onPhaseChange?: (p: Phase) => void;
  // showBezel: false hides buttons/shadow/notch (used during mobile intro transition)
  showBezel?: boolean;
};

const PhoneMockup = forwardRef<HTMLDivElement, PhoneMockupProps>(
  ({ compact = false, initialPhase = "A" as Phase, onComplete, onPhaseChange, showBezel = true }, ref) => {

  const [phase, setPhase] = useState<Phase>(initialPhase);

  const nextPhase = useCallback(() => {
    setPhase(p => {
      // A→B→C→E→(onComplete/postcard); E loops to B if onComplete not set
      const next: Phase = p === "A" ? "B" : p === "B" ? "C" : p === "C" ? "E" : "B";
      onPhaseChange?.(next);
      return next;
    });
  }, [onPhaseChange]);

  const phaseEl: Record<Phase, React.ReactNode> = {
    A: <PhaseA key="A" onNext={nextPhase} />,
    B: <PhaseB key="B" onNext={nextPhase} />,
    C: <PhaseC key="C" onNext={nextPhase} />,
    E: <PhaseE key="E" onNext={nextPhase} onComplete={onComplete} />,
  };

  // compact mode: dvh-based so phone is independent of flex container and can overlap texts
  const phoneStyle = compact
    ? { height: "min(62dvh, 500px)", width: "auto", aspectRatio: "9/19.5" }
    : { width: "clamp(270px, 42vw, 310px)", aspectRatio: "9/19.5" };

  return (
    <div className="flex flex-col items-center" style={compact ? { height: "100%" } : {}}>
      <div
        ref={ref}
        className="relative mx-auto select-none rounded-[42px] bg-slate-800"
        style={phoneStyle}
      >
        {/* Shadow */}
        <motion.div
          className="absolute inset-0 rounded-[42px] pointer-events-none"
          animate={{ opacity: showBezel ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          style={{ boxShadow: "0 32px 80px -12px rgba(0,0,0,0.4)" }}
        />

        {/* Physical buttons + notch — fade in after intro */}
        <motion.div
          animate={{ opacity: showBezel ? 1 : 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0 pointer-events-none"
        >
          <div className="absolute -right-[3px] top-[22%] w-[4px] h-10 bg-slate-700 rounded-r-full" />
          <div className="absolute -left-[3px] top-[18%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
          <div className="absolute -left-[3px] top-[27%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
          <div className="absolute top-[9px] left-1/2 -translate-x-1/2 w-14 h-[14px] bg-slate-800 rounded-full" style={{ zIndex: 10 }} />
        </motion.div>

        {/* Screen */}
        <div className="absolute inset-[9px] rounded-[34px] overflow-hidden bg-black" style={{ zIndex: 1 }}>
          <AnimatePresence mode="wait">{phaseEl[phase]}</AnimatePresence>
        </div>
      </div>
    </div>
  );
});
PhoneMockup.displayName = "PhoneMockup";

// ─── FullscreenIntroVideo ─────────────────────────────────────────────────────
// Video lives at root level (no CSS transform parent) to avoid the iOS Safari
// "video inside scale() = black screen" WebKit compositing bug.
// When done it spring-shrinks to the phone screen rect, then fades out.

function FullscreenIntroVideo({
  phoneBodyRef,
  onDone,
  onShrinkStart,
}: {
  phoneBodyRef: RefObject<HTMLDivElement>;
  onDone: () => void;
  onShrinkStart?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const doneRef = useRef(false);
  const [audioMuted, setAudioMuted] = useState(true);

  useEffect(() => { if (videoRef.current) videoRef.current.muted = audioMuted; }, [audioMuted]);

  const triggerShrink = useCallback(() => {
    if (doneRef.current) return;
    doneRef.current = true;
    // Tell parent to raise phone to z-50 and show bezel; two rAF frames for React to flush
    onShrinkStart?.();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const phoneEl = phoneBodyRef.current;
      const containerEl = containerRef.current;
      if (!phoneEl || !containerEl) { onDone(); return; }
      // Raise video above phone (z-50) so it visually enters the frame
      containerEl.style.zIndex = "60";
      const r = phoneEl.getBoundingClientRect();
      // Target = inner screen rect (9px inset, 34px border-radius)
      const target = { top: r.top + 9, left: r.left + 9, width: r.width - 18, height: r.height - 18 };
      animate(containerEl, {
        top: target.top,
        left: target.left,
        width: target.width,
        height: target.height,
        borderRadius: "34px",
      }, { type: "spring", stiffness: 120, damping: 20 })
        .then(() => animate(containerEl, { opacity: 0 }, { duration: 0.25 }))
        .then(() => onDone());
    }));
  }, [phoneBodyRef, onDone, onShrinkStart]);

  useEffect(() => {
    const t = setTimeout(triggerShrink, 9000);
    return () => clearTimeout(t);
  }, [triggerShrink]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.setAttribute("muted", "");
    el.muted = true;
    el.play().catch(() => {});
    const onTouch = () => { if (el.paused) { el.setAttribute("muted", ""); el.muted = true; el.play().catch(() => {}); } };
    document.addEventListener("touchstart", onTouch, { once: true, passive: true });
    return () => document.removeEventListener("touchstart", onTouch);
  }, []);

  return (
    <div
      ref={containerRef}
      onClick={() => {
        const el = videoRef.current;
        if (el && el.paused) { el.muted = true; el.play().catch(() => {}); return; }
        triggerShrink();
      }}
      style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "#000", zIndex: 40, overflow: "hidden", WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
    >
      <video
        ref={(el) => {
          videoRef.current = el;
          if (!el) return;
          el.setAttribute("muted", "");
          el.muted = true;
          el.play().catch(() => {});
        }}
        src="/founders_intro.mp4"
        autoPlay playsInline muted preload="auto"
        onEnded={triggerShrink}
        onCanPlay={(e) => {
          const el = e.currentTarget;
          el.setAttribute("muted", "");
          el.muted = true;
          el.play().catch(() => {});
        }}
        className="absolute inset-0 w-full h-full object-cover"
        style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
      />
      <button
        onPointerUp={(e) => { e.stopPropagation(); setAudioMuted(m => !m); }}
        className="absolute top-3 right-3 z-30 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
      >
        {audioMuted ? <VolumeX className="h-3.5 w-3.5 text-white/80" /> : <Volume2 className="h-3.5 w-3.5 text-white" />}
      </button>
    </div>
  );
}

// ─── Postcard ─────────────────────────────────────────────────────────────────

function PostcardFront({ w, h }: { w: number; h: number }) {
  const pad = Math.round(w * 0.05);
  const bottomPad = Math.round(w * 0.18);
  return (
    <div className="w-full h-full rounded-2xl overflow-hidden bg-white shadow-2xl flex flex-col"
      style={{ padding: `${pad}px ${pad}px ${bottomPad}px` }}>
      {/* Photo */}
      <div className="relative flex-1 overflow-hidden rounded-sm bg-slate-200">
        <img
          src="/IMG_9609.jpg"
          alt="Nat i Bart"
          className="absolute inset-0 w-full h-full object-cover object-top"
        />
      </div>
      {/* Polaroid bottom strip */}
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
    <div className="w-full h-full rounded-2xl overflow-hidden shadow-2xl flex flex-col"
      style={{ background: "#FEFEFE", padding: `${pad}px` }}>

      {/* Top: address — full-width single row */}
      <div className="mb-3 flex justify-between items-baseline w-full">
        <span style={{ fontFamily: "monospace", fontSize: w * 0.038, color: "#aaa", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Nat i Bart
        </span>
        <span style={{ fontFamily: "monospace", fontSize: w * 0.038, color: "#aaa", letterSpacing: "0.05em", textTransform: "uppercase" }}>
          Gdańsk · 2026
        </span>
      </div>

      {/* Horizontal rule */}
      <div className="mb-3" style={{ height: 1, background: "#e8e0d5" }} />

      {/* Handwritten message */}
      <div className="flex-1 flex flex-col justify-start">
        {BACK_MESSAGE.map((line, i) => (
          <motion.p
            key={i}
            style={{
              fontFamily: "'Caveat', 'Bradley Hand', cursive",
              fontSize: w * 0.082,
              color: "#2d1505",
              lineHeight: 1.5,
              minHeight: line ? undefined : `${w * 0.082 * 0.75}px`,
            }}
            initial={{ opacity: 0 }}
            animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
            transition={{ delay: 0.3 + i * 0.07, duration: 0.3 }}
          >
            {line || ""}
          </motion.p>
        ))}
      </div>

      {/* Signature */}
      <motion.div
        className="mt-auto"
        initial={{ opacity: 0 }}
        animate={isVisible ? { opacity: 1 } : { opacity: 0 }}
        transition={{ delay: 1.1, duration: 0.4 }}
      >
        <div className="mb-2" style={{ height: 1, background: "#e8e0d5" }} />
        <p style={{
          fontFamily: "'Caveat', cursive",
          fontSize: w * 0.088,
          color: "#2d1505",
          fontWeight: 600,
          textAlign: "center",
        }}>
          Nat i Bart 🧡
        </p>
      </motion.div>
    </div>
  );
}

// Phone compact height: min(54vw, 195px) * (19.5/9) ≈ 423px — postcard matches this
function PostcardReveal({ large = false }: { large?: boolean }) {
  const w = large ? 300 : 238;
  const h = large ? 530 : 423;
  const [flipped, setFlipped] = useState(false);

  // Front shows for 3s, back for 8s — asymmetric timing
  useEffect(() => {
    const delay = flipped ? 8000 : 3000;
    const id = setTimeout(() => setFlipped(f => !f), delay);
    return () => clearTimeout(id);
  }, [flipped]);

  return (
    // Outer wrapper provides the static tilt so it doesn't fight framer-motion transforms
    <div style={{ transform: "rotate(-2.5deg)", transformOrigin: "center" }}>
      <div style={{ width: w, height: h, perspective: "900px" }}>
        <motion.div
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.85, type: "spring", stiffness: 82, damping: 17 }}
          style={{
            transformStyle: "preserve-3d",
            WebkitTransformStyle: "preserve-3d",
            width: w, height: h,
            position: "relative",
          }}
        >
          {/* Front face */}
          <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", position: "absolute", inset: 0 }}>
            <PostcardFront w={w} h={h} />
          </div>
          {/* Back face */}
          <div style={{
            backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)", WebkitTransform: "rotateY(180deg)",
            position: "absolute", inset: 0,
          }}>
            <PostcardBack w={w} h={h} isVisible={flipped} />
          </div>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Email Capture ────────────────────────────────────────────────────────────

function EmailCapture({ inputRef }: { inputRef?: React.RefObject<HTMLInputElement> }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status !== "idle") return;
    setStatus("loading");
    await (supabase as any).from("waitlist").insert({ email: email.trim().toLowerCase() });
    setStatus("done");
  };
  if (status === "done") return (
    <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-orange-50 border border-orange-200">
      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shrink-0"><Check className="h-4 w-4 text-white" /></div>
      <p className="text-sm font-semibold text-[#0E0E0E]">Powiadomimy Cię o premierze.</p>
    </div>
  );
  return (
    <form onSubmit={submit} className="flex gap-2 w-full">
      <input ref={inputRef} type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="twoj@email.pl"
        className="flex-1 min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-[#0E0E0E] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300" />
      <button type="submit" disabled={status === "loading"}
        className="rounded-2xl bg-orange-700 hover:bg-orange-800 text-white font-bold px-5 py-3.5 text-sm whitespace-nowrap shadow-md shadow-orange-200 active:scale-[0.98] transition-all shrink-0">
        {status === "loading" ? "..." : "Zapisz się"}
      </button>
    </form>
  );
}

function AppStoreBadge({ store }: { store: "ios" | "android" }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 select-none h-[52px]">
      {store === "ios"
        ? <svg className="h-5 w-5 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" /></svg>
        : <svg className="h-5 w-5 text-slate-500 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M3.18 23.76a2 2 0 0 0 2.37-.08l.11-.08 9.5-5.48-2.35-2.35zM1.5 2.27A2 2 0 0 0 1 3.73v16.54a2 2 0 0 0 .5 1.46l.08.08 9.26-9.26v-.22zM20.49 10.7l-2.7-1.56-2.62 2.62 2.62 2.62 2.71-1.56a2 2 0 0 0 0-3.12zM5.55.4 14.93 5.8l-2.35 2.35L5.18.65A2 2 0 0 1 5.55.4z" /></svg>}
      <div className="flex-1 min-w-0">
        <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">{store === "ios" ? "Pobierz w" : "Dostępne w"}</p>
        <p className="text-[12px] font-semibold text-slate-600 leading-tight whitespace-nowrap">{store === "ios" ? "App Store" : "Google Play"}</p>
      </div>
      <span className="text-[9px] text-slate-400 font-medium bg-slate-100 rounded-full px-1.5 py-0.5 shrink-0">Wkrótce</span>
    </div>
  );
}

// ─── WaitlistPage ─────────────────────────────────────────────────────────────

type Scene = "intro" | "demo" | "postcard";

export default function WaitlistPage() {
  const navigate = useNavigate();
  // "intro" = phone at expanded (fullscreen) scale; "demo" = phone compact; "postcard" = postcard
  const [scene, setScene] = useState<Scene>("intro");
  const [shrinking, setShrinking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const phoneBodyRef = useRef<HTMLDivElement>(null);

  const goDemo = useCallback(() => setScene("demo"), []);
  const goPostcard = useCallback(() => setScene("postcard"), []);

  const HEADLINE_SIZE = "clamp(44px, 13vw, 64px)";

  return (
    <div style={{ background: "#FEFEFE" }}>

      {/* ── MOBILE ─────────────────────────────────────────────────────────────── */}
      <div className="lg:hidden">
        {/* Fullscreen founders video — at root level (outside any transform) for iOS Safari */}
        {scene === "intro" && (
          <FullscreenIntroVideo phoneBodyRef={phoneBodyRef} onDone={goDemo} onShrinkStart={() => setShrinking(true)} />
        )}

        <div className="flex flex-col" style={{ height: "100dvh" }}>

          {/* Intro overlay — fixed z-50 (above video z-40): grayed app store badges */}
          <AnimatePresence>
            {scene === "intro" && (
              <motion.div
                className="fixed inset-0 z-50 pointer-events-none flex flex-col items-end justify-end"
                style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.45 }}
              >
                <div className="flex gap-2 w-full px-4 mb-6" style={{ filter: "grayscale(1)", opacity: 0.45 }}>
                  <div className="flex-1"><AppStoreBadge store="ios" /></div>
                  <div className="flex-1"><AppStoreBadge store="android" /></div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content — flex column: "speed dating" → orb → phone (flex-1) → "z miastem" */}
          <div className="flex-1 min-h-0 flex flex-col items-center px-2"
            style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 6px)" }}>

            {/* "speed dating" — z-60 after intro (above orb z-49), z-5 during intro (hidden behind video). */}
            <p
              className="shrink-0 font-black text-[#0E0E0E] text-center leading-none select-none whitespace-nowrap"
              style={{ fontSize: HEADLINE_SIZE, position: "relative", zIndex: scene === "intro" ? 5 : 60 }}
            >
              speed dating
            </p>

            {/* Orb — slides under "speed dating" via negative marginTop. z-50 during intro (above video), z-49 after (below text z-60). */}
            <div
              className="w-14 h-14 rounded-full shrink-0"
              style={{
                background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)",
                position: "relative",
                zIndex: scene === "intro" ? 50 : 49,
                marginTop: "-36px",
                marginBottom: "12px",
              }}
            />

            {/* Phone / postcard — flex-1 min-h-0: fills available space, adapts to screen height. */}
            <div className="relative flex-1 min-h-0 flex items-center justify-center w-full"
              style={{ zIndex: scene === "intro" ? (shrinking ? 50 : 1) : 70 }}>
              <AnimatePresence mode="wait">
                {scene !== "postcard" ? (
                  <motion.div key="phone" className="h-full" initial={false} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.3 }}>
                    <PhoneMockup
                      ref={phoneBodyRef}
                      key={scene === "intro" ? "phone-intro" : "phone-demo"}
                      compact
                      initialPhase="B"
                      showBezel={scene !== "intro" || shrinking}
                      onComplete={goPostcard}
                    />
                  </motion.div>
                ) : (
                  <motion.div key="postcard"
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 220, damping: 26 }}>
                    <PostcardReveal />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* "z miastem" — right below phone. Hidden during intro (z-5 behind video z-40). */}
            <p
              className="shrink-0 font-black text-[#0E0E0E] text-center leading-none select-none whitespace-nowrap mt-2"
              style={{ fontSize: HEADLINE_SIZE, position: "relative", zIndex: scene === "intro" ? 5 : 60 }}
            >
              z miastem
            </p>
          </div>

          {/* Sticky bottom CTA — hidden during intro, fades in after */}
          <div
            className="shrink-0 bg-white/96 backdrop-blur-sm border-t border-slate-100 px-4 pt-3 space-y-3"
            style={{
              opacity: scene === "intro" ? 0 : 1,
              pointerEvents: scene === "intro" ? "none" : "auto",
              transition: "opacity 0.5s ease 0.2s",
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
            }}
          >
            <p className="text-xs text-slate-500 text-center font-medium">
              {scene === "postcard" ? "Dołącz do pierwszych użytkowników Trasy" : "Bądź pierwszy na liście oczekujących"}
            </p>
            <EmailCapture inputRef={inputRef} />
            <div className="flex gap-2">
              <div className="flex-1"><AppStoreBadge store="ios" /></div>
              <div className="flex-1"><AppStoreBadge store="android" /></div>
            </div>
            <button onClick={() => navigate("/dla-firm")} className="w-full text-slate-500 text-xs hover:text-slate-700 transition-colors text-center">
              Prowadzisz lokal? Dowiedz się więcej →
            </button>
          </div>
        </div>
      </div>

      {/* ── DESKTOP ─────────────────────────────────────────────────────────────── */}
      <div className="hidden lg:flex min-h-screen items-center justify-center gap-20 px-8 py-16 max-w-5xl mx-auto">
        {/* Left */}
        <div className="flex flex-col items-start text-left max-w-sm w-full">
          <div className="w-14 h-14 rounded-full mb-6" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)", boxShadow: "0 0 32px rgba(249,102,43,0.35), 0 0 64px rgba(249,102,43,0.10)" }} />
          <h1 className="text-5xl font-black text-[#0E0E0E] leading-[1.05] mb-4">
            speed dating<br />
            z miastem
          </h1>
          <p className="text-slate-500 text-base leading-relaxed mb-8 max-w-xs">Planujcie wyjazdy grupowo. Wybierajcie miejsca, twórzcie trasy i dzielcie się wspomnieniami.</p>
          <div className="w-full mb-3"><EmailCapture inputRef={inputRef} /></div>
          <p className="text-slate-400 text-xs mb-8">Powiadomimy Cię o premierze na iOS i Androidzie.</p>
          <div className="flex gap-3 mb-8"><AppStoreBadge store="ios" /><AppStoreBadge store="android" /></div>
          <button onClick={() => navigate("/dla-firm")} className="text-slate-500 text-sm hover:text-slate-700 transition-colors underline underline-offset-4">Prowadzisz lokal? Dowiedz się więcej</button>
        </div>

        {/* Right: phone → postcard */}
        <div className="shrink-0">
          <AnimatePresence mode="wait">
            {scene !== "postcard" ? (
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
