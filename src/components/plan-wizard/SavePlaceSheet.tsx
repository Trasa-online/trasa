import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Check, Loader2, Share2, Bookmark, ListChecks } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useHaptics } from "@/hooks/useHaptics";
import { useShare } from "@/hooks/useShare";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveStored } from "@/components/PlacePhoto";
import { fetchUserLists, addPlaceToList, removePlaceFromList, createListWithPlace, quickSavePlace, listHasPlace, type UserList } from "@/lib/placeLists";

// "Miejsce zapisane! · dodaj do wyjazdu" - drawer zapisu miejsca (redesign 2026-08-20).
// Nagłówek + lista LIST usera (awatar + nazwa + "+"), prywatne z eyebrow "Prywatne".
// Tap "+" dodaje miejsce do listy; przy prywatnej "Do zobaczenia" (auto-lista) tworzy ją gdy brak.
// Awatary obok nazwy = placeholder (ikona) - docelowo user wybierze awatar listy.

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

const WISHLIST_ID = "__wishlist__";

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
  onFullyRemoved?: () => void; // legacy prop (nieużywany) - zachowany dla zgodności API
}) {
  const { t } = useTranslation("plan");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const share = useShare();

  const [busyId, setBusyId] = useState<string | null>(null);
  const [override, setOverride] = useState<Map<string, boolean>>(new Map());
  const [newName, setNewName] = useState("");

  useEffect(() => { if (open) { setBusyId(null); setOverride(new Map()); setNewName(""); } }, [open]);

  const { data: author } = useQuery({
    queryKey: ["save-sheet-author", user?.id],
    enabled: !!user && open,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("username, first_name, avatar_url").eq("id", user!.id).maybeSingle();
      return { name: (data as any)?.first_name || (data as any)?.username || "Użytkownik", avatar: (data as any)?.avatar_url ?? null };
    },
  });

  const { data: lists = [] } = useQuery({
    queryKey: ["save-sheet-lists", user?.id],
    enabled: !!user && open,
    queryFn: () => fetchUserLists(user!.id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["save-sheet-lists", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["saved-place-names", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["saved-places", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["profile-list-feed", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["public-profile-lists"] });
  };

  // Prywatne (to_visit) najpierw, potem publiczne. Gdy brak prywatnej listy - wirtualny wiersz
  // "Do zobaczenia" (utworzy się przy pierwszym zapisie przez quickSavePlace).
  const toVisit = lists.filter((l) => l.list_status === "to_visit");
  const visited = lists.filter((l) => l.list_status === "visited");
  const virtualWishlist: UserList = { id: WISHLIST_ID, title: "Do zobaczenia", city: null, list_status: "to_visit", count: 0, cover: null, place_names: [] };
  const displayLists: UserList[] = toVisit.length > 0 ? [...toVisit, ...visited] : [virtualWishlist, ...visited];

  const isIn = (l: UserList) => (override.has(l.id) ? override.get(l.id)! : listHasPlace(l, place?.place_name ?? ""));

  const toggle = async (l: UserList) => {
    if (!place || !user || busyId) return;
    setBusyId(l.id); haptics.medium();
    try {
      if (l.id === WISHLIST_ID) {
        const { added } = await quickSavePlace(user.id, { ...place }, city || null, author);
        setOverride((prev) => new Map(prev).set(l.id, true));
        toast.success(added ? `Dodano do „Do zobaczenia"` : `Już jest w „Do zobaczenia"`);
      } else if (isIn(l)) {
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
      console.error("[SavePlaceSheet] toggle failed:", e?.message ?? e);
      toast.error("Nie udało się zapisać zmiany");
    } finally { setBusyId(null); }
  };

  // Utwórz NOWĄ listę z tym miejscem. Nowa lista = publiczna polecajka (visited) - domyślnie.
  const createNew = async () => {
    if (!place || !user || busyId) return;
    const name = newName.trim();
    if (!name) return;
    setBusyId("new"); haptics.medium();
    try {
      const id = await createListWithPlace(user.id, name, "visited", city || null, { ...place }, author);
      if (!id) throw new Error("create failed");
      setNewName("");
      invalidate();
      toast.success(`Utworzono listę „${name}"`);
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

  const renderRow = (l: UserList) => {
    const inList = isIn(l);
    const cover = resolveStored(l.cover);
    return (
      <button
        key={l.id}
        type="button"
        onClick={() => toggle(l)}
        disabled={busyId === l.id}
        className="w-full flex items-center gap-3 py-2.5 text-left active:opacity-80"
      >
        {/* Awatar listy (placeholder: okładka albo peachy koło z ikoną - docelowo wybór awatara) */}
        <div className="h-11 w-11 rounded-full overflow-hidden shrink-0 bg-[#fcede3] flex items-center justify-center">
          {cover ? <img src={cover} alt="" className="h-full w-full object-cover" /> : <ListChecks className="h-5 w-5 text-orange-400" />}
        </div>
        <div className="flex-1 min-w-0">
          {l.list_status === "to_visit" && <p className="text-xs text-muted-foreground leading-tight">Prywatne</p>}
          <p className="text-base font-bold text-foreground truncate leading-tight">{l.title}</p>
        </div>
        <span className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0", inList ? "text-orange-500" : "text-foreground")}>
          {busyId === l.id ? <Loader2 className="h-5 w-5 animate-spin" /> : inList ? <Check className="h-5 w-5" strokeWidth={2.5} /> : <Plus className="h-6 w-6" strokeWidth={2} />}
        </span>
      </button>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col" style={{ maxHeight: "82vh" }}>
        {/* Uchwyt */}
        <div className="pt-3 pb-1 shrink-0">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" />
        </div>

        {/* Nagłówek: "Miejsce zapisane!" + bookmark */}
        <div className="flex items-center justify-between px-5 pt-2 pb-1 shrink-0">
          <p className="text-xl font-black text-foreground">Miejsce zapisane!</p>
          <Bookmark className="h-6 w-6 text-foreground fill-foreground" />
        </div>

        {/* Nowa lista: input + "+" (wg Figmy) */}
        <div className="px-5 pt-2 pb-2 shrink-0">
          <div className="flex items-center gap-1 h-12 pl-4 pr-1.5 rounded-2xl border border-border bg-background">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createNew(); }}
              placeholder="Nazwa listy"
              className="flex-1 min-w-0 bg-transparent text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
            />
            <button type="button" onClick={createNew} disabled={busyId === "new" || !newName.trim()} className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-foreground active:scale-90 transition-transform disabled:opacity-40" aria-label="Utwórz listę">
              {busyId === "new" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pt-1 pb-3" style={{ WebkitOverflowScrolling: "touch" }}>
          <div className="divide-y divide-border/40">
            {displayLists.map(renderRow)}
          </div>
        </div>

        {/* Stopka: Udostępnij to miejsce */}
        <div className="shrink-0 px-5 pt-2 pb-safe-4">
          <button type="button" onClick={onShare} className="w-full h-12 rounded-2xl bg-orange-100 text-foreground font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Share2 className="h-4 w-4" /> Udostępnij to miejsce
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
