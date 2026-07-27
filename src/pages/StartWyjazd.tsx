import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { ArrowLeft, ArrowRight, Search, X, Trash2, Plus, Loader2 } from "lucide-react";
import { resolveStored } from "@/components/PlacePhoto";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { toast } from "sonner";

// Ekran po kliknieciu "+": wybor bazy nowego wyjazdu. Robocze (wlasne trasy usera) lub
// Zapisane (trasy zapisane od innych) jako punkt startu, albo "Zacznij od nowa" (pusty
// ComposeWyjazd). Wybor bazy -> ComposeWyjazd prefill miejscami tej trasy.

type ChooserRoute = {
  id: string;
  title: string | null;
  city: string | null;
  cover: string | null;
  count: number;
  own: boolean;
};

const placesLabel = (n: number) => `${n} ${n === 1 ? "miejsce" : n < 5 ? "miejsca" : "miejsc"}`;

// Wspolne: dociagnij okladke (pierwsze zdjecie pinu) + liczbe miejsc dla listy tras.
async function enrichRoutes(rows: any[]): Promise<ChooserRoute[]> {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const { data: pins } = await (supabase as any)
    .from("pins")
    .select("route_id, photo_url, image_url, pin_order")
    .in("route_id", ids)
    .order("pin_order", { ascending: true });
  const cover: Record<string, string> = {};
  const count: Record<string, number> = {};
  for (const p of (pins ?? []) as any[]) {
    count[p.route_id] = (count[p.route_id] ?? 0) + 1;
    if (!cover[p.route_id]) {
      const u = resolveStored(p.photo_url || p.image_url);
      if (u) cover[p.route_id] = u;
    }
  }
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    city: r.city,
    cover: cover[r.id] ?? (Array.isArray(r.review_photos) ? resolveStored(r.review_photos[0]) : null),
    count: count[r.id] ?? 0,
    own: !!r.__own,
  }));
}

export default function StartWyjazd() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"robocze" | "zapisane">("robocze");
  const [query, setQuery] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);

  // Robocze = wlasne SZKICE (drafty), NIE gotowe trasy. "Gotowa" = trip_type 'completed'
  // ALBO plan_finalized=true (jak w JournalTab). Szkic = jeszcze w planowaniu, niesfinalizowany.
  const { data: robocze = [], isLoading: roboczeLoading } = useQuery({
    queryKey: ["start-robocze", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, review_photos, updated_at")
        .eq("user_id", user!.id)
        .eq("trip_type", "planning")
        .or("plan_finalized.is.null,plan_finalized.eq.false")
        .order("updated_at", { ascending: false })
        .limit(30);
      return enrichRoutes((data ?? []).map((r: any) => ({ ...r, __own: true })));
    },
  });

  // Zapisane = trasy zapisane od innych (saved_routes -> routes).
  const { data: zapisane = [], isLoading: zapisaneLoading } = useQuery({
    queryKey: ["start-zapisane", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: saved } = await (supabase as any)
        .from("saved_routes").select("route_id, created_at")
        .eq("user_id", user!.id).order("created_at", { ascending: false });
      const ids = (saved ?? []).map((s: any) => s.route_id);
      if (!ids.length) return [] as ChooserRoute[];
      const { data: rows } = await (supabase as any)
        .from("routes").select("id, title, city, review_photos").in("id", ids);
      const enriched = await enrichRoutes((rows ?? []).map((r: any) => ({ ...r, __own: false })));
      const order = new Map(ids.map((id: string, i: number) => [id, i]));
      return enriched.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    },
  });

  const list = tab === "robocze" ? robocze : zapisane;
  const loading = tab === "robocze" ? roboczeLoading : zapisaneLoading;
  const shown = query.trim()
    ? list.filter((r) =>
        (r.title ?? "").toLowerCase().includes(query.trim().toLowerCase()) ||
        (r.city ?? "").toLowerCase().includes(query.trim().toLowerCase()))
    : list;

  // Wybor bazy: dociagnij miejsca tej trasy -> ComposeWyjazd z prefill.
  const useAsBase = async (route: ChooserRoute) => {
    if (loadingId) return;
    setLoadingId(route.id);
    const { data: pins } = await (supabase as any)
      .from("pins")
      .select("place_name, category, address, latitude, longitude, photo_url, image_url, place_id, rating, pin_order")
      .eq("route_id", route.id)
      .order("pin_order", { ascending: true });
    setLoadingId(null);
    const places = (pins ?? []).map((p: any) => ({
      place_name: p.place_name,
      category: p.category ?? null,
      address: p.address ?? null,
      latitude: p.latitude ?? null,
      longitude: p.longitude ?? null,
      photo_url: resolveStored(p.photo_url || p.image_url) ?? null,
      place_id: p.place_id ?? null,
      rating: typeof p.rating === "number" ? p.rating : null,
    }));
    // Robocza (wlasny szkic) -> edytuj JA (draftId). Zapisana od innych -> nowa kopia (bez draftId).
    navigate("/wyjazd/nowy", { state: { city: route.city, title: route.title, places, draftId: route.own ? route.id : undefined } });
  };

  const deleteDraft = async (id: string) => {
    if (!confirm("Usunąć tę roboczą trasę?")) return;
    await (supabase as any).from("pins").delete().eq("route_id", id);
    await (supabase as any).from("routes").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["start-robocze"] });
    toast.success("Usunięto");
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-background max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-safe-4 pb-3 shrink-0">
        <button onClick={() => navigate(-1)} aria-label="Wróć" className="h-9 w-9 flex items-center justify-center -ml-1 shrink-0 text-foreground active:scale-90 transition-transform">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="flex-1 font-bold text-base">Nowy wyjazd</span>
      </div>

      {/* Toggle Robocze | Zapisane - cala szerokosc */}
      <div className="px-4 pt-1">
        <div className="flex rounded-full bg-secondary p-0.5 text-sm font-bold">
          <button
            onClick={() => setTab("robocze")}
            className={`flex-1 py-2.5 rounded-full transition-colors ${tab === "robocze" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Robocze
          </button>
          <button
            onClick={() => setTab("zapisane")}
            className={`flex-1 py-2.5 rounded-full transition-colors ${tab === "zapisane" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"}`}
          >
            Zapisane
          </button>
        </div>
      </div>

      {/* Wyszukiwarka */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="h-4 w-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === "robocze" ? "Szukaj w roboczych..." : "Szukaj w zapisanych..."}
            className="w-full rounded-full bg-secondary text-secondary-foreground border border-border/40 pl-10 pr-9 py-3 text-base outline-none focus:ring-2 focus:ring-orange-500/40 placeholder:text-muted-foreground/60"
          />
          {query && (
            <button onClick={() => setQuery("")} aria-label="Wyczyść" className="absolute right-3 top-1/2 -translate-y-1/2 h-6 w-6 flex items-center justify-center rounded-full text-muted-foreground active:bg-muted">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Lista tras-baz */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-4 pb-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-[120px] rounded-3xl bg-muted/40 animate-pulse" />)
        ) : shown.length === 0 ? (
          <div className="py-14 text-center px-8">
            <div className="text-4xl mb-3">🧳</div>
            <p className="text-base font-bold">{tab === "robocze" ? "Brak roboczych tras" : "Brak zapisanych tras"}</p>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed max-w-[260px] mx-auto">
              {tab === "robocze" ? "Zacznij od nowa, żeby stworzyć pierwszą trasę." : "Zapisz trasę innego użytkownika w Eksploruj, a użyjesz jej tutaj jako bazy."}
            </p>
          </div>
        ) : (
          shown.map((r) => (
            <div key={r.id} className="relative w-full flex gap-3.5 p-2.5 rounded-3xl bg-card border border-border/50">
              <button onClick={() => useAsBase(r)} className="flex gap-3.5 flex-1 min-w-0 text-left active:opacity-90 transition-opacity">
                <div className="relative w-[104px] h-[132px] shrink-0 rounded-2xl overflow-hidden bg-muted">
                  <img
                    src={r.cover ?? getRandomPinPlaceholder(r.id)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(r.id + "_fb"); }}
                  />
                  {loadingId === r.id && (
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Loader2 className="h-5 w-5 text-white animate-spin" /></div>
                  )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col py-0.5">
                  <p className="text-lg font-bold leading-tight line-clamp-2 text-foreground">{r.title || r.city || "Trasa"}</p>
                  <div className="mt-auto flex items-center gap-2 pt-2">
                    {r.city && <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-[11px] font-medium text-muted-foreground">{r.city}</span>}
                    <span className="text-sm text-muted-foreground">{placesLabel(r.count)}</span>
                  </div>
                </div>
              </button>
              {r.own && (
                <button
                  onClick={() => deleteDraft(r.id)}
                  aria-label="Usuń roboczą trasę"
                  className="absolute top-3 right-3 h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground/50 hover:text-destructive active:scale-90 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* CTA: Zacznij od nowa (pusty ComposeWyjazd) */}
      <div className="shrink-0 border-t border-border/20 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-background">
        <button
          onClick={() => navigate("/wyjazd/nowy")}
          className="w-full h-12 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-md shadow-orange-500/20"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
          Zacznij od nowa
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
