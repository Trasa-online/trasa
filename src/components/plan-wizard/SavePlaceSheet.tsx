import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Check, Loader2, Share2, Eye } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHaptics } from "@/hooks/useHaptics";
import { useShare } from "@/hooks/useShare";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveStored } from "@/components/PlacePhoto";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { fetchUserLists, addPlaceToList, removePlaceFromList, createListWithPlace, listHasPlace, type UserList, type ListStatus } from "@/lib/placeLists";

// Sheet "Gdzie chcesz zapisać to miejsce?" - zapis miejsca do LISTY usera. Listy mają dwie
// kategorie: Odwiedzone miejsca (visited) i Miejsca do odwiedzenia (to_visit). User może dodać
// miejsce do istniejącej listy albo utworzyć nową (toggle kategorii). Wszystkie listy publiczne.

export interface SavePlaceInput {
  place_name: string;
  category: string | null;
  address: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  place_id: string | null;
}

export default function SavePlaceSheet({
  open,
  onOpenChange,
  place,
  city,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  place: SavePlaceInput | null;
  city: string;
  onFullyRemoved?: () => void; // legacy prop (nieużywany w modelu list) - zachowany dla zgodności API
}) {
  const { t } = useTranslation("plan");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const share = useShare();

  const [newName, setNewName] = useState("");
  const [newStatus, setNewStatus] = useState<ListStatus>("to_visit");
  const [busyId, setBusyId] = useState<string | null>(null);
  // Optymistyczny stan przynaleznosci: listId -> true (w liscie) / false (usuniete), zanim query sie odswiezy.
  const [override, setOverride] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (open) { setNewName(""); setNewStatus("to_visit"); setBusyId(null); setOverride(new Map()); }
  }, [open]);

  const { data: author } = useQuery({
    queryKey: ["save-sheet-author", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username, first_name, avatar_url").eq("id", user!.id).maybeSingle();
      return { name: (data as any)?.first_name || (data as any)?.username || "Użytkownik", avatar: (data as any)?.avatar_url ?? null };
    },
  });

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["save-sheet-lists", user?.id],
    enabled: !!user && open,
    queryFn: () => fetchUserLists(user!.id),
  });

  const visitedLists = lists.filter((l) => l.list_status === "visited");
  const toVisitLists = lists.filter((l) => l.list_status === "to_visit");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["save-sheet-lists", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["my-collections"] });
    queryClient.invalidateQueries({ queryKey: ["public-profile-lists"] });
    queryClient.invalidateQueries({ queryKey: ["explore-my-collections"] });
  };

  const isIn = (l: UserList) => (override.has(l.id) ? override.get(l.id)! : listHasPlace(l, place?.place_name ?? ""));

  // Toggle: gdy miejsce jest w liscie -> usun, inaczej -> dodaj.
  const toggle = async (l: UserList) => {
    if (!place || !user || busyId) return;
    const currentlyIn = isIn(l);
    setBusyId(l.id); haptics.medium();
    try {
      if (currentlyIn) {
        await removePlaceFromList(l.id, place.place_name);
        setOverride((prev) => new Map(prev).set(l.id, false));
        toast.success(`Usunięto z „${l.title}"`);
      } else {
        await addPlaceToList(l.id, { ...place });
        setOverride((prev) => new Map(prev).set(l.id, true));
        toast.success(`Dodano do „${l.title}"`);
      }
      invalidate();
    } catch (e: any) {
      console.error("[SavePlaceSheet] toggle list failed:", e?.message ?? e);
      toast.error("Nie udało się zapisać zmiany");
    } finally { setBusyId(null); }
  };

  const createNew = async () => {
    if (!place || !user || busyId) return;
    setBusyId("new"); haptics.medium();
    try {
      const id = await createListWithPlace(user.id, newName.trim(), newStatus, city || null, { ...place }, author);
      if (!id) throw new Error("create failed");
      setNewName("");
      invalidate();
      onOpenChange(false);
      toast.success(`Utworzono listę „${newName.trim() || (newStatus === "visited" ? "Odwiedzone miejsca" : "Do odwiedzenia")}"`);
    } catch (e: any) {
      console.error("[SavePlaceSheet] create list failed:", e?.message ?? e);
      toast.error("Nie udało się utworzyć listy");
    } finally { setBusyId(null); }
  };

  const onShare = async () => {
    if (!place) return;
    const url =
      place.latitude && place.longitude
        ? `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`
        : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([place.place_name, place.address, city].filter(Boolean).join(" "))}`;
    const res = await share({ title: place.place_name, text: place.place_name, url });
    if (res.ok) toast.success(res.method === "clipboard" ? t("save_sheet.link_copied") : t("save_sheet.shared"));
  };

  const renderList = (l: UserList) => {
    const inList = isIn(l);
    const cover = resolveStored(l.cover) ?? getRandomPinPlaceholder(l.id);
    return (
      <button
        key={l.id}
        type="button"
        onClick={() => toggle(l)}
        disabled={busyId === l.id}
        className="w-full flex items-center gap-3 py-2.5 text-left active:opacity-80"
      >
        <div className="relative h-14 w-14 rounded-xl overflow-hidden shrink-0 bg-muted">
          <img src={cover} alt="" className="h-full w-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(l.id + "_fb"); }} />
          {l.count > 0 && (
            <span className="absolute bottom-1 right-1 bg-black/55 text-white text-[11px] font-medium px-1.5 rounded-full">{l.count}</span>
          )}
        </div>
        <p className="flex-1 text-sm font-medium text-foreground truncate">{l.title}</p>
        <span
          className={cn(
            "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-transform",
            inList ? "bg-orange-100 text-orange-600" : "text-foreground",
          )}
        >
          {busyId === l.id ? <Loader2 className="h-5 w-5 animate-spin" /> : inList ? <Check className="h-5 w-5" /> : <Plus className="h-6 w-6" />}
        </span>
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ maxHeight: "82vh" }}>
        {/* Uchwyt + zamknij */}
        <div className="relative pt-3 pb-1 shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
          <button type="button" onClick={() => onOpenChange(false)} className="absolute top-2 right-3 h-8 w-8 rounded-full bg-muted/60 flex items-center justify-center active:scale-95 transition-transform" aria-label={t("close")}>
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
          <p className="text-xl font-black text-foreground mb-3">Gdzie chcesz zapisać to miejsce?</p>

          {/* Nowa lista: nazwa + toggle kategorii + "+" */}
          <div className="flex items-center gap-2 pb-1">
            <div className="flex-1 flex items-center gap-1.5 h-12 pl-3.5 pr-1.5 rounded-2xl border border-border bg-background min-w-0">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") createNew(); }}
                placeholder="Nowa lista"
                className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
              />
              {/* Toggle kategorii nowej listy: Odwiedzone | Do odwiedzenia */}
              <button
                type="button"
                onClick={() => setNewStatus((s) => (s === "visited" ? "to_visit" : "visited"))}
                className={cn(
                  "flex items-center gap-1.5 h-9 pl-1 pr-3 rounded-full text-xs font-semibold shrink-0 transition-colors active:scale-95",
                  newStatus === "visited" ? "bg-orange-100 text-orange-700" : "bg-secondary text-secondary-foreground",
                )}
              >
                <span className={cn("h-7 w-7 rounded-full flex items-center justify-center", newStatus === "visited" ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground")}>
                  {newStatus === "visited" ? <Check className="h-4 w-4" strokeWidth={3} /> : <Eye className="h-4 w-4" />}
                </span>
                {newStatus === "visited" ? "Odwiedzone" : "Do odwiedzenia"}
              </button>
            </div>
            <button type="button" onClick={createNew} disabled={busyId === "new"} className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 text-foreground active:scale-90 transition-transform disabled:opacity-50" aria-label="Utwórz listę">
              {busyId === "new" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-6 w-6" />}
            </button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <div className="pt-2">
              {/* Odwiedzone miejsca */}
              {visitedLists.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-3 mb-1">Odwiedzone miejsca</p>
                  <div className="divide-y divide-border/40">{visitedLists.map(renderList)}</div>
                </div>
              )}
              {/* Miejsca do odwiedzenia */}
              {toVisitLists.length > 0 && (
                <div className="mb-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mt-3 mb-1">Miejsca do odwiedzenia</p>
                  <div className="divide-y divide-border/40">{toVisitLists.map(renderList)}</div>
                </div>
              )}
              {lists.length === 0 && (
                <p className="text-sm text-muted-foreground py-4">Nie masz jeszcze list. Utwórz pierwszą powyżej.</p>
              )}
            </div>
          )}
        </div>

        {/* Stopka: Udostepnij */}
        <div className="shrink-0 px-5 pt-2 pb-safe-4 border-t border-border/20">
          <button type="button" onClick={onShare} className="w-full h-11 rounded-2xl bg-orange-100 text-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Share2 className="h-4 w-4" /> {t("save_sheet.share")}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
