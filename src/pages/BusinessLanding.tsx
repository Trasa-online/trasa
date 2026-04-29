import { useState } from "react";
import { Star, ChevronUp, ChevronDown, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Inline phone mockup ──────────────────────────────────────────────────────

function PhonePreview() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="relative mx-auto select-none"
      style={{
        width: "clamp(220px, 32vw, 270px)",
        aspectRatio: "9/19.5",
        borderRadius: 42,
        background: "#1e293b",
        boxShadow: "0 32px 80px -12px rgba(0,0,0,0.42)",
      }}
    >
      {/* Physical buttons */}
      <div className="absolute -right-[3px] top-[22%] w-[4px] h-10 bg-slate-700 rounded-r-full" />
      <div className="absolute -left-[3px] top-[18%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
      <div className="absolute -left-[3px] top-[27%] w-[4px] h-7 bg-slate-700 rounded-l-full" />
      <div className="absolute top-[9px] left-1/2 -translate-x-1/2 w-14 h-[14px] bg-slate-800 rounded-full z-10" />

      {/* Screen */}
      <div
        className="absolute overflow-hidden bg-[#f5f5f5]"
        style={{ inset: 9, borderRadius: 34, zIndex: 1 }}
      >
        {/* Top bar */}
        <div className="h-10 bg-white flex items-center px-3 gap-2 border-b border-slate-100 shrink-0">
          <div className="flex-1">
            <span className="font-bold text-[11px] text-[#0E0E0E]">Warszawa</span>
            <span className="font-semibold text-[11px] ml-1" style={{ color: "#F4A259" }}>10 kategorii</span>
          </div>
          <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center text-[9px] font-bold text-orange-600">T</div>
        </div>

        {/* Tabs */}
        <div className="flex bg-white border-b border-slate-100 shrink-0">
          <div className="flex-1 py-1.5 text-[10px] font-bold text-center border-b-2" style={{ color: "#F4A259", borderColor: "#F4A259" }}>Eksploruj</div>
          <div className="flex-1 py-1.5 text-[10px] text-slate-400 text-center relative">
            Dopasowania
            <span className="absolute top-1 right-3 h-3 w-3 rounded-full text-[7px] text-white flex items-center justify-center font-bold" style={{ background: "#F4A259" }}>3</span>
          </div>
        </div>

        {!expanded ? (
          <div className="relative mx-1.5 mt-1.5 rounded-2xl overflow-hidden" style={{ height: "calc(100% - 88px)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-800 via-orange-700 to-amber-600" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: "#F4A259" }}>Kawiarnia</div>
            <div className="absolute left-0 right-0 px-3 space-y-1" style={{ bottom: "3.5rem" }}>
              <div className="flex items-center gap-1">
                <Star className="fill-yellow-400 text-yellow-400" style={{ width: 9, height: 9 }} />
                <span className="text-white/70 text-[9px]">4.6 · Nowy Swiat 12</span>
              </div>
              <h3 className="text-white font-black text-sm leading-tight">Wanderlust Coffee</h3>
              <p className="text-white/60 text-[9px] leading-snug line-clamp-2">Specialty coffee w sercu Warszawy. Trzecia fala, lokalne wypieki.</p>
              <div className="flex flex-wrap gap-1 pr-9">
                {["kawiarnia", "kawa", "relaks"].map(t => (
                  <span key={t} className="px-1.5 py-0.5 bg-white/15 rounded-full text-[8px] text-white/80">{t}</span>
                ))}
              </div>
            </div>
            <button
              onClick={() => setExpanded(true)}
              className="absolute right-3 bg-white rounded-full flex items-center justify-center shadow-md"
              style={{ width: 30, height: 30, bottom: "3.6rem" }}
            >
              <ChevronUp style={{ width: 14, height: 14, color: "#374151" }} />
            </button>
            <div className="absolute bottom-2 left-2 right-2 flex gap-1.5">
              <div className="flex-1 py-2 rounded-full bg-white text-center text-slate-900 font-bold text-[10px]">Odrzuc</div>
              <div className="flex-1 py-2 rounded-full text-center text-white font-bold text-[10px]" style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)" }}>Dodaj</div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col" style={{ height: "calc(100% - 88px)" }}>
            <div className="relative shrink-0" style={{ height: "35%" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-amber-800 via-orange-700 to-amber-600" />
              <button
                onClick={() => setExpanded(false)}
                className="absolute top-2 left-2 bg-black/30 rounded-full flex items-center justify-center"
                style={{ width: 24, height: 24 }}
              >
                <ChevronDown style={{ width: 12, height: 12, color: "white" }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto bg-white px-3 py-2.5 space-y-2">
              <h2 className="font-black text-sm text-[#0E0E0E]">Wanderlust Coffee</h2>
              <div className="flex items-center gap-1">
                {[1,2,3,4,5].map(i => <Star key={i} className="fill-yellow-400 text-yellow-400" style={{ width: 9, height: 9 }} />)}
                <span className="text-[9px] text-slate-500 ml-1">4.6 (2 600)</span>
              </div>
              <p className="flex items-center gap-1 text-[9px] text-slate-500">
                <MapPin style={{ width: 9, height: 9 }} />Nowy Swiat 12, Warszawa
              </p>
              <p className="text-[9px] text-slate-600 leading-relaxed">Specialty coffee w sercu Warszawy. Trzecia fala, lokalne wypieki, spokojne miejsce.</p>
              <div className="flex flex-wrap gap-1">
                {["kawiarnia","kawa","relaks","slow food"].map(t => (
                  <span key={t} className="px-2 py-0.5 bg-slate-100 rounded-full text-[8px] text-slate-600">{t}</span>
                ))}
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#0E0E0E] mb-1">Aktualnosci</p>
                <div className="bg-slate-50 rounded-xl py-3 flex flex-col items-center border border-slate-100">
                  <p className="text-[9px] text-slate-400">Brak wpisow</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#0E0E0E] mb-1">Opinie</p>
                <div className="flex items-start gap-1.5">
                  <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white text-[8px] font-bold shrink-0">M</div>
                  <div>
                    <p className="text-[9px] font-bold">Mateusz S.</p>
                    <div className="flex gap-0.5">{[1,2,3,4,5].map(i=><Star key={i} className="fill-yellow-400 text-yellow-400" style={{width:7,height:7}}/>)}</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0 flex gap-1.5 px-2 py-2 border-t border-slate-100 bg-white">
              <button onClick={() => setExpanded(false)} className="flex-1 py-1.5 rounded-full border border-slate-200 text-slate-700 font-semibold text-[9px] flex items-center justify-center gap-1">
                <ChevronDown style={{ width: 10, height: 10 }} /> Pomin
              </button>
              <button className="flex-1 py-1.5 rounded-full text-white font-bold text-[9px] flex items-center justify-center gap-1" style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)" }}>
                Chce tu byc
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BusinessLanding() {
  const navigate = useNavigate();

  return (
    <div style={{ background: "#FEFEFE", minHeight: "100dvh" }}>

      {/* ── MOBILE hero ── */}
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
        <PhonePreview />
        <button
          onClick={() => navigate("/biznes/start")}
          className="w-full max-w-xs rounded-2xl text-white font-bold py-4 text-base active:scale-[0.98] transition-all"
          style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)", boxShadow: "0 8px 24px -6px rgba(249,102,43,0.4)" }}
        >
          Zglos swoj lokal
        </button>
      </div>

      {/* ── DESKTOP hero ── */}
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
          <button
            onClick={() => navigate("/biznes/start")}
            className="w-full rounded-2xl text-white font-bold py-4 text-base active:scale-[0.98] transition-all"
            style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)", boxShadow: "0 8px 24px -6px rgba(249,102,43,0.4)" }}
          >
            Zglos swoj lokal
          </button>
        </div>
        {/* Right */}
        <div className="shrink-0">
          <PhonePreview />
        </div>
      </div>

    </div>
  );
}
