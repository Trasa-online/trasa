import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Plus, ArrowRight, Bookmark, BookOpen, Compass, Sparkles } from "lucide-react";
import { TrasaLogo } from "@/components/TrasaLogo";

// ─────────────────────────────────────────────────────────────────────────────
// Onboarding v2 - learn-by-doing, GUEST-first (2026-08-14).
// Prowadzimy usera-gosca za reke przez pelna petle appki na FEJKOWYM (in-memory)
// wyjezdzie: Przegladaj -> Zapisz -> Stworz wyjazd -> Dziennik. Po ostatnim CTA
// "Okej! Przechodze do aplikacji" NIC sie nie zapisuje - gosc laduje na Eksploracji.
// (W realnej appce anonim moze TYLKO przegladac - zapis/wyjazd wymaga konta.)
// ─────────────────────────────────────────────────────────────────────────────

// Bump klucza = reset onboardingu dla WSZYSTKICH urzadzen (flaga jest device-local, nie per-email).
// v2_1 (2026-08-14): reset dla testerow (Nat, Tomek) po zmianach w onboardingu.
const ONBOARDING_DONE_KEY = "trasa_onboarding_v2_1_done";

interface DemoPlace {
  id: string;
  emoji: string;
  name: string;
  category: string;
  color: string; // tlo kafelka
}

// Kilka miejsc z Warszawy (miasto domyslne) - dane demo, tylko na czas onboardingu.
const DEMO_PLACES: DemoPlace[] = [
  { id: "d1", emoji: "☕", name: "Kawiarnia Relaks", category: "Kawiarnia", color: "#F6E1CE" },
  { id: "d2", emoji: "🍜", name: "Ramen Shop Krucza", category: "Restauracja", color: "#F3D9D0" },
  { id: "d3", emoji: "🏛️", name: "Muzeum Narodowe", category: "Muzeum", color: "#DDE6F0" },
  { id: "d4", emoji: "🌳", name: "Łazienki Królewskie", category: "Park", color: "#D8EFD8" },
  { id: "d5", emoji: "🍺", name: "Piw Paw Beer Heaven", category: "Bar", color: "#EFE6CE" },
];

const PlaceTile = ({ p, size = 64 }: { p: DemoPlace; size?: number }) => (
  <div
    className="rounded-2xl flex items-center justify-center shrink-0"
    style={{ width: size, height: size, background: p.color }}
  >
    <span style={{ fontSize: size * 0.42 }}>{p.emoji}</span>
  </div>
);

const Onboarding = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0); // 0 przegladaj, 1 zapisane, 2 wyjazd, 3 dziennik
  const [cardIdx, setCardIdx] = useState(0);
  const [saved, setSaved] = useState<DemoPlace[]>([]);
  const [tripName, setTripName] = useState("Weekend w Warszawie");

  const finish = () => {
    try { localStorage.setItem(ONBOARDING_DONE_KEY, "1"); } catch { /* unavailable */ }
    navigate("/eksploruj", { replace: true });
  };

  const currentCard = DEMO_PLACES[cardIdx];

  const handleSave = () => {
    if (currentCard && !saved.some((s) => s.id === currentCard.id)) {
      setSaved((prev) => [...prev, currentCard]);
    }
    nextCard();
  };
  const nextCard = () => {
    if (cardIdx < DEMO_PLACES.length - 1) setCardIdx((i) => i + 1);
  };

  const canGoToSaved = saved.length >= 2;

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header: postep + pomin */}
      <div className="flex items-center justify-between px-5 pt-safe-4 pb-2 shrink-0">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2, 3].map((s) => (
            <span
              key={s}
              className={`h-1.5 rounded-full transition-all ${s === step ? "w-6 bg-primary" : s < step ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"}`}
            />
          ))}
        </div>
        <button onClick={finish} className="text-xs font-semibold text-muted-foreground active:opacity-60">
          Pomiń
        </button>
      </div>

      {/* ── KROK 0: Przegladaj + Zapisz ─────────────────────────────────────── */}
      {step === 0 && (
        <div className="flex-1 flex flex-col min-h-0 px-5">
          <div className="pt-2 pb-4">
            <div className="flex items-center gap-2 text-orange-600 text-xs font-bold mb-1.5">
              <Compass className="h-4 w-4" /> EKSPLORUJ
            </div>
            <h1 className="text-2xl font-black leading-tight">Przeglądaj miejsca i lokalne biznesy</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {`To Twoje miasto (Warszawa). Spodobało się? Zapisz - reszta trafi do wyjazdu.`}
            </p>
          </div>

          {/* Karta miejsca */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <div className="w-full max-w-[320px] rounded-3xl bg-card border border-border/50 shadow-lg overflow-hidden">
              <div className="w-full aspect-[4/3] flex items-center justify-center" style={{ background: currentCard.color }}>
                <span style={{ fontSize: 96 }}>{currentCard.emoji}</span>
              </div>
              <div className="p-4">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-xs font-semibold mb-2">
                  {currentCard.category}
                </span>
                <p className="text-lg font-black leading-tight">{currentCard.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Miejsce {cardIdx + 1} z {DEMO_PLACES.length}</p>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="pb-safe-4 pt-3 flex flex-col gap-2">
            {saved.length > 0 && (
              <p className="text-center text-xs font-semibold text-green-600 flex items-center justify-center gap-1">
                <Check className="h-3.5 w-3.5" /> Zapisane: {saved.length}
              </p>
            )}
            {canGoToSaved ? (
              <button
                onClick={() => setStep(1)}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
              >
                Gotowe - zobacz zapisane <ArrowRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
              >
                <Bookmark className="h-4 w-4" /> Zapisz to miejsce
              </button>
            )}
            {!canGoToSaved && cardIdx < DEMO_PLACES.length - 1 && (
              <button onClick={nextCard} className="w-full py-2.5 rounded-full text-sm font-semibold text-muted-foreground active:scale-[0.98] transition-transform">
                Pokaż inne
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── KROK 1: Zapisane ────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex-1 flex flex-col min-h-0 px-5">
          <div className="pt-2 pb-4">
            <div className="flex items-center gap-2 text-orange-600 text-xs font-bold mb-1.5">
              <Bookmark className="h-4 w-4" /> ZAPISANE
            </div>
            <h1 className="text-2xl font-black leading-tight">Twoje zapisane miejsca</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {`Wszystko co zapiszesz masz w jednym miejscu. Teraz zróbmy z tego wyjazd.`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-2.5">
            {saved.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-2xl border border-border/50 bg-card">
                <PlaceTile p={p} size={56} />
                <div className="min-w-0">
                  <p className="text-sm font-bold truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <Check className="h-5 w-5 text-green-500 ml-auto shrink-0" />
              </div>
            ))}
          </div>
          <div className="pb-safe-4 pt-3">
            <button
              onClick={() => setStep(2)}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
            >
              <Plus className="h-4 w-4" /> Stwórz wyjazd
            </button>
          </div>
        </div>
      )}

      {/* ── KROK 2: Tworzenie wyjazdu ───────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex-1 flex flex-col min-h-0 px-5">
          <div className="pt-2 pb-4">
            <div className="flex items-center gap-2 text-orange-600 text-xs font-bold mb-1.5">
              <Plus className="h-4 w-4" /> NOWY WYJAZD
            </div>
            <h1 className="text-2xl font-black leading-tight">Nazwij swój wyjazd</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {`Wybrane miejsca składają się w wyjazd. Możesz go nazwać jak chcesz.`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Nazwa wyjazdu</label>
            <input
              value={tripName}
              onChange={(e) => setTripName(e.target.value)}
              className="w-full h-12 px-4 rounded-2xl border border-border bg-muted/30 text-sm focus:outline-none focus:border-foreground/30 mb-4"
            />
            <p className="text-xs font-semibold text-muted-foreground mb-2">{saved.length} miejsca w wyjeździe</p>
            <div className="flex flex-col gap-2">
              {saved.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-2xl border border-border/50 bg-card">
                  <span className="h-6 w-6 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                  <PlaceTile p={p} size={44} />
                  <p className="text-sm font-bold truncate">{p.name}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="pb-safe-4 pt-3">
            <button
              onClick={() => setStep(3)}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
            >
              Utwórz wyjazd <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── KROK 3: Dziennik ────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex-1 flex flex-col min-h-0 px-5">
          <div className="pt-2 pb-4">
            <div className="flex items-center gap-2 text-orange-600 text-xs font-bold mb-1.5">
              <BookOpen className="h-4 w-4" /> DZIENNIK
            </div>
            <h1 className="text-2xl font-black leading-tight">Twój wyjazd trafia do dziennika</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {`Tu odhaczysz odwiedzone miejsca i dodasz notki - dla siebie i znajomych.`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {/* Karta wpisu (pocztowka) */}
            <div className="rounded-3xl bg-card border border-border/50 overflow-hidden shadow-sm mb-3">
              <div className="relative w-full aspect-[16/9] bg-gradient-to-br from-orange-300 via-orange-400 to-rose-400 flex items-center justify-center">
                <TrasaLogo size={56} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
                  <p className="text-white font-bold text-lg leading-tight drop-shadow-sm">{tripName || "Mój wyjazd"}</p>
                  <span className="inline-flex items-center gap-1 mt-1 bg-orange-500/90 rounded-full px-2 py-0.5 text-[10px] font-bold text-white">W toku</span>
                </div>
              </div>
              <div className="p-3 flex flex-col gap-2">
                {saved.map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3">
                    <span className="h-5 w-5 rounded-full bg-secondary text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                    <PlaceTile p={p} size={40} />
                    <p className="text-sm font-semibold truncate flex-1">{p.name}</p>
                    <span className="h-7 w-7 rounded-full border border-border flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-orange-50 border border-orange-100 p-3 flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-orange-600 mt-0.5 shrink-0" />
              <p className="text-sm text-foreground/80 leading-relaxed">
                {`Gotowe! Tak wygląda pełna pętla: przeglądasz, zapisujesz, tworzysz wyjazd i prowadzisz dziennik.`}
              </p>
            </div>
          </div>
          <div className="pb-safe-4 pt-3">
            <button
              onClick={finish}
              className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/25"
            >
              Okej! Przechodzę do aplikacji <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Onboarding;
