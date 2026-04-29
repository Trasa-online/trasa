import { useState } from "react";
import { Check, Star, ChevronUp, ChevronDown, MapPin } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ─── Inline phone mockup showing the biz card ────────────────────────────────

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
          /* ── Card view ── */
          <div className="relative mx-1.5 mt-1.5 rounded-2xl overflow-hidden" style={{ height: "calc(100% - 88px)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-amber-800 via-orange-700 to-amber-600" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent" />
            <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full text-[9px] font-bold text-white" style={{ background: "#F4A259" }}>Kawiarnia</div>
            {/* Info */}
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
            {/* Expand button */}
            <button
              onClick={() => setExpanded(true)}
              className="absolute right-3 bg-white rounded-full flex items-center justify-center shadow-md"
              style={{ width: 30, height: 30, bottom: "3.6rem" }}
            >
              <ChevronUp style={{ width: 14, height: 14, color: "#374151" }} />
            </button>
            {/* Action buttons */}
            <div className="absolute bottom-2 left-2 right-2 flex gap-1.5">
              <div className="flex-1 py-2 rounded-full bg-white text-center text-slate-900 font-bold text-[10px]">Odrzuc</div>
              <div className="flex-1 py-2 rounded-full text-center text-white font-bold text-[10px]" style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)" }}>Dodaj</div>
            </div>
          </div>
        ) : (
          /* ── Detail view ── */
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
              <p className="text-[9px] text-slate-600 leading-relaxed">Specialty coffee w sercu Warszawy. Trzecia fala, lokalne wypieki, spokojne miejsce do pracy i spotkania ze znajomymi.</p>
              <div className="flex flex-wrap gap-1">
                {["kawiarnia","kawa","relaks","slow food"].map(t => (
                  <span key={t} className="px-2 py-0.5 bg-slate-100 rounded-full text-[8px] text-slate-600">{t}</span>
                ))}
              </div>
              {/* Aktualnosci zero */}
              <div>
                <p className="text-[10px] font-bold text-[#0E0E0E] mb-1">Aktualnosci</p>
                <div className="bg-slate-50 rounded-xl py-3 flex flex-col items-center gap-1 border border-slate-100">
                  <p className="text-[9px] text-slate-400">Brak wpisow</p>
                </div>
              </div>
              {/* Opinie */}
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

// ─── Form ─────────────────────────────────────────────────────────────────────

function BizForm() {
  const [placeName, setPlaceName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!placeName.trim() || !email.trim()) return;
    setLoading(true);
    try {
      const { error } = await (supabase as any).from("business_claims").insert({
        contact_email: email.trim().toLowerCase(),
        contact_phone: phone.trim() || null,
        place_name_text: placeName.trim(),
        status: "pending",
      });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "Blad wysylania");
    } finally {
      setLoading(false);
    }
  };

  if (done) return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="h-16 w-16 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg,#F4A259,#F9662B)" }}>
        <Check className="h-8 w-8 text-white" />
      </div>
      <h3 className="text-2xl font-black text-[#0E0E0E]">Jestes wsrod pierwszych!</h3>
      <p className="text-[#979797] text-center max-w-xs">Odezwiemy sie w ciagu 24h i pomozemy uruchomic Twoj profil przed launchem.</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-4 max-w-lg mx-auto">
      <div>
        <label className="block text-sm font-semibold text-[#0E0E0E] mb-1.5">Nazwa lokalu *</label>
        <input
          required value={placeName} onChange={e => setPlaceName(e.target.value)}
          placeholder="np. Kawiarnia Pod Lipa"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#0E0E0E] mb-1.5">Email kontaktowy *</label>
        <input
          required type="email" value={email} onChange={e => setEmail(e.target.value)}
          placeholder="twoj@email.pl"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-[#0E0E0E] mb-1.5">
          Telefon <span className="font-normal text-slate-400">(opcjonalnie)</span>
        </label>
        <input
          type="tel" value={phone} onChange={e => setPhone(e.target.value)}
          placeholder="+48 000 000 000"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-orange-300"
        />
      </div>
      <button
        type="submit" disabled={loading}
        className="w-full rounded-2xl text-white font-bold py-4 text-sm active:scale-[0.98] transition-all disabled:opacity-60"
        style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)", boxShadow: "0 8px 24px -6px rgba(249,102,43,0.4)" }}
      >
        {loading ? "Wysylanie..." : "Dolacz do programu"}
      </button>
      <p className="text-center text-xs text-slate-400">Odezwiemy sie w ciagu 24h. Pierwsze 100 lokali wchodzi bezplatnie do launchu.</p>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const TIERS = [
  {
    id: "basic",
    label: "PODSTAWOWY",
    title: "Jestes widoczny",
    price: "Bezplatny",
    priceStrike: null,
    badge: null,
    features: [
      "Profil biznesowy w aplikacji",
      "Galeria zdiec",
      "Opis i adres",
      "Podstawowa analityka (wyswietlenia)",
    ],
  },
  {
    id: "premium",
    label: "FOUNDING PARTNER",
    title: "Wyrozniasz sie",
    price: "Bezplatny do launchu",
    priceStrike: "139 zl/mies",
    badge: "Pierwsze 100 lokali",
    features: [
      "Profil biznesowy w aplikacji",
      "Pelna galeria zdiec i filmow",
      "Opis i adres",
      "Pelna analityka - wyswietlenia, klikniecia, dodania do trasy",
      "Sekcja aktualnosci i promocji",
      "Powiadomienia push dla uzytkownikow",
      "Wyroznione miejsce w wynikach",
    ],
  },
];

export default function BusinessLanding() {
  const navigate = useNavigate();

  const scrollToForm = () => {
    setTimeout(() => document.getElementById("formularz")?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  return (
    <div style={{ background: "#FEFEFE", minHeight: "100dvh" }}>

      {/* ── Nav ── */}
      <div className="sticky top-0 z-50 border-b border-slate-100 px-5 h-14 flex items-center justify-between gap-4" style={{ background: "rgba(254,254,254,0.92)", backdropFilter: "blur(12px)" }}>
        <button onClick={() => navigate("/")} className="flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
          <span className="font-black text-sm text-[#0E0E0E]">trasa</span>
        </button>
        <div className="hidden sm:flex items-center gap-5">
          <button onClick={() => document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" })} className="text-sm font-semibold text-[#979797] hover:text-[#0E0E0E] transition-colors">Pakiety</button>
          <button onClick={scrollToForm} className="text-sm font-semibold text-[#979797] hover:text-[#0E0E0E] transition-colors">Formularz</button>
        </div>
        <button onClick={scrollToForm} className="text-sm font-bold px-4 py-2 rounded-full text-white shrink-0 active:scale-95 transition-all" style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)" }}>
          Dolacz
        </button>
      </div>

      {/* ── MOBILE hero ── */}
      <div className="lg:hidden flex flex-col items-center px-5 pt-10 pb-6 gap-6">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest mb-3 text-center" style={{ color: "#F4A259" }}>PRZED LAUNCHEM</p>
          <h1 className="text-4xl font-black text-[#0E0E0E] leading-[1.05] text-center mb-4">
            Dolacz do Trasy<br />jako Founding Partner
          </h1>
          <p className="text-[#979797] text-base leading-relaxed text-center max-w-xs mx-auto mb-5">
            Budujemy aplikacje do grupowego planowania podrozy. Szukamy pierwszych 100 lokali w Warszawie - wchodzisz bezplatnie i zostajesz na mapie zanim uzytkownicy tu trafią.
          </p>
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="text-lg">🚀</span>
            <span className="text-sm font-semibold text-[#0E0E0E]">Premiera: czerwiec 2026</span>
          </div>
        </div>
        <PhonePreview />
        <div className="flex flex-col items-center gap-3 w-full">
          <button onClick={scrollToForm} className="w-full max-w-xs rounded-2xl text-white font-bold py-4 text-base active:scale-[0.98] transition-all" style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)", boxShadow: "0 8px 24px -6px rgba(249,102,43,0.4)" }}>
            Zglos swoj lokal
          </button>
          <button onClick={() => document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" })} className="text-sm text-[#979797] flex items-center gap-1">
            Zobacz pakiety <ChevronDown className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ── DESKTOP hero ── */}
      <div className="hidden lg:flex min-h-[90vh] items-center justify-center gap-20 px-8 py-16 max-w-5xl mx-auto">
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
          <div className="flex items-center gap-2 px-4 py-2.5 rounded-full border border-slate-200 bg-white mb-8">
            <span className="text-lg">🚀</span>
            <span className="text-sm font-semibold text-[#0E0E0E]">Premiera: czerwiec 2026</span>
          </div>
          <div className="flex gap-3 w-full">
            <button onClick={scrollToForm} className="flex-1 rounded-2xl text-white font-bold py-4 text-sm active:scale-[0.98] transition-all" style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)", boxShadow: "0 8px 24px -6px rgba(249,102,43,0.4)" }}>
              Zglos swoj lokal
            </button>
            <button onClick={() => document.getElementById("pakiety")?.scrollIntoView({ behavior: "smooth" })} className="px-5 py-4 rounded-2xl border border-slate-200 text-sm font-semibold text-[#0E0E0E] hover:bg-slate-50 transition-colors">
              Pakiety
            </button>
          </div>
        </div>
        {/* Right: phone */}
        <div className="shrink-0">
          <PhonePreview />
        </div>
      </div>

      {/* ── Features strip ── */}
      <div className="border-y border-slate-100 py-10 px-5">
        <div className="max-w-4xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-8">
          {[
            { emoji: "📍", title: "Widocznosc gdzie trzeba", desc: "Twoj lokal pojawia sie gdy ktos planuje wyjazd do Twojego miasta - nie w reklamach, ale w planie dnia." },
            { emoji: "📊", title: "Analityka w czasie rzeczywistym", desc: "Ile osob zobaczyo Twoj profil, ile kliknelo, ile dodalo do trasy. Wiesz co dziala." },
            { emoji: "📣", title: "Aktualnosci i promocje", desc: "Wrzuc specjalna oferte lub wydarzenie. Uzytkownicy planujacy trase zobacza to w odpowiednim momencie." },
          ].map(f => (
            <div key={f.title} className="flex flex-col gap-2">
              <span className="text-3xl">{f.emoji}</span>
              <h3 className="font-black text-base text-[#0E0E0E]">{f.title}</h3>
              <p className="text-sm text-[#979797] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Packages ── */}
      <section id="pakiety" className="py-16 px-5">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#F4A259" }}>Pakiety</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0E0E0E]">Co dostajesz w Trasie</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {TIERS.map(tier => (
              <div
                key={tier.id}
                className="rounded-3xl p-6 flex flex-col border relative"
                style={tier.id === "premium"
                  ? { background: "#0E0E0E", borderColor: "#0E0E0E" }
                  : { background: "white", borderColor: "#e2e8f0" }
                }
              >
                {tier.badge && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-[11px] font-bold px-3 py-1 rounded-full text-white whitespace-nowrap" style={{ background: "linear-gradient(90deg,#F4A259,#F9662B)" }}>
                    {tier.badge}
                  </span>
                )}
                <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${tier.id === "premium" ? "text-orange-400" : "text-[#979797]"}`}>{tier.label}</p>
                <h3 className={`text-xl font-black mb-3 ${tier.id === "premium" ? "text-white" : "text-[#0E0E0E]"}`}>{tier.title}</h3>
                <div className="mb-4">
                  {tier.priceStrike && <p className={`text-sm line-through ${tier.id === "premium" ? "text-white/40" : "text-[#CFCFCF]"}`}>{tier.priceStrike}</p>}
                  <p className={`text-base font-bold ${tier.id === "premium" ? "text-orange-400" : "text-[#0E0E0E]"}`}>{tier.price}</p>
                </div>
                <ul className="flex flex-col gap-2.5 flex-1 mb-6">
                  {tier.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2">
                      <Check className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${tier.id === "premium" ? "text-orange-400" : "text-[#0E0E0E]"}`} strokeWidth={2.5} />
                      <span className={`text-xs leading-snug ${tier.id === "premium" ? "text-white/80" : "text-[#979797]"}`}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={scrollToForm}
                  className="w-full py-3 rounded-2xl text-sm font-bold active:scale-[0.98] transition-all"
                  style={tier.id === "premium"
                    ? { background: "linear-gradient(90deg,#F4A259,#F9662B)", color: "white" }
                    : { background: "white", color: "#0E0E0E", border: "1.5px solid #e2e8f0" }
                  }
                >
                  Wybieram
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Form ── */}
      <section id="formularz" className="py-16 px-5 border-t border-slate-100" style={{ background: "#f8f8f8" }}>
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#F4A259" }}>Zgłoszenie</p>
            <h2 className="text-3xl sm:text-4xl font-black text-[#0E0E0E] mb-3">Dolacz jako Founding Partner</h2>
            <p className="text-[#979797] max-w-[44ch] mx-auto">Odezwiemy sie w ciagu 24h. Pierwsze 100 lokali wchodzi bezplatnie do launchu.</p>
          </div>
          <BizForm />
        </div>
      </section>

      {/* ── Footer ── */}
      <div className="py-8 px-5 border-t border-slate-100 flex items-center justify-center gap-3">
        <div className="h-5 w-5 rounded-full shrink-0" style={{ background: "radial-gradient(circle at 35% 35%, #fb923c, #ea580c 60%, #c2410c)" }} />
        <span className="text-xs text-[#979797]">trasa.travel · Warszawa 2026</span>
      </div>
    </div>
  );
}
