import { useState, useRef, useEffect } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useTransform,
  animate,
  type MotionValue,
} from "framer-motion";
import type { PanInfo } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Star,
  ArrowRight,
  RotateCcw,
  Clock,
  Globe,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

type Phase = "A" | "B" | "C" | "D" | "E";
const PHASES: Phase[] = ["A", "B", "C", "D", "E"];

type DemoPlace = {
  id: string;
  name: string;
  category: string;
  address: string;
  rating: number;
  reviews: number;
  event: string | null;
  tags: string[];
  gradient: string;
  logoChar: string;
  description: string;
};

const DEMO_PLACES: DemoPlace[] = [
  {
    id: "1",
    name: "Stołówka Gdańska",
    category: "Restauracja",
    address: "Długie Ogrody 27",
    rating: 4.7,
    reviews: 234,
    event: "Dzisiaj zupa+drugie danie za 29,90zł",
    tags: ["restauracja", "jedzenie", "lokalne"],
    gradient: "from-amber-800 via-orange-700 to-amber-600",
    logoChar: "S",
    description:
      "Kultowe miejsce w centrum Gdańska. Domowe obiady, prosty wystrój i zawsze pełna sala.",
  },
  {
    id: "2",
    name: "Brovarnia Gdańsk",
    category: "Bar & Browar",
    address: "Szafarnia 9",
    rating: 4.5,
    reviews: 189,
    event: null,
    tags: ["piwo", "craft", "centrum"],
    gradient: "from-slate-700 via-slate-600 to-slate-800",
    logoChar: "B",
    description:
      "Jeden z najlepszych browarów rzemieślniczych w Trójmieście. Piwo warzone na miejscu.",
  },
  {
    id: "3",
    name: "Lody Mariacka",
    category: "Kawiarnia",
    address: "Mariacka 16",
    rating: 4.9,
    reviews: 412,
    event: "Nowy smak: mango-chili 🌶️",
    tags: ["lody", "kawiarnia", "instagramowe"],
    gradient: "from-pink-500 via-rose-500 to-pink-600",
    logoChar: "L",
    description:
      "Najlepsza lodziarnia rzemieślnicza na Mariackiej. Sezonowe smaki, kolejki od rana.",
  },
];

// ─── Video with fallback ───────────────────────────────────────────────────────
function BgVideo({ src, fallbackGradient }: { src: string; fallbackGradient: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, [src]);

  return (
    <>
      <div className={`absolute inset-0 bg-gradient-to-br ${fallbackGradient}`} />
      <video
        ref={ref}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      />
    </>
  );
}

// ─── Shared: card content ─────────────────────────────────────────────────────
function CardInner({
  place,
  videoSrc,
  likeOpacity,
  skipOpacity,
  onExpand,
}: {
  place: DemoPlace;
  videoSrc?: string;
  likeOpacity?: MotionValue<number>;
  skipOpacity?: MotionValue<number>;
  onExpand?: () => void;
}) {
  return (
    <div className="relative w-full h-full overflow-hidden" style={{ WebkitMaskImage: "linear-gradient(white, white)" }}>
      {videoSrc ? (
        <BgVideo src={videoSrc} fallbackGradient="from-orange-900 via-orange-700 to-amber-600" />
      ) : (
        <div className={`absolute inset-0 bg-gradient-to-br ${place.gradient}`} />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-black/5" />

      {likeOpacity && (
        <motion.div
          className="absolute left-3 top-5 z-20 border-2 border-green-400 rounded-lg px-2 py-0.5 -rotate-12"
          style={{ opacity: likeOpacity }}
        >
          <span className="text-green-400 font-black text-[10px] tracking-widest">TAK</span>
        </motion.div>
      )}
      {skipOpacity && (
        <motion.div
          className="absolute right-3 top-5 z-20 border-2 border-red-400 rounded-lg px-2 py-0.5 rotate-12"
          style={{ opacity: skipOpacity }}
        >
          <span className="text-red-400 font-black text-[10px] tracking-widest">NIE</span>
        </motion.div>
      )}

      <div className="absolute bottom-0 left-0 right-0 px-3 pb-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm text-white border-2 border-white/30 shrink-0"
            style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }}
          >
            {place.logoChar}
          </div>
          <span className="text-white/70 text-[10px] font-medium">
            {place.category} · @trasa
          </span>
        </div>

        <h3 className="text-white font-black text-[17px] leading-tight">{place.name}</h3>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            <span className="text-white text-[10px] font-semibold">{place.rating}</span>
          </span>
          <span className="text-white/55 text-[9px]">📍 {place.address}</span>
        </div>

        {place.event && (
          <div className="inline-flex items-center gap-1 bg-gradient-to-r from-[#F4A259] to-[#F9662B] rounded-full px-2.5 py-[3px]">
            <span className="text-[8px]">🎉</span>
            <span className="text-white font-semibold text-[8.5px]">{place.event}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <div className="flex flex-wrap gap-1 flex-1 min-w-0 overflow-hidden">
            {place.tags.map((t) => (
              <span
                key={t}
                className="text-white/55 text-[8px] bg-white/12 rounded-full px-2 py-0.5 whitespace-nowrap"
              >
                {t}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 shrink-0 ml-1">
            <button className="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
              <RotateCcw className="h-3 w-3 text-white" />
            </button>
            {onExpand && (
              <button
                onPointerUp={(e) => { e.stopPropagation(); onExpand(); }}
                className="w-7 h-7 rounded-full bg-white/20 backdrop-blur flex items-center justify-center"
              >
                <ChevronUp className="h-3 w-3 text-white" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Loading Screen ────────────────────────────────────────────────────────────
// Pure CSS approach — no framer-motion SVG, no MotionValue for progress
// (avoids framer-motion v12 onComplete + SVG strokeDashoffset bugs)
const RING_SIZE = 220; // px
const RING_R = 88;     // px, radius of progress ring

function LoadingScreen({ onEnter }: { onEnter: () => void }) {
  const [pct, setPct] = useState(0);
  const [showCTA, setShowCTA] = useState(false);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const DURATION = 2600;
    const start = performance.now();

    const tick = (now: number) => {
      const p = Math.min((now - start) / DURATION, 1);
      setPct(Math.round(p * 100));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setTimeout(() => setShowCTA(true), 200);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  const angleDeg = (pct / 100) * 360;

  return (
    <motion.div
      key="loading"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center"
      style={{ background: "#0E0E0E" }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        {/* Track ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{ border: "1.5px solid rgba(249,102,43,0.12)" }}
        />

        {/* Progress ring — conic-gradient + mask for thin ring effect */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(from -90deg, #F9662B 0deg ${angleDeg}deg, rgba(249,102,43,0.08) ${angleDeg}deg 360deg)`,
            WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - 2.5px), black calc(100% - 2.5px))`,
            maskImage: `radial-gradient(farthest-side, transparent calc(100% - 2.5px), black calc(100% - 2.5px))`,
            filter: angleDeg > 5 ? "drop-shadow(0 0 5px rgba(249,102,43,0.7))" : "none",
          }}
        />

        {/* Inner decorative ring */}
        <div
          className="absolute rounded-full"
          style={{
            inset: RING_SIZE / 2 - 66,
            width: 132,
            height: 132,
            border: "8px solid rgba(249,102,43,0.06)",
          }}
        />

        {/* Orbiting dot */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: "50%",
            width: 0,
            height: 0,
            transform: `rotate(${angleDeg}deg)`,
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "radial-gradient(circle at 35% 35%, #fb923c, #F9662B)",
              top: -(RING_R + 5),
              left: -5,
              boxShadow: "0 0 8px rgba(249,102,43,0.9), 0 0 18px rgba(249,102,43,0.5)",
            }}
          />
        </div>

        {/* Center orb */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="rounded-full"
            style={{
              width: 90,
              height: 90,
              background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)",
              boxShadow: "0 0 28px rgba(249,102,43,0.55), 0 0 56px rgba(249,102,43,0.25)",
              cursor: showCTA ? "pointer" : "default",
            }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
            onClick={showCTA ? onEnter : undefined}
          />
        </div>
      </div>

      {/* Counter / CTA */}
      <div className="mt-5 h-8 flex items-center justify-center">
        <AnimatePresence mode="wait">
          {!showCTA ? (
            <motion.p
              key="pct"
              className="font-bold text-sm tracking-widest"
              style={{ color: "#F4A259" }}
              exit={{ opacity: 0 }}
            >
              {pct} %
            </motion.p>
          ) : (
            <motion.button
              key="cta"
              onClick={onEnter}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="font-bold text-sm tracking-widest"
              style={{ color: "#F4A259", background: "none", border: "none", cursor: "pointer" }}
            >
              Kliknij aby uruchomić
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ─── Phase A: Founders video card ─────────────────────────────────────────────
function PhaseA({ onNext }: { onNext: () => void }) {
  const place: DemoPlace = {
    id: "a",
    name: "Co możesz robić w Trasie?",
    category: "Poradnik",
    address: "trasa.travel",
    rating: 5.0,
    reviews: 0,
    event: "Filmik założycieli 🎬",
    tags: ["#miejsca", "#planowanie", "#razem"],
    gradient: "from-orange-900 via-orange-700 to-amber-600",
    logoChar: "T",
    description: "",
  };

  return (
    <motion.div
      key="A"
      className="absolute inset-0 flex flex-col bg-white"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="relative flex-1 min-h-0">
        <CardInner place={place} videoSrc="/founders_intro.mp4" />
      </div>
      <div className="flex gap-2 px-3 py-2.5 bg-white shrink-0">
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-full py-3 text-[12px] active:scale-95 transition-transform"
        >
          Sprawdź jak to działa <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

// ─── Phase B: Swiper with 3 cards ─────────────────────────────────────────────
function PhaseB({ onNext, onExpand }: { onNext: () => void; onExpand: () => void }) {
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
      if (next >= DEMO_PLACES.length) {
        onNext();
      } else {
        setCardIdx(next);
        setDecided(false);
      }
    }, 400);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (decided) return;
    if (info.offset.x > 60) flyOut("like");
    else if (info.offset.x < -60) flyOut("skip");
    else animate(dragX, 0, { type: "spring", stiffness: 300, damping: 30 });
  };

  const remaining = DEMO_PLACES.length - cardIdx;

  return (
    <motion.div
      key="B"
      className="absolute inset-0 flex flex-col bg-[#f5f5f5]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="h-6 flex items-center justify-center shrink-0">
        <p className="text-[9px] text-slate-400 font-semibold tracking-widest uppercase">
          Przeciągnij i wybierz
        </p>
      </div>

      <div className="relative flex-1 min-h-0 mx-1.5">
        {remaining >= 3 && (
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{ transform: "scale(0.88) translateY(10px)", zIndex: 1, opacity: 0.6 }}
          >
            <div className={`w-full h-full bg-gradient-to-br ${DEMO_PLACES[cardIdx + 2]?.gradient ?? DEMO_PLACES[0].gradient}`} />
          </div>
        )}
        {remaining >= 2 && (
          <div
            className="absolute inset-0 rounded-3xl overflow-hidden"
            style={{ transform: "scale(0.94) translateY(5px)", zIndex: 2, opacity: 0.8 }}
          >
            <div className={`w-full h-full bg-gradient-to-br ${DEMO_PLACES[cardIdx + 1]?.gradient ?? DEMO_PLACES[0].gradient}`} />
          </div>
        )}

        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.72}
          onDragEnd={handleDragEnd}
          style={{ x: dragX, rotate, zIndex: 10, touchAction: "pan-y" }}
          className="absolute inset-0 rounded-3xl overflow-hidden cursor-grab active:cursor-grabbing shadow-xl"
        >
          <CardInner
            place={DEMO_PLACES[cardIdx]}
            likeOpacity={likeOpacity}
            skipOpacity={skipOpacity}
            onExpand={onExpand}
          />
        </motion.div>
      </div>

      <div className="flex gap-2 px-3 py-2.5 bg-white shrink-0">
        <button
          onPointerUp={() => flyOut("skip")}
          className="flex-1 py-3 rounded-full border-2 border-slate-200 text-slate-700 font-bold text-[12px] active:scale-95 transition-transform bg-white"
        >
          Odrzuć
        </button>
        <button
          onPointerUp={() => flyOut("like")}
          className="flex-1 py-3 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold text-[12px] active:scale-95 transition-transform"
        >
          Dodaj
        </button>
      </div>
    </motion.div>
  );
}

// ─── Phase C: Detail sheet ────────────────────────────────────────────────────
function PhaseC({ onNext }: { onNext: () => void }) {
  const place = DEMO_PLACES[0];
  return (
    <motion.div
      key="C"
      className="absolute inset-0"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${place.gradient}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute top-4 left-0 right-0 px-4">
        <p className="text-white/65 text-[9px]">{place.category}</p>
        <h3 className="text-white font-black text-sm">{place.name}</h3>
      </div>

      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[26px] overflow-hidden"
        style={{ height: "72%" }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 34, delay: 0.15 }}
      >
        <div className="flex justify-center pt-2.5 pb-1">
          <div className="w-8 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="flex gap-1.5 px-3 mb-3">
          {[place.gradient, "from-slate-400 to-slate-500", "from-amber-300 to-amber-500"].map(
            (g, i) => (
              <div key={i} className={`rounded-xl bg-gradient-to-br ${g} flex-1`} style={{ height: 56 }} />
            )
          )}
        </div>
        <div className="px-3 space-y-2.5">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-black text-sm text-[#0E0E0E]">{place.name}</h3>
              <p className="text-[10px] text-[#979797]">{place.category} · Gdańsk</p>
            </div>
            <div className="flex items-center gap-0.5 bg-slate-50 rounded-xl px-2 py-1">
              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              <span className="text-[10px] font-bold">{place.rating}</span>
            </div>
          </div>
          <p className="text-[9px] text-[#979797] leading-relaxed">{place.description}</p>
          <div className="flex gap-3 text-[9px] text-[#979797]">
            <span className="flex items-center gap-1">
              <Clock className="h-2.5 w-2.5" /> pon–pt 11:00–20:00
            </span>
            <span className="flex items-center gap-1">
              <Globe className="h-2.5 w-2.5" /> stolowkagdanska.pl
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {place.tags.map((t) => (
              <span key={t} className="text-[8px] bg-orange-50 text-orange-600 rounded-full px-2 py-0.5 font-medium">{t}</span>
            ))}
          </div>
          <button
            onClick={onNext}
            className="w-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl py-2.5 text-[11px] active:scale-95 transition-transform"
          >
            Dodaj do trasy ✓
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Phase D: Business CTA with video ─────────────────────────────────────────
function PhaseD({ onNext }: { onNext: () => void }) {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(onNext, 5000);
    return () => clearTimeout(t);
  }, [onNext]);

  return (
    <motion.div
      key="D"
      className="absolute inset-0 flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <BgVideo src="/founders_business.mp4" fallbackGradient="from-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/92 via-black/40 to-black/10" />

      <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 space-y-3">
        <motion.div
          className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shadow-lg"
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 20, delay: 0.3 }}
        >
          <span className="text-xl">🏠</span>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="space-y-1">
          <p className="text-white font-black text-[15px] leading-tight">Twój lokal w Trasie?</p>
          <p className="text-white/55 text-[10px] leading-relaxed">Dotrzyj do osób planujących wyjazdy w Twoim mieście</p>
        </motion.div>
        <motion.div className="flex gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
          {[["12k+", "użytkowników"], ["4.8★", "ocena app"], ["0 zł", "na start"]].map(([val, label]) => (
            <div key={label} className="text-center">
              <p className="text-white font-black text-[11px]">{val}</p>
              <p className="text-white/45 text-[8px]">{label}</p>
            </div>
          ))}
        </motion.div>
        <motion.div className="space-y-1.5" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}>
          <button onClick={() => navigate("/dla-firm")} className="w-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl py-2.5 text-[11px] active:scale-95 transition-transform">
            Zarejestruj lokal →
          </button>
          <button onClick={onNext} className="w-full text-white/40 text-[9px] py-1 active:text-white/70">
            Pomiń
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}

// ─── Phase E: Founders scroll CTA ─────────────────────────────────────────────
function PhaseE({ onScrollDown }: { onScrollDown: () => void }) {
  return (
    <motion.div
      key="E"
      className="absolute inset-0 flex flex-col justify-between py-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      <BgVideo src="/founders_business.mp4" fallbackGradient="from-slate-900 to-slate-800" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/50" />

      <motion.div className="relative flex flex-col items-center gap-2 mt-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
        <p className="text-white font-black text-[13px] text-center px-4 leading-tight">Stworzone przez Natka i Jurka</p>
        <p className="text-white/50 text-[9px] text-center">Bo sami potrzebowaliśmy czegoś takiego 🤷</p>
      </motion.div>

      <motion.button
        onClick={onScrollDown}
        className="relative flex flex-col items-center gap-1 text-white/55 active:text-white/80 transition-colors"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <span className="text-[8px] tracking-widest uppercase font-semibold">Dowiedz się więcej</span>
        <motion.div animate={{ y: [0, 5, 0] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}>
          <ChevronDown className="h-4 w-4" />
        </motion.div>
      </motion.button>
    </motion.div>
  );
}

// ─── Phone Mockup ──────────────────────────────────────────────────────────────
function PhoneMockup({ phase, setPhase, onScrollDown }: { phase: Phase; setPhase: (p: Phase) => void; onScrollDown: () => void }) {
  const nextPhase = () => {
    const idx = PHASES.indexOf(phase);
    if (idx < PHASES.length - 1) setPhase(PHASES[idx + 1]);
  };
  const goToPhase = (p: Phase) => setPhase(p);

  const phaseEl: Record<Phase, React.ReactNode> = {
    A: <PhaseA key="A" onNext={nextPhase} />,
    B: <PhaseB key="B" onNext={nextPhase} onExpand={() => goToPhase("C")} />,
    C: <PhaseC key="C" onNext={nextPhase} />,
    D: <PhaseD key="D" onNext={nextPhase} />,
    E: <PhaseE key="E" onScrollDown={onScrollDown} />,
  };

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative mx-auto select-none" style={{ width: "clamp(270px, 82vw, 310px)", aspectRatio: "9/19.5" }}>
        <div className="absolute inset-0 rounded-[42px] border-[9px] border-slate-800 bg-slate-900 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.5)] z-10 pointer-events-none" />
        <div className="absolute -right-[11px] top-[22%] w-[4px] h-10 bg-slate-700 rounded-r-full z-20 pointer-events-none" />
        <div className="absolute -left-[11px] top-[18%] w-[4px] h-7 bg-slate-700 rounded-l-full z-20 pointer-events-none" />
        <div className="absolute -left-[11px] top-[27%] w-[4px] h-7 bg-slate-700 rounded-l-full z-20 pointer-events-none" />
        <div className="absolute top-[9px] left-1/2 -translate-x-1/2 w-14 h-[14px] bg-slate-900 rounded-full z-20 pointer-events-none" />
        <div
          className="absolute inset-[9px] rounded-[34px] overflow-hidden bg-black"
          style={{ WebkitMaskImage: "linear-gradient(white, white)" }}
        >
          <AnimatePresence mode="wait">{phaseEl[phase]}</AnimatePresence>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {PHASES.map((p) => (
          <button key={p} onClick={() => setPhase(p)} aria-label={`Faza ${p}`}>
            <motion.div
              className="rounded-full"
              animate={{ width: p === phase ? 20 : 8, height: 8, backgroundColor: p === phase ? "#F9662B" : "rgb(203 213 225)" }}
              transition={{ duration: 0.25 }}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Hero Section ──────────────────────────────────────────────────────────────
function HeroSection({ phase, setPhase }: { phase: Phase; setPhase: (p: Phase) => void }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollToContent = () => contentRef.current?.scrollIntoView({ behavior: "smooth" });

  return (
    <>
      <section className="min-h-screen bg-[#FEFEFE] flex flex-col lg:flex-row items-center justify-center gap-8 lg:gap-20 px-6 py-14 lg:py-0">
        <motion.div
          className="text-center lg:text-left max-w-xs lg:max-w-sm order-2 lg:order-1"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
        >
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="w-6 h-6 rounded-full animate-orb-flow" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="text-sm font-semibold text-[#979797]">Trasa.travel</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-black text-[#0E0E0E] leading-[1.1] mb-4">
            Odkryj miejsca.<br />
            <span className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] bg-clip-text text-transparent">Razem.</span>
          </h1>
          <p className="text-[#979797] text-base leading-relaxed mb-8 max-w-[280px] mx-auto lg:mx-0">
            Planujcie wyjazdy grupowo — wybierajcie miejsca, twórzcie trasy i dzielcie się wspomnieniami.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <a href="/auth" className="bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl px-7 py-3 text-sm shadow-lg shadow-orange-200 active:scale-95 transition-transform text-center">
              Zacznij za darmo
            </a>
            <button onClick={scrollToContent} className="border border-slate-200 text-[#0E0E0E] font-semibold rounded-2xl px-7 py-3 text-sm active:scale-95 transition-transform">
              Jak to działa?
            </button>
          </div>
        </motion.div>

        <motion.div className="order-1 lg:order-2" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.25 }}>
          <PhoneMockup phase={phase} setPhase={setPhase} onScrollDown={scrollToContent} />
        </motion.div>
      </section>

      <div ref={contentRef} className="bg-slate-50 py-24 px-6 text-center">
        <div className="max-w-sm mx-auto space-y-4">
          <div className="w-10 h-10 rounded-full mx-auto animate-orb-flow" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          <h2 className="text-2xl font-black text-[#0E0E0E]">Więcej sekcji wkrótce</h2>
          <p className="text-[#979797] text-sm">Landing page jest w trakcie budowy.</p>
          <a href="/auth" className="inline-flex items-center gap-2 bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold rounded-2xl px-7 py-3 text-sm shadow-lg shadow-orange-200 active:scale-95 transition-transform">
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
        {showLoading && <LoadingScreen onEnter={() => setShowLoading(false)} />}
      </AnimatePresence>
      {!showLoading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
          <HeroSection phase={phase} setPhase={setPhase} />
        </motion.div>
      )}
    </div>
  );
}
