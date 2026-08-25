import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Check, X, RefreshCw, Loader2, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import { usePlaceSearch } from "@/hooks/usePlaceSearch";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { GoogleGlyph } from "@/components/icons/GoogleGlyph";
import { openExternal } from "@/lib/openExternal";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { fetchSavedPlaces, type SavedPlace } from "@/lib/placeLists";
import {
  fetchRouteProposals, addRouteProposal, deleteRouteProposal, promoteProposalToPin,
  type RouteProposal, type ProposalInput,
} from "@/lib/routeProposals";

const NBSP = " ";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const normKey = (s: unknown) => String(s ?? "").toLowerCase().trim();
const normCity = (s: unknown) =>
  String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l").trim();
const keyOf = (p: { place_id?: string | null; place_name?: string | null }) =>
  (p.place_id && String(p.place_id).trim()) ? `id:${p.place_id}` : `nm:${normKey(p.place_name)}`;

// Wspolna PULA PROPOZYCJI wyjazdu (route_proposals). Host tworzy wyjazd + swoje piny; zaproszeni
// dorzucaja propozycje tutaj (async). Host (isOwner) promuje wybrane do trasy (pins) lub odrzuca;
// autor moze wycofac swoja. Wyszukiwarka Google + "Twoje zapisane" (z miasta wyjazdu) + wizytowka.
export default function TripProposalsSheet({
  open, onOpenChange, routeId, city, isOwner, onChanged,
  fullscreen = false, pins, tripTitle, onBack,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  routeId: string | null;
  city: string | null;
  isOwner: boolean;
  onChanged?: () => void;
  // fullscreen = pelnoekranowy widok uczestnika (wejscie z zaproszenia do roboczej trasy grupowej),
  // zamiast bottom-sheet. pins = miejsca juz w trasie (read-only, uczestnik NIE usuwa cudzych). onBack
  // = powrot (nawigacja). tripTitle = tytul w naglowku.
  fullscreen?: boolean;
  pins?: any[];
  tripTitle?: string | null;
  onBack?: () => void;
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [detailPlace, setDetailPlace] = useState<any | null>(null);
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null); // id propozycji w trakcie akcji (spinner)

  const enabled = (fullscreen || open) && !!routeId;

  // Srodek miasta (geokod) - twardy filtr wynikow Google w obrebie miasta wyjazdu.
  const { data: geoCenter = null } = useQuery({
    queryKey: ["proposals-city-center", city],
    enabled: enabled && !!city,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke("google-places-proxy", { body: { action: "textsearch", query: city } });
      const r = ((data as any)?.results ?? [])[0];
      return r?.latitude != null ? { lat: r.latitude as number, lng: r.longitude as number } : null;
    },
  });
  const { results, searching, blocked, searchMode } =
    usePlaceSearch(query, { city, center: geoCenter, scopeKm: 30, enabled });

  const { data: proposals = [], refetch: refetchProposals, isLoading: loadingProposals, isRefetching } = useQuery({
    queryKey: ["route-proposals", routeId],
    enabled,
    queryFn: () => fetchRouteProposals(routeId!),
  });

  // Piny trasy (klucze) - do oznaczenia "juz w trasie" i dedupu przy dodawaniu.
  const { data: pinKeys = new Set<string>(), refetch: refetchPins } = useQuery({
    queryKey: ["route-pin-keys", routeId],
    enabled,
    queryFn: async () => {
      const { data } = await (supabase as any).from("pins").select("place_id, place_name").eq("route_id", routeId);
      return new Set<string>(((data ?? []) as any[]).map((p) => keyOf(p)));
    },
  });

  const { data: savedPlaces = [] } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: enabled && !!user?.id,
    queryFn: () => fetchSavedPlaces(user!.id),
  });
  // Zapisane TYLKO z miasta wyjazdu (jak w kreatorze); gdy nic nie pasuje - sekcja sie nie pokazuje.
  const savedInCity = (savedPlaces as SavedPlace[]).filter((p) => {
    const c = normCity(city);
    return !c || normCity(p.city) === c || normCity(p.address).includes(c);
  });

  const proposedKeys = new Set<string>((proposals as RouteProposal[]).map((p) => keyOf(p)));

  const openDetail = (p: any) => {
    haptics.light();
    setDetailPlace({
      id: p.place_id || p.id || p.place_name,
      place_name: p.place_name, category: p.category || "other", city: (p.city ?? city) || "",
      address: p.address || "", latitude: p.latitude ?? 0, longitude: p.longitude ?? 0,
      rating: p.rating ?? 0, photo_url: p.photo_url ?? "", vibe_tags: [],
      description: p.description ?? p.short_desc ?? "", google_place_id: p.google_place_id ?? null,
    });
  };
  const openGooglePlace = (p: any) => {
    haptics.light();
    const q = encodeURIComponent([p.place_name, p.address, p.city ?? city].filter(Boolean).join(", "));
    const gpid = typeof p.google_place_id === "string" && p.google_place_id.trim() ? p.google_place_id.trim() : "";
    const pid0 = typeof p.place_id === "string" && p.place_id.trim() ? p.place_id.trim() : "";
    const gid = gpid || (UUID_RE.test(pid0) ? "" : pid0);
    const placeIdParam = gid ? `&query_place_id=${encodeURIComponent(gid)}` : "";
    void openExternal(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`);
  };

  // Dodaj miejsce do PULI propozycji (z wynikow Google lub zapisanych).
  const addToPool = async (p: ProposalInput) => {
    if (!user || !routeId) return;
    if (proposedKeys.has(keyOf(p))) { toast("To miejsce jest już w propozycjach"); return; }
    haptics.light();
    const ok = await addRouteProposal(routeId, user.id, p);
    if (!ok) { haptics.error(); toast.error("Nie udało się dodać propozycji"); return; }
    haptics.success();
    await refetchProposals();
  };

  // Host: promuj propozycje do trasy (pin na koniec). Usuwa propozycje z puli.
  const promote = async (prop: RouteProposal) => {
    if (!user || !routeId) return;
    setBusyId(prop.id); haptics.light();
    const ok = await promoteProposalToPin(routeId, user.id, prop);
    setBusyId(null);
    if (!ok) { haptics.error(); toast.error("Nie udało się dodać do trasy"); return; }
    haptics.success(); toast.success(`Dodano „${prop.place_name}" do trasy`);
    await Promise.all([refetchProposals(), refetchPins()]);
    onChanged?.();
  };

  // Host odrzuca propozycje LUB autor wycofuje swoja (RLS egzekwuje uprawnienia).
  const remove = async (prop: RouteProposal) => {
    setBusyId(prop.id); haptics.light();
    const ok = await deleteRouteProposal(prop.id);
    setBusyId(null);
    if (!ok) { haptics.error(); toast.error("Nie udało się usunąć propozycji"); return; }
    await refetchProposals();
  };

  // ── wiersz wyszukiwarki / zapisanych: klik = wizytowka, Google w kolku, + = dodaj do puli ──
  const renderAddRow = (opts: { rowKey: string; place: any; subtitle?: string | null }) => {
    const added = proposedKeys.has(keyOf(opts.place));
    return (
      <div key={opts.rowKey} className="w-full flex items-center gap-2 rounded-2xl bg-secondary/60 pl-3 pr-2.5 py-2.5">
        <button onClick={() => openDetail(opts.place)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
          <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
            <img src={categoryIconSrc(opts.place.category)} alt="" className="w-1/2 opacity-90" draggable={false} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-foreground truncate">{opts.place.place_name}</span>
            {opts.subtitle && <span className="block text-[13px] text-muted-foreground truncate">{opts.subtitle}</span>}
          </span>
        </button>
        <button onClick={() => openGooglePlace(opts.place)} aria-label={`Otwórz ${opts.place.place_name} w Google Maps`}
          className="h-9 w-9 flex items-center justify-center shrink-0 rounded-full bg-white shadow-sm border border-black/[0.04] active:scale-90 transition-transform">
          <GoogleGlyph className="h-[18px] w-[18px]" />
        </button>
        <button onClick={() => addToPool(opts.place)} disabled={added} aria-label={added ? "Już w propozycjach" : "Dodaj do propozycji"}
          className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${added ? "bg-[#f0a583] text-white" : "border-2 border-border"}`}>
          {added ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : <Plus className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      </div>
    );
  };

  // ── wiersz PROPOZYCJI w puli: autor (avatar) + akcje wg roli ──
  const renderProposalRow = (prop: RouteProposal) => {
    const inTrip = pinKeys.has(keyOf(prop));
    const mine = prop.proposed_by === user?.id;
    const who = mine ? "Ty" : (prop.proposer?.username || "Uczestnik");
    const busy = busyId === prop.id;
    return (
      <div key={prop.id} className="w-full flex items-center gap-2 rounded-2xl bg-secondary/60 pl-3 pr-2.5 py-2.5">
        <button onClick={() => openDetail(prop)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
          <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
            <img src={categoryIconSrc(prop.category)} alt="" className="w-1/2 opacity-90" draggable={false} />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-[15px] font-semibold text-foreground truncate">{prop.place_name}</span>
            <span className="flex items-center gap-1.5 mt-0.5">
              <img src={avatarSrc(prop.proposer?.avatar_url)} alt="" className="h-4 w-4 rounded-full object-cover bg-secondary" />
              <span className="text-[12px] text-muted-foreground truncate">{who}</span>
            </span>
          </span>
        </button>
        <button onClick={() => openGooglePlace(prop)} aria-label={`Otwórz ${prop.place_name} w Google Maps`}
          className="h-9 w-9 flex items-center justify-center shrink-0 rounded-full bg-white shadow-sm border border-black/[0.04] active:scale-90 transition-transform">
          <GoogleGlyph className="h-[18px] w-[18px]" />
        </button>
        {busy ? (
          <span className="h-8 w-8 flex items-center justify-center shrink-0"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></span>
        ) : inTrip ? (
          // Miejsce jest juz w trasie - info + (host) mozliwosc uprzatniecia duplikatu propozycji.
          <span className="shrink-0 inline-flex items-center gap-1 text-[12px] font-semibold text-emerald-600 bg-emerald-50 rounded-full px-2 py-1">
            <Check className="h-3.5 w-3.5 stroke-[3]" /> W trasie
          </span>
        ) : isOwner ? (
          <span className="flex items-center gap-1.5 shrink-0">
            <button onClick={() => promote(prop)} className="h-8 rounded-full bg-primary text-primary-foreground text-[13px] font-bold px-3 flex items-center gap-1 active:scale-95 transition-transform">
              <Plus className="h-3.5 w-3.5 stroke-[3]" /> Do trasy
            </button>
            <button onClick={() => remove(prop)} aria-label="Odrzuć propozycję" className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground active:scale-90 transition-transform">
              <X className="h-4 w-4" strokeWidth={2.4} />
            </button>
          </span>
        ) : mine ? (
          <button onClick={() => remove(prop)} aria-label="Wycofaj propozycję" className="h-8 w-8 rounded-full flex items-center justify-center text-destructive active:scale-90 transition-transform shrink-0">
            <Trash2 className="h-4 w-4" strokeWidth={2} />
          </button>
        ) : <span className="w-8 shrink-0" />}
      </div>
    );
  };

  // ── wiersz MIEJSCA W TRASIE (read-only): uczestnik widzi co host juz dodal, ale NIE moze usuwac ──
  const renderPinRow = (p: any, i: number) => (
    <div key={`pin-${p.id ?? p.place_id ?? i}`} className="w-full flex items-center gap-2 rounded-2xl bg-secondary/60 pl-3 pr-2.5 py-2.5">
      <button onClick={() => openDetail(p)} className="flex items-center gap-3 flex-1 min-w-0 text-left active:opacity-80 transition-opacity">
        <span className="h-11 w-11 rounded-xl bg-[#fcede3] flex items-center justify-center shrink-0">
          <img src={categoryIconSrc(p.category)} alt="" className="w-1/2 opacity-90" draggable={false} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[15px] font-semibold text-foreground truncate">{p.place_name}</span>
          {(p.address || city) && <span className="block text-[13px] text-muted-foreground truncate">{p.address || city}</span>}
        </span>
      </button>
      <button onClick={() => openGooglePlace(p)} aria-label={`Otwórz ${p.place_name} w Google Maps`}
        className="h-9 w-9 flex items-center justify-center shrink-0 rounded-full bg-white shadow-sm border border-black/[0.04] active:scale-90 transition-transform">
        <GoogleGlyph className="h-[18px] w-[18px]" />
      </button>
    </div>
  );

  // Odswiez (wspolny dla obu wariantow naglowka).
  const refreshBtn = (
    <button onClick={() => { haptics.light(); refetchProposals(); refetchPins(); }} aria-label="Odśwież propozycje"
      className="h-9 w-9 rounded-full border border-black/15 bg-white flex items-center justify-center active:opacity-60 transition-opacity shrink-0">
      <RefreshCw className={`h-4 w-4 text-foreground ${isRefetching ? "animate-spin" : ""}`} />
    </button>
  );

  const bodyContent = (
    <>
      {/* Naglowek: fullscreen -> [wstecz | tytul | odswiez]; sheet -> [odswiez | tytul | zamknij] */}
      <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-2 shrink-0">
        {fullscreen ? (
          <button onClick={onBack} aria-label="Wróć"
            className="h-9 w-9 rounded-full border border-black/15 bg-white flex items-center justify-center active:opacity-60 transition-opacity shrink-0">
            <ArrowLeft className="h-4 w-4 text-foreground" />
          </button>
        ) : refreshBtn}
        <h2 className="text-[18px] font-semibold text-foreground truncate">{fullscreen ? (tripTitle || "Propozycje miejsc") : "Propozycje miejsc"}</h2>
        {fullscreen ? refreshBtn : (
          <button onClick={() => onOpenChange(false)} aria-label="Zamknij"
            className="h-9 w-9 rounded-full border border-black/15 bg-white flex items-center justify-center active:opacity-60 transition-opacity shrink-0">
            <X className="h-4 w-4 text-foreground" />
          </button>
        )}
      </div>

      {/* Wyszukiwarka Google Places (zawezona do miasta wyjazdu) */}
      <div className="px-5 pb-2 shrink-0">
        <div className="flex items-center gap-2 rounded-2xl bg-secondary px-3.5 h-11">
          <Search className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={city ? `Szukaj miejsca w${NBSP}${city}` : "Szukaj miejsca"}
            className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && <button onClick={() => setQuery("")} aria-label="Wyczyść"><X className="h-4 w-4 text-muted-foreground" /></button>}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))]">
        {searchMode ? (
          /* Tryb wyszukiwania: wyniki Google */
          <div className="pt-1 space-y-1.5">
            {searching ? (
              <div className="py-8 text-center text-sm text-muted-foreground flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Szukam...</div>
            ) : blocked ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{`Wyszukiwarka chwilowo niedostępna. Dodaj z${NBSP}zapisanych poniżej.`}</p>
            ) : results.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Brak wyników.</p>
            ) : (
              results.map((r, i) => renderAddRow({ rowKey: `s-${r.place_id ?? r.place_name}-${i}`, place: r, subtitle: r.address }))
            )}
          </div>
        ) : (
          <div className="pt-1 space-y-4">
            {/* MIEJSCA W TRASIE (read-only) - tylko widok uczestnika (fullscreen), co host juz dodal */}
            {fullscreen && pins && pins.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-0.5">Miejsca w trasie</p>
                {pins.map(renderPinRow)}
              </div>
            )}

            {/* PULA PROPOZYCJI */}
            <div className="space-y-1.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-0.5">
                {`Propozycje uczestników${proposals.length ? ` (${proposals.length})` : ""}`}
              </p>
              {loadingProposals ? (
                <div className="py-6 text-center text-sm text-muted-foreground">Ładowanie...</div>
              ) : proposals.length === 0 ? (
                <p className="py-6 px-2 text-center text-sm text-muted-foreground">
                  {isOwner
                    ? `Brak propozycji. Dorzuć miejsca wyszukiwarką lub poczekaj, aż uczestnicy dodadzą swoje.`
                    : `Brak propozycji. Dorzuć miejsca, które chcesz zwiedzić - host wybierze, co wejdzie do${NBSP}trasy.`}
                </p>
              ) : (
                (proposals as RouteProposal[]).map(renderProposalRow)
              )}
            </div>

            {/* TWOJE ZAPISANE (z miasta wyjazdu) */}
            {savedInCity.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-0.5">Twoje zapisane miejsca</p>
                {savedInCity.map((p) => renderAddRow({ rowKey: `sv-${p.id}`, place: p, subtitle: p.city || city }))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {fullscreen ? (
        // Widok uczestnika = pelnoekranowy (bez okladki, bez pill-tabow) - zamiast ReviewSummary.
        // In-flow h-[100dvh] (NIE fixed/z-high): wizytowka i SavePlaceSheet (Vaul z-50) otwieraja sie
        // NAD nim naturalnie. /review-summary to top-level route (bez BottomNava) - nie ma czego zaslaniac.
        <div className="h-[100dvh] bg-[#fefefe] flex flex-col" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}>
          {bodyContent}
        </div>
      ) : (
        <Sheet open={open} onOpenChange={onOpenChange}>
          <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()} className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col bg-[#fefefe] border-0" style={{ height: "92dvh" }}>
            {bodyContent}
          </SheetContent>
        </Sheet>
      )}

      {/* Wizytowka miejsca + "Zapisz to miejsce" (nie gub miejsc) */}
      <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={detailPlace?.city || city || ""}
        onLike={user && detailPlace ? () => setSavePlace({
          place_name: detailPlace.place_name, category: detailPlace.category ?? null, address: detailPlace.address || null,
          description: detailPlace.description || null, latitude: detailPlace.latitude ?? null, longitude: detailPlace.longitude ?? null,
          photo_url: detailPlace.photo_url || null,
          place_id: UUID_RE.test(String(detailPlace.id ?? "")) ? detailPlace.id : null,
        }) : undefined} />
      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => { if (!o) setSavePlace(null); }} place={savePlace} city={city || ""} />
    </>
  );
}
