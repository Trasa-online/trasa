import { useState } from "react";
import { Check, MapPin, PlusCircle, Send, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface HomeTourProps {
  onDone: () => void;
}

// ── Phone frame wrapper ───────────────────────────────────────────────────────

const PhoneFrame = ({ children }: { children: React.ReactNode }) => (
  <div className="w-[220px] h-[380px] sm:w-[240px] sm:h-[420px] rounded-[32px] border-2 border-foreground/10 bg-background shadow-2xl overflow-hidden flex flex-col shrink-0">
    <div className="h-5 shrink-0 flex items-end justify-center pb-1">
      <div className="w-10 h-1 bg-foreground/10 rounded-full" />
    </div>
    <div className="flex-1 min-h-0 relative">
      {children}
    </div>
  </div>
);

// ── Slide visuals ─────────────────────────────────────────────────────────────

/** Slide 1 — CTA button highlighted */
const Visual1 = () => (
  <PhoneFrame>
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 px-3 pt-1 overflow-hidden">
        <div className="flex flex-col items-center pt-2 pb-3">
          <div className="h-9 w-9 rounded-full bg-muted" />
          <div className="h-2 w-14 bg-muted rounded-full mt-1.5" />
          <div className="flex gap-1 mt-1.5">
            <div className="h-1.5 w-10 bg-muted/70 rounded-full" />
            <div className="h-1.5 w-10 bg-muted/70 rounded-full" />
          </div>
        </div>
        <div className="h-2.5 w-24 bg-foreground rounded-full mb-2" />
        <div className="rounded-xl border border-border bg-card p-2.5 space-y-1.5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="h-2.5 w-16 bg-foreground rounded-full" />
              <div className="h-1.5 w-20 bg-muted rounded-full" />
            </div>
            <div className="text-right space-y-1">
              <div className="h-2 w-12 bg-muted rounded-full" />
              <div className="h-1.5 w-10 bg-muted/70 rounded-full" />
            </div>
          </div>
        </div>
      </div>
      <div className="relative bg-foreground px-3 py-2.5 shrink-0">
        <div className="absolute inset-0 ring-2 ring-yellow-400 ring-inset rounded-none" />
        <div className="bg-card rounded-lg px-2 py-1.5 flex items-center justify-center gap-1.5">
          <PlusCircle className="h-3 w-3 text-foreground" />
          <span className="text-[9px] font-semibold text-foreground">Zaplanuj swoją podróż</span>
        </div>
      </div>
    </div>
  </PhoneFrame>
);

/** Slide 2 — Create: preferences form */
const Visual2 = () => (
  <PhoneFrame>
    <div className="h-full px-3 pt-2 pb-3 overflow-hidden bg-background space-y-2">
      <div>
        <div className="h-1.5 w-16 bg-muted rounded-full mb-1.5" />
        <div className="border border-border rounded-lg px-2.5 py-1.5 bg-card">
          <span className="text-[9px] text-foreground/70">Kraków</span>
        </div>
      </div>
      <div>
        <div className="h-1.5 w-10 bg-muted rounded-full mb-1.5" />
        <div className="flex gap-1">
          {(["1 dzień", "2 dni", "3 dni"] as const).map((d, i) => (
            <div key={d} className={cn("flex-1 rounded-lg py-1.5 text-center text-[8px] font-medium border", i === 1 ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground")}>
              {d}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="h-1.5 w-14 bg-muted rounded-full mb-1.5" />
        <div className="flex gap-1">
          {(["⚡ Aktywne", "⚖️ Mieszane", "☕ Spokojne"] as const).map((p, i) => (
            <div key={p} className={cn("flex-1 rounded-lg py-1.5 text-center text-[8px] font-medium border", i === 1 ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground")}>
              {p}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="h-1.5 w-24 bg-muted rounded-full mb-1.5" />
        <div className="flex flex-wrap gap-1">
          {(["🍽️ Jedzenie", "🌅 Widoki", "🏛️ Muzea", "🎭 Klimaty"] as const).map((p, i) => (
            <div key={p} className={cn("rounded-full px-1.5 py-0.5 text-[7px] font-medium border", i < 2 ? "bg-foreground text-background border-foreground" : "bg-card border-border text-foreground")}>
              {p}
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="h-1.5 w-14 bg-muted rounded-full mb-1.5" />
        <div className="border border-border rounded-lg px-2 py-1.5 bg-card flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 bg-muted rounded-sm shrink-0" />
          <span className="text-[9px] text-muted-foreground/60">01.03.2025</span>
        </div>
      </div>
      <div className="bg-foreground rounded-lg py-1.5 text-center text-[9px] text-background font-semibold">
        Dalej
      </div>
    </div>
  </PhoneFrame>
);

/** Slide 3 — AI chat + plan + decision buttons */
const Visual3 = () => (
  <PhoneFrame>
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 px-2.5 pt-2 overflow-hidden space-y-1.5">
        <div className="flex justify-start">
          <div className="bg-card rounded-2xl rounded-bl-sm px-2.5 py-1.5 max-w-[85%] shadow-sm">
            <p className="text-[8px] text-foreground leading-relaxed">
              Cześć! Przygotowałem plan dla Ciebie — Kraków 2 dni z kulturą i smakami 🎉
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-foreground rounded-2xl rounded-br-sm px-2.5 py-1.5 max-w-[65%]">
            <p className="text-[8px] text-background">Brzmi świetnie!</p>
          </div>
        </div>
        <div className="border border-border rounded-xl bg-card p-2 space-y-1">
          <div className="h-1.5 w-14 bg-foreground/80 rounded-full" />
          {[["1","9:00"],["2","11:30"],["3","14:00"]].map(([num, time]) => (
            <div key={num} className="flex items-center gap-1.5 px-0.5">
              <div className="h-4 w-4 rounded-full bg-foreground flex items-center justify-center shrink-0">
                <span className="text-[6px] text-background font-bold">{num}</span>
              </div>
              <div className="flex-1 h-1.5 bg-foreground/60 rounded-full" />
              <div className="h-1.5 w-5 bg-muted rounded-full shrink-0" />
            </div>
          ))}
        </div>
        <div className="flex gap-1.5">
          <div className="flex-1 bg-foreground rounded-lg py-1.5 text-center text-[7px] text-background font-semibold">
            Wybieram ten plan!
          </div>
          <div className="flex-1 border border-border bg-card rounded-lg py-1.5 text-center text-[7px] text-foreground">
            Wprowadź zmiany
          </div>
        </div>
      </div>
      <div className="border-t border-border/40 px-2.5 py-2 flex gap-1.5 items-center shrink-0">
        <div className="flex-1 bg-card border border-border/60 rounded-lg px-2 py-1">
          <div className="h-1.5 w-16 bg-muted rounded-full" />
        </div>
        <div className="h-6 w-6 bg-foreground rounded-full flex items-center justify-center shrink-0">
          <Send className="h-2.5 w-2.5 text-background" />
        </div>
      </div>
    </div>
  </PhoneFrame>
);

/** Slide 4 — Route summary modal */
const Visual4 = () => (
  <PhoneFrame>
    <div className="relative h-full bg-background">
      <div className="absolute inset-0 bg-background/40" />
      <div className="absolute inset-x-2 top-3 bottom-3 bg-card rounded-2xl shadow-2xl border border-border overflow-hidden flex flex-col">
        <div className="px-3 pt-3 pb-2 flex items-start justify-between shrink-0">
          <div className="h-2.5 w-28 bg-foreground rounded-full" />
          <div className="h-4 w-4 rounded bg-muted" />
        </div>
        <div className="h-px bg-border mx-3 shrink-0" />
        <div className="mx-3 mt-2 h-16 rounded-xl bg-muted/50 border border-border flex items-center justify-center shrink-0">
          <MapPin className="h-4 w-4 text-muted-foreground/40" />
        </div>
        <div className="flex-1 px-3 pt-2.5 space-y-2 overflow-hidden">
          {[true, false, false].map((filled, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={cn("h-2.5 w-2.5 rounded-full border shrink-0", filled ? "bg-foreground border-foreground" : "bg-background border-border")} />
              <div className="h-1.5 w-6 bg-muted rounded-full shrink-0" />
              <div className="h-1.5 flex-1 bg-foreground/50 rounded-full" />
            </div>
          ))}
        </div>
        <div className="px-3 pb-3 space-y-1.5 shrink-0">
          <div className="bg-foreground rounded-lg py-1.5 text-center text-[8px] text-background font-semibold">
            Przechodzę dalej
          </div>
          <div className="border border-border bg-card rounded-lg py-1.5 text-center text-[8px] text-foreground">
            Cofnij do edycji
          </div>
        </div>
      </div>
    </div>
  </PhoneFrame>
);

/** Slide 5 — Home: active trip with check-in */
const Visual5 = () => (
  <PhoneFrame>
    <div className="h-full flex flex-col bg-background px-3 pt-2">
      <div className="flex flex-col items-center pt-1 pb-2">
        <div className="h-7 w-7 rounded-full bg-muted" />
        <div className="h-1.5 w-12 bg-muted rounded-full mt-1" />
      </div>
      <div className="h-2.5 w-24 bg-foreground rounded-full mb-2" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-2.5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="h-2.5 w-14 bg-foreground rounded-full" />
              <div className="h-1.5 w-20 bg-muted rounded-full" />
            </div>
            <div className="h-2 w-10 bg-muted rounded-full" />
          </div>
        </div>
        <div className="border-t border-border px-2.5 py-2 space-y-1.5">
          <div className="h-1.5 w-16 bg-muted/70 rounded-full mb-1" />
          {[true, false, false].map((checked, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className={cn("h-4 w-4 rounded border flex items-center justify-center shrink-0", checked ? "bg-foreground border-foreground" : "border-border bg-background")}>
                {checked && <Check className="h-2.5 w-2.5 text-background" />}
              </div>
              <div className={cn("h-1.5 rounded-full", checked ? "w-12 bg-muted" : "w-16 bg-foreground/60")} />
            </div>
          ))}
          <div className="bg-foreground rounded-lg py-1 mt-1 text-center text-[8px] text-background font-medium">
            Zakończ dzień i podsumuj z AI
          </div>
        </div>
      </div>
    </div>
  </PhoneFrame>
);

/** Slide 6 — Home after completed day: "Opowiadam o dniu!" CTA */
const Visual6 = () => (
  <PhoneFrame>
    <div className="h-full flex flex-col bg-background px-3 pt-2">
      <div className="flex flex-col items-center pt-1 pb-2">
        <div className="h-7 w-7 rounded-full bg-muted" />
        <div className="h-1.5 w-12 bg-muted rounded-full mt-1" />
      </div>
      <div className="h-2.5 w-24 bg-foreground rounded-full mb-2" />
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-2.5">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <div className="h-2.5 w-14 bg-foreground rounded-full" />
              <div className="h-1.5 w-20 bg-muted rounded-full" />
            </div>
            <div className="h-2 w-10 bg-muted rounded-full" />
          </div>
        </div>
        {/* All pins checked */}
        <div className="border-t border-border px-2.5 py-2 space-y-1.5">
          {[true, true, true].map((_, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="h-4 w-4 rounded border bg-foreground border-foreground flex items-center justify-center shrink-0">
                <Check className="h-2.5 w-2.5 text-background" />
              </div>
              <div className="h-1.5 rounded-full w-12 bg-muted" />
            </div>
          ))}
        </div>
        {/* "Opowiadam o dniu!" button highlighted */}
        <div className="border-t border-border px-2.5 py-2">
          <div className="relative bg-foreground rounded-lg py-1.5 flex items-center justify-center gap-1.5">
            <div className="absolute inset-0 ring-2 ring-yellow-400 ring-inset rounded-lg" />
            <MessageSquare className="h-2.5 w-2.5 text-background" />
            <span className="text-[8px] text-background font-semibold">Opowiadam o dniu!</span>
          </div>
        </div>
      </div>
    </div>
  </PhoneFrame>
);

/** Slide 7 — AI guide chat about the day */
const Visual7 = () => (
  <PhoneFrame>
    <div className="h-full flex flex-col bg-background">
      <div className="flex-1 px-2.5 pt-2 overflow-hidden space-y-1.5">
        <div className="flex justify-start">
          <div className="bg-card rounded-2xl rounded-bl-sm px-2.5 py-1.5 max-w-[85%] shadow-sm">
            <p className="text-[8px] text-foreground leading-relaxed">
              Cześć! Jak minął Twoj dzien w Krakowie? Wszystko zgodnie z planem? 😊
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-foreground rounded-2xl rounded-br-sm px-2.5 py-1.5 max-w-[70%]">
            <p className="text-[8px] text-background">Tak, bylo super!</p>
          </div>
        </div>
        <div className="flex justify-start">
          <div className="bg-card rounded-2xl rounded-bl-sm px-2.5 py-1.5 max-w-[85%] shadow-sm">
            <p className="text-[8px] text-foreground leading-relaxed">
              Swietnie! Co bylo najlepszym momentem dnia? 🌟
            </p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="bg-foreground rounded-2xl rounded-br-sm px-2.5 py-1.5 max-w-[65%]">
            <p className="text-[8px] text-background">Wawel byl niesamowity!</p>
          </div>
        </div>
        {/* Typing indicator */}
        <div className="flex justify-start">
          <div className="bg-card rounded-2xl rounded-bl-sm px-3 py-2 shadow-sm">
            <div className="flex gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
              <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-border/40 px-2.5 py-2 flex gap-1.5 items-center shrink-0">
        <div className="flex-1 bg-card border border-border/60 rounded-lg px-2 py-1">
          <div className="h-1.5 w-16 bg-muted rounded-full" />
        </div>
        <div className="h-6 w-6 bg-foreground rounded-full flex items-center justify-center shrink-0">
          <Send className="h-2.5 w-2.5 text-background" />
        </div>
      </div>
    </div>
  </PhoneFrame>
);

// ── Slide definitions ─────────────────────────────────────────────────────────

interface Slide {
  visual?: React.ReactNode;
  isClosing?: boolean;
  title: string;
  description: React.ReactNode;
}

const SLIDES: Slide[] = [
  {
    visual: <Visual1 />,
    title: "Twoja podróż zaczyna się tutaj",
    description: (
      <>
        Guzik na dole ekranu to centrum Trasy. Kliknij i{" "}
        <strong>zaplanuj swoją podróż w mniej niż 10 minut!</strong>
      </>
    ),
  },
  {
    visual: <Visual2 />,
    title: "Zacznij od podstawowych informacji",
    description:
      "Miasto, liczba dni, tempo podróży i priorytety - im więcej wypełnisz, tym lepiej Twój przewodnik dopasuje plan do Twoich oczekiwań.",
  },
  {
    visual: <Visual3 />,
    title: '„Hej! Tu Twój przewodnik!"',
    description:
      "O nic się nie martw — opowiedz o swojej wymarzonej podróży i plan gotowy.",
  },
  {
    visual: <Visual4 />,
    title: "...i cyk! Plan gotowy",
    description:
      "Widzisz wszystkie miejsca na mapie oraz szacunkowy czas, którego będziesz potrzebować. Gotowy plan znajdziesz w swoich aktywnych podróżach.",
  },
  {
    visual: <Visual5 />,
    title: "Odhaczaj odwiedzone miejsca",
    description:
      "W dniu wyjazdu Twoja trasa pojawi się na ekranie głównym. Odhaczaj odwiedzone miejsca, aby mieć nad wszystkim kontrolę.",
  },
  {
    visual: <Visual6 />,
    title: "Oceń swój dzień",
    description:
      "Dzień się kończy, wiele się wydarzyło — to dobry moment by go podsumować!",
  },
  {
    visual: <Visual7 />,
    title: '„Czy wszystko poszło zgodnie z planem?"',
    description:
      "Opowiedz o przebiegu zaplanowanego dnia — to pomoże Twojemu przewodnikowi tworzyć coraz lepsze trasy!",
  },
  {
    isClosing: true,
    title: "Gotowy na nowe, lepsze doświadczenie planowania podróży?",
    description: "",
  },
];

// ── Main component ────────────────────────────────────────────────────────────

const HomeTour = ({ onDone }: HomeTourProps) => {
  const [step, setStep] = useState(0);
  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  const next = () => {
    if (!isLast) setStep((s) => s + 1);
    else onDone();
  };

  if (slide.isClosing) {
    return (
      <div className="fixed inset-0 z-[60] bg-background flex flex-col items-center justify-center px-8 text-center">
        <p className="text-5xl mb-6">🗺️</p>
        <h2 className="text-3xl font-black tracking-tight leading-tight mb-4">
          Gotowy na nowe, lepsze doświadczenie planowania podróży?
        </h2>
        <p className="text-sm text-muted-foreground mb-10 max-w-xs">
          Wszystko, czego potrzebujesz — planer, mapa, dziennik — w jednym miejscu.
        </p>
        <Button
          size="lg"
          onClick={onDone}
          className="w-full max-w-xs rounded-full font-semibold text-base"
        >
          Tak! Zaczynajmy
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] bg-background flex flex-col">
      {/* Progress bar */}
      <div className="px-5 pt-12 pb-0 shrink-0">
        <div className="flex gap-1">
          {SLIDES.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-all duration-300",
                i <= step ? "bg-foreground" : "bg-border"
              )}
            />
          ))}
        </div>
      </div>

      {/* Skip button */}
      <div className="flex justify-end px-5 pt-2 shrink-0">
        <button onClick={onDone} className="text-xs text-muted-foreground px-2 py-1">
          Pomiń
        </button>
      </div>

      {/* Visual mockup */}
      <div className="flex-1 flex items-center justify-center px-6 min-h-0 overflow-hidden">
        {slide.visual}
      </div>

      {/* Text + navigation */}
      <div className="px-6 pb-10 shrink-0 space-y-2">
        <h2 className="text-2xl font-black tracking-tight leading-tight">
          {slide.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {slide.description}
        </p>
        <div className="pt-4">
          <Button
            size="lg"
            onClick={next}
            className="w-full rounded-full font-semibold"
          >
            Dalej →
          </Button>
        </div>
      </div>
    </div>
  );
};

export default HomeTour;
