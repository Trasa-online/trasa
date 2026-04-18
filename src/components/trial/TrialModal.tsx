import { useState, useRef, useEffect, useCallback } from "react";
import { X, Heart, Star, ArrowRight, ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "city" | "categories" | "swipe" | "results";

interface TrialModalProps {
  open: boolean;
  onClose: () => void;
}

interface TrialPlace {
  id: string;
  place_name: string;
  category: string;
  description: string;
  photo_url: string;
  rating: number;
  vibe_tags: string[];
}

// ─── Trial places (10+ per city, independent from mockPlaces) ────────────────
// Photos: specific Unsplash IDs — permanent CDN URLs, browser-cached (1yr)

const u = (id: string) => `https://images.unsplash.com/photo-${id}?w=700&q=75&auto=format&fit=crop`;

const TRIAL_PLACES: Record<string, TrialPlace[]> = {
  Kraków: [
    { id: "k1",  place_name: "Wawel",               category: "monument",   description: "Królewski zamek na wzgórzu z katedrą, smoczą jaskinią i skarbcem.", rating: 4.8, photo_url: u("1519197924294-4ba991a11128"), vibe_tags: ["historia", "widok", "must-see"] },
    { id: "k2",  place_name: "Kościół Mariacki",     category: "monument",   description: "Gotycka bazylika z XIV w. ze słynnym hejnałem i ołtarzem Wita Stwosza.", rating: 4.8, photo_url: u("1477959858617-67f85cf4f1df"),   vibe_tags: ["architektura", "historia"] },
    { id: "k3",  place_name: "Sukiennice",            category: "market",     description: "Renesansowa hala targowa w sercu Rynku — polskie rękodzieło i pamiątki.", rating: 4.6, photo_url: u("1488459716781-31db52582fe9"), vibe_tags: ["zakupy", "centrum"] },
    { id: "k4",  place_name: "Kazimierz",             category: "experience", description: "Historyczna dzielnica pełna galerii, barów i klimatycznych podwórek.", rating: 4.7, photo_url: u("1555396273-367ea4eb4db5"),   vibe_tags: ["klimat", "bary", "historia"] },
    { id: "k5",  place_name: "MOCAK",                 category: "museum",     description: "Muzeum Sztuki Współczesnej w Krakowie — prowokujące wystawy w dawnej fabryce.", rating: 4.4, photo_url: u("1578301978693-85fa9c0320b9"), vibe_tags: ["sztuka", "kultura"] },
    { id: "k6",  place_name: "Muzeum Narodowe",       category: "museum",     description: "Największe muzeum w Polsce z bogatą kolekcją polskiego malarstwa.", rating: 4.5, photo_url: u("1555448248-2571daf6344b"),   vibe_tags: ["sztuka", "malarstwo"] },
    { id: "k7",  place_name: "Kawiarnia Płyś",        category: "cafe",       description: "Kultowa krakowska kawiarnia ze świetną kawą i domowymi ciastkami.", rating: 4.5, photo_url: u("1501339847302-ac426a4a7cbb"), vibe_tags: ["kawa", "klimat", "slow"] },
    { id: "k8",  place_name: "Forum Przestrzenie",    category: "bar",        description: "Bar na tarasie dawnego hotelu Forum z widokiem na Wisłę i Wawel.", rating: 4.4, photo_url: u("1514362545857-3bc16c4c7d1b"), vibe_tags: ["taras", "Wisła", "koktajle"] },
    { id: "k9",  place_name: "Veganico",              category: "restaurant", description: "Wegańska restauracja w centrum — kolorowe miski i smoothie na lunch.", rating: 4.5, photo_url: u("1512621776951-a57141f2eefd"), vibe_tags: ["vege", "zdrowe", "lunch"] },
    { id: "k10", place_name: "Bar Mleczny Centralny", category: "restaurant", description: "Kultowy bar mleczny — pierogi, żurek i kompot w niebiciu cenach.", rating: 4.2, photo_url: u("1414235077428-338989a2e8c0"), vibe_tags: ["tanie", "nostalgiczny", "PRL"] },
    { id: "k11", place_name: "Planty",                category: "park",       description: "Pierścień zieleni okalający Stare Miasto — idealne na poranny spacer.", rating: 4.6, photo_url: u("1533750349088-cd871a92f312"), vibe_tags: ["spacer", "relaks", "natura"] },
    { id: "k12", place_name: "Hala Targowa Kleparz",  category: "market",     description: "Jeden z najstarszych targów w Krakowie — świeże produkty od rolników.", rating: 4.3, photo_url: u("1488459716781-31db52582fe9"), vibe_tags: ["lokalnie", "śniadanie"] },
  ],
  Warszawa: [
    { id: "w1",  place_name: "Stare Miasto",          category: "monument",   description: "Pięknie odbudowane Stare Miasto wpisane na listę UNESCO.", rating: 4.6, photo_url: u("1559827260-dc66d52bef19"),   vibe_tags: ["historia", "spacer", "UNESCO"] },
    { id: "w2",  place_name: "Centrum Nauki Kopernik",category: "experience", description: "Interaktywne muzeum nauki z setkami eksponatów do odkrywania.", rating: 4.7, photo_url: u("1567427017947-545c5f8d16ad"), vibe_tags: ["nauka", "interaktywnie"] },
    { id: "w3",  place_name: "Hala Koszyki",          category: "restaurant", description: "Zabytkowa hala targowa — modne miejsce z kuchnią z całego świata.", rating: 4.5, photo_url: u("1414235077428-338989a2e8c0"), vibe_tags: ["food hall", "różnorodność"] },
    { id: "w4",  place_name: "Muzeum Powstania Warszawskiego", category: "museum", description: "Wstrząsające muzeum poświęcone bohaterom Powstania Warszawskiego 1944.", rating: 4.9, photo_url: u("1555448248-2571daf6344b"), vibe_tags: ["historia", "must-see", "poruszające"] },
    { id: "w5",  place_name: "Łazienki Królewskie",   category: "park",       description: "Piękny park z pałacem na wodzie i pawiem spacerującym po alejkach.", rating: 4.8, photo_url: u("1500534314209-a25ddb2bd429"), vibe_tags: ["park", "pałac", "przyroda"] },
    { id: "w6",  place_name: "Pałac Kultury i Nauki", category: "monument",   description: "Stalionistyczna ikona Warszawy — platforma widokowa z panoramą miasta.", rating: 4.3, photo_url: u("1477959858617-67f85cf4f1df"), vibe_tags: ["widok", "architektura"] },
    { id: "w7",  place_name: "Przekąski Zakąski",     category: "bar",        description: "Legendarny bar przy Nowym Świecie — kultowe kanapki i piwo z beczki.", rating: 4.4, photo_url: u("1514362545857-3bc16c4c7d1b"), vibe_tags: ["bary", "klimat", "kanapki"] },
    { id: "w8",  place_name: "Charlotte Chleb i Wino",category: "cafe",       description: "Paryska kawiarnia na Placu Zbawiciela — świeże bagietki i świetne wino.", rating: 4.6, photo_url: u("1495474472287-4d71bcdd2085"), vibe_tags: ["śniadanie", "wino", "paryski klimat"] },
    { id: "w9",  place_name: "Wilanów",               category: "monument",   description: "Barokowy pałac i ogrody króla Jana III Sobieskiego.", rating: 4.7, photo_url: u("1477959858617-67f85cf4f1df"), vibe_tags: ["pałac", "ogród", "historia"] },
    { id: "w10", place_name: "Nowy Świat",             category: "experience", description: "Reprezentacyjna ulica Warszawy — kawiarnie, sklepy i historia.", rating: 4.5, photo_url: u("1559827260-dc66d52bef19"), vibe_tags: ["spacer", "zakupy", "kawiarnie"] },
    { id: "w11", place_name: "Ogród BUW",              category: "experience", description: "Słynny ogród na dachu Biblioteki UW z widokiem na Wisłę i panoramą miasta.", rating: 4.5, photo_url: u("1533750349088-cd871a92f312"), vibe_tags: ["ogród", "widok", "relaks"] },
  ],
  Łódź: [
    { id: "l1",  place_name: "Manufaktura",           category: "experience", description: "Dawna fabryka Poznańskiego przebudowana w centrum kultury i rozrywki.", rating: 4.6, photo_url: u("1519681393784-d120267933ba"), vibe_tags: ["centrum", "rozrywka", "historia"] },
    { id: "l2",  place_name: "EC1",                   category: "museum",     description: "Dawna elektrownia — interaktywne centrum nauki i planetarium.", rating: 4.5, photo_url: u("1567427017947-545c5f8d16ad"), vibe_tags: ["nauka", "industrialne"] },
    { id: "l3",  place_name: "The Brick Coffee",      category: "cafe",       description: "Kawiarnia specialty w klimatycznym industrialnym wnętrzu.", rating: 4.6, photo_url: u("1501339847302-ac426a4a7cbb"), vibe_tags: ["specialty coffee", "industrialne"] },
    { id: "l4",  place_name: "Przędza",               category: "cafe",       description: "Kawiarnia w pofabrycznym wnętrzu — wyśmienite śniadania i ciasta.", rating: 4.7, photo_url: u("1495474472287-4d71bcdd2085"), vibe_tags: ["śniadania", "klimat"] },
    { id: "l5",  place_name: "Ulica Piotrkowska",     category: "experience", description: "Najdłuższa ulica handlowa w Polsce z kawiarnianymi ogródkami.", rating: 4.5, photo_url: u("1559827260-dc66d52bef19"), vibe_tags: ["spacer", "kawiarnie", "historia"] },
    { id: "l6",  place_name: "Muzeum Miasta Łodzi",   category: "museum",     description: "Pałac Poznańskiego z bogatą kolekcją historii i kultury miasta.", rating: 4.4, photo_url: u("1555448248-2571daf6344b"),   vibe_tags: ["historia", "architektura"] },
    { id: "l7",  place_name: "Księży Młyn",           category: "experience", description: "Osiedle fabryczne Scheiblera — street art i klimatyczne podwórka.", rating: 4.5, photo_url: u("1578301978693-85fa9c0320b9"), vibe_tags: ["street art", "industrialne"] },
    { id: "l8",  place_name: "Bałucki Rynek",         category: "market",     description: "Klimatyczny targ w sercu Bałut — lokalne produkty i antyki.", rating: 4.2, photo_url: u("1488459716781-31db52582fe9"), vibe_tags: ["targ", "lokalne", "antyki"] },
    { id: "l9",  place_name: "Restauracja Esencja",   category: "restaurant", description: "Nowoczesna polska kuchnia — sezonowe menu od lokalnych rolników.", rating: 4.7, photo_url: u("1414235077428-338989a2e8c0"), vibe_tags: ["fine dining", "polska kuchnia"] },
    { id: "l10", place_name: "Park Źródliska",        category: "park",       description: "Piękny park z palmiarniami i ogrodem różanym w centrum miasta.", rating: 4.4, photo_url: u("1533750349088-cd871a92f312"), vibe_tags: ["park", "natura", "relaks"] },
    { id: "l11", place_name: "Orientarium ZOO Łódź",  category: "experience", description: "Największe oceanarium w Polsce — tygrys sumatrzański i piranie.", rating: 4.8, photo_url: u("1567427017947-545c5f8d16ad"), vibe_tags: ["zwierzęta", "rodzina", "egzotyka"] },
  ],
  Gdańsk: [
    { id: "g1",  place_name: "Długi Targ",             category: "monument",   description: "Reprezentacyjna ulica Gdańska z Fontanną Neptuna i Dworem Artusa.", rating: 4.7, photo_url: u("1559827260-dc66d52bef19"),   vibe_tags: ["widok", "kamienice", "centrum"] },
    { id: "g2",  place_name: "Muzeum II Wojny Światowej", category: "museum", description: "Jedno z najważniejszych muzeów historycznych w Europie.", rating: 4.8, photo_url: u("1555448248-2571daf6344b"),   vibe_tags: ["historia", "poruszające", "must-see"] },
    { id: "g3",  place_name: "Westerplatte",           category: "monument",   description: "Półwysep gdzie wybuchła II Wojna Światowa — symbol polskiego oporu.", rating: 4.6, photo_url: u("1519197924294-4ba991a11128"), vibe_tags: ["historia", "patriotyzm"] },
    { id: "g4",  place_name: "Stare Miasto Gdańsk",    category: "experience", description: "Pięknie odbudowane stare miasto z kolorowymi kamienicami przy Motławie.", rating: 4.8, photo_url: u("1587974928442-77dc3e0dba72"), vibe_tags: ["architektura", "spacer"] },
    { id: "g5",  place_name: "Plaża Sopot",            category: "experience", description: "Najdłuższa plaża miejska w Polsce — biały piasek i promenada.", rating: 4.7, photo_url: u("1507525428034-b723cf961d3e"), vibe_tags: ["plaża", "morze", "relaks"] },
    { id: "g6",  place_name: "Molo w Sopocie",         category: "monument",   description: "Najdłuższe molo w Europie — romantyczny spacer z widokiem na morze.", rating: 4.6, photo_url: u("1507525428034-b723cf961d3e"), vibe_tags: ["morze", "spacer", "romantycznie"] },
    { id: "g7",  place_name: "ECS Solidarność",        category: "museum",     description: "Muzeum ruchu Solidarność — nowoczesna narracja o polskiej wolności.", rating: 4.8, photo_url: u("1555448248-2571daf6344b"),   vibe_tags: ["historia", "demokracja"] },
    { id: "g8",  place_name: "Kawiarnia Gunki",        category: "cafe",       description: "Kawiarnia z widokiem na Motławę — najlepszy widok i najlepsza kawa.", rating: 4.7, photo_url: u("1495474472287-4d71bcdd2085"), vibe_tags: ["kawa", "widok", "klimat"] },
    { id: "g9",  place_name: "Restauracja Kubicki",    category: "restaurant", description: "Najstarsza restauracja Gdańska — kuchnia polska z tradycją od 1918 r.", rating: 4.6, photo_url: u("1555396273-367ea4eb4db5"),   vibe_tags: ["tradycja", "polska kuchnia"] },
    { id: "g10", place_name: "Targ Rybny",             category: "market",     description: "Historyczny rynek rybny nad Motławą — świeże ryby i bursztyn.", rating: 4.4, photo_url: u("1488459716781-31db52582fe9"), vibe_tags: ["ryby", "targ", "lokalnie"] },
    { id: "g11", place_name: "Oliwski Park i Katedra", category: "park",       description: "Piękny park botaniczny z barokową katedrą i słynnymi organami.", rating: 4.7, photo_url: u("1533750349088-cd871a92f312"), vibe_tags: ["park", "muzyka organowa", "natura"] },
  ],
};

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
      <div className="absolute inset-x-0 top-0 h-16 pointer-events-none z-10 bg-gradient-to-b from-white to-transparent" />
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
          const cls =
            dist === 0 ? "text-4xl font-black text-foreground" :
            dist === 1 ? "text-2xl font-semibold text-foreground/50" :
            "text-xl font-medium text-foreground/20";
          return (
            <div
              key={c}
              onClick={() => { setIdx(i); onSelect(c); scrollRef.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" }); }}
              className={`flex items-center justify-center cursor-pointer select-none transition-all duration-150 ${cls}`}
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
  place, onLike, onSkip, isTop,
}: {
  place: TrialPlace; onLike: () => void; onSkip: () => void; isTop: boolean;
}) {
  const [exitDir, setExitDir] = useState<ExitDir>(null);

  const fire = useCallback((dir: ExitDir, cb: () => void) => {
    setExitDir(dir);
    setTimeout(cb, 320);
  }, []);

  if (!isTop) {
    return (
      <div className="absolute inset-0 rounded-3xl overflow-hidden scale-[0.96] -translate-y-2 opacity-60">
        <img src={place.photo_url} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
      </div>
    );
  }

  return (
    <div
      className="absolute inset-0 rounded-3xl overflow-hidden shadow-xl"
      style={
        exitDir === "right" ? { transform: "translateX(120%) rotate(15deg)", opacity: 0, transition: "all 0.32s ease-in" } :
        exitDir === "left"  ? { transform: "translateX(-120%) rotate(-15deg)", opacity: 0, transition: "all 0.32s ease-in" } :
        {}
      }
    >
      <img src={place.photo_url} alt={place.place_name} className="w-full h-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      <div className="absolute bottom-20 left-4 right-4">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="flex items-center gap-0.5 text-xs font-bold text-amber-400">
            <Star className="h-3 w-3 fill-amber-400" />{place.rating.toFixed(1)}
          </span>
          <span className="text-white/50 text-xs">·</span>
          <span className="text-white/70 text-xs capitalize">{place.category}</span>
        </div>
        <h3 className="text-white font-black text-2xl leading-tight">{place.place_name}</h3>
        <p className="text-white/70 text-xs mt-1 line-clamp-2 leading-relaxed">{place.description}</p>
        <div className="flex flex-wrap gap-1 mt-2">
          {place.vibe_tags.slice(0, 3).map(t => (
            <span key={t} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 text-white backdrop-blur-sm">
              #{t}
            </span>
          ))}
        </div>
      </div>

      <div className="absolute bottom-4 left-0 right-0 flex justify-center items-center gap-5">
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
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function TrialModal({ open, onClose }: TrialModalProps) {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("city");
  const [city, setCity] = useState("Kraków");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [cardIdx, setCardIdx] = useState(0);
  const [liked, setLiked] = useState<TrialPlace[]>([]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (open) { setStep("city"); setCity("Kraków"); setSelectedCat(null); setCardIdx(0); setLiked([]); }
  }, [open]);

  // Selected category places first, rest after — always 10+ cards
  const allCityPlaces = TRIAL_PLACES[city] ?? [];
  const swipePlaces = selectedCat
    ? [...allCityPlaces.filter(p => p.category === selectedCat), ...allCityPlaces.filter(p => p.category !== selectedCat)]
    : allCityPlaces;

  const currentCard = swipePlaces[cardIdx];
  const nextCard = swipePlaces[cardIdx + 1];
  const isDone = cardIdx >= swipePlaces.length;

  const handleLike = useCallback(() => {
    if (currentCard) setLiked(prev => [...prev, currentCard]);
    setCardIdx(i => i + 1);
  }, [currentCard]);

  const handleSkip = useCallback(() => setCardIdx(i => i + 1), []);

  const stepNum = step === "city" ? 1 : step === "categories" ? 2 : step === "swipe" ? 3 : 4;

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white w-full sm:max-w-sm sm:rounded-3xl rounded-t-3xl overflow-hidden shadow-2xl flex flex-col" style={{ maxHeight: "90dvh" }}>

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
              {[1, 2, 3, 4].map(n => (
                <div key={n} className={`h-1.5 rounded-full transition-all duration-300 ${n <= stepNum ? "bg-orange-500 w-5" : "bg-slate-200 w-1.5"}`} />
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
              <h2 className="text-2xl font-black">Wybierz miasto</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Gdzie planujesz wyjazd?</p>
            </div>
            <div className="flex-1 overflow-hidden">
              <CityDrum city={city} onSelect={setCity} />
            </div>
            <div className="px-5 pb-6 pt-3 shrink-0">
              <button onClick={() => setStep("categories")} className="w-full h-12 rounded-full font-bold text-white text-base shadow-lg active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}>
                Dalej
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2: Category (single select) ── */}
        {step === "categories" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="px-5 mb-4">
              <h2 className="text-2xl font-black">Co wybierasz?</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Wybierz jedną kategorię</p>
            </div>
            <div className="flex-1 overflow-y-auto px-5">
              <div className="grid grid-cols-2 gap-2 pb-4">
                {CATS.map(cat => {
                  const active = selectedCat === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCat(active ? null : cat.id)}
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
              <button onClick={() => { setCardIdx(0); setLiked([]); setStep("swipe"); }} className="w-full h-12 rounded-full font-bold text-white text-base shadow-lg active:scale-95 transition-transform" style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}>
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
                  <h2 className="text-xl font-black">{city} <span className="text-muted-foreground font-medium text-base">· odkrywaj</span></h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isDone ? "Wszystkie miejsca przejrzane!" : `${swipePlaces.length - cardIdx} pozostałych`}
                  </p>
                </div>
                {liked.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-full">
                    <Heart className="h-3 w-3 fill-orange-600" /> {liked.length}
                  </span>
                )}
              </div>
            </div>

            <div className="relative mx-5" style={{ height: 380 }}>
              {isDone ? (
                <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                  <div className="text-5xl">🎉</div>
                  <p className="font-black text-xl">Koniec kart!</p>
                  <p className="text-sm text-muted-foreground">{liked.length > 0 ? `Wybrałeś ${liked.length} ${liked.length === 1 ? "miejsce" : "miejsca"}` : "Spróbuj inną kategorię"}</p>
                </div>
              ) : (
                <>
                  {nextCard && <SwipeCard key={`bg-${cardIdx + 1}`} place={nextCard} onLike={() => {}} onSkip={() => {}} isTop={false} />}
                  <SwipeCard key={`top-${cardIdx}`} place={currentCard} onLike={handleLike} onSkip={handleSkip} isTop={true} />
                </>
              )}
            </div>

            <div className="px-5 pb-6 pt-4 shrink-0">
              <button
                onClick={() => setStep("results")}
                disabled={liked.length === 0}
                className={`w-full h-12 rounded-full font-bold text-base transition-all active:scale-95 ${liked.length > 0 ? "text-white shadow-lg" : "bg-slate-100 text-slate-400 cursor-not-allowed"}`}
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
              <h2 className="text-2xl font-black">Twoja trasa ✨</h2>
              <p className="text-sm text-muted-foreground mt-0.5">{liked.length} {liked.length === 1 ? "miejsce" : liked.length < 5 ? "miejsca" : "miejsc"} · {city}</p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 space-y-2 pb-2">
              {liked.map((place, i) => (
                <div key={place.id} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="h-6 w-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 text-xs font-black text-orange-600">{i + 1}</div>
                  <img src={place.photo_url} alt="" className="h-10 w-10 rounded-xl object-cover shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{place.place_name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{place.category}</p>
                  </div>
                  <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-500 shrink-0">
                    <Star className="h-3 w-3 fill-amber-400" />{place.rating}
                  </span>
                </div>
              ))}
            </div>

            <div className="px-5 pb-6 pt-4 shrink-0 border-t border-slate-100">
              <button
                onClick={() => navigate("/auth?tab=register")}
                className="w-full py-3.5 rounded-full font-black text-white text-base shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-transform"
                style={{ background: "linear-gradient(135deg, #F4A259, #F9662B)" }}
              >
                Tworzę konto na trasie <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
