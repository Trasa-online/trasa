import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

function EmailCapture() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done">("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || status !== "idle") return;
    setStatus("loading");
    await (supabase as any).from("waitlist").insert({ email: email.trim().toLowerCase() });
    setStatus("done");
  };

  if (status === "done") {
    return (
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-orange-50 border border-orange-200 max-w-sm">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-semibold text-[#0E0E0E]">Powiadomimy Cię o premierze.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm">
      <input
        type="email"
        required
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="twoj@email.pl"
        className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm text-[#0E0E0E] placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="rounded-2xl bg-orange-700 hover:bg-orange-800 text-white font-bold px-6 py-3.5 text-sm whitespace-nowrap shadow-md shadow-orange-200 active:scale-[0.98] transition-all"
      >
        {status === "loading" ? "..." : "Zapisz się"}
      </button>
    </form>
  );
}

function AppStoreBadge({ store }: { store: "ios" | "android" }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 select-none">
      {store === "ios" ? (
        <svg className="h-6 w-6 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      ) : (
        <svg className="h-6 w-6 text-slate-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.18 23.76a2 2 0 0 0 2.37-.08l.11-.08 9.5-5.48-2.35-2.35zM1.5 2.27A2 2 0 0 0 1 3.73v16.54a2 2 0 0 0 .5 1.46l.08.08 9.26-9.26v-.22zM20.49 10.7l-2.7-1.56-2.62 2.62 2.62 2.62 2.71-1.56a2 2 0 0 0 0-3.12zM5.55.4 14.93 5.8l-2.35 2.35L5.18.65A2 2 0 0 1 5.55.4z"/>
        </svg>
      )}
      <div>
        <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">
          {store === "ios" ? "Pobierz w" : "Dostępne w"}
        </p>
        <p className="text-[13px] font-semibold text-slate-600 leading-tight">
          {store === "ios" ? "App Store" : "Google Play"}
        </p>
      </div>
      <span className="ml-1 text-[9px] text-slate-400 font-medium bg-slate-100 rounded-full px-2 py-0.5">Wkrótce</span>
    </div>
  );
}

function PhoneMockupVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  return (
    <div className="relative mx-auto select-none" style={{ width: "clamp(220px, 42vw, 280px)" }}>
      {/* Phone shell */}
      <div
        className="relative rounded-[42px] bg-slate-800 shadow-[0_32px_80px_-12px_rgba(0,0,0,0.35)]"
        style={{ aspectRatio: "9/19.5" }}
      >
        {/* Side buttons */}
        <div className="absolute -right-[3px] top-[22%] w-[4px] h-10 bg-slate-700 rounded-r-full" />
        <div className="absolute -left-[3px] top-[18%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
        <div className="absolute -left-[3px] top-[27%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
        {/* Screen */}
        <div className="absolute inset-[9px] rounded-[34px] overflow-hidden bg-black" style={{ zIndex: 1 }}>
          {/* Gradient fallback */}
          <div className="absolute inset-0 bg-gradient-to-br from-orange-900 via-orange-700 to-amber-600" />
          {/* Video */}
          <video
            ref={ref}
            src="/founders_intro.mp4"
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/10" />
          {/* Card info */}
          <div className="absolute bottom-4 left-3 right-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
              <span className="text-white/65 text-[10px]">Poradnik · @trasa</span>
            </div>
            <p className="text-white font-black text-[14px] leading-tight">Co możesz robić w Trasie?</p>
            <div className="inline-flex items-center gap-1 bg-gradient-to-r from-[#F4A259] to-[#F9662B] rounded-full px-2 py-[3px]">
              <span className="text-white font-semibold text-[9px]">Filmik założycieli</span>
            </div>
          </div>
        </div>
        {/* Notch */}
        <div className="absolute top-[9px] left-1/2 -translate-x-1/2 w-14 h-[14px] bg-slate-800 rounded-full" style={{ zIndex: 10 }} />
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#FEFEFE" }}>
      {/* Main content — two columns on large screens */}
      <div className="flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 lg:gap-20 px-6 py-16 lg:py-0 max-w-5xl mx-auto w-full">

        {/* Left column — text + form */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left max-w-sm w-full order-2 lg:order-1">
          {/* Orb */}
          <div
            className="w-14 h-14 rounded-full mb-6"
            style={{
              background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)",
              boxShadow: "0 0 32px rgba(249,102,43,0.35), 0 0 64px rgba(249,102,43,0.10)",
            }}
          />

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-black text-[#0E0E0E] leading-[1.05] mb-4">
            speed dating<br />
            <span
              className="bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(135deg, #F4A259, #F9662B)" }}
            >
              z miastem
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-slate-500 text-base leading-relaxed mb-3 max-w-xs">
            Planujcie wyjazdy grupowo. Wybierajcie miejsca, twórzcie trasy i dzielcie sie wspomnieniami.
          </p>

          {/* Mobile badge */}
          <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 mb-8">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-orange-700 text-xs font-medium">Aplikacja mobilna w budowie</span>
          </div>

          {/* Email capture */}
          <div className="w-full mb-3">
            <EmailCapture />
          </div>

          <p className="text-slate-400 text-xs mb-8">Powiadomimy Cie o premierze na iOS i Androidzie.</p>

          {/* Store badges */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <AppStoreBadge store="ios" />
            <AppStoreBadge store="android" />
          </div>

          {/* Business link */}
          <button
            onClick={() => navigate("/dla-firm")}
            className="text-slate-500 text-sm hover:text-slate-700 transition-colors underline underline-offset-4"
          >
            Prowadzisz lokal? Dowiedz sie wiecej
          </button>
        </div>

        {/* Right column — phone mockup */}
        <div className="order-1 lg:order-2 shrink-0">
          <PhoneMockupVideo />
        </div>
      </div>
    </div>
  );
}
