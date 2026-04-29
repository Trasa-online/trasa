import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X } from "lucide-react";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";

type DiscoveryItem = {
  id: string;
  order_index: number;
  place_name: string;
  short_desc: string | null;
  photo_url: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

type DiscoveryCollection = {
  id: string;
  title: string;
  city: string | null;
  description: string | null;
  author_name: string;
  author_avatar: string | null;
  items: DiscoveryItem[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const PLACEHOLDER_GRADIENTS = [
  "from-amber-200 to-orange-300",
  "from-rose-200 to-pink-300",
  "from-sky-200 to-blue-300",
  "from-emerald-200 to-teal-300",
  "from-violet-200 to-purple-300",
];

function buildLeafletHtml(items: DiscoveryItem[]) {
  const pins = items
    .filter((i) => i.latitude && i.longitude)
    .map((i, idx) => ({ lat: i.latitude!, lng: i.longitude!, name: i.place_name, index: idx + 1 }));
  const pinsJson = JSON.stringify(pins);
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script><style>*{margin:0;padding:0;box-sizing:border-box}body{height:100%;overflow:hidden}#map{height:100%;width:100%}.pm{color:#fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;font-family:-apple-system,sans-serif;border:2px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,.35);background:#ea580c}</style></head><body><div id="map"></div><script>const pins=${pinsJson};const map=L.map('map',{zoomControl:false,attributionControl:false});L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',{maxZoom:19}).addTo(map);const coords=pins.map(p=>[p.lat,p.lng]);if(coords.length>1){L.polyline(coords,{color:'#ea580c',weight:2.5,opacity:.55,dashArray:'6 5'}).addTo(map);map.fitBounds(coords,{padding:[36,36]});}else if(coords.length===1){map.setView(coords[0],15);}pins.forEach(p=>{const icon=L.divIcon({className:'',html:'<div class="pm">'+p.index+'</div>',iconSize:[28,28],iconAnchor:[14,14]});L.marker([p.lat,p.lng],{icon}).bindPopup('<b style="font-size:12px">'+p.name+'</b>').addTo(map);});<\/script></body></html>`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AuthorChip({ name, avatar }: { name: string; avatar: string | null }) {
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="flex items-center gap-1.5">
      {avatar ? (
        <img src={avatar} alt={name} className="h-5 w-5 rounded-full object-cover" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
          {initials}
        </div>
      )}
      <span className="text-xs text-muted-foreground">{name}</span>
    </div>
  );
}

function PlacePhoto({
  item,
  className,
  placeholderIdx = 0,
}: {
  item: DiscoveryItem;
  className?: string;
  placeholderIdx?: number;
}) {
  const gradient = PLACEHOLDER_GRADIENTS[placeholderIdx % PLACEHOLDER_GRADIENTS.length];
  return item.photo_url ? (
    <img src={item.photo_url} alt={item.place_name} className={`object-cover ${className ?? ""}`} loading="lazy" />
  ) : (
    <div className={`bg-gradient-to-br ${gradient} flex items-center justify-center ${className ?? ""}`}>
      <span className="text-2xl opacity-60">📍</span>
    </div>
  );
}

function PhotoGrid({ items }: { items: DiscoveryItem[] }) {
  const displayItems = items.slice(0, 3);
  if (displayItems.length === 0) return null;
  const [main, ...rest] = displayItems;

  return (
    <div className="flex gap-1 h-40 overflow-hidden">
      {/* Big photo - left 2/3 */}
      <div className="relative flex-[2] min-w-0 overflow-hidden rounded-l-xl">
        <PlacePhoto item={main} placeholderIdx={0} className="w-full h-full" />
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-[10px] font-semibold leading-tight line-clamp-1">{main.place_name}</p>
        </div>
      </div>
      {/* Side photos - right 1/3 stacked */}
      {rest.length > 0 && (
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {rest.slice(0, 2).map((item, idx) => (
            <div key={item.id} className={`relative flex-1 overflow-hidden ${idx === 0 ? "rounded-tr-xl" : "rounded-br-xl"}`}>
              <PlacePhoto item={item} placeholderIdx={idx + 1} className="w-full h-full" />
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-[9px] font-semibold leading-tight line-clamp-1">{item.place_name}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Collection card (horizontal carousel item) ─────────────────────────────────

function CollectionCard({ col, onOpen }: { col: DiscoveryCollection; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="shrink-0 w-[82vw] max-w-[320px] rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.97] transition-transform snap-start"
    >
      <PhotoGrid items={col.items} />
      <div className="px-3.5 pt-2.5 pb-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-black text-sm leading-snug flex-1 line-clamp-2">{col.title}</p>
          {col.city && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0 mt-0.5">
              <MapPin className="h-3 w-3" />
              {col.city}
            </div>
          )}
        </div>
        <div className="flex gap-2 overflow-hidden">
          {col.items.slice(0, 3).map((item, idx) => (
            <span key={item.id} className="text-[10px] text-muted-foreground shrink-0">
              <span className="font-bold text-orange-500">{idx + 1}.</span> {item.place_name}
            </span>
          ))}
          {col.items.length > 3 && (
            <span className="text-[10px] text-muted-foreground shrink-0">+{col.items.length - 3} więcej</span>
          )}
        </div>
        <AuthorChip name={col.author_name} avatar={col.author_avatar} />
      </div>
    </button>
  );
}

// ── Detail sheet ───────────────────────────────────────────────────────────────

function CollectionDetail({ col }: { col: DiscoveryCollection }) {
  const leafletHtml = buildLeafletHtml(col.items);
  const hasPins = col.items.some((i) => i.latitude && i.longitude);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-border/20 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight line-clamp-2">{col.title}</p>
          <div className="flex items-center gap-2 mt-1">
            <AuthorChip name={col.author_name} avatar={col.author_avatar} />
            {col.city && (
              <>
                <span className="text-muted-foreground/40 text-xs">·</span>
                <span className="text-xs text-muted-foreground">{col.city}</span>
              </>
            )}
          </div>
        </div>
        <SheetClose className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90 transition-transform shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </SheetClose>
      </div>

      {/* Map */}
      {hasPins && (
        <div className="h-52 shrink-0">
          <iframe key={col.id} srcDoc={leafletHtml} className="w-full h-full border-0" />
        </div>
      )}

      {/* Scrollable place list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {col.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{col.description}</p>
        )}
        {col.items.map((item, idx) => (
          <div key={item.id} className="space-y-2">
            <div className="relative rounded-2xl overflow-hidden h-44">
              <PlacePhoto item={item} placeholderIdx={idx} className="w-full h-full" />
              <div className="absolute top-2.5 left-2.5 h-7 w-7 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shadow-md">
                <span className="text-white text-[11px] font-black">{idx + 1}</span>
              </div>
            </div>
            <div className="px-0.5">
              <p className="font-bold text-sm leading-snug">{item.place_name}</p>
              {item.short_desc && (
                <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{item.short_desc}</p>
              )}
            </div>
          </div>
        ))}
        <div className="h-4" />
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function CollectionSkeleton() {
  return (
    <div className="shrink-0 w-[82vw] max-w-[320px] rounded-2xl bg-card border border-border/50 overflow-hidden animate-pulse snap-start">
      <div className="h-40 bg-muted" />
      <div className="px-3.5 pt-2.5 pb-3 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function DiscoveryFeed() {
  const [activeCol, setActiveCol] = useState<DiscoveryCollection | null>(null);

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["discovery-collections"],
    queryFn: async () => {
      // 1. Fetch collections
      const { data: cols, error: colsErr } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (colsErr || !cols?.length) return [];

      const ids = cols.map((c: any) => c.id);

      // 2. Fetch items - without lat/lng to avoid errors if migration not yet applied
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      // 3. Try to fetch lat/lng separately (optional - ignored if columns don't exist)
      const coordMap = new Map<string, { latitude: number; longitude: number }>();
      try {
        const { data: coords, error: coordErr } = await (supabase as any)
          .from("discovery_items")
          .select("id, latitude, longitude")
          .in("collection_id", ids)
          .not("latitude", "is", null);
        if (!coordErr && coords) {
          for (const c of coords) {
            if (c.latitude && c.longitude) coordMap.set(c.id, { latitude: c.latitude, longitude: c.longitude });
          }
        }
      } catch {
        // lat/lng columns not yet available - map will be hidden
      }

      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        items: (items ?? [])
          .filter((i: any) => i.collection_id === col.id)
          .map((i: any) => ({ ...i, ...coordMap.get(i.id) })),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto scrollbar-none -mx-4 px-4 pb-1">
        <CollectionSkeleton />
        <CollectionSkeleton />
      </div>
    );
  }

  if (collections.length === 0) return null;

  return (
    <>
      {/* Horizontal carousel */}
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory -mx-4 px-4 pb-1">
        {collections.map((col) => (
          <CollectionCard key={col.id} col={col} onOpen={() => setActiveCol(col)} />
        ))}
        <div className="shrink-0 w-2" />
      </div>

      {/* Detail sheet - hide SheetContent's built-in X since we rely on the drag handle / overlay to close */}
      <Sheet open={!!activeCol} onOpenChange={(open) => { if (!open) setActiveCol(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 [&>button:last-child]:hidden"
          style={{ maxHeight: "92vh", height: "92vh" }}
        >
          {activeCol && <CollectionDetail col={activeCol} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
