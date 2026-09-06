import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Compass, Heart, Loader2, Check, MapPin, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { expandCity } from "@/lib/cities";
import { MAIN_CATEGORIES } from "@/lib/categories";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { notify } from "@/lib/notify";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { PlacePhoto } from "@/components/PlacePhoto";
import { CategoryIcon } from "@/components/CategoryIcon";
import PlaceSwiper, { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";

// Pelnoekranowy widok dodawania miejsc do istniejacej aktywnej trasy. Zastapil drawer
// AddPinSheet (uznany za nieintuicyjny). Trzy metody: szukanie po nazwie, przegladanie
// kategorii (reuzyty PlaceSwiper), albo z polubionych. Tryb batch: zaznaczenia zbieraja
// sie wspolnym licznikiem, a "Dodaj wybrane (N)" dopisuje wszystkie naraz do tabeli pins.

type Step = "choose" | "search" | "category" | "liked";

// Zaznaczone miejsce - minimalny zestaw pol potrzebnych do insertu pinu.
interface SelectedPlace {
  place_name: string;
  address: string | null;
  description: string | null;
  category: string;
  latitude: number | null;
  longitude: number | null;
  place_id: string | null;
  photo_url: string | null;
}

interface DbPlace {
  id: string;
  place_name: string;
  category: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  photo_url: string | null;
}

const skey = (name: string) => name.trim().toLowerCase();

const dbToSelected = (p: DbPlace): SelectedPlace => ({
  place_name: p.place_name,
  address: p.address ?? null,
  description: p.description ?? null,
  category: p.category || "other",
  latitude: p.latitude ?? null,
  longitude: p.longitude ?? null,
  place_id: p.id ?? null,
  photo_url: p.photo_url ?? null,
});

const mockToSelected = (p: MockPlace): SelectedPlace => ({
  place_name: p.place_name,
  address: p.address || null,
  description: p.description || null,
  category: (p.category as string) || "other",
  latitude: p.latitude || null,
  longitude: p.longitude || null,
  place_id: p.id || null,
  photo_url: p.photo_url || null,
});

const AddPlaceToTripInner = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { t } = useTranslation("myplan");

  const [step, setStep] = useState<Step>("choose");
  const [selected, setSelected] = useState<Map<string, SelectedPlace>>(new Map());
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<DbPlace[]>([]);
  const [searching, setSearching] = useState(false);
  const [mainCategoryId, setMainCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Trasa - miasto + lista istniejacych pinow (do pin_order + filtra duplikatow).
  const { data: route } = useQuery({
    queryKey: ["add-place-route", routeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, city")
        .eq("id", routeId)
        .single();
      return data as { id: string; city: string } | null;
    },
    enabled: !!routeId,
  });

  const { data: existingPins = [] } = useQuery({
    queryKey: ["add-place-existing-pins", routeId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pins")
        .select("place_name, pin_order")
        .eq("route_id", routeId);
      return (data ?? []) as { place_name: string; pin_order: number | null }[];
    },
    enabled: !!routeId,
  });

  const routeCity = route?.city ?? "";
  const existingNames = useMemo(
    () => new Set(existingPins.map((p) => skey(p.place_name))),
    [existingPins],
  );

  // Search w tabeli places (ilike po nazwie, filtr po miescie). Reuzyta logika z AddPinSheet.
  useEffect(() => {
    if (step !== "search" || query.trim().length < 2 || !routeCity) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      const { data } = await (supabase as any)
        .from("places")
        .select("id, place_name, category, address, latitude, longitude, description, photo_url")
        .in("city", expandCity(routeCity))
        .ilike("place_name", `%${query.trim()}%`)
        .eq("is_active", true)
        .limit(20);
      setSearchResults((data ?? []) as DbPlace[]);
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, step, routeCity]);

  // Polubienia z exploreLikes (localStorage) dla miasta trasy.
  const likedForCity = useMemo(() => {
    if (!routeCity) return [];
    const expanded = expandCity(routeCity).map((c) => c.toLowerCase());
    const groups = getHistoryByCity();
    const out: SelectedPlace[] = [];
    for (const g of groups) {
      if (!expanded.includes(g.city.toLowerCase()) && g.city !== routeCity) continue;
      for (const p of g.places) {
        out.push({
          place_name: p.place_name,
          address: p.address ?? null,
          description: p.description ?? null,
          category: p.category || "other",
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          place_id: null,
          photo_url: p.photo_url ?? null,
        });
      }
    }
    return out;
  }, [routeCity]);

  const toggle = (place: SelectedPlace) => {
    const k = skey(place.place_name);
    if (existingNames.has(k)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(k)) next.delete(k);
      else next.set(k, place);
      return next;
    });
  };

  const isSelected = (name: string) => selected.has(skey(name));

  // PlaceSwiper zglasza biezacy zbior polubionych (MockPlace[]). Mergujemy do wspolnej
  // selekcji - usuwamy z selekcji te, ktore user cofnal w swiperze (tylko klucze nalezace
  // do tej puli), zostawiajac zaznaczenia z innych trybow nietkniete.
  const swiperKeysRef = useMemo(() => ({ keys: new Set<string>() }), []);
  const handleSwiperLiked = (places: MockPlace[]) => {
    const nextKeys = new Set(places.map((p) => skey(p.place_name)));
    setSelected((prev) => {
      const next = new Map(prev);
      // Usun zaznaczenia ze swipera, ktorych juz nie ma w aktualnej puli polubionych.
      for (const k of swiperKeysRef.keys) {
        if (!nextKeys.has(k)) next.delete(k);
      }
      // Dodaj nowe polubienia (pomijajac juz istniejace w trasie).
      for (const p of places) {
        const k = skey(p.place_name);
        if (existingNames.has(k)) continue;
        if (!next.has(k)) next.set(k, mockToSelected(p));
      }
      return next;
    });
    swiperKeysRef.keys = nextKeys;
  };

  const handleAddSelected = async () => {
    if (!routeId || !user || selected.size === 0) return;
    setSaving(true);
    try {
      const maxOrder = existingPins.reduce((m, p) => Math.max(m, p.pin_order ?? -1), -1);
      const rows = [...selected.values()].map((p, idx) => ({
        route_id: routeId,
        place_name: p.place_name,
        address: p.address,
        description: p.description,
        category: p.category || "other",
        latitude: p.latitude,
        longitude: p.longitude,
        place_id: p.place_id,
        suggested_time: null,
        photo_url: p.photo_url,
        pin_order: maxOrder + 1 + idx,
        original_creator_id: user.id,
      }));
      const { error } = await (supabase as any).from("pins").insert(rows);
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ["active-plan-all-pins"] });
      await queryClient.invalidateQueries({ queryKey: ["home-active-solo"] });
      // Dziennik/ReviewSummary uzywa innego klucza pinow - odswiez tez jego.
      await queryClient.invalidateQueries({ queryKey: ["review-all-pins"] });
      notify.success(
        t("add_place.added", { count: rows.length }),
      );
      goBackOr(navigate, "/moj-profil?tab=wyjazdy");
    } catch (e: any) {
      console.error("[AddPlaceToTrip] add selected failed:", e?.message ?? e);
      notify.error(t("add_place.add_error"));
      setSaving(false);
    }
  };

  const count = selected.size;

  const back = () => {
    if (step === "category" && subCategoryId) { setSubCategoryId(null); setMainCategoryId(null); return; }
    if (step !== "choose") { setStep("choose"); setQuery(""); setSearchResults([]); return; }
    goBackOr(navigate, "/moj-profil?tab=wyjazdy");
  };

  // ── Sticky CTA "Dodaj wybrane (N)" ──
  const renderCta = () =>
    count > 0 ? (
      <div className="shrink-0 px-4 pt-2 pb-safe-4 border-t border-border/20 bg-background">
        <button
          onClick={handleAddSelected}
          disabled={saving}
          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : t("add_place.add_selected", { count })}
        </button>
      </div>
    ) : null;

  // ── Wiersz listy z checkboxem ──
  const renderRow = (place: SelectedPlace, key: string) => {
    const inTrip = existingNames.has(skey(place.place_name));
    const checked = isSelected(place.place_name);
    return (
      <button
        key={key}
        onClick={() => toggle(place)}
        disabled={inTrip}
        className={`w-full flex items-center gap-3 p-2.5 rounded-2xl border text-left transition-colors active:scale-[0.99] ${
          inTrip
            ? "border-border/30 bg-muted/30 opacity-50"
            : checked
              ? "border-orange-400 bg-orange-50"
              : "border-border/40 bg-card"
        }`}
      >
        <PlacePhoto
          pin={{ place_name: place.place_name, category: place.category, photo_url: place.photo_url, latitude: place.latitude, longitude: place.longitude }}
          className="h-14 w-14 rounded-xl object-cover shrink-0"
          emojiClass="text-2xl"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight truncate">{place.place_name}</p>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {t(`categories.${place.category}`, { defaultValue: t("add_place.place_fallback") })}
            {place.address ? ` · ${place.address}` : ""}
          </p>
        </div>
        <div
          className={`h-7 w-7 rounded-full shrink-0 flex items-center justify-center border-2 transition-colors ${
            inTrip
              ? "border-border bg-muted"
              : checked
                ? "border-orange-500 bg-orange-500 text-white"
                : "border-border bg-transparent"
          }`}
        >
          {inTrip ? <Check className="h-4 w-4 text-muted-foreground" /> : checked ? <Check className="h-4 w-4" /> : null}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button
          onClick={back}
          className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground"
          aria-label={t("add_place.back")}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-base font-bold truncate">
          {step === "choose" && t("add_place.header_choose")}
          {step === "search" && t("add_place.header_search")}
          {step === "category" && t("add_place.header_category")}
          {step === "liked" && t("add_place.header_liked")}
        </p>
      </div>

      {/* ── Krok: wybor metody ── */}
      {step === "choose" && (
        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-6">
          <h1 className="text-xl font-black leading-tight mb-1">{t("add_place.how_title")}</h1>
          <p className="text-sm text-muted-foreground mb-6">
            {routeCity ? t("add_place.adding_to_city", { city: routeCity }) : t("add_place.choose_method")}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setStep("search")}
              className="w-full flex items-center gap-4 p-4 rounded-3xl border border-border/50 bg-card shadow-sm active:scale-[0.98] transition-transform text-left"
            >
              <div className="h-12 w-12 rounded-2xl bg-orange-100 flex items-center justify-center text-2xl shrink-0">🔍</div>
              <div className="min-w-0">
                <p className="text-base font-bold">{t("add_place.method_search_title")}</p>
                <p className="text-sm text-muted-foreground">{t("add_place.method_search_desc")}</p>
              </div>
            </button>
            <button
              onClick={() => setStep("category")}
              className="w-full flex items-center gap-4 p-4 rounded-3xl border border-border/50 bg-card shadow-sm active:scale-[0.98] transition-transform text-left"
            >
              <div className="h-12 w-12 rounded-2xl bg-orange-100 flex items-center justify-center text-2xl shrink-0">🧭</div>
              <div className="min-w-0">
                <p className="text-base font-bold">{t("add_place.method_category_title")}</p>
                <p className="text-sm text-muted-foreground">{t("add_place.method_category_desc")}</p>
              </div>
            </button>
            <button
              onClick={() => setStep("liked")}
              className="w-full flex items-center gap-4 p-4 rounded-3xl border border-border/50 bg-card shadow-sm active:scale-[0.98] transition-transform text-left"
            >
              <div className="h-12 w-12 rounded-2xl bg-orange-100 flex items-center justify-center text-2xl shrink-0">❤️</div>
              <div className="min-w-0">
                <p className="text-base font-bold">{t("add_place.method_liked_title")}</p>
                <p className="text-sm text-muted-foreground">{t("add_place.method_liked_desc")}</p>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* ── Krok: szukanie po nazwie ── */}
      {step === "search" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 min-h-0">
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={routeCity ? t("add_place.search_placeholder_city", { city: routeCity }) : t("add_place.search_placeholder")}
                autoFocus
                className="w-full h-12 pl-10 pr-4 rounded-2xl border border-border bg-muted/30 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:border-foreground/30"
              />
            </div>
            {searching && (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            )}
            {!searching && query.trim().length >= 2 && searchResults.length === 0 && (
              <p className="text-center py-8 text-sm text-muted-foreground">{t("add_place.no_results", { query: query.trim() })}</p>
            )}
            {!searching && query.trim().length < 2 && (
              <p className="text-center py-8 text-sm text-muted-foreground">{t("add_place.search_hint")}</p>
            )}
            {!searching && searchResults.length > 0 && (
              <div className="flex flex-col gap-2">
                {searchResults.map((p) => renderRow(dbToSelected(p), p.id))}
              </div>
            )}
          </div>
          {renderCta()}
        </>
      )}

      {/* ── Krok: kategorie -> swiper ── */}
      {step === "category" && (
        <>
          {!subCategoryId ? (
            <div className="flex-1 overflow-y-auto px-4 pt-4 pb-6 min-h-0 bg-[#F4F3EF]">
              <p className="text-sm text-muted-foreground mb-4 px-1">{t("add_place.pick_category")}</p>
              <div className="flex flex-col gap-4">
                {MAIN_CATEGORIES.map((cat) => (
                  <div key={cat.id} className="rounded-3xl bg-white border border-black/5 shadow-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CategoryIcon category={cat.id} className="h-5 w-5 shrink-0" />
                      <p className="text-[15px] font-bold">{cat.label}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {cat.subcategories.map((sub) => (
                        <button
                          key={sub.id}
                          onClick={() => { setMainCategoryId(cat.id); setSubCategoryId(sub.id); }}
                          className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-border/60 shadow-sm text-sm font-semibold active:scale-[0.97] transition-transform"
                        >
                          <CategoryIcon category={sub.id} className="h-4 w-4 shrink-0" />
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="shrink-0 px-4 pt-2 pb-1 flex items-center gap-2">
                <button
                  onClick={() => { setSubCategoryId(null); setMainCategoryId(null); }}
                  className="flex items-center gap-1 text-sm font-semibold text-muted-foreground active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" /> {t("add_place.change_category")}
                </button>
              </div>
              <PlaceSwiper
                key={`${subCategoryId}-${routeCity}`}
                city={routeCity}
                date={new Date()}
                categoryFilter={[subCategoryId]}
                exploreMode
                onLikedPlacesChange={handleSwiperLiked}
              />
            </>
          )}
          {!subCategoryId ? null : renderCta()}
        </>
      )}

      {/* ── Krok: z polubionych ── */}
      {step === "liked" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 pt-3 pb-4 min-h-0">
            {likedForCity.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-14 px-6 text-center">
                <div className="h-14 w-14 rounded-full bg-orange-100 flex items-center justify-center">
                  <Heart className="h-6 w-6 text-orange-600" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">{t("add_place.liked_empty_title")}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {t("add_place.liked_empty_desc")}
                  </p>
                </div>
                <button
                  onClick={() => setStep("category")}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary text-white font-semibold text-sm active:scale-[0.97] transition-transform"
                >
                  <Compass className="h-4 w-4" /> {t("add_place.browse_categories")}
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {likedForCity.map((p, i) => renderRow(p, `${skey(p.place_name)}-${i}`))}
              </div>
            )}
          </div>
          {renderCta()}
        </>
      )}
    </div>
  );
};

export default function AddPlaceToTrip() {
  return (
    <ErrorBoundary>
      <AddPlaceToTripInner />
    </ErrorBoundary>
  );
}
