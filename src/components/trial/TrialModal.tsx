import { useState, useRef, useEffect, useCallback } from "react";
import { X, Heart, Star, ArrowRight, ChevronLeft, MapPin } from "lucide-react";
import { getMockPlaces } from "@/lib/mockPlaces";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "city" | "categories" | "swipe" | "results";

interface TrialModalProps {
  open: boolean;
  onClose: () => void;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const TRIAL_CITIES = ["Kraków", "Warszawa", "Łódź", "Gdańsk"];

const CATS = [
  { id: "restaurant", label: "Restauracje", icon: "🍽️" },
  { id: "cafe",       label: "Kawiarnie",   icon: "☕" },
  { id: "museum",     label: "Muzea",       icon: "🏛️" },
  { id: "monument",   label: "Zabytki",     icon: "🏰" },
  { id: "park",       label: "Parki",       icon: "🌿" },
  { id: "bar",        label: "Bary",        icon: "🍸" },
  { id: "experience", label: "Atrakcje",    icon: "✨" },
  { id: "market",     label: "Targi",       icon: "🛍️" },
  { id: "viewpoint",  label: "Widoki",      icon: "👁️" },
];

// ─── Drum picker ──────────────────────────────────────────────────────────────

const ITEM_H = 60;
const VISIBLE = 5;
const PAD = (ITEM_H * VISIBLE - ITEM_H) / 2;

function CityDrum({ city, onSelect }: { city: string; onSelect: (c: string) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(TRIAL_CITIES.indexOf(city) >= 0 ? TRIAL_CITIES.indexOf(city) : 0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: idx * ITEM_H, behavior: "instant" as ScrollBehavior });
  }, []);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const raw = el.scrollTop / ITEM_H;
    const clamped = Math.max(0, Math.min(TRIAL_CITIES.length - 1, Math.round(raw)));
    setIdx(clamped);
    onSelect(TRIAL_CITIES[clamped]);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      el.scrollTo({ top: clamped * ITEM_H, behavior: "smooth" });
    }, 80);
  };

  return (
    <div className="relative w-full" style={{ height: ITEM_H * VISIBLE }}>
      {/* Fade top */}
      <div className="absolute inset-x-0 top-0 h-16 pointer-events-none z-10 bg-gradient-to-b from-white to-transparent" />
      {/* Fade bottom */}
      <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none z-10 bg-gradient-to-t from-white to-transparent" />

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="absolute inset-0 overflow-y-scroll"
        style={{ scrollSnapType: "y mandatory", scrollbarWidth: "none" }}
      >
        <div style={{ height: PAD }} />
        {TRIAL_CITIES.map((c, i) => {
          const dist = Math.abs(i - idx);
          const sizeClass =
            dist === 0 ? "text-4xl font-black text-foreground" :
            dist === 1 ? "text-2xl font-semibold text-foreground/50" :
            "text-xl font-medium text-foreground/20";
          return (
            <div
              key={c}
              onClick={() => { setIdx(i); onSelect(c); scrollRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" }); }}
              className={`flex items-center justify-center cursor-pointer select-none transition-all duration-150 ${sizeClass}`}
              style={{ height: ITEM_H, scrollSnapAlign: "center" }}
            >
              {c}
            </div>
          );
        })}
        <div style={{ height: PAD }} />
      </div>
    </div>
  );
}

// ─── Swipe card ───────────────────────────────────────────────────────────────

type ExitDir = "left" | "right" | null;

function SwipeCard({
  place,
  onLike,
  onSkip,
  isTop,
}: {
  place: (typeof MOCK_PLACES)[0];
  onLike: () => void;
  onSkip: () => void;
  isTop: boolean;
}) {
  const [exitDir, setExitDir] = useState<ExitDir>(null);

  const fire = useCallback((dir: ExitDir, cb: () => void) => {
    setExitDir(dir);
    setTimeout(cb, 320);
  }, []);

  if (!isTop) {
    return (
      <div className="absolute inset-0 rounded-3xl overflow-hidden scale-[0.96] -translate-y-2 opacity-60">
        <img src={place.photo_url ?? ""} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </div>
    );
  }

  return (
    <>
      <div
        className="absolute inset-0 rounded-3xl overflow-hidden shadow-xl cursor-grab active:cursor-grabbing transition-transform duration-300"
        style={
          exitDir === "right" ? { transform: "translateX(120%) rotate(15deg)", opacity: 0, transition: "all 0.32s ease-in" } :
          exitDir === "left"  ? { transform: "translateX(-120%) rotate(-15deg)", opacity: 0, transition: "all 0.32s ease-in" } :
          {}
        }
      >
        <img src={place.photo_url ?? ""} alt={place.place_name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Info */}
        <div className="absolute bottom-20 left-4 right-4">
          <div className="flex items-center gap-1.5 mb-1">
            {place.rating && (
              <span className="flex items-center gap-0.5 text-xs font-bold text-amber-400">
                <Star className="h-3 w-3 fill-amber-400" />{place.rating.toFixed(1)}
              </span>
            )}
            <span className="text-white/50 text-xs">·</span>
            <span className="text-white/70 text-xs capitalize">{place.category}</span>
          </div>
          <h3 className="text-white font-black text-2xl leading-tight">{place.place_name}</h3>
          {place.description && (
            <p className="text-white/70 text-xs mt-1 line-clamp-2 leading-relaxed">{place.description}</p>
          )}
          <div className="flex flex-wrap gap-1 mt-2">
            {place.vibe_tags?.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
                #{t}
              </span>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-5">
          <button
            onClick={() => fire("left", onSkip)}
            className="h-12 w-12 rounded-full bg-white shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
          <button
            onClick={() => fire("right", onLike)}
            className="h-14 w-14 rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
            style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}
          >
            <Heart className="h-6 w-6 text-white fill-white" />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function TrialModal({ open, onClose }: TrialModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("city");
  const [city, setCity] = useState("Kraków");
  const [selectedCats, setSelectedCats] = useState<string[]>([]);
  const [cardIdx, setCardIdx] = useState(0);
  const [liked, setLiked] = useState<typeof MOCK_PLACES>([]);

  // Lock scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // Reset on reopen
  useEffect(() => {
    if (open) {
      setStep("city");
      setCity("Kraków");
      setSelectedCats([]);
      setCardIdx(0);
      setLiked([]);
    }
  }, [open]);

  const cityPlaces = getMockPlaces(city);
  const filteredPlaces = selectedCats.length === 0
    ? cityPlaces
    : cityPlaces.filter(p => selectedCats.includes(p.category as string));

  const currentCard = filteredPlaces[cardIdx];
  const nextCard = filteredPlaces[cardIdx + 1];
  const isDone = cardIdx >= filteredPlaces.length;

  const handleLike = useCallback(() => {
    if (currentCard) setLiked(prev => [...prev, currentCard]);
    setCardIdx(i => i + 1);
  }, [currentCard]);

  const handleSkip = useCallback(() => {
    setCardIdx(i => i + 1);
  }, []);

  const stepNum = step === "city" ? 1 : step === "categories" ? 2 : step === "swipe" ? 3 : 4;
  const STEPS = 4;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Card */}
      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col"
        style={{ maxHeight: "90dvh" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 shrink-0">
          <div className="flex items-center gap-2">
            {step !== "city" && (
              <button
                onClick={() => {
                  if (step === "categories") setStep("city");
                  else if (step === "swipe") setStep("categories");
                  else if (step === "results") { setStep("swipe"); setCardIdx(0); setLiked([]); }
                }}
                className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors -ml-1"
              >
                <ChevronLeft className="h-5 w-5 text-slate-500" />
              </button>
            )}
            <div className="flex gap-1.5">
              {Array.from({ length: STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${i < stepNum ? "bg-orange-500 w-5" : "bg-slate-200 w-1.5"}`}
                />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 hover:bg-slate-200 transition-colors">
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* ── STEP 1: City ── */}
        {step === "city" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 mb-2">
              <h2 className="text-2xl font-black text-foreground">Wybierz miasto</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Gdzie planujesz wyjazd?</p>
            </div>
            <div className="flex-1 overflow-hidden">
              <CityDrum city={city} onSelect={setCity} />
            </div>
            <div className="px-5 pb-6 pt-3 shrink-0">
              <button
                onClick={() => setStep("categories")}
                className="w-full h-12 rounded-full font-bold text-white text-base shadow-lg active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}
              >
                Dalej
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Categories ── */}
        {step === "categories" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 mb-4">
              <h2 className="text-2xl font-black text-foreground">Co wybierasz?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Wybierz kategorie — możesz zaznaczyć kilka</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <div className="grid grid-cols-2 gap-2 pb-4">
                {CATS.map(cat => {
                  const active = selectedCats.includes(cat.id);
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCats(prev =>
                        active ? prev.filter(c => c !== cat.id) : [...prev, cat.id]
                      )}
                      className={`flex items-center gap-3 px-4 py-3 rounded-2xl border-2 text-sm font-semibold transition-all active:scale-95 text-left ${
                        active
                          ? "border-orange-500 bg-orange-50 text-orange-700"
                          : "border-slate-100 bg-slate-50 text-slate-600 hover:border-slate-200"
                      }`}
                    >
                      <span className="text-xl">{cat.icon}</span>
                      {cat.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="px-5 pb-6 pt-3 shrink-0 border-t border-slate-100">
              <button
                onClick={() => { setCardIdx(0); setLiked([]); setStep("swipe"); }}
                className="w-full h-12 rounded-full font-bold text-white text-base shadow-lg active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}
              >
                Przechodzę dalej
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Swipe ── */}
        {step === "swipe" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 mb-3 shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-black text-foreground">
                    {city} <span className="text-muted-foreground font-medium text-base">· odkrywaj</span>
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isDone ? "Wszystkie miejsca przejrzane!" : `${filteredPlaces.length - cardIdx} pozostałych`}
                  </p>
                </div>
                {liked.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                    <Heart className="h-3 w-3 fill-orange-600" /> {liked.length}
                  </span>
                )}
              </div>
            </div>

            {/* Card stack */}
            <div className="relative mx-5" style={{ height: 380 }}>
              {isDone ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <div className="text-5xl">🎉</div>
                  <p className="font-black text-xl">Koniec kart!</p>
                  <p className="text-sm text-muted-foreground">
                    {liked.length > 0
                      ? `Wybrałeś ${liked.length} miejsc${liked.length === 1 ? "e" : "a"}`
                      : "Spróbuj zmienić kategorię"}
                  </p>
                </div>
              ) : (
                <>
                  {nextCard && (
                    <SwipeCard key={`bg-${cardIdx + 1}`} place={nextCard} onLike={() => {}} onSkip={() => {}} isTop={false} />
                  )}
                  <SwipeCard key={`top-${cardIdx}`} place={currentCard} onLike={handleLike} onSkip={handleSkip} isTop={true} />
                </>
              )}
            </div>

            <div className="px-5 pb-6 pt-4 shrink-0">
              <button
                onClick={() => setStep("results")}
                disabled={liked.length === 0}
                className={`w-full h-12 rounded-full font-bold text-base transition-all active:scale-95 ${
                  liked.length > 0
                    ? "text-white shadow-lg"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                }`}
                style={liked.length > 0 ? { background: "linear-gradient(135deg, #F4A259, #F9662B)" } : {}}
              >
                {liked.length > 0 ? `Zobacz moją trasę (${liked.length})` : "Kliknij ❤️ żeby dodać miejsce"}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Results ── */}
        {step === "results" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 mb-3 shrink-0">
              <h2 className="text-2xl font-black text-foreground">Twoja trasa ✨</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {liked.length} {liked.length === 1 ? "miejsce" : liked.length < 5 ? "miejsca" : "miejsc"} · {city}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-2 pb-2">
              {liked.map((place, i) => (
                <div key={place.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 text-xs font-black text-orange-600">
                    {i + 1}
                  </div>
                  {place.photo_url && (
                    <img src={place.photo_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{place.place_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{place.category}</p>
                  </div>
                  {place.rating && (
                    <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500 shrink-0">
                      <Star className="h-3 w-3 fill-amber-400" />{place.rating}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="px-5 pb-6 pt-4 shrink-0 border-t border-slate-100 space-y-2">
              <button
                onClick={() => navigate("/auth?tab=register")}
                className="w-full h-13 py-3.5 rounded-full font-black text-white text-base shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}
              >
                Tworzę konto! <ArrowRight className="h-4 w-4" />
              </button>
              <p className="text-center text-[11px] text-muted-foreground">
                Bezpłatne · Trasa zostanie zapisana po rejestracji
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
