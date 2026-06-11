import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import { MapPin, ArrowLeft, Sparkles, ChevronRight, ChevronLeft, Bookmark } from "lucide-react";
import { PlacePhoto } from "@/components/PlacePhoto";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import { resolveStored } from "@/components/PlacePhoto";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭",
  walk: "🚶", other: "📍",
};
const CATEGORY_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  bar: "Bar", club: "Klub", monument: "Zabytek", gallery: "Galeria",
  market: "Targ", viewpoint: "Punkt widokowy", shopping: "Zakupy", experience: "Atrakcja",
  walk: "Spacer", other: "Miejsce",
};

export default function SharedRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [planView, setPlanView] = useState<"list" | "cards">("list");
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["shared-route", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, title, city, user_id, day_number, start_date, ai_summary, ai_highlight")
        .eq("id", id as string)
        .eq("is_shared", true)
        .single();
      if (error) return null;
      return data as any;
    },
    enabled: !!id,
  });

  // Inkrementacja licznika wyswietlen (nagroda dla autora). Dedup per-urzadzenie
  // (localStorage), zeby refresh/powroty nie zawyzaly "X osob obejrzalo".
  useEffect(() => {
    if (!route?.id) return;
    try {
      const key = "trasa_viewed_routes";
      const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (seen.includes(route.id)) return;
      localStorage.setItem(key, JSON.stringify([...seen, route.id].slice(-200)));
    } catch { /* brak localStorage - i tak inkrementuj raz na mount */ }
    void (supabase as any).rpc("increment_route_views", { route_id: route.id });
  }, [route?.id]);

  // Zapisz cudza trase do swojego dziennika (kopia pinow). Domyka petle
  // discovery -> moja sesja (re-discovery). Wymaga konta.
  const saveToMine = async (tripDate?: Date) => {
    if (!user) { navigate("/auth"); return; }
    if (!route || !pins.length || saving) return;
    setSaving(true);
    setShowDateSheet(false);
    const dateStr = tripDate ? format(tripDate, "yyyy-MM-dd") : null;
    try {
      const { data: newRoute, error } = await (supabase as any)
        .from("routes")
        .insert({
          user_id: user.id,
          title: route.title || route.city,
          city: route.city,
          status: "draft",
          trip_type: "planning",
          day_number: 1,
          start_date: dateStr,
          end_date: dateStr,
          is_shared: false,
          new_for_users: [user.id],
        })
        .select("id")
        .single();
      if (error || !newRoute) throw error;
      await (supabase as any).from("pins").insert(
        pins.map((p: any, idx: number) => ({
          route_id: newRoute.id,
          place_name: p.place_name,
          address: p.address ?? null,
          description: p.description ?? null,
          category: p.category ?? "other",
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          place_id: p.place_id ?? null,
          photo_url: p.photo_url ?? null,
          suggested_time: p.suggested_time ?? null,
          pin_order: idx,
          original_creator_id: user.id,
        }))
      );
      notify.success("Trasa zapisana w Twoim dzienniku");
      navigate(`/review-summary?route=${newRoute.id}`);
    } catch (e: any) {
      console.error("[SharedRoute] save failed:", e?.message ?? e);
      notify.error("Nie udało się zapisać trasy");
    }
    setSaving(false);
  };

  const { data: pins = [] } = useQuery({
    queryKey: ["shared-route-pins", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pins")
        .select("id, place_name, address, category, suggested_time, images, image_url, photo_url, place_id, latitude, longitude, pin_order, description")
        .eq("route_id", id!)
        .order("pin_order");
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  // Oceny + notki autora trasy (pin_ratings SELECT jest publiczny).
  const { data: ratings = [] } = useQuery({
    queryKey: ["shared-route-ratings", id, route?.user_id],
    queryFn: async () => {
      if (!route?.user_id) return [];
      const { data } = await (supabase as any)
        .from("pin_ratings")
        .select("place_name, rating, note")
        .eq("route_id", id!)
        .eq("user_id", route.user_id);
      return (data ?? []) as any[];
    },
    enabled: !!id && !!route?.user_id,
  });

  const ratingMap: Record<string, { rating: number | null; note: string | null }> = {};
  for (const r of ratings) ratingMap[r.place_name] = { rating: r.rating, note: r.note };

  if (routeLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">Ładowanie...</div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">🗺️</p>
        <p className="text-lg font-bold">Trasa niedostępna</p>
        <p className="text-sm text-muted-foreground">Ten link mógł wygasnąć lub trasa nie jest publiczna.</p>
        <button onClick={() => navigate("/")} className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">
          Wróć do Trasa
        </button>
      </div>
    );
  }

  // #2: udostepniona trasa NIE zawiera zdjec uzytkownika - hero to ilustracja
  // placeholder (mocny gradient overlay dla kontrastu tekstu, WCAG).
  const heroPhoto = getRandomPinPlaceholder(route.id);
  const dateLabel = route.start_date ? format(new Date(route.start_date), "d MMMM yyyy", { locale: pl }) : "";
  const cityLabel = route.city || "Podróż";

  const openDetail = (pin: any) => setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (pin.category || "other") as any,
    city: route.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: 0,
    photo_url: resolveStored(pin.photo_url || pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null)) ?? "",
    vibe_tags: [],
    description: pin.description || "",
  } satisfies MockPlace);

  // Read-only ocena + notka autora pod miejscem.
  const renderRatingNote = (placeName: string, centered = false) => {
    const r = ratingMap[placeName];
    if (!r || (!r.rating && !r.note)) return null;
    return (
      <div className={`mt-3 pt-3 border-t border-border/40 ${centered ? "text-center" : ""}`}>
        {r.rating ? (
          <>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Ocena autora</p>
            <div className={`flex items-center gap-1 ${centered ? "justify-center" : ""}`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <span key={n} className={`text-lg leading-none ${n <= r.rating! ? "opacity-100" : "opacity-20"}`}>⭐</span>
              ))}
            </div>
          </>
        ) : null}
        {r.note ? (
          <>
            {r.rating ? <div className="my-3 h-px bg-border/40" /> : null}
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">Notka autora</p>
            <p className="text-sm text-foreground/80 leading-relaxed text-left whitespace-pre-wrap">{r.note}</p>
          </>
        ) : null}
      </div>
    );
  };

  const renderList = () => {
    const groups: Record<string, any[]> = {};
    pins.forEach((p: any) => { const k = p.category || "other"; (groups[k] ??= []).push(p); });
    return (
      <div className="space-y-4">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <span>{CATEGORY_EMOJI[cat] ?? "📍"}</span>{CATEGORY_LABEL[cat] ?? "Miejsce"}
            </p>
            <div className="space-y-2">
              {items.map((pin: any) => (
                <div key={pin.id} className="bg-card border border-border/40 rounded-2xl p-2.5">
                  <button onClick={() => openDetail(pin)} className="w-full flex items-center gap-3 text-left active:opacity-70 transition-opacity">
                    <PlacePhoto pin={pin} className="h-14 w-14 rounded-xl object-cover shrink-0" emojiClass="text-xl" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold leading-tight truncate">{pin.place_name}</p>
                      {pin.address && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{pin.address}</p>}
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                  </button>
                  {renderRatingNote(pin.place_name)}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSwiper = () => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {pins.map((pin: any, i: number) => (
        <div key={pin.id} className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl bg-card border border-border/40 overflow-hidden shadow-sm flex flex-col">
          <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
            <div className="relative w-full aspect-[4/3] bg-muted">
              <PlacePhoto pin={pin} className="w-full h-full object-cover" emojiClass="text-4xl" />
              <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
            </div>
            <div className="px-4 pt-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-foreground mb-2">
                <span>{CATEGORY_EMOJI[pin.category] ?? "📍"}</span>{CATEGORY_LABEL[pin.category] ?? "Miejsce"}
              </span>
              <p className="text-base font-black leading-tight">{pin.place_name}</p>
              {pin.description && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{pin.description}</p>}
            </div>
          </button>
          <div className="px-4 pb-4 pt-1">{renderRatingNote(pin.place_name, true)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">

      {/* Hero - ilustracja placeholder (bez zdjec autora) */}
      <div className="relative w-full aspect-[4/5] flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
        <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/25 to-black/80" />

        <div className="absolute left-0 right-0 flex items-center px-4"
          style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button onClick={() => navigate("/")}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <span className="ml-3 text-xs font-semibold text-white/80 bg-black/30 backdrop-blur-sm rounded-full px-3 py-1.5 flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" /> Trasa polecana
          </span>
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6">
          {dateLabel && <p className="text-white/70 text-sm mb-1">{dateLabel}</p>}
          <h1 className="text-white text-3xl font-black leading-tight drop-shadow-sm">{route.title || cityLabel}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-44">

        {route.ai_highlight && (
          <div className="px-5 pt-6 pb-5 border-b border-border/30">
            <p className="text-[22px] font-bold leading-snug text-foreground">„{route.ai_highlight}"</p>
          </div>
        )}
        {route.ai_summary && (
          <div className="px-5 pt-5 pb-5 border-b border-border/30">
            <p className="text-sm text-foreground/70 leading-relaxed">{route.ai_summary}</p>
          </div>
        )}

        {/* Plan trasy - toggle Lista / Szczegoly */}
        {pins.length > 0 && (
          <div className="px-5 pt-5 pb-5 border-b border-border/30">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Plan trasy</p>
              <div className="flex rounded-full bg-muted p-0.5">
                <button onClick={() => setPlanView("list")} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Lista</button>
                <button onClick={() => setPlanView("cards")} className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Szczegóły</button>
              </div>
            </div>
            {planView === "list" ? renderList() : renderSwiper()}
          </div>
        )}

        {/* Attribution */}
        <div className="px-5 pt-5 pb-2 flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>Stworzone z pomocą <span className="font-semibold text-foreground">Trasa</span></span>
        </div>
      </div>

      {/* Podglad wizytowki miejsca */}
      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => !o && setDetailPin(null)}
        place={detailPin}
        city={route.city}
      />

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-3 bg-background/90 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <button
          onClick={() => { if (!user) { navigate("/auth"); return; } setShowDateSheet(true); }}
          disabled={saving}
          className="w-full py-4 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/25 disabled:opacity-50"
        >
          <Bookmark className="h-5 w-5" />{saving ? "Zapisywanie…" : "Zapisz tę trasę do siebie"}
        </button>
        <button
          onClick={() => navigate(`/plan?city=${encodeURIComponent(cityLabel)}`)}
          className="w-full mt-2 py-2 text-sm font-medium text-muted-foreground active:text-foreground transition-colors"
        >
          Zaplanuj własną trasę w&nbsp;{cityLabel}
        </button>
      </div>

      {/* Sheet wyboru daty wyjazdu przy zapisie cudzej trasy do dziennika */}
      {showDateSheet && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowDateSheet(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl flex flex-col max-h-[88dvh] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-1 text-center shrink-0">
              <p className="text-lg font-black leading-tight">Kiedy planujesz tę trasę?</p>
              <p className="text-xs text-muted-foreground mt-1">Wybierz datę, żeby trasa trafiła do&nbsp;dziennika.</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FullCalendarPicker onConfirm={(d) => saveToMine(d)} />
            </div>
            <button
              onClick={() => saveToMine()}
              disabled={saving}
              className="mx-5 mt-1 mb-[max(16px,env(safe-area-inset-bottom))] py-2.5 text-sm font-medium text-muted-foreground active:text-foreground transition-colors shrink-0 disabled:opacity-50"
            >
              Zapisz bez daty
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
