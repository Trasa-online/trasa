import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

// ─── VideoMockup ──────────────────────────────────────────────────────────────

function VideoMockup({ onComplete }: { onComplete?: () => void }) {
  const style = { width: "clamp(270px, 42vw, 310px)", aspectRatio: "9/19.5" };
  return (
    <div className="flex flex-col items-center">
      <div className="relative mx-auto select-none rounded-[34px] overflow-hidden bg-black" style={style}>
        <div className="absolute inset-0 rounded-[34px] pointer-events-none" style={{ boxShadow: "0 32px 80px -12px rgba(0,0,0,0.4)" }} />
        <video
          ref={el => { if (!el) return; el.muted = true; el.play().catch(() => {}); }}
          src="/placeholders/Animacja_landing_dla_firm_mini.mp4"
          autoPlay playsInline muted preload="auto"
          onEnded={onComplete}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ WebkitTransform: "translateZ(0)", transform: "translateZ(0)" }}
        />
      </div>
    </div>
  );
}

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
      {store === "ios" ? (
        <svg className="h-6 w-6 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
        </svg>
      ) : (
        <svg className="h-6 w-6 shrink-0 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.18 23.76c.37.2.8.22 1.19.06l11.3-6.5-2.49-2.49-10 8.93zm-1.13-20.7A1.5 1.5 0 0 0 2 4v16a1.5 1.5 0 0 0 .05.94l.09.1 8.96-8.96v-.21L2.14 2.96l-.09.1zm17.3 7.84-2.41-1.39-2.72 2.72 2.72 2.72 2.44-1.41a1.5 1.5 0 0 0 0-2.64zM4.37.18 15.67 6.68l-2.49 2.49L3.18.24A1.5 1.5 0 0 1 4.37.18z" />
        </svg>
      )}
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
    <div style={{ background: "#FAFAFA", minHeight: "100dvh" }}>

      {/* ── Shared TopBar nav (mobile + desktop) ── */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-100 h-14 lg:h-16">
        <div className="h-full flex items-center justify-between px-5 lg:px-8 max-w-5xl mx-auto">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 lg:w-8 lg:h-8 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
            <span className="font-black text-base lg:text-lg text-[#0E0E0E] tracking-tight">trasa</span>
          </div>
          <button
            onClick={() => navigate("/biznes/start")}
            className="rounded-full text-white font-bold px-5 py-2 lg:px-6 lg:py-2.5 text-sm active:scale-95 transition-transform"
            style={{ background: "#0E0E0E" }}
          >
            Sprawdź
          </button>
        </div>
      </header>

      {/* ── MOBILE ── */}
      <div className="lg:hidden">
        <div className="flex flex-col items-center px-5 pt-6 pb-10 gap-6">
          {/* Video → Postcard at top */}
          <AnimatePresence mode="wait">
            {scene === "demo" ? (
              <motion.div key="video-mobile" exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.35 }}>
                <VideoMockup onComplete={goPostcard} />
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

          {/* Short hero copy + blue CTA */}
          <div className="text-center max-w-xs">
            <h2 className="text-xl font-black text-[#0E0E0E] mb-1">Bądź pierwszy</h2>
            <p className="text-sm text-[#979797]">Twój lokal w Trasie zanim aplikacja trafi do gości.</p>
          </div>
          <button
            onClick={() => navigate("/biznes/start")}
            className="w-full max-w-xs rounded-2xl text-white font-bold py-4 text-base active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(90deg,#3b82f6,#6366f1)", boxShadow: "0 8px 24px -6px rgba(59,130,246,0.4)" }}
          >
            Sprawdź
          </button>

          {/* Existing premiera + h1 + body */}
          <div className="text-center mt-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200 bg-white mb-4">
              <span className="text-base">🚀</span>
              <span className="text-sm font-semibold text-[#0E0E0E]">Premiera: czerwiec 2026</span>
            </div>
            <h1 className="text-4xl font-black text-[#0E0E0E] leading-[1.05] mb-4">
              Dołącz do Trasy<br />jako jeden<br />z pierwszych
            </h1>
            <p className="text-[#979797] text-base leading-relaxed max-w-xs mx-auto">
              Budujemy aplikację do planowania city breaków. Szukamy pierwszych 100 lokali w Warszawie - wchodzisz bezpłatnie i zostajesz na mapie zanim użytkownicy tu trafią!
            </p>
          </div>

          {/* App store badges */}
          <div id="cta-section" className="flex flex-col gap-2 w-full max-w-xs scroll-mt-20">
            <AppStoreBadge store="ios" />
            <AppStoreBadge store="android" />
          </div>
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden lg:flex min-h-[calc(100vh-4rem)] items-center justify-between gap-20 px-8 py-16 max-w-5xl mx-auto">
        {/* Left */}
        <div className="flex flex-col items-start text-left max-w-md w-full">
          {/* Premiera + h1 + body */}
          <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white mb-5">
            <span className="text-lg">🚀</span>
            <span className="text-sm font-semibold text-[#0E0E0E]">Premiera: czerwiec 2026</span>
          </div>
          <h1 className="text-5xl font-black text-[#0E0E0E] leading-[1.05] mb-5">
            Dołącz do Trasy<br />jako jeden<br />z pierwszych
          </h1>
          <p className="text-[#979797] text-base leading-relaxed mb-10 max-w-xs">
            Budujemy aplikację do planowania city breaków. Szukamy pierwszych 100 lokali w Warszawie - wchodzisz bezpłatnie i zostajesz na mapie zanim użytkownicy tu trafią!
          </p>

          {/* Hero copy + blue CTA */}
          <h2 className="text-xl font-bold text-slate-500 mb-2">Bądź pierwszy</h2>
          <p className="text-base text-[#979797] mb-5">Twój lokal w Trasie zanim aplikacja trafi do gości.</p>
          <button
            onClick={() => navigate("/biznes/start")}
            className="rounded-2xl text-white font-bold px-8 py-4 text-base active:scale-[0.98] transition-all mb-10"
            style={{ background: "linear-gradient(90deg,#3b82f6,#6366f1)", boxShadow: "0 8px 24px -6px rgba(59,130,246,0.4)" }}
          >
            Sprawdź
          </button>

          <div className="flex gap-3 w-full">
            <div className="flex-1"><AppStoreBadge store="ios" /></div>
            <div className="flex-1"><AppStoreBadge store="android" /></div>
          </div>
        </div>

        {/* Right: video → postcard */}
        <div className="shrink-0">
          <AnimatePresence mode="wait">
            {scene === "demo" ? (
              <motion.div key="video-desk" exit={{ opacity: 0, scale: 0.88 }} transition={{ duration: 0.4 }}>
                <VideoMockup onComplete={goPostcard} />
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
