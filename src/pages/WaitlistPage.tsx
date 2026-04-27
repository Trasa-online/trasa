import { useState } from "react";
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
      <div className="flex items-center gap-3 px-5 py-4 rounded-2xl bg-orange-50 border border-orange-200 max-w-sm mx-auto">
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shrink-0">
          <Check className="h-4 w-4 text-white" />
        </div>
        <p className="text-sm font-semibold text-[#0E0E0E]">Dzięki! Powiadomimy Cię o premierze.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2.5 w-full max-w-sm mx-auto">
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

export default function WaitlistPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center relative overflow-hidden"
      style={{ background: "#FEFEFE" }}
    >
      {/* Subtle background glow */}
      <div
        className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(249,102,43,0.06) 0%, transparent 70%)" }}
      />

      {/* Logo */}
      <img
        src="/app-icon-base.png"
        alt="Trasa"
        className="w-16 h-16 rounded-2xl mb-6 shadow-md shadow-orange-100"
      />

      {/* Wordmark */}
      <p className="text-slate-400 text-xs font-semibold tracking-[0.2em] uppercase mb-4">Trasa.travel</p>

      {/* Headline */}
      <h1 className="text-4xl sm:text-5xl font-black text-[#0E0E0E] leading-[1.05] mb-4 max-w-sm">
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
        Planujcie wyjazdy grupowo. Wybierajcie miejsca, twórzcie trasy i dzielcie się wspomnieniami.
      </p>

      {/* Mobile app badge */}
      <div className="inline-flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-full px-4 py-1.5 mb-10">
        <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
        <span className="text-orange-700 text-xs font-medium">Aplikacja mobilna w budowie</span>
      </div>

      {/* Email capture */}
      <div className="w-full max-w-sm mb-3">
        <EmailCapture />
      </div>

      <p className="text-slate-400 text-xs mb-10">Powiadomimy Cię o premierze na iOS i Androidzie.</p>

      {/* Store badges */}
      <div className="flex flex-col sm:flex-row gap-3 mb-16">
        <AppStoreBadge store="ios" />
        <AppStoreBadge store="android" />
      </div>

      {/* Business link */}
      <button
        onClick={() => navigate("/dla-firm")}
        className="text-slate-500 text-sm hover:text-slate-700 transition-colors underline underline-offset-4"
      >
        Prowadzisz lokal? Dowiedz się więcej
      </button>
    </div>
  );
}
