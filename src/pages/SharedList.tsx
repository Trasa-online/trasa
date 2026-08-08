import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { MapPin, ArrowLeft, Bookmark, List, GalleryHorizontalEnd, Maximize2, X, Building2, Sparkles } from "lucide-react";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import RouteMap from "@/components/RouteMap";
import { API_BASE } from "@/lib/platform";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { avatarSrc } from "@/lib/avatar";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { CategoryIcon } from "@/components/CategoryIcon";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { createWyjazdFromPlaces } from "@/lib/createWyjazd";
import { useAuthDrawer } from "@/hooks/useAuthDrawer";

// Statyczna mapa (Google przez proxy) - 1:1 z SharedRoute (peachy numerowane piny).
function buildStaticMap(pins: { latitude: number; longitude: number }[], size = "560x300"): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 20);
  if (!pts.length) return null;
  const markers = pts.map((p, i) => {
    const label = i + 1 <= 9 ? `label:${i + 1}%7C` : "";
    return `markers=color:0xf0a583%7C${label}${p.latitude},${p.longitude}`;
  }).join("&");
  return `${API_BASE}/api/static-map?size=${size}&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}

// Widok LISTY miejsc (polecajki) - UI/UX 1:1 z widokiem trasy (SharedRoute), ale zasilany z
// discovery_collections/discovery_items. Lista NIE jest trasa (brak kolejnosci-planu), ale
// prezentacyjnie ma wygladac tak samo. RLS: publiczny odczyt wymaga approved; wlasciciel widzi
// swoja tez pending.
export default function SharedList() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { open: openAuthDrawer } = useAuthDrawer();
  const [planView, setPlanView] = useState<"list" | "cards">("list");
  const [planTab, setPlanTab] = useState<"miejsca" | "mapa">("miejsca");
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<boolean>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")).has(id ?? ""); } catch { return false; }
  });

  const { data: col, isLoading } = useQuery({
    queryKey: ["shared-list", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, user_id, author_name, author_avatar, cover_url, tags")
        .eq("id", id as string)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["shared-list-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("discovery_items")
        .select("id, place_id, place_name, category, address, latitude, longitude, rating, google_place_id, photo_url, short_desc, order_index")
        .eq("collection_id", id as string)
        .order("order_index", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  // Autor listy (link do profilu + awatar). author_name/avatar sa denormalizowane na kolekcji,
  // ale username (do /profil/:username) dociagamy z profiles.
  const { data: author } = useQuery({
    queryKey: ["shared-list-author", col?.user_id],
    enabled: !!col?.user_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("username, first_name, avatar_url").eq("id", col!.user_id).maybeSingle();
      return data as any;
    },
  });

  // Licznik wyswietlen (dedup per-urzadzenie, jak SharedRoute).
  useEffect(() => {
    if (!col?.id) return;
    try {
      const key = "trasa_viewed_collections";
      const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (seen.includes(col.id)) return;
      localStorage.setItem(key, JSON.stringify([...seen, col.id].slice(-200)));
    } catch { /* brak localStorage */ }
    void (supabase as any).rpc("increment_collection_views", { p_collection_id: col.id });
  }, [col?.id]);

  const categoryLabel = (cat: string | null) => (cat ? subcategoryLabelLocalized(cat) : "Miejsce");

  const openGoogle = (pin: any) => {
    const q = encodeURIComponent([pin.place_name, pin.address, col?.city].filter(Boolean).join(", "));
    const pid = typeof pin.google_place_id === "string" && pin.google_place_id.trim() ? pin.google_place_id.trim() : "";
    const placeIdParam = pid ? `&query_place_id=${encodeURIComponent(pid)}` : "";
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`, "_blank", "noopener,noreferrer");
  };

  const openDetail = (pin: any) => setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (pin.category || "other") as any,
    city: col?.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: pin.rating ?? 0,
    photo_url: resolveStored(pin.photo_url) ?? "",
    description: pin.short_desc || "",
  });

  // Zapisz liste (bookmark) - localStorage, 1:1 z toggleSaveCollection (feed/Zapisane).
  const toggleSave = () => {
    if (!id) return;
    try {
      const set = new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]"));
      const dates: Record<string, string> = (() => { try { return JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}"); } catch { return {}; } })();
      if (set.has(id)) { set.delete(id); delete dates[id]; setSaved(false); toast("Usunięto z zapisanych"); }
      else { set.add(id); dates[id] = new Date().toISOString(); setSaved(true); toast.success("Zapisano listę"); void (supabase as any).rpc("increment_collection_saves", { p_collection_id: id }); }
      localStorage.setItem("trasa_saved_collections", JSON.stringify([...set]));
      localStorage.setItem("trasa_saved_collections_dates", JSON.stringify(dates));
    } catch { /* localStorage niedostepny */ }
  };

  // Uzyj listy - stworz wyjazd z jej miejsc (adopt). Jak w CollectionDetail (plan_adds).
  const useList = async () => {
    if (!user) { openAuthDrawer({ mode: "register", hint: "save_route" }); return; }
    if (!items.length || saving) return;
    setSaving(true);
    void (supabase as any).rpc("increment_collection_plan_adds", { p_collection_id: id });
    const routeId = await createWyjazdFromPlaces(user.id, col?.city ?? null, col?.title ?? (col?.city ?? "Wyjazd"), items.map((p: any) => ({
      place_name: p.place_name,
      category: p.category,
      address: p.address ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      photo_url: p.photo_url ?? null,
      place_id: p.place_id ?? null,
    })));
    setSaving(false);
    if (routeId) navigate(`/review-summary?route=${routeId}&edit=1`);
    else toast.error("Nie udało się utworzyć wyjazdu");
  };

  if (isLoading) {
    return <div className="min-h-[100dvh] bg-background flex items-center justify-center"><div className="text-muted-foreground text-sm animate-pulse">Ładowanie...</div></div>;
  }
  if (!col) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">📋</p>
        <p className="text-lg font-bold">Lista niedostępna</p>
        <p className="text-sm text-muted-foreground">Mogła zostać usunięta lub nie jest jeszcze opublikowana.</p>
        <button onClick={() => navigate("/eksploruj")} className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">Wróć do eksploracji</button>
      </div>
    );
  }

  // Hero = recznie wybrana okladka listy (cover_url); fallback do zdjecia pierwszego miejsca.
  const cover = resolveStored(col.cover_url) ?? resolveStored(items.find((i: any) => i.photo_url)?.photo_url) ?? null;
  const hasRealPhoto = !!cover;
  const heroPhoto = cover ?? getRandomPinPlaceholder(col.id);
  const cityLabel = col.city || "";
  const authorName = author?.first_name || author?.username || col.author_name || "Ktoś";
  const mapPins = (items as any[])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number, place_name: p.place_name as string }));
  const staticMapUrl = buildStaticMap(mapPins);
  const placesCountLabel = `${items.length} ${items.length === 1 ? "miejsce" : items.length < 5 ? "miejsca" : "miejsc"}`;

  const renderList = () => (
    <div className="space-y-2.5">
      {items.map((pin: any, i: number) => {
        const noteText = (pin.short_desc ?? "").trim();
        const note = noteText ? (
          <div>
            <p className="text-sm font-semibold text-foreground">Notka autora</p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mt-0.5">{noteText}</p>
          </div>
        ) : undefined;
        return (
          <RoutePlaceRow
            key={pin.id}
            pin={pin}
            index={i}
            categoryLabel={categoryLabel(pin.category)}
            onOpen={() => openDetail(pin)}
            onGoogle={() => openGoogle(pin)}
            note={note}
          />
        );
      })}
    </div>
  );

  const renderCards = () => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {items.map((pin: any, i: number) => (
        <div key={pin.id} className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col">
          <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
            <div className="relative w-full aspect-[4/3] bg-muted">
              <PlacePhoto pin={pin} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
            </div>
            <div className="px-4 pt-4 pb-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-foreground mb-2">
                <CategoryIcon category={pin.category} className="h-3.5 w-3.5 shrink-0" />{categoryLabel(pin.category)}
              </span>
              <p className="text-[15px] font-bold leading-snug">{pin.place_name}</p>
              {pin.short_desc && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{pin.short_desc}</p>}
            </div>
          </button>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">
      {/* Hero */}
      <div className="relative w-full aspect-[16/10] flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
        <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-b ${hasRealPhoto ? "from-black/40 via-transparent to-black/75" : "from-black/35 via-black/25 to-black/80"}`} />
        <div className="absolute left-0 right-0 flex items-center px-4" style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); }} className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
        </div>
      </div>

      {/* Content - 1:1 z SharedRoute */}
      <div className="flex-1 overflow-y-auto pb-44">
        <div className="px-5 pt-5">
          <div className="flex items-center gap-2.5 flex-wrap text-sm">
            {author?.username ? (
              <button onClick={() => navigate(`/profil/${author.username}`)} className="flex items-center gap-1.5 font-semibold text-foreground active:opacity-60 transition-opacity">
                <img src={avatarSrc(author?.avatar_url ?? col.author_avatar)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />
                @{author.username}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <img src={avatarSrc(col.author_avatar ?? null)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />
                {authorName}
              </span>
            )}
            {cityLabel && <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-4 w-4" />{cityLabel}</span>}
            <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{placesCountLabel}</span>
          </div>
          <h1 className="text-2xl font-black text-foreground leading-tight mt-3">{col.title || cityLabel}</h1>
          {col.description && <p className="text-sm text-muted-foreground leading-relaxed mt-3">{col.description}</p>}
          {Array.isArray(col.tags) && col.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {col.tags.map((tg: string) => (
                <span key={tg} className="inline-flex items-center px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-[13px] font-semibold">{tg}</span>
              ))}
            </div>
          )}
        </div>

        {/* Miejsca | Mapa */}
        <div className="px-5 pt-6">
          <div className="flex rounded-full bg-muted p-0.5 text-sm font-bold">
            <button onClick={() => setPlanTab("miejsca")} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "miejsca" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Miejsca</button>
            <button onClick={() => setPlanTab("mapa")} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "mapa" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Mapa</button>
          </div>
        </div>

        {planTab === "miejsca" ? (
          <div className="px-5 pt-4">
            {items.length > 0 && (
              <>
                <div className="flex items-center justify-end pb-3">
                  <div className="flex rounded-full bg-muted p-0.5">
                    <button onClick={() => setPlanView("list")} aria-label="Lista" className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
                    <button onClick={() => setPlanView("cards")} aria-label="Karty" className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><GalleryHorizontalEnd className="h-4 w-4" /></button>
                  </div>
                </div>
                {planView === "list" ? renderList() : renderCards()}
              </>
            )}
          </div>
        ) : (
          <div className="px-5 pt-4">
            {mapPins.length > 0 && staticMapUrl ? (
              <button onClick={() => setMapOpen(true)} className="relative block w-full h-64 rounded-2xl overflow-hidden border border-border/40 bg-muted active:opacity-95 transition-opacity">
                <img src={staticMapUrl} alt="Mapa listy" className="w-full h-full object-cover" />
                <span className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center"><Maximize2 className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} /></span>
              </button>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-10">Brak lokalizacji miejsc na mapie.</p>
            )}
          </div>
        )}
      </div>

      <PlaceSwiperDetail open={!!detailPin} onOpenChange={(o) => !o && setDetailPin(null)} place={detailPin} city={col.city} />

      {mapOpen && (
        <div className="fixed inset-0 z-[90] bg-background flex flex-col animate-in fade-in duration-200">
          <div className="relative flex-1 min-h-0">
            <RouteMap pins={mapPins as any} className="w-full h-full" showRoute={false} />
            <button onClick={() => setMapOpen(false)} aria-label="Zamknij" className="absolute right-3 z-10 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* CTA - 1:1 z SharedRoute */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-3 bg-background/90 backdrop-blur-md border-t border-border/30" style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <button onClick={toggleSave} className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/25">
          <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />{saved ? "Zapisano listę" : "Zapisz tę listę"}
        </button>
        <button onClick={useList} disabled={saving} className="w-full mt-2 py-2 text-sm font-medium text-muted-foreground active:text-foreground transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50">
          <Sparkles className="h-4 w-4" />{saving ? "Tworzę wyjazd..." : "Zrób wyjazd z tej listy"}
        </button>
      </div>
    </div>
  );
}
