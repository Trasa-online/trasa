import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { X, Check } from "lucide-react";
import { toast } from "sonner";

type Pin = {
  id: string;
  place_name: string;
  category: string;
  images?: string[] | null;
  image_url?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onPublished: () => void;
  city: string;
  pins: Pin[];
  userId: string;
};

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: "🍽️", cafe: "☕", museum: "🏛️", park: "🌳",
  bar: "🍺", club: "🎵", monument: "🏰", gallery: "🖼️",
  market: "🛒", viewpoint: "🌅", shopping: "🛍️", experience: "🎭", walk: "🚶",
};

export default function CreatePolecajkaSheet({ open, onClose, onPublished, city, pins, userId }: Props) {
  const [title, setTitle] = useState(`Moje top miejsca w ${city}`);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(pins.map((p) => p.place_name)));
  const [descs, setDescs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["profile-for-polecajka", userId],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("first_name, username, avatar_url")
        .eq("id", userId)
        .single();
      return data as { first_name: string | null; username: string | null; avatar_url: string | null } | null;
    },
    enabled: !!userId,
    staleTime: 60_000,
  });

  const authorName = profile?.first_name || profile?.username || "Użytkownik";
  const selectedPins = pins.filter((p) => selected.has(p.place_name));

  function togglePin(placeName: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeName)) next.delete(placeName);
      else next.add(placeName);
      return next;
    });
  }

  async function handlePublish() {
    if (!title.trim() || selectedPins.length === 0) return;
    setSaving(true);
    try {
      const { data: col, error: colErr } = await (supabase as any)
        .from("discovery_collections")
        .insert({
          user_id: userId,
          author_name: authorName,
          author_avatar: profile?.avatar_url ?? null,
          title: title.trim(),
          city: city || null,
          description: null,
          is_public: true,
        })
        .select("id")
        .single();
      if (colErr || !col) throw colErr ?? new Error("Błąd zapisu");

      const items = selectedPins.map((pin, idx) => ({
        collection_id: col.id,
        order_index: idx,
        place_name: pin.place_name,
        short_desc: descs[pin.place_name]?.trim() || null,
        photo_url: pin.images?.[0] ?? pin.image_url ?? null,
        latitude: null,
        longitude: null,
      }));

      const { error: itemsErr } = await (supabase as any).from("discovery_items").insert(items);
      if (itemsErr) throw itemsErr;

      toast.success("Polecajka opublikowana! 🎉");
      onPublished();
      onClose();
    } catch {
      toast.error("Nie udało się opublikować polecajki");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 flex flex-col [&>button:last-child]:hidden"
        style={{ maxHeight: "90vh", height: "90vh" }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3 border-b border-border/20 shrink-0">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-base">Stwórz polecajkę</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Jako <span className="font-semibold text-foreground">{authorName}</span>
            </p>
          </div>
          <SheetClose className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90 transition-transform shrink-0">
            <X className="h-4 w-4" />
          </SheetClose>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {/* Title input */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              Tytuł
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
              className="w-full px-4 py-3 rounded-2xl border border-border bg-muted/40 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
            />
          </div>

          {/* Places */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Miejsca ({selectedPins.length} wybranych)
            </label>
            <div className="space-y-2">
              {pins.map((pin) => {
                const thumb = pin.images?.[0] ?? pin.image_url ?? null;
                const emoji = CATEGORY_EMOJI[pin.category] ?? "📍";
                const isOn = selected.has(pin.place_name);
                return (
                  <div
                    key={pin.id}
                    className={`rounded-2xl border transition-colors ${isOn ? "border-orange-300 bg-orange-50/50" : "border-border/40 bg-muted/20 opacity-50"}`}
                  >
                    {/* Place row */}
                    <button
                      onClick={() => togglePin(pin.place_name)}
                      className="w-full flex items-center gap-3 p-3 text-left"
                    >
                      <div className="h-11 w-11 rounded-xl overflow-hidden bg-muted shrink-0">
                        {thumb ? (
                          <img src={thumb} alt={pin.place_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-xl">{emoji}</div>
                        )}
                      </div>
                      <p className="flex-1 text-sm font-semibold leading-tight">{pin.place_name}</p>
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 transition-colors ${isOn ? "bg-orange-500" : "bg-muted border border-border"}`}>
                        {isOn && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                      </div>
                    </button>

                    {/* Description input — only when selected */}
                    {isOn && (
                      <div className="px-3 pb-3">
                        <input
                          type="text"
                          value={descs[pin.place_name] ?? ""}
                          onChange={(e) => setDescs((d) => ({ ...d, [pin.place_name]: e.target.value }))}
                          placeholder="Krótki opis (opcjonalnie)…"
                          maxLength={120}
                          className="w-full px-3 py-2 rounded-xl bg-white border border-border/50 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-orange-400/40 transition-colors"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="h-2" />
        </div>

        {/* Publish button */}
        <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-3 border-t border-border/20 shrink-0">
          <button
            onClick={handlePublish}
            disabled={saving || !title.trim() || selectedPins.length === 0}
            className="w-full py-3.5 rounded-full bg-gradient-to-r from-[#F4A259] to-[#F9662B] text-white font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-40 disabled:pointer-events-none shadow-md shadow-orange-500/20"
          >
            {saving ? "Publikowanie…" : `Opublikuj polecajkę (${selectedPins.length} miejsc) →`}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
