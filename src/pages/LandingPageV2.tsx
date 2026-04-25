import { useState, useEffect, useRef } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
} from "framer-motion";
import type { PanInfo } from "framer-motion";
import { ChevronDown, Heart, X, Star, MapPin, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Phase = "A" | "B" | "C" | "D" | "E";
const PHASES: Phase[] = ["A", "B", "C", "D", "E"];

const DEMO = {
  name: "Stołówka Gdańska",
  category: "Restauracja",
  tags: ["#obiady domowe", "#lokalne", "#gdańsk"],
  rating: 4.7,
  reviews: 234,
  description:
    "Kultowe miejsce w centrum. Domowe obiady, prosty wystrój i zawsze pełna sala — odkryj smaki, które pamiętasz.",
  gradient: "from-amber-800 via-orange-700 to-amber-600",
};

// ─── Loading Screen ────────────────────────────────────────────────────────────

function LoadingScreen({ onEnter }: { onEnter: () => void }) {
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowCTA(true), 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <motion.div
      key="loading"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FEFEFE]"
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {/* Glow ring */}
      <motion.div
        className="absolute rounded-full pointer-events-none"
        style={{
          width: 140,
          height: 140,
          background:
            "radial-gradient(circle, rgba(249,102,43,0.18) 0%, transparent 70%)",
        }}
        animate={{ scale: [1, 1.7, 1], opacity: [0.7, 0, 0.7] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Orb */}
      <div
        className="rounded-full animate-orb-flow"
        style={{
          width: 72,
          height: 72,
          background:
            "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)",
        }}
      />

      <AnimatePresence>
        {showCTA && (
          <motion.div
            className="mt-10 flex flex-col items-center gap-3"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm text-[#979797] tracking-wide">
              Aplikacja do planowania podróży
            </p>
            <button
              onClick={onEnter}
              className="flex items-center gap-2 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-semibold rounded-full px-7 py-3 text-sm active:scale-95 transition-transform shadow-lg shadow-orange-200"
            >
              Odkryj Trasę <ArrowRight className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Phase A: Founders video ───────────────────────────────────────────────────

function PhaseA({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      key="A"
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.35 }}
    >
      <video
        src="/demo.mp4"
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/10" />

      <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full bg-white/15 backdrop-blur flex items-center justify-center text-base border border-white/20">
            👋
          </div>
          <div>
            <p className="text-white font-bold text-[13px] leading-tight">
              Cześć! Jesteśmy Trasa
            </p>
            <p className="text-white/55 text-[10px]">
              Natka &amp; Jurek · twórcy aplikacji
            </p>
          </div>
        </div>
        <button
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 bg-white/12 backdrop-blur-sm border border-white/25 text-white font-semibold rounded-2xl py-2.5 text-xs active:scale-95 transition-transform"
        >
          Zobacz jak to działa <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Phase B: Swiper demo ──────────────────────────────────────────────────────

function PhaseB({ onNext }: { onNext: () => void }) {
  const dragX = useMotionValue(0);
  const rotate = useTransform(dragX, [-120, 0, 120], [-12, 0, 12]);
  const likeOpacity = useTransform(dragX, [20, 80], [0, 1]);
  const skipOpacity = useTransform(dragX, [-80, -20], [1, 0]);
  const [decided, setDecided] = useState(false);

  const doLike = () => {
    if (decided) return;
    setDecided(true);
    animate(dragX, 420, { duration: 0.38 });
    setTimeout(onNext, 440);
  };

  const doSkip = () => {
    if (decided) return;
    setDecided(true);
    animate(dragX, -420, { duration: 0.38 });
    setTimeout(onNext, 440);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (decided) return;
    if (info.offset.x > 60) {
      doLike();
    } else if (info.offset.x < -60) {
      doSkip();
    } else {
      animate(dragX, 0, { type: "spring", stiffness: 300, damping: 30 });
    }
  };

  return (
    <motion.div
      key="B"
      className="absolute inset-0 bg-slate-100"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Hint */}
      <div className="absolute top-3 left-0 right-0 flex justify-center z-10">
        <p className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase">
          Przeciągnij i wybierz
        </p>
      </div>

      {/* Draggable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.75}
        onDragEnd={handleDragEnd}
        style={{ x: dragX, rotate, touchAction: "pan-y" }}
        className="absolute inset-x-3 top-8 bottom-14 cursor-grab active:cursor-grabbing z-10"
      >
        <div
          className={`relative w-full h-full rounded-3xl overflow-hidden bg-gradient-to-br ${DEMO.gradient} shadow-xl`}
        >
          {/* TAK / NIE stamps — on card, rotate with it */}
          <motion.div
            className="absolute left-3 top-5 z-20 border-[2px] border-green-400 rounded-lg px-2 py-0.5 -rotate-12"
            style={{ opacity: likeOpacity }}
          >
            <span className="text-green-400 font-black text-[11px] tracking-widest">
              TAK
            </span>
          </motion.div>
          <motion.div
            className="absolute right-3 top-5 z-20 border-[2px] border-red-400 rounded-lg px-2 py-0.5 rotate-12"
            style={{ opacity: skipOpacity }}
          >
            <span className="text-red-400 font-black text-[11px] tracking-widest">
              NIE
            </span>
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

          <div className="absolute bottom-0 left-0 right-0 p-4 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <MapPin className="h-3 w-3 text-white/65" />
              <span className="text-white/65 text-[9px]">{DEMO.category}</span>
              <span className="ml-auto flex items-center gap-0.5">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="text-white text-[10px] font-semibold">
                  {DEMO.rating}
                </span>
                <span className="text-white/50 text-[9px]">
                  ({DEMO.reviews})
                </span>
              </span>
            </div>
            <h3 className="text-white font-black text-[15px] leading-tight">
              {DEMO.name}
            </h3>
            <div className="flex flex-wrap gap-1">
              {DEMO.tags.map((t) => (
                <span
                  key={t}
                  className="text-white/65 text-[8px] bg-white/10 rounded-full px-2 py-0.5"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Buttons */}
      <div className="absolute bottom-2.5 left-0 right-0 flex justify-center gap-6 z-20">
        <button
          onClick={doSkip}
          className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border border-slate-100 active:scale-90 transition-transform"
        >
          <X className="h-4 w-4 text-slate-400" />
        </button>
        <button
          onClick={doLike}
          className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center border border-slate-100 active:scale-90 transition-transform"
        >
          <Heart className="h-4 w-4 text-rose-500" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Phase C: Detail Drawer ────────────────────────────────────────────────────

function PhaseC({ onNext }: { onNext: () => void }) {
  return (
    <motion.div
      key="C"
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Place card background (top ~35%) */}
      <div
        className={`absolute inset-0 bg-gradient-to-br ${DEMO.gradient}`}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />

      {/* Name above sheet */}
      <div className="absolute top-5 left-0 right-0 px-4 z-10">
        <p className="text-white/65 text-[9px] font-medium">{DEMO.category}</p>
        <h3 className="text-white font-black text-sm leading-tight">
          {DEMO.name}
        </h3>
      </div>

      {/* Bottom sheet */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] overflow-hidden"
        style={{ height: "68%" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{
          type: "spring",
          stiffness: 280,
          damping: 36,
          delay: 0.2,
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-2.5 pb-2">
          <div className="w-8 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="px-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-black text-sm text-[#0E0E0E] leading-tight">
                {DEMO.name}
              </h3>
              <p className="text-[10px] text-[#979797] mt-0.5">
                {DEMO.category} · Gdańsk
              </p>
            </div>
            <div className="flex items-center gap-0.5 bg-slate-50 rounded-xl px-2 py-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-bold text-[#0E0E0E]">
                {DEMO.rating}
              </span>
            </div>
          </div>

          <p className="text-[9px] text-[#979797] leading-relaxed line-clamp-2">
            {DEMO.description}
          </p>

          <div className="flex flex-wrap gap-1">
            {DEMO.tags.map((t) => (
              <span
                key={t}
                className="text-[8px] bg-orange-50 text-orange-600 rounded-full px-2 py-0.5 font-medium"
              >
                {t}
              </span>
            ))}
          </div>

          <button
            onClick={onNext}
            className="w-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl py-2.5 text-xs active:scale-95 transition-transform shadow-md shadow-orange-200"
          >
            Dodaj do trasy ✓
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Phase D: Business CTA ─────────────────────────────────────────────────────

function PhaseD({ onNext }: { onNext: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(onNext, 4200);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <motion.div
      key="D"
      className="absolute inset-0 bg-[#0E0E0E] flex flex-col items-center justify-center px-5 gap-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Pulsing glow inside screen */}
      <motion.div
        className="absolute inset-0 rounded-[32px] pointer-events-none"
        animate={{
          boxShadow: [
            "inset 0 0 0px rgba(249,102,43,0)",
            "inset 0 0 30px rgba(249,102,43,0.18)",
            "inset 0 0 0px rgba(249,102,43,0)",
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <motion.div
        className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shadow-lg shadow-orange-900/30"
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20,
          delay: 0.2,
        }}
      >
        <span className="text-2xl">🏠</span>
      </motion.div>

      <motion.div
        className="text-center space-y-1.5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45 }}
      >
        <p className="text-white font-black text-sm leading-tight">
          Twój lokal w Trasie?
        </p>
        <p className="text-white/45 text-[9px] leading-relaxed">
          Dotrzyj do osób planujących
          <br />
          wyjazdy w Twoim mieście
        </p>
      </motion.div>

      <motion.div
        className="flex gap-5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
      >
        {[
          ["12k+", "użytkowników"],
          ["4.8★", "ocena app"],
          ["0 zł", "na start"],
        ].map(([val, label]) => (
          <div key={label} className="text-center">
            <p className="text-white font-black text-xs">{val}</p>
            <p className="text-white/40 text-[8px]">{label}</p>
          </div>
        ))}
      </motion.div>

      <motion.div
        className="w-full space-y-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
      >
        <button
          onClick={() => navigate("/dla-firm")}
          className="w-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl py-2.5 text-xs active:scale-95 transition-transform"
        >
          Zarejestruj lokal →
        </button>
        <button
          onClick={onNext}
          className="w-full text-white/35 text-[9px] py-1 active:text-white/60 transition-colors"
        >
          Pomiń
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── Phase E: Founders + Scroll ────────────────────────────────────────────────

function PhaseE({ onScrollDown }: { onScrollDown: () => void }) {
  return (
    <motion.div
      key="E"
      className="absolute inset-0 flex flex-col items-center justify-between py-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900" />

      {/* Founder avatars + text */}
      <div className="relative flex flex-col items-center gap-4 mt-4">
        <div className="flex -space-x-4">
          {(
            [
              {
                label: "N",
                bg: "radial-gradient(circle at 35% 35%, #fb923c, #c2410c)",
              },
              {
                label: "J",
                bg: "radial-gradient(circle at 35% 35%, #818cf8, #4f46e5)",
              },
            ] as const
          ).map(({ label, bg }, i) => (
            <motion.div
              key={label}
              className="w-14 h-14 rounded-full border-[3px] border-slate-800 flex items-center justify-center font-black text-xl text-white shadow-xl"
              style={{ background: bg }}
              initial={{ scale: 0, x: i === 0 ? 16 : -16 }}
              animate={{ scale: 1, x: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 22,
                delay: 0.15 + i * 0.1,
              }}
            >
              {label}
            </motion.div>
          ))}
        </div>

        <motion.div
          className="text-center px-6 space-y-1"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <p className="text-white font-black text-[13px] leading-tight">
            Stworzone przez Natka i Jurka
          </p>
          <p className="text-white/45 text-[9px] leading-relaxed">
            Bo sami potrzebowaliśmy
            <br />
            czegoś takiego 🤷
          </p>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.button
        onClick={onScrollDown}
        className="relative flex flex-col items-center gap-1 text-white/45 active:text-white/70 transition-colors"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.85 }}
      >
        <span className="text-[8px] tracking-widest uppercase font-semibold">
          Dowiedz się więcej
        </span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.button>
    </motion.div>
  );
}

// ─── Phone Mockup ──────────────────────────────────────────────────────────────

function PhoneMockup({
  phase,
  setPhase,
  onScrollDown,
}: {
  phase: Phase;
  setPhase: (p: Phase) => void;
  onScrollDown: () => void;
}) {
  const nextPhase = () => {
    const idx = PHASES.indexOf(phase);
    if (idx < PHASES.length - 1) setPhase(PHASES[idx + 1]);
  };

  const phaseEl: Record<Phase, React.ReactNode> = {
    A: <PhaseA key="A" onNext={nextPhase} />,
    B: <PhaseB key="B" onNext={nextPhase} />,
    C: <PhaseC key="C" onNext={nextPhase} />,
    D: <PhaseD key="D" onNext={nextPhase} />,
    E: <PhaseE key="E" onScrollDown={onScrollDown} />,
  };

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Phone frame */}
      <div
        className="relative mx-auto select-none"
        style={{ width: "min(245px, 72vw)", aspectRatio: "9/19.5" }}
      >
        {/* Outer frame */}
        <div className="absolute inset-0 rounded-[40px] border-[9px] border-slate-800 bg-slate-900 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.45)] z-10 pointer-events-none" />
        {/* Side buttons */}
        <div className="absolute -right-[11px] top-[22%] w-[4px] h-10 bg-slate-700 rounded-r-full z-20 pointer-events-none" />
        <div className="absolute -left-[11px] top-[18%] w-[4px] h-7 bg-slate-700 rounded-l-full z-20 pointer-events-none" />
        <div className="absolute -left-[11px] top-[27%] w-[4px] h-7 bg-slate-700 rounded-l-full z-20 pointer-events-none" />
        {/* Notch */}
        <div className="absolute top-[9px] left-1/2 -translate-x-1/2 w-14 h-[14px] bg-slate-900 rounded-full z-20 pointer-events-none" />
        {/* Screen */}
        <div className="absolute inset-[9px] rounded-[32px] overflow-hidden bg-black">
          <AnimatePresence mode="wait">{phaseEl[phase]}</AnimatePresence>
        </div>
      </div>

      {/* Phase indicator dots */}
      <div className="flex items-center gap-2">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            aria-label={`Faza ${p}`}
          >
            <motion.div
              className="rounded-full"
              animate={{
                width: p === phase ? 20 : 8,
                height: 8,
                backgroundColor:
                  p === phase ? "#F9662B" : "rgb(203 213 225)",
              }}
              transition={{ duration: 0.25 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Hero Section ──────────────────────────────────────────────────────────────

function HeroSection({
  phase,
  setPhase,
}: {
  phase: Phase;
  setPhase: (p: Phase) => void;
}) {
  const contentRef = useRef<HTMLDivElement>(null);

  const scrollToContent = () => {
    contentRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <>
      <section className="min-h-screen bg-[#FEFEFE] flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-24 px-6 py-16 lg:py-0">
        {/* Copy — below phone on mobile, left on desktop */}
        <motion.div
          className="text-center lg:text-left max-w-xs lg:max-w-sm order-2 lg:order-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="inline-flex items-center gap-2 mb-5">
            <div
              className="w-6 h-6 rounded-full animate-orb-flow"
              style={{
                background:
                  "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)",
              }}
            />
            <span className="text-sm font-semibold text-[#979797]">
              Trasa.travel
            </span>
          </div>

          <h1 className="text-4xl lg:text-5xl font-black text-[#0E0E0E] leading-[1.1] mb-4">
            Odkryj miejsca.
            <br />
            <span className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] bg-clip-text text-transparent">
              Razem.
            </span>
          </h1>

          <p className="text-[#979797] text-base leading-relaxed mb-8 max-w-[280px] mx-auto lg:mx-0">
            Planujcie wyjazdy grupowo — wybierajcie miejsca, twórzcie trasy i
            dzielcie się wspomnieniami.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <a
              href="/auth"
              className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl px-7 py-3 text-sm shadow-lg shadow-orange-200 active:scale-95 transition-transform text-center"
            >
              Zacznij za darmo
            </a>
            <button
              onClick={scrollToContent}
              className="border border-slate-200 text-[#0E0E0E] font-semibold rounded-2xl px-7 py-3 text-sm active:scale-95 transition-transform"
            >
              Jak to działa?
            </button>
          </div>
        </motion.div>

        {/* Phone mockup — top on mobile, right on desktop */}
        <motion.div
          className="order-1 lg:order-2"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
        >
          <PhoneMockup
            phase={phase}
            setPhase={setPhase}
            onScrollDown={scrollToContent}
          />
        </motion.div>
      </section>

      {/* Content below hero (placeholder for now) */}
      <div ref={contentRef} className="bg-slate-50 py-24 px-6 text-center">
        <div className="max-w-sm mx-auto space-y-4">
          <div
            className="w-10 h-10 rounded-full mx-auto animate-orb-flow"
            style={{
              background:
                "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)",
            }}
          />
          <h2 className="text-2xl font-black text-[#0E0E0E]">
            Więcej sekcji wkrótce
          </h2>
          <p className="text-[#979797] text-sm">
            Landing page jest w trakcie budowy.
          </p>
          <a
            href="/auth"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl px-7 py-3 text-sm shadow-lg shadow-orange-200 active:scale-95 transition-transform"
          >
            Dołącz teraz <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPageV2() {
  const [showLoading, setShowLoading] = useState(true);
  const [phase, setPhase] = useState<Phase>("A");

  return (
    <div className="overflow-x-hidden">
      <AnimatePresence>
        {showLoading && (
          <LoadingScreen onEnter={() => setShowLoading(false)} />
        )}
      </AnimatePresence>

      {!showLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
        >
          <HeroSection phase={phase} setPhase={setPhase} />
        </motion.div>
      )}
    </div>
  );
}
