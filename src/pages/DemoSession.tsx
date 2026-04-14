import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import PlaceSwiper from "@/components/plan-wizard/PlaceSwiper";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Copy, Check, Users, MapPin, ChevronRight, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────

const DEMO_CITIES = ["Kraków", "Gdańsk", "Warszawa", "Wrocław"];

const DEMO_CATEGORIES = [
  { id: "Kawiarnia",   label: "Kawiarnia",   emoji: "☕",  dbValue: "cafe" },
  { id: "Restauracja", label: "Restauracja", emoji: "🍽️", dbValue: "restaurant" },
  { id: "Bar",         label: "Bar",         emoji: "🍺",  dbValue: "bar" },
  { id: "Muzeum",      label: "Muzeum",      emoji: "🏛️", dbValue: "museum" },
  { id: "Park",        label: "Park",        emoji: "🌿",  dbValue: "park" },
  { id: "Rozrywka",    label: "Rozrywka",    emoji: "🎪",  dbValue: "experience" },
];

type Step = "city" | "lobby" | "category" | "swipe" | "results";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = Math.imul(31, h) + seed.charCodeAt(i) | 0;
  const rand = () => { h ^= h << 13; h ^= h >> 17; h ^= h << 5; return (h >>> 0) / 4294967296; };
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ─── DemoSession ──────────────────────────────────────────────────────────────

export default function DemoSession() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("city");
  const [city, setCity] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(searchParams.get("code"));
  const [userId, setUserId] = useState<string | null>(null);
  const [isCreator, setIsCreator] = useState(false);
  const [category, setCategory] = useState<string | null>(null);
  const [placeIds, setPlaceIds] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const initDone = useRef(false);

  // ── Anonymous auth ────────────────────────────────────────────────────────

  useEffect(() => {
    if (initDone.current) return;
    initDone.current = true;
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) { setUserId(user.id); setInitializing(false); return; }
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        toast.error("Nie udało się uruchomić demo");
        return;
      }
      setUserId(data.user.id);
      setInitializing(false);
    };
    init();
  }, []);

  // ── Join via share code ───────────────────────────────────────────────────

  useEffect(() => {
    const code = searchParams.get("code");
    if (!code || !userId || initializing) return;
    const joinExisting = async () => {
      const { data: session } = await (supabase as any)
        .from("group_sessions")
        .select("id, city, categories, current_category_index, created_by")
        .eq("join_code", code)
        .eq("is_demo", true)
        .maybeSingle();
      if (!session) { toast.error("Nie znaleziono sesji demo"); return; }
      setSessionId(session.id);
      setCity(session.city);
      setJoinCode(code);
      setIsCreator(session.created_by === userId);
      await supabase.rpc("join_group_session" as any, { p_session_id: session.id });
      queryClient.invalidateQueries({ queryKey: ["demo-members", session.id] });
      const cats: string[] = session.categories ?? [];
      if (cats.length > 0) {
        const cat = cats[session.current_category_index ?? 0] ?? cats[0];
        setCategory(cat);
        await loadPlaceIds(session.city, cat, session.id);
        setStep("swipe");
      } else {
        setStep("lobby");
      }
    };
    joinExisting();
  }, [userId, initializing]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const loadPlaceIds = async (c: string, cat: string, sid: string) => {
    const dbValue = DEMO_CATEGORIES.find(d => d.id === cat)?.dbValue ?? cat;
    const { data } = await (supabase as any)
      .from("places")
      .select("id")
      .ilike("city", c)
      .eq("category", dbValue)
      .eq("is_active", true)
      .order("id")
      .limit(40);
    const shuffled = seededShuffle(data ?? [], sid + cat);
    setPlaceIds(shuffled.slice(0, 10).map((p: any) => p.id));
  };

  const loadCategoryCounts = async (c: string) => {
    const { data } = await (supabase as any)
      .from("places")
      .select("category")
      .ilike("city", c)
      .eq("is_active", true);
    const counts: Record<string, number> = {};
    for (const row of data ?? []) counts[row.category] = (counts[row.category] ?? 0) + 1;
    setCategoryCounts(counts);
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCitySelect = async (selectedCity: string) => {
    if (!userId) return;
    setCity(selectedCity);
    await loadCategoryCounts(selectedCity);
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { data: session, error } = await (supabase as any)
      .from("group_sessions")
      .insert({ city: selectedCity, created_by: userId, join_code: code, is_demo: true })
      .select()
      .single();
    if (error || !session) { toast.error("Błąd tworzenia sesji demo"); return; }
    setSessionId(session.id);
    setJoinCode(code);
    setIsCreator(true);
    await supabase.rpc("join_group_session" as any, { p_session_id: session.id });
    setStep("lobby");
  };

  const handleStartSolo = () => setStep("category");

  const handleCategorySelect = async (cat: string) => {
    if (!sessionId) return;
    setCategory(cat);
    await (supabase as any)
      .from("group_sessions")
      .update({ categories: [cat], current_category_index: 0 })
      .eq("id", sessionId);
    await loadPlaceIds(city, cat, sessionId);
    setStep("swipe");
  };

  const handleSwipeComplete = () => setStep("results");

  const handleCopyLink = () => {
    const url = `${window.location.origin}/demo?code=${joinCode}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Poll for category set by creator (non-creator waits) ──────────────────

  const { data: sessionData } = useQuery({
    queryKey: ["demo-session", sessionId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_sessions")
        .select("categories, current_category_index")
        .eq("id", sessionId!)
        .single();
      return data;
    },
    enabled: !!sessionId && step === "lobby" && !isCreator,
    refetchInterval: 3000,
  });

  useEffect(() => {
    if (!sessionData || isCreator || step !== "lobby") return;
    const cats: string[] = sessionData.categories ?? [];
    if (cats.length > 0) {
      const cat = cats[sessionData.current_category_index ?? 0] ?? cats[0];
      setCategory(cat);
      if (sessionId) loadPlaceIds(city, cat, sessionId);
      setStep("swipe");
    }
  }, [sessionData]);

  // ── Members query ─────────────────────────────────────────────────────────

  const { data: members = [] } = useQuery({
    queryKey: ["demo-members", sessionId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_members")
        .select("user_id")
        .eq("session_id", sessionId!);
      return data ?? [];
    },
    enabled: !!sessionId && (step === "lobby" || step === "category"),
    refetchInterval: 3000,
  });

  // ── Results: liked places ─────────────────────────────────────────────────

  const { data: reactions = [] } = useQuery({
    queryKey: ["demo-reactions", sessionId, userId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("group_session_reactions")
        .select("place_name, photo_url, reaction, user_id")
        .eq("session_id", sessionId!)
        .in("reaction", ["liked", "super_liked"]);
      return data ?? [];
    },
    enabled: !!sessionId && step === "results",
  });

  const myLikes = reactions.filter((r: any) => r.user_id === userId);
  const isSolo = members.length <= 1;
  const matchedPlaces = isSolo
    ? myLikes
    : myLikes.filter((r: any) =>
        reactions.some((r2: any) => r2.place_name === r.place_name && r2.user_id !== userId)
      );

  // ── Loading ───────────────────────────────────────────────────────────────

  if (initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex gap-1.5">
          {[0,1,2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-orange-600 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={() => navigate("/")} className="h-9 w-9 flex items-center justify-center -ml-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-sm leading-tight">Trasa Demo</p>
          {city && <p className="text-xs text-muted-foreground">{city}</p>}
        </div>
        <span className="text-xs bg-orange-600/10 text-orange-600 font-semibold px-2.5 py-1 rounded-full">
          Demo
        </span>
      </div>

      {/* ── STEP: city ── */}
      {step === "city" && (
        <div className="flex-1 flex flex-col px-5 pt-6 pb-8 gap-6 overflow-y-auto">
          <div>
            <p className="text-2xl font-black mb-1">Wypróbuj bez konta</p>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Wybierz miasto i paruj miejsca — solo lub z kimś. Żadnego rejestrowania.
            </p>
          </div>
          <div className="space-y-2">
            {DEMO_CITIES.map(c => (
              <button
                key={c}
                onClick={() => handleCitySelect(c)}
                className="w-full flex items-center justify-between px-4 py-4 rounded-2xl border border-border/50 bg-card active:scale-[0.98] transition-transform"
              >
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-orange-600" />
                  <span className="font-semibold">{c}</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
              </button>
            ))}
          </div>
          <div className="mt-auto rounded-2xl bg-muted/50 px-4 py-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">Masz już konto?</p>
            <button onClick={() => navigate("/auth")} className="text-sm font-semibold text-orange-600">
              Zaloguj się →
            </button>
          </div>
        </div>
      )}

      {/* ── STEP: lobby ── */}
      {step === "lobby" && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6 text-center">
          <div className="h-20 w-20 rounded-full bg-orange-600/10 flex items-center justify-center">
            <Users className="h-10 w-10 text-orange-600" />
          </div>
          <div>
            <p className="text-xl font-black mb-1">Sesja gotowa!</p>
            <p className="text-sm text-muted-foreground">
              Zaproś kogoś lub zacznij sam.
            </p>
          </div>

          {/* Share link */}
          <div className="w-full rounded-2xl border border-border/40 bg-card p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Link do dołączenia</p>
            <p className="text-xs text-muted-foreground break-all bg-muted rounded-xl px-3 py-2">
              {window.location.origin}/demo?code={joinCode}
            </p>
            <button
              onClick={handleCopyLink}
              className="w-full py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.97] transition-transform"
            >
              {copied ? <><Check className="h-4 w-4" />Skopiowano!</> : <><Copy className="h-4 w-4" />Skopiuj link</>}
            </button>
          </div>

          {members.length > 1 && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <Check className="h-4 w-4" />
              {members.length} osoby w sesji
            </div>
          )}

          <div className="w-full space-y-2">
            {isCreator && (
              <button
                onClick={handleStartSolo}
                className="w-full py-4 rounded-2xl bg-orange-600 text-white font-bold text-base active:scale-[0.97] transition-transform"
              >
                {members.length > 1 ? "Wybierz kategorię →" : "Zacznij solo →"}
              </button>
            )}
            {!isCreator && (
              <div className="flex flex-col items-center gap-2 py-4">
                <div className="flex gap-1">
                  {[0,1,2].map(i => <div key={i} className="h-2 w-2 rounded-full bg-orange-600/40 animate-bounce" style={{ animationDelay: `${i*0.15}s` }} />)}
                </div>
                <p className="text-sm text-muted-foreground">Czekam aż organizator wybierze kategorię…</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── STEP: category ── */}
      {step === "category" && (
        <div className="flex-1 flex flex-col px-4 pt-6 pb-6 gap-5 overflow-y-auto">
          <div>
            <p className="font-black text-xl mb-1">Wybierz kategorię</p>
            <p className="text-sm text-muted-foreground">W wersji demo możesz wybrać 1 kategorię.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {DEMO_CATEGORIES.map(cat => {
              const count = categoryCounts[cat.dbValue] ?? 0;
              const empty = count === 0;
              return (
                <button
                  key={cat.id}
                  onClick={() => !empty && handleCategorySelect(cat.id)}
                  disabled={empty}
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm font-semibold border flex items-center gap-2 transition-colors active:scale-[0.97]",
                    empty
                      ? "bg-card text-muted-foreground/40 border-border/30 cursor-not-allowed"
                      : "bg-card text-foreground border-border/60 hover:border-orange-600/50"
                  )}
                >
                  <span>{cat.emoji}</span>
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
          {/* Locked categories hint */}
          <div className="rounded-2xl bg-muted/50 px-4 py-3 flex items-center gap-3">
            <Lock className="h-4 w-4 text-muted-foreground/60 shrink-0" />
            <p className="text-xs text-muted-foreground">
              W pełnej wersji możesz parować wiele kategorii bez limitu.
            </p>
          </div>
        </div>
      )}

      {/* ── STEP: swipe ── */}
      {step === "swipe" && sessionId && placeIds.length > 0 && (
        <div className="flex-1 overflow-hidden">
          <PlaceSwiper
            city={city}
            date={new Date()}
            groupSessionId={sessionId}
            roundPlaceIds={placeIds}
            onRoundComplete={handleSwipeComplete}
          />
        </div>
      )}

      {step === "swipe" && placeIds.length === 0 && (
        <div className="flex-1 flex flex-col items-center justify-center px-6 gap-4 text-center">
          <p className="text-muted-foreground text-sm">Brak miejsc dla tej kategorii w tym mieście.</p>
          <button onClick={() => setStep("category")} className="text-orange-600 font-semibold text-sm">
            ← Zmień kategorię
          </button>
        </div>
      )}

      {/* ── STEP: results ── */}
      {step === "results" && (
        <div className="flex-1 flex flex-col overflow-y-auto">
          <div className="px-4 pt-5 pb-4 space-y-4">
            {/* Header */}
            <div className="text-center">
              <p className="text-2xl font-black">
                {isSolo
                  ? myLikes.length > 0 ? "Twoje propozycje 🎉" : "Żadnych lajków"
                  : matchedPlaces.length > 0 ? "Macie dopasowania! 🎉" : "Brak dopasowań"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {isSolo
                  ? `Polubiłeś/aś ${myLikes.length} ${myLikes.length === 1 ? "miejsce" : "miejsc"}`
                  : `${matchedPlaces.length} wspólnych miejsc`}
              </p>
            </div>

            {/* Matched places */}
            {(isSolo ? myLikes : matchedPlaces).length > 0 ? (
              <div className="space-y-2">
                {(isSolo ? myLikes : matchedPlaces).map((r: any, i: number) => (
                  <div key={r.place_name} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border/40">
                    <span className="h-7 w-7 rounded-full bg-orange-600/10 flex items-center justify-center text-sm font-bold text-orange-600 shrink-0">
                      {i + 1}
                    </span>
                    {r.photo_url && (
                      <img src={r.photo_url} alt={r.place_name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
                    )}
                    <p className="text-sm font-semibold flex-1 min-w-0 truncate">{r.place_name}</p>
                    {r.reaction === "super_liked" && <span className="text-base">⭐</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                {isSolo ? "Spróbuj ponownie i polub jakieś miejsca!" : "Nikt nie polubił tych samych miejsc. Spróbuj jeszcze raz!"}
              </div>
            )}

            {/* Upsell: sign up */}
            <div className="rounded-2xl bg-gradient-to-br from-orange-600/10 to-orange-500/5 border border-orange-600/20 p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-orange-600" />
                <p className="font-bold text-base">Spodobało się?</p>
              </div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <li>✓ Nieograniczone kategorie i rundy</li>
                <li>✓ Zapisz trasę i nawiguj po niej</li>
                <li>✓ Planuj z dowolną liczbą znajomych</li>
                <li>✓ Historia wszystkich tras</li>
              </ul>
              <button
                onClick={() => navigate("/auth")}
                className="w-full py-3.5 rounded-2xl bg-orange-600 text-white font-bold text-sm active:scale-[0.97] transition-transform"
              >
                Załóż konto — to zajmuje 30 sekund →
              </button>
            </div>

            {/* Retry */}
            <button
              onClick={() => { setStep("category"); setCategory(null); setPlaceIds([]); }}
              className="w-full py-3 rounded-2xl border border-border/50 text-sm font-semibold text-muted-foreground"
            >
              Spróbuj innej kategorii
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
