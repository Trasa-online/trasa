import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, X, Loader2, ChevronUp, ChevronDown, Star, MapPin, Database, Globe } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ORIGIN_COUNTRIES } from "@/lib/locations";
import { expandCity } from "@/lib/cities";
import { getHistoryByCity } from "@/lib/exploreLikes";
import { forwardGeocode, reverseGeocode } from "@/lib/googleMaps";
import { getPhotoUrl } from "@/lib/placePhotos";

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
type CustomTab = "nazwa" | "adres" | "koordynaty";

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
  const { user, isAnonymous } = useAuth();

  const [title, setTitle] = useState("");
  const [city, setCity] = useState(params.get("city") || "Warszawa");
  const [items, setItems] = useState<RankingItem[]>([]);
  const [publishing, setPublishing] = useState(false);

  const [addMode, setAddMode] = useState<null | "search" | "custom">(null);
  const [author, setAuthor] = useState<{ name: string; avatar: string | null }>({ name: "Użytkownik", avatar: null });

  // TYMCZASOWO: tworzenie NOWYCH zestawien zablokowane (deep-link guard; edycja istniejacych dziala).
  // Wejscia w UI sa wyszarzone (Explore), to chroni bezposrednie wejscie na /zestawienie/nowe.
  useEffect(() => {
    if (!editId) {
      toast("Tworzenie zestawień będzie dostępne wkrótce 🙌");
      navigate("/eksploruj", { replace: true });
    }
  }, [editId, navigate]);

  // ── Author + edit/liked prefill ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("username, first_name, avatar_url").eq("id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setAuthor({ name: (data as any).first_name || (data as any).username || "Użytkownik", avatar: (data as any).avatar_url ?? null }); });
  }, [user]);

  useEffect(() => {
    if (editId) {
      (async () => {
        const { data: col } = await (supabase as any).from("discovery_collections").select("title, city").eq("id", editId).maybeSingle();
        if (col) { setTitle(col.title ?? ""); if (col.city) setCity(col.city); }
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
        setTitle((t) => t || `Moje miejsca w ${city}`);
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
    setAddMode(null);
  };
  const removeItem = (key: string) => setItems((prev) => prev.filter((x) => x.key !== key));
  const move = (idx: number, dir: -1 | 1) => setItems((prev) => {
    const next = [...prev]; const j = idx + dir;
    if (j < 0 || j >= next.length) return prev;
    [next[idx], next[j]] = [next[j], next[idx]]; return next;
  });
  const setNote = (key: string, v: string) => setItems((prev) => prev.map((x) => x.key === key ? { ...x, short_desc: v } : x));

  const canPublish = title.trim().length >= 3 && city && items.length >= 2 && !publishing;

  const publish = async () => {
    if (!user || !canPublish) return;
    setPublishing(true);
    try {
      let collectionId = editId;
      // Anonimowi userzy -> tresc czeka na akceptacje admina (App Store Guideline 1.2).
      // Konta z emailem publikuja od razu.
      const moderationStatus = isAnonymous ? "pending" : "approved";
      if (editId) {
        await (supabase as any).from("discovery_collections").update({ title: title.trim(), city, updated_at: new Date().toISOString() }).eq("id", editId);
        await (supabase as any).from("discovery_items").delete().eq("collection_id", editId);
      } else {
        const { data: col, error } = await (supabase as any).from("discovery_collections").insert({
          user_id: user.id, author_name: author.name, author_avatar: author.avatar, title: title.trim(), city, kind: "ranking", is_public: true,
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
      // Tresc od anona -> powiadom admina mailem (best-effort, nie blokuj flow).
      if (!editId && moderationStatus === "pending") {
        supabase.functions.invoke("notify-admin-content", {
          body: { type: "ranking", title: title.trim(), city, collection_id: collectionId, author: author.name },
        }).catch((e) => console.warn("[CreateRanking] notify-admin-content failed:", e));
      }
      toast.success(
        editId ? "Zestawienie zaktualizowane!"
          : moderationStatus === "pending"
            ? "Wysłane! Zestawienie pojawi się po akceptacji moderatora."
            : "Zestawienie opublikowane!"
      );
      navigate("/eksploruj");
    } catch (e: any) {
      toast.error(`Nie udało się zapisać: ${e?.message ?? "błąd"}`);
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 border-b border-border/20 shrink-0">
        <button onClick={() => navigate(-1)} aria-label="Wstecz" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="font-bold text-base">{editId ? "Edytuj zestawienie" : "Nowe zestawienie"}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Miasto + tytuł */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Miasto</label>
            <select value={city} onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/60">
              {PL_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-1.5 block">Tytuł</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={70}
              placeholder={`np. Top miejsc w ${city}`}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/60 placeholder:text-muted-foreground/50" />
          </div>
        </div>

        {/* Lista miejsc (ranking) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Miejsca ({items.length})</p>
          </div>
          {items.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">Dodaj min. 2 miejsca i ustaw kolejność = ranking.</p>
          )}
          <div className="space-y-2">
            {items.map((it, idx) => (
              <div key={it.key} className="flex items-start gap-2.5 bg-card border border-border/40 rounded-2xl p-2.5">
                <div className="h-7 w-7 rounded-full bg-orange-600 text-white text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{idx + 1}</div>
                {it.photo_url
                  ? <img src={it.photo_url} alt="" className="h-12 w-12 rounded-xl object-cover shrink-0" />
                  : <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0"><MapPin className="h-5 w-5" /></div>}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-bold truncate">{it.place_name}</p>
                    {it.rating != null && <span className="text-[11px] text-muted-foreground flex items-center gap-0.5 shrink-0"><Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />{it.rating}</span>}
                    {it.place_id == null && <span className="text-[9px] font-bold text-orange-600 bg-orange-50 rounded-full px-1.5 py-0.5 shrink-0">spoza bazy</span>}
                  </div>
                  {it.address && <p className="text-[11px] text-muted-foreground truncate">{it.address}</p>}
                  <input value={it.short_desc} onChange={(e) => setNote(it.key, e.target.value)} maxLength={120}
                    placeholder="Notka (opcjonalnie)…"
                    className="mt-1.5 w-full rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs outline-none focus:ring-1 focus:ring-orange-300 placeholder:text-muted-foreground/50" />
                </div>
                <div className="flex flex-col items-center gap-0.5 shrink-0">
                  <button onClick={() => move(idx, -1)} disabled={idx === 0} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 active:bg-muted"><ChevronUp className="h-4 w-4" /></button>
                  <button onClick={() => move(idx, 1)} disabled={idx === items.length - 1} className="h-6 w-6 flex items-center justify-center rounded-md text-muted-foreground disabled:opacity-30 active:bg-muted"><ChevronDown className="h-4 w-4" /></button>
                  <button onClick={() => removeItem(it.key)} className="h-6 w-6 flex items-center justify-center rounded-md text-destructive active:bg-destructive/10"><X className="h-4 w-4" /></button>
                </div>
              </div>
            ))}
          </div>

          {/* Dodawanie */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button onClick={() => setAddMode("search")} className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-foreground active:bg-muted/40">
              <Database className="h-4 w-4 text-orange-600" /> Z bazy Trasy
            </button>
            <button onClick={() => setAddMode("custom")} className="flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-border text-sm font-semibold text-foreground active:bg-muted/40">
              <Globe className="h-4 w-4 text-orange-600" /> Spoza bazy
            </button>
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="shrink-0 px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] border-t border-border/20">
        <button onClick={publish} disabled={!canPublish}
          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm shadow-md shadow-orange-500/20 active:scale-[0.98] transition-transform disabled:opacity-50">
          {publishing ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (editId ? "Zapisz zmiany" : "Opublikuj zestawienie")}
        </button>
      </div>

      {addMode === "search" && <SearchSheet city={city} onClose={() => setAddMode(null)} onAdd={addItem} />}
      {addMode === "custom" && <CustomSheet city={city} onClose={() => setAddMode(null)} onAdd={addItem} />}
    </div>
  );
};

// ── Search w bazie places ─────────────────────────────────────────────────────
function SearchSheet({ city, onClose, onAdd }: { city: string; onClose: () => void; onAdd: (it: Omit<RankingItem, "key" | "short_desc">) => void }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setResults([]); return; }
      setLoading(true);
      const { data } = await (supabase as any).from("places").select("id, place_name, category, address, latitude, longitude, rating, photo_url")
        .in("city", expandCity(city)).ilike("place_name", `%${q.trim()}%`).eq("is_active", true).limit(15);
      setResults(data ?? []); setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q, city]);
  return (
    <Overlay title={`Szukaj w ${city}`} onClose={onClose}>
      <div className="relative mb-3">
        <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nazwa miejsca…"
          className="w-full rounded-2xl border border-border bg-background pl-9 pr-3 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300" />
      </div>
      {loading && <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
      <div className="space-y-1.5">
        {results.map((r) => (
          <button key={r.id} onClick={() => onAdd({ place_id: r.id, place_name: r.place_name, category: r.category, address: r.address, latitude: r.latitude, longitude: r.longitude, rating: r.rating ?? null, google_place_id: null, photo_url: r.photo_url ?? null })}
            className="w-full flex items-center gap-3 p-2 rounded-xl active:bg-muted/50 text-left">
            {r.photo_url ? <img src={r.photo_url} alt="" className="h-11 w-11 rounded-xl object-cover shrink-0" /> : <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center shrink-0"><MapPin className="h-4 w-4 text-muted-foreground" /></div>}
            <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{r.place_name}</p>{r.address && <p className="text-[11px] text-muted-foreground truncate">{r.address}</p>}</div>
            <Plus className="h-4 w-4 text-orange-600 shrink-0" />
          </button>
        ))}
        {!loading && q.trim().length >= 2 && results.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Brak w bazie. Dodaj „Spoza bazy".</p>}
      </div>
    </Overlay>
  );
}

// ── Custom: nazwa / adres / koordynaty + podgląd ──────────────────────────────
function CustomSheet({ city, onClose, onAdd }: { city: string; onClose: () => void; onAdd: (it: Omit<RankingItem, "key" | "short_desc">) => void }) {
  const [tab, setTab] = useState<CustomTab>("nazwa");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Omit<RankingItem, "key" | "short_desc"> | null>(null);

  const search = async () => {
    setLoading(true); setPreview(null);
    const opts = tab === "nazwa" ? { name, city }
      : tab === "adres" ? { name: name || undefined, address, city }
      : { name: name || undefined, lat: parseFloat(lat), lng: parseFloat(lng), city };
    const res = await fetchGooglePlace(opts);
    setLoading(false);
    if (!res || !res.place_name) { toast.error("Nie znaleziono miejsca - sprawdź dane"); return; }
    setPreview(res);
  };

  const tabs: { id: CustomTab; label: string }[] = [{ id: "nazwa", label: "Nazwa" }, { id: "adres", label: "Adres" }, { id: "koordynaty", label: "Koordynaty" }];
  const canSearch = tab === "nazwa" ? name.trim().length >= 2 : tab === "adres" ? address.trim().length >= 3 : (!!lat && !!lng);

  return (
    <Overlay title="Dodaj miejsce spoza bazy" onClose={onClose}>
      <div className="flex rounded-2xl bg-muted p-1 mb-3">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setPreview(null); }}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${tab === t.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{t.label}</button>
        ))}
      </div>
      <div className="space-y-2.5">
        {tab === "nazwa" && (
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa miejsca (np. Bar Mleczny X)"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300" />
        )}
        {tab === "adres" && (<>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa (opcjonalnie)"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300" />
          <input autoFocus value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Adres (ulica, miasto)"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300" />
        </>)}
        {tab === "koordynaty" && (<>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nazwa (opcjonalnie)"
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300" />
          <div className="flex gap-2">
            <input value={lat} onChange={(e) => setLat(e.target.value)} inputMode="decimal" placeholder="Szer. (lat)"
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300" />
            <input value={lng} onChange={(e) => setLng(e.target.value)} inputMode="decimal" placeholder="Dł. (lng)"
              className="flex-1 rounded-2xl border border-border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-orange-300" />
          </div>
        </>)}
        <button onClick={search} disabled={!canSearch || loading}
          className="w-full py-3 rounded-2xl bg-foreground text-background font-bold text-sm active:scale-[0.98] transition-transform disabled:opacity-40">
          {loading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : "Znajdź miejsce"}
        </button>
      </div>

      {/* Podgląd-karta (okładka + nazwa + gwiazdki + adres) z Odrzuć / Dodaj */}
      {preview && (
        <div className="mt-4 rounded-2xl border border-border overflow-hidden bg-card">
          <div className="relative w-full aspect-[16/10] bg-muted">
            {preview.photo_url ? <img src={preview.photo_url} alt="" className="absolute inset-0 w-full h-full object-cover" /> : <div className="absolute inset-0 flex items-center justify-center text-muted-foreground"><MapPin className="h-8 w-8" /></div>}
          </div>
          <div className="p-3">
            <p className="text-base font-black leading-tight">{preview.place_name}</p>
            {preview.rating != null && <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />{preview.rating}</p>}
            {preview.address && <p className="text-xs text-muted-foreground mt-0.5">{preview.address}</p>}
            <div className="flex gap-2 mt-3">
              <button onClick={() => setPreview(null)} className="flex-1 py-2.5 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97]">Odrzuć</button>
              <button onClick={() => onAdd(preview)} className="flex-1 py-2.5 rounded-full bg-primary text-white text-sm font-bold active:scale-[0.97]">Dodaj</button>
            </div>
          </div>
        </div>
      )}
    </Overlay>
  );
}

function Overlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div className="bg-background rounded-t-3xl max-h-[88dvh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-4 pb-3 shrink-0">
          <p className="text-lg font-black">{title}</p>
          <button onClick={onClose} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center active:bg-muted/70"><X className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">{children}</div>
      </div>
    </div>
  );
}

export default CreateRanking;
