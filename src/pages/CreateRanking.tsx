import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, X, Loader2, Star, MapPin, ChevronRight, List, GalleryHorizontalEnd } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ORIGIN_COUNTRIES } from "@/lib/locations";
import { expandCity } from "@/lib/cities";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { forwardGeocode, reverseGeocode } from "@/lib/googleMaps";
import { getPhotoUrl } from "@/lib/placePhotos";
import { COLLECTION_THEMES, getTheme } from "@/lib/collectionThemes";
import { MAIN_CATEGORIES, getDbCategoriesFor } from "@/lib/categories";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";

// Item rankingu. place_id != null = miejsce z bazy (tap -> wizytowka). null = custom (Google).
interface RankingItem {
  key: string;
  place_id: string | null;
  place_name: string;
  category: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  google_place_id: string | null;
  photo_url: string | null;
  short_desc: string;
}

const PL_CITIES = ORIGIN_COUNTRIES.find((c) => c.name === "Polska")?.cities ?? ["Warszawa"];

// Kategoria (moze byc alias DB) -> emoji + etykieta, jak w dzienniku/home.
const CAT_META: Record<string, { emoji: string; label: string }> = {};
MAIN_CATEGORIES.forEach((m) => m.subcategories.forEach((s) => {
  CAT_META[s.id] = { emoji: s.emoji, label: s.label };
  for (const alias of getDbCategoriesFor(s.id)) if (!CAT_META[alias]) CAT_META[alias] = { emoji: s.emoji, label: s.label };
}));
const categoryBadge = (cat: string | null): { emoji: string; label: string } | null => (cat ? CAT_META[cat] ?? null : null);

// Wzbogaca miejsce spoza bazy danymi z Google (rating + okladka + adres + coords).
// Jeden pipeline dla wszystkich 3 trybow: nazwa | adres | koordynaty.
async function fetchGooglePlace(opts: { name?: string; address?: string; lat?: number; lng?: number; city: string }): Promise<Omit<RankingItem, "key" | "short_desc"> | null> {
  let name = opts.name?.trim();
  let lat = opts.lat ?? null;
  let lng = opts.lng ?? null;
  let address = opts.address?.trim() || null;
  try {
    if (address && (lat == null || lng == null)) {
      const geo = await forwardGeocode(address);
      if (geo[0]) { lat = geo[0].coordinates.latitude; lng = geo[0].coordinates.longitude; address = geo[0].full_address; if (!name) name = geo[0].name; }
    }
    if (lat != null && lng != null && !name) {
      const rev = await reverseGeocode(lat, lng);
      if (rev) { name = rev.placeName; address = address ?? rev.fullAddress; }
    }
    if (!name && lat == null) return null;
    // Wzbogacenie przez proxy (rating, user_ratings_total, photos, formatted_address, place_id).
    const { data } = await supabase.functions.invoke("google-places-proxy", {
      body: { placeName: name, latitude: lat, longitude: lng, city: opts.city },
    });
    const r = (data as any)?.result;
    const photoRef = r?.photos?.[0]?.photo_reference;
    const photoUrl = r?.photos?.[0]?.photo_url ?? (photoRef ? getPhotoUrl(photoRef, 800) : null);
    return {
      place_id: null,
      place_name: r?.name ?? name ?? "",
      category: null,
      address: r?.formatted_address ?? address,
      latitude: r?.geometry?.location?.lat ?? lat,
      longitude: r?.geometry?.location?.lng ?? lng,
      rating: r?.rating ?? null,
      google_place_id: r?.place_id ?? null,
      photo_url: photoUrl,
    };
  } catch (e) {
    console.warn("[CreateRanking] fetchGooglePlace failed:", e);
    return name ? { place_id: null, place_name: name, category: null, address, latitude: lat, longitude: lng, rating: null, google_place_id: null, photo_url: null } : null;
  }
}

const CreateRanking = () => {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const [params] = useSearchParams();
  const { user } = useAuth();

  const [category, setCategory] = useState<string | null>(null);
  // Tytul = etykieta motywu (usuniete pole tytulu). `legacyTitle` tylko dla starych
  // zestawien bez motywu (edycja) - zeby edycja nie kasowala istniejacego tytulu.
  const [legacyTitle, setLegacyTitle] = useState("");
  const [city, setCity] = useState(params.get("city") || "Warszawa");
  const [items, setItems] = useState<RankingItem[]>([]);
  const [publishing, setPublishing] = useState(false);
  // Widocznosc + tozsamosc autora: profil | anonimowo | prywatne.
  const [visibility, setVisibility] = useState<"profile" | "anon" | "private">("profile");

  // Wyszukiwarka + propozycje miejsc (bez zargonu "baza/spoza bazy").
  const [search, setSearch] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [addingCustom, setAddingCustom] = useState(false);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  // Wizytowka miejsca (tap w pozycje na liscie).
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  // Widok miejsc: szczegolowy (karty) | lista (kompakt) - jak toggle na home/dzienniku.
  const [placeView, setPlaceView] = useState<"detail" | "list">("detail");
  // Podglad wizytowki miejsca spoza bazy PRZED dodaniem (user zatwierdza).
  const [customPreview, setCustomPreview] = useState<{ place: MockPlace; item: Omit<RankingItem, "key" | "short_desc"> } | null>(null);
  const [author, setAuthor] = useState<{ name: string; avatar: string | null }>({ name: "Użytkownik", avatar: null });

  // Krok 1 = wybor motywu (tylko nowe zestawienie, bez wybranego motywu). Edycja i
  // zestawienia z juz wybranym motywem od razu w formularzu.
  const showThemePicker = !editId && !category;

  // ── Author + edit/liked prefill ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, first_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setAuthor({ name: (data as any).first_name || (data as any).username || "Użytkownik", avatar: (data as any).avatar_url ?? null }); });
  }, [user]);

  useEffect(() => {
    if (editId) {
      (async () => {
        const { data: col } = await (supabase as any).from("discovery_collections").select("title, city, category, is_public, author_name, author_avatar").eq("id", editId).maybeSingle();
        if (col) {
          setLegacyTitle(col.title ?? ""); if (col.city) setCity(col.city); setCategory(col.category ?? null);
          setVisibility(col.is_public === false ? "private" : (col.author_name === "Anonim" && !col.author_avatar ? "anon" : "profile"));
        }
        const { data: its } = await (supabase as any).from("discovery_items").select("*").eq("collection_id", editId).order("order_index", { ascending: true });
        if (its) setItems(its.map((i: any, idx: number) => ({
          key: `e${idx}`, place_id: i.place_id ?? null, place_name: i.place_name, category: i.category ?? null,
          address: i.address ?? null, latitude: i.latitude ?? null, longitude: i.longitude ?? null,
          rating: i.rating ?? null, google_place_id: i.google_place_id ?? null, photo_url: i.photo_url ?? null, short_desc: i.short_desc ?? "",
        })));
      })();
      return;
    }
    // Prefill z polubionych danego miasta.
    if (params.get("from") === "liked") {
      const liked = getHistoryByCity().find((g) => g.city === city)?.places ?? [];
      if (liked.length) {
        (async () => {
          const names = liked.map((p) => p.place_name);
          const { data: rows } = await (supabase as any).from("places").select("id, place_name, category, address, latitude, longitude, rating, photo_url").in("city", expandCity(city)).in("place_name", names);
          const byName = new Map<string, any>((rows ?? []).map((r: any) => [r.place_name.toLowerCase(), r]));
          setItems(liked.map((p, idx) => {
            const m = byName.get(p.place_name.toLowerCase());
            return {
              key: `l${idx}`, place_id: m?.id ?? null, place_name: p.place_name, category: m?.category ?? p.category ?? null,
              address: m?.address ?? p.address ?? null, latitude: m?.latitude ?? p.latitude ?? null, longitude: m?.longitude ?? p.longitude ?? null,
              rating: m?.rating ?? p.rating ?? null, google_place_id: null, photo_url: m?.photo_url ?? p.photo_url ?? null, short_desc: "",
            };
          }));
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  const addItem = (it: Omit<RankingItem, "key" | "short_desc">) => {
    if (items.some((x) => x.place_name.toLowerCase() === it.place_name.toLowerCase())) { toast("To miejsce już jest na liście"); return; }
    setItems((prev) => [...prev, { ...it, key: `k${Date.now()}`, short_desc: "" }]);
  };
  const removeItem = (key: string) => setItems((prev) => prev.filter((x) => x.key !== key));
  const setNote = (key: string, v: string) => setItems((prev) => prev.map((x) => x.key === key ? { ...x, short_desc: v } : x));

  // Otworz wizytowke miejsca (te same dane co w feedzie; Google dociaga reszte).
  const openDetail = (it: RankingItem) => {
    setDetailPlace({
      id: it.place_id ?? it.google_place_id ?? it.place_name,
      place_name: it.place_name, category: it.category || "other",
      city, address: it.address ?? "", latitude: it.latitude ?? 0, longitude: it.longitude ?? 0,
      rating: it.rating ?? 0, photo_url: it.photo_url ?? "", vibe_tags: [], description: "",
    } as MockPlace);
  };

  const addedNames = new Set(items.map((x) => x.place_name.toLowerCase()));

  // Dodaj miejsce z bazy (wynik wyszukiwarki lub propozycji).
  const addDbPlace = (r: any) => {
    addItem({ place_id: r.id, place_name: r.place_name, category: r.category ?? null, address: r.address ?? null, latitude: r.latitude ?? null, longitude: r.longitude ?? null, rating: r.rating ?? null, google_place_id: null, photo_url: r.photo_url ?? null });
    setSuggestions((prev) => prev.filter((s) => s.id !== r.id));
  };

  // Miejsce spoza bazy: najpierw POKAZ wizytowke do zatwierdzenia (Google proxy),
  // dopiero po "Dodaj" trafia na liste. User widzi co dodaje.
  const previewCustomByName = async (name: string) => {
    if (!name.trim() || addingCustom) return;
    setAddingCustom(true);
    const res = await fetchGooglePlace({ name: name.trim(), city });
    setAddingCustom(false);
    if (!res || !res.place_name) { toast.error("Nie znaleziono miejsca - sprawdź nazwę"); return; }
    setCustomPreview({
      item: res,
      place: {
        id: res.google_place_id ?? res.place_name, place_name: res.place_name, category: res.category || "other",
        city, address: res.address ?? "", latitude: res.latitude ?? 0, longitude: res.longitude ?? 0,
        rating: res.rating ?? 0, photo_url: res.photo_url ?? "", vibe_tags: [], description: "",
      } as MockPlace,
    });
  };
  const confirmCustom = () => {
    if (!customPreview) return;
    addItem(customPreview.item);
    setCustomPreview(null);
    setSearch("");
    setSearchResults([]);
  };

  // Wyszukiwarka miejsc w bazie (debounce). Puste query -> brak wynikow (pokazujemy propozycje).
  useEffect(() => {
    const q = search.trim();
    if (q.length < 2) { setSearchResults([]); setSearchLoading(false); return; }
    setSearchLoading(true);
    const t = setTimeout(async () => {
      const { data } = await (supabase as any).from("places")
        .select("id, place_name, category, address, latitude, longitude, rating, photo_url")
        .in("city", expandCity(city)).ilike("place_name", `%${q}%`).eq("is_active", true).limit(15);
      setSearchResults(data ?? []); setSearchLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [search, city]);

  // Propozycje: losowe miejsca z bazy dla miasta (swiper pod wyszukiwarka).
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await (supabase as any).from("places")
        .select("id, place_name, category, address, latitude, longitude, rating, photo_url")
        .in("city", expandCity(city)).eq("is_active", true).limit(40);
      if (!alive) return;
      const shuffled = [...(data ?? [])].sort(() => Math.random() - 0.5).slice(0, 15);
      setSuggestions(shuffled);
    })();
    return () => { alive = false; };
  }, [city]);

  const collectionTitle = getTheme(category)?.label || legacyTitle.trim() || "Zestawienie";
  const canPublish = !!category && !!city && items.length >= 2 && !publishing;

  const publish = async () => {
    if (!user || !canPublish) return;
    setPublishing(true);
    try {
      let collectionId = editId;
      // Wszystkie nowe zestawienia czekaja na akceptacje admina (App Store Guideline
      // 1.2 UGC + decyzja: moderacja na starcie dla wszystkich, nie tylko anonimow).
      const moderationStatus = "pending";
      // Tozsamosc autora wg wyboru widocznosci.
      const isPublic = visibility !== "private";
      const authorName = visibility === "anon" ? "Anonim" : author.name;
      const authorAvatar = visibility === "anon" ? null : author.avatar;
      if (editId) {
        await (supabase as any).from("discovery_collections").update({ title: collectionTitle, city, category, is_public: isPublic, author_name: authorName, author_avatar: authorAvatar, updated_at: new Date().toISOString() }).eq("id", editId);
        await (supabase as any).from("discovery_items").delete().eq("collection_id", editId);
      } else {
        const { data: col, error } = await (supabase as any).from("discovery_collections").insert({
          user_id: user.id, author_name: authorName, author_avatar: authorAvatar, title: collectionTitle,
          category, city, kind: "ranking", is_public: isPublic,
          moderation_status: moderationStatus,
        }).select("id").single();
        if (error || !col) throw new Error(error?.message ?? "insert failed");
        collectionId = col.id;
      }
      const rows = items.map((it, idx) => ({
        collection_id: collectionId, order_index: idx, place_id: it.place_id, place_name: it.place_name,
        category: it.category, address: it.address, latitude: it.latitude, longitude: it.longitude,
        rating: it.rating, google_place_id: it.google_place_id, photo_url: it.photo_url, short_desc: it.short_desc.trim() || null,
      }));
      const { error: itemsErr } = await (supabase as any).from("discovery_items").insert(rows);
      if (itemsErr) throw new Error(itemsErr.message);
      // Kazda nowa publikacja -> powiadom admina mailem do moderacji (best-effort, nie blokuj flow).
      if (!editId) {
        supabase.functions.invoke("notify-admin-content", {
          body: { type: "ranking", title: collectionTitle, city, collection_id: collectionId, author: author.name },
        }).catch((e) => console.warn("[CreateRanking] notify-admin-content failed:", e));
      }
      toast.success(
        editId ? "Zestawienie zaktualizowane!"
          : visibility === "private" ? "Zapisane. Zestawienie jest prywatne (tylko dla Ciebie)."
          : "Wysłane! Zestawienie pojawi się po akceptacji moderatora."
      );
      navigate("/eksploruj");
    } catch (e: any) {
      toast.error(`Nie udało się zapisać: ${e?.message ?? "błąd"}`);
    } finally {
      setPublishing(false);
    }
  };

  // ── Krok 1: wybor motywu zestawienia (tylko z zamknietej listy) ──────────────
  if (showThemePicker) {
    return (
      <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
        <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
          <button onClick={() => navigate(-1)} aria-label="Wstecz" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-base">Nowe zestawienie</span>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <h1 className="text-2xl font-display font-extrabold tracking-tight leading-tight">Jaki to motyw?</h1>
          <p className="text-sm text-muted-foreground mt-1.5">Wybierz temat swojej kolekcji miejsc. To pomaga innym ją&nbsp;znaleźć.</p>
          <div className="grid grid-cols-2 gap-3 mt-5">
            {COLLECTION_THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => setCategory(t.id)}
                className="flex flex-col items-start gap-1 rounded-3xl border border-border/60 bg-card p-4 text-left active:scale-[0.97] transition-transform"
              >
                <span className="text-3xl leading-none">{t.emoji}</span>
                <span className="font-bold text-sm mt-1.5 leading-tight">{t.label}</span>
                <span className="text-[11px] text-muted-foreground leading-snug">{t.hint}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const activeTheme = getTheme(category);

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={() => navigate(-1)} aria-label="Wstecz" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-base">{editId ? "Edytuj zestawienie" : "Nowe zestawienie"}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-8">
        {/* Widocznosc: profil | anonimowo | prywatne (na gorze, bez naglowka) */}
        <div>
          <div className="flex gap-1.5 rounded-2xl bg-secondary p-1">
            {([
              { id: "profile", label: "Z profilem" },
              { id: "anon", label: "Anonimowo" },
              { id: "private", label: "Prywatnie" },
            ] as const).map((o) => (
              <button key={o.id} type="button" onClick={() => setVisibility(o.id)}
                className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${visibility === o.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                {o.label}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1.5">
            {visibility === "private" ? "Tylko dla Ciebie, nie trafi do Eksploruj." : visibility === "anon" ? "Widoczne w Eksploruj, ale bez Twojego profilu." : "Widoczne w Eksploruj z Twoim profilem i awatarem."}
          </p>
        </div>

        {/* Motyw (chip, zmiana tylko przy nowym zestawieniu) */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Motyw</label>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 border border-orange-200 px-3 py-1.5 text-sm font-semibold text-orange-700">
              {activeTheme ? <>{activeTheme.emoji} {activeTheme.label}</> : "Bez motywu"}
            </span>
            {!editId && (
              <button onClick={() => setCategory(null)} className="text-xs font-semibold text-muted-foreground underline underline-offset-2">zmień</button>
            )}
          </div>
        </div>

        {/* Miasto */}
        <div>
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Miasto</label>
          <select value={city} onChange={(e) => setCity(e.target.value)}
            className="w-full rounded-2xl bg-secondary text-secondary-foreground border-0 px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40">
            {PL_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Lista miejsc: karty jak w dzienniku (tap = wizytowka) + notka autora pod spodem */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Miejsca ({items.length})</p>
            {items.length > 0 && (
              <div className="flex rounded-full bg-secondary p-0.5">
                <button type="button" onClick={() => setPlaceView("list")} aria-label="Widok listy" className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <List className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setPlaceView("detail")} aria-label="Widok szczegółowy" className={`px-2.5 py-1 rounded-full transition-colors ${placeView === "detail" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}>
                  <GalleryHorizontalEnd className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Dodaj min. 2&nbsp;miejsca do swojej kolekcji.</p>
          )}
          <div className="space-y-2.5">
            {items.map((it) => {
              const cat = categoryBadge(it.category);
              // Widok LISTA: kompaktowy wiersz + cienka notka pod spodem.
              if (placeView === "list") {
                return (
                  <div key={it.key} className="rounded-2xl bg-secondary p-2.5">
                    <div className="flex items-center gap-2.5">
                      <button onClick={() => openDetail(it)} className="flex items-center gap-2.5 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
                        {it.photo_url
                          ? <img src={it.photo_url} alt="" className="h-11 w-11 rounded-lg object-cover shrink-0" />
                          : <div className="h-11 w-11 rounded-lg bg-background flex items-center justify-center text-muted-foreground shrink-0"><MapPin className="h-4 w-4" /></div>}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold truncate">{it.place_name}</p>
                            {it.rating != null && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{it.rating}</span>}
                          </div>
                          {cat && <p className="text-[11px] text-muted-foreground truncate">{cat.emoji} {cat.label}</p>}
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </button>
                      <button onClick={() => removeItem(it.key)} aria-label="Usuń miejsce" className="h-7 w-7 flex items-center justify-center rounded-full text-destructive active:bg-destructive/10 shrink-0"><X className="h-4 w-4" /></button>
                    </div>
                    <input value={it.short_desc} onChange={(e) => setNote(it.key, e.target.value)} maxLength={120}
                      placeholder="Notka (opcjonalnie)…"
                      className="mt-2 w-full rounded-lg bg-background px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
                  </div>
                );
              }
              // Widok SZCZEGOLOWY: karta jak w dzienniku.
              return (
                <div key={it.key} className="rounded-2xl bg-secondary p-3">
                  <div className="flex items-start gap-3">
                    <button onClick={() => openDetail(it)} className="flex items-start gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
                      {it.photo_url
                        ? <img src={it.photo_url} alt="" className="h-14 w-14 rounded-xl object-cover shrink-0" />
                        : <div className="h-14 w-14 rounded-xl bg-background flex items-center justify-center text-muted-foreground shrink-0"><MapPin className="h-5 w-5" /></div>}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold truncate">{it.place_name}</p>
                          {it.rating != null && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{it.rating}</span>}
                        </div>
                        {cat && <span className="inline-flex items-center gap-1 mt-1 rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold">{cat.emoji} {cat.label}</span>}
                        {it.address && <p className="text-[11px] text-muted-foreground truncate mt-1">{it.address}</p>}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </button>
                    <button onClick={() => removeItem(it.key)} aria-label="Usuń miejsce" className="h-7 w-7 flex items-center justify-center rounded-full text-destructive active:bg-destructive/10 shrink-0"><X className="h-4 w-4" /></button>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground mb-1">Notka</p>
                    <input value={it.short_desc} onChange={(e) => setNote(it.key, e.target.value)} maxLength={120}
                      placeholder="Twoja notka o tym miejscu (opcjonalnie)…"
                      className="w-full rounded-xl bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Wyszukiwarka miejsc (focus -> przewin na gore, zeby wyniki byly widoczne) */}
          <div ref={searchRef} className="relative mt-4 scroll-mt-3">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2 z-10" />
            <input value={search} onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setTimeout(() => searchRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 150)}
              placeholder={`Szukaj miejsca w ${city}…`}
              className="w-full rounded-2xl bg-secondary text-secondary-foreground border-0 pl-9 pr-3 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/50" />
          </div>

          {/* Wyniki wyszukiwania (gdy wpisano fraze) */}
          {search.trim().length >= 2 ? (
            <div className="mt-2 rounded-2xl bg-secondary overflow-hidden divide-y divide-background/60">
              {searchLoading && <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
              {searchResults.filter((r) => !addedNames.has(r.place_name.toLowerCase())).map((r) => (
                <button key={r.id} onClick={() => addDbPlace(r)}
                  className="w-full flex items-center gap-3 p-2.5 active:bg-background/50 text-left">
                  {r.photo_url ? <img src={r.photo_url} alt="" className="h-11 w-11 rounded-xl object-cover shrink-0" /> : <div className="h-11 w-11 rounded-xl bg-background flex items-center justify-center shrink-0"><MapPin className="h-4 w-4 text-muted-foreground" /></div>}
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{r.place_name}</p>{r.address && <p className="text-[11px] text-muted-foreground truncate">{r.address}</p>}</div>
                  <Plus className="h-4 w-4 text-orange-600 shrink-0" />
                </button>
              ))}
              {/* Brak w bazie -> dodaj recznie po nazwie (Google, bez zargonu) */}
              {!searchLoading && (
                <button onClick={() => previewCustomByName(search)} disabled={addingCustom}
                  className="w-full flex items-center gap-2 p-3 text-left active:bg-background/50 disabled:opacity-50">
                  {addingCustom ? <Loader2 className="h-4 w-4 animate-spin text-orange-600 shrink-0" /> : <Search className="h-4 w-4 text-orange-600 shrink-0" />}
                  <span className="text-sm font-semibold">Zobacz „{search.trim()}" i&nbsp;dodaj</span>
                </button>
              )}
            </div>
          ) : (
            /* Propozycje: losowe miejsca (swiper, ~2,5 karty widoczne) */
            suggestions.filter((s) => !addedNames.has(s.place_name.toLowerCase())).length > 0 && (
              <div className="mt-4">
                <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">Propozycje w {city}</p>
                <div className="flex gap-2.5 overflow-x-auto scrollbar-none snap-x snap-mandatory -mr-4 pr-4 pb-1">
                  {suggestions.filter((s) => !addedNames.has(s.place_name.toLowerCase())).map((s) => (
                    <button key={s.id} onClick={() => addDbPlace(s)}
                      className="shrink-0 w-[40%] snap-start rounded-2xl bg-secondary overflow-hidden text-left active:scale-[0.97] transition-transform">
                      <div className="relative aspect-[4/3] bg-background">
                        {s.photo_url ? <img src={s.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" /> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><MapPin className="h-5 w-5" /></div>}
                        <div className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-primary text-white flex items-center justify-center shadow-sm"><Plus className="h-3.5 w-3.5" /></div>
                        {s.rating != null && (
                          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-white/90 backdrop-blur-sm">
                            <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" /><span className="text-[9px] font-bold">{s.rating}</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs font-bold leading-tight truncate px-2 py-2">{s.place_name}</p>
                    </button>
                  ))}
                  <div className="shrink-0 w-1" />
                </div>
              </div>
            )
          )}
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/20">
        <button onClick={publish} disabled={!canPublish}
          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-transform disabled:opacity-50">
          {publishing ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (editId ? "Zapisz zmiany" : visibility === "private" ? "Zapisz zestawienie" : "Opublikuj zestawienie")}
        </button>
      </div>

      {detailPlace && (
        <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={city} skipGoogleFetch={false} />
      )}
      {customPreview && (
        <PlaceSwiperDetail open={!!customPreview} onOpenChange={(o) => { if (!o) setCustomPreview(null); }}
          place={customPreview.place} city={city} skipGoogleFetch={false}
          onLike={confirmCustom} onSkip={() => setCustomPreview(null)} />
      )}
    </div>
  );
};

export default CreateRanking;
