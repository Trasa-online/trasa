import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X, Globe, Sparkles } from "lucide-react";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";

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

type PolecaneRoute = {
  kind: "route";
  id: string;
  title: string;
  city: string | null;
  photo: string | null;
  ai_highlight: string | null;
  author_name: string;
  author_avatar: string | null;
};

type PolecaneCreatorPlan = {
  kind: "creator";
  id: string;
  title: string;
  city: string;
  description: string | null;
  photo: string | null;
  creator_handle: string;
  creator_avatar_url: string | null;
  num_days: number | null;
  tags: string[] | null;
};

type PolecaneEntry = PolecaneRoute | PolecaneCreatorPlan;

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

// ── Detail sheet ───────────────────────────────────────────────────────────────

function CollectionDetail({ col }: { col: DiscoveryCollection }) {
  const leafletHtml = buildLeafletHtml(col.items);
  const hasPins = col.items.some((i) => i.latitude && i.longitude);

  return (
    <div className="flex flex-col h-full overflow-hidden">
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

      {hasPins && (
        <div className="h-52 shrink-0">
          <iframe key={col.id} srcDoc={leafletHtml} className="w-full h-full border-0" />
        </div>
      )}

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

function CreatorPlanDetail({ plan }: { plan: PolecaneCreatorPlan }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 border-b border-border/20 shrink-0">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-base leading-tight line-clamp-2">{plan.title}</p>
          <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3 text-orange-500" />
            <span>@{plan.creator_handle}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>{plan.city}</span>
            {plan.num_days && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>{plan.num_days} {plan.num_days === 1 ? "dzień" : "dni"}</span>
              </>
            )}
          </div>
        </div>
        <SheetClose className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90 transition-transform shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </SheetClose>
      </div>

      <div className="flex-1 overflow-y-auto">
        {plan.photo && (
          <div className="w-full aspect-[16/10] overflow-hidden bg-muted">
            <img src={plan.photo} alt={plan.title} className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}
        <div className="px-4 py-3 space-y-3">
          {plan.description && (
            <p className="text-sm text-foreground/80 leading-relaxed">{plan.description}</p>
          )}
          {plan.tags && plan.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {plan.tags.map((tag) => (
                <span key={tag} className="text-[11px] px-2.5 py-1 rounded-full bg-primary/10 text-orange-700 font-medium">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────────

function MotywySkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1 px-1">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="shrink-0 w-[88px] flex flex-col items-center gap-1.5 animate-pulse">
          <div className="h-[88px] w-[88px] rounded-full bg-muted" />
          <div className="h-2.5 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}

function PolecaneSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto scrollbar-none pb-1">
      {Array.from({ length: 2 }).map((_, i) => (
        <div key={i} className="shrink-0 w-[68vw] max-w-[280px] rounded-2xl bg-card border border-border/50 overflow-hidden animate-pulse">
          <div className="aspect-[16/10] bg-muted" />
          <div className="px-3 py-2.5 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Rows ───────────────────────────────────────────────────────────────────────

function MotywyRow({
  collections,
  onOpen,
}: {
  collections: DiscoveryCollection[];
  onOpen: (col: DiscoveryCollection) => void;
}) {
  return (
    <div>
      <p className="text-sm font-bold mb-2 px-1">Popularne motywy Warszawy</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory px-1 pb-1">
        {collections.map((col, idx) => {
          const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
          const gradient = PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length];
          return (
            <button
              key={col.id}
              onClick={() => onOpen(col)}
              className="shrink-0 w-[88px] flex flex-col items-center gap-1.5 snap-start active:scale-95 transition-transform"
            >
              <div className="h-[88px] w-[88px] rounded-full overflow-hidden ring-1 ring-border/40">
                {photoItem?.photo_url ? (
                  <img src={photoItem.photo_url} alt={col.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-2xl opacity-60">📍</span>
                  </div>
                )}
              </div>
              <p className="text-[11px] font-semibold text-center leading-tight line-clamp-2 w-[88px]">
                {col.title}
              </p>
            </button>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </div>
  );
}

// Polecajki tworzone przez uzytkownikow (discovery_collections z user_id != null).
// Pokazujemy karty w formacie zblizonym do PolecaneRow (hero 16:10 + tytul + miasto
// + autor + licznik miejsc). Tap otwiera CollectionDetail Sheet jak fallback.
function UserPolecajkiRow({
  collections,
  onOpen,
}: {
  collections: DiscoveryCollection[];
  onOpen: (col: DiscoveryCollection) => void;
}) {
  return (
    <div>
      <p className="text-sm font-bold mb-2 px-1">Polecajki od użytkowników</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1">
        {collections.map((col, idx) => {
          const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
          const gradient = PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length];
          const placesCount = col.items.length;
          return (
            <button
              key={col.id}
              onClick={() => onOpen(col)}
              className="shrink-0 w-[68vw] max-w-[280px] rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.97] transition-transform snap-start"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted relative">
                {photoItem?.photo_url ? (
                  <img src={photoItem.photo_url} alt={col.title} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                    <span className="text-3xl opacity-60">📍</span>
                  </div>
                )}
                {placesCount > 0 && (
                  <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-sm text-[10px] font-semibold text-white">
                    {placesCount} {placesCount === 1 ? "miejsce" : placesCount < 5 ? "miejsca" : "miejsc"}
                  </div>
                )}
              </div>
              <div className="px-3.5 py-2.5 space-y-1">
                <p className="font-bold text-sm leading-snug line-clamp-2">{col.title}</p>
                {col.city && (
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {col.city}
                  </div>
                )}
                <AuthorChip name={col.author_name} avatar={col.author_avatar} />
              </div>
            </button>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </div>
  );
}

function PolecaneRow({
  entries,
  onCreatorOpen,
}: {
  entries: PolecaneEntry[];
  onCreatorOpen: (plan: PolecaneCreatorPlan) => void;
}) {
  const navigate = useNavigate();

  return (
    <div>
      <p className="text-sm font-bold mb-2 px-1">Polecane</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1">
        {entries.map((entry) => {
          const photo = entry.photo ?? getRandomPinPlaceholder(entry.id);
          const onClick = () => {
            if (entry.kind === "route") {
              navigate(`/route/${entry.id}`);
            } else {
              onCreatorOpen(entry);
            }
          };
          return (
            <button
              key={`${entry.kind}-${entry.id}`}
              onClick={onClick}
              className="shrink-0 w-[68vw] max-w-[280px] rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.97] transition-transform snap-start"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted">
                <img
                  src={photo}
                  alt={entry.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = getRandomPinPlaceholder(entry.id + "_fb");
                  }}
                />
              </div>
              <div className="px-3 py-2.5 space-y-1.5">
                <p className="font-bold text-sm leading-snug line-clamp-2">{entry.title}</p>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground min-w-0">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span className="truncate">{entry.city ?? "-"}</span>
                  </div>
                  {entry.kind === "route" ? (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
                      <Globe className="h-3 w-3" />
                      Trasa
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[10px] text-orange-600 font-semibold shrink-0">
                      <Sparkles className="h-3 w-3" />
                      Twórca
                    </span>
                  )}
                </div>
                {entry.kind === "route" ? (
                  <AuthorChip name={entry.author_name} avatar={entry.author_avatar} />
                ) : (
                  <AuthorChip name={`@${entry.creator_handle}`} avatar={entry.creator_avatar_url} />
                )}
              </div>
            </button>
          );
        })}
        <div className="shrink-0 w-2" />
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

export default function DiscoveryFeed() {
  const [activeCol, setActiveCol] = useState<DiscoveryCollection | null>(null);
  const [activeCreator, setActiveCreator] = useState<PolecaneCreatorPlan | null>(null);

  const { data: motywy = [], isLoading: motywyLoading } = useQuery({
    queryKey: ["discovery-motywy-warszawa"],
    queryFn: async () => {
      const { data: cols, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar")
        .eq("is_public", true)
        .eq("city", "Warszawa")
        .order("created_at", { ascending: false })
        .limit(12);
      if (error || !cols?.length) return [] as DiscoveryCollection[];

      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      const coordMap = new Map<string, { latitude: number; longitude: number }>();
      try {
        const { data: coords } = await (supabase as any)
          .from("discovery_items")
          .select("id, latitude, longitude")
          .in("collection_id", ids)
          .not("latitude", "is", null);
        if (coords) {
          for (const c of coords) {
            if (c.latitude && c.longitude) coordMap.set(c.id, { latitude: c.latitude, longitude: c.longitude });
          }
        }
      } catch {
        // optional columns
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

  const { data: polecane = [], isLoading: polecaneLoading } = useQuery({
    queryKey: ["discovery-polecane"],
    queryFn: async () => {
      const [routesRes, creatorRes] = await Promise.all([
        (supabase as any)
          .from("routes")
          .select("id, title, city, review_photos, ai_highlight, user_id, views")
          .eq("is_shared", true)
          .not("title", "is", null)
          .order("views", { ascending: false, nullsFirst: false })
          .limit(8),
        (supabase as any)
          .from("creator_plans")
          .select("id, title, city, description, thumbnail_url, creator_handle, creator_avatar_url, num_days, tags")
          .eq("is_active", true)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

      const routes = (routesRes.data ?? []) as any[];
      const creatorPlans = (creatorRes.data ?? []) as any[];

      // Fetch profiles for routes
      const userIds = [...new Set(routes.map((r) => r.user_id).filter(Boolean))];
      let profileMap = new Map<string, { username: string | null; first_name: string | null; avatar_url: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await (supabase as any)
          .from("profiles")
          .select("id, username, first_name, avatar_url")
          .in("id", userIds);
        if (profiles) {
          for (const p of profiles) {
            profileMap.set(p.id, { username: p.username, first_name: p.first_name, avatar_url: p.avatar_url });
          }
        }
      }

      const routeEntries: PolecaneRoute[] = routes.map((r) => {
        const profile = profileMap.get(r.user_id);
        const photo = (r.review_photos ?? []).find((url: any) => typeof url === "string" && url.trim() !== "") ?? null;
        const authorName = profile?.first_name || profile?.username || "Użytkownik";
        return {
          kind: "route",
          id: r.id,
          title: r.title,
          city: r.city,
          photo,
          ai_highlight: r.ai_highlight,
          author_name: authorName,
          author_avatar: profile?.avatar_url ?? null,
        };
      });

      const creatorEntries: PolecaneCreatorPlan[] = creatorPlans.map((p) => ({
        kind: "creator",
        id: p.id,
        title: p.title,
        city: p.city,
        description: p.description,
        photo: p.thumbnail_url,
        creator_handle: p.creator_handle,
        creator_avatar_url: p.creator_avatar_url,
        num_days: p.num_days,
        tags: p.tags,
      }));

      // Interleave: route, creator, route, creator, ...
      const merged: PolecaneEntry[] = [];
      const maxLen = Math.max(routeEntries.length, creatorEntries.length);
      for (let i = 0; i < maxLen && merged.length < 12; i++) {
        if (i < routeEntries.length) merged.push(routeEntries[i]);
        if (i < creatorEntries.length && merged.length < 12) merged.push(creatorEntries[i]);
      }
      return merged;
    },
    staleTime: 5 * 60 * 1000,
  });

  const bothEmpty = !motywyLoading && !polecaneLoading && motywy.length === 0 && polecane.length === 0;

  // Polecajki tworzone przez uzytkownikow (user_id != null) - feed user-generated
  // content w odroznieniu od admin curated motywow. Zawsze enabled (nie tylko gdy
  // bothEmpty), pokazuje top 10 najnowszych. Empty state = brak sekcji.
  const { data: userPolecajki = [] } = useQuery({
    queryKey: ["user-polecajki"],
    queryFn: async () => {
      const { data: cols, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar")
        .eq("is_public", true)
        .not("user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error || !cols?.length) return [] as DiscoveryCollection[];

      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url, latitude, longitude")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        items: (items ?? []).filter((i: any) => i.collection_id === col.id),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: fallbackCollections = [] } = useQuery({
    queryKey: ["discovery-fallback"],
    queryFn: async () => {
      const { data: cols, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error || !cols?.length) return [] as DiscoveryCollection[];

      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      const coordMap = new Map<string, { latitude: number; longitude: number }>();
      try {
        const { data: coords } = await (supabase as any)
          .from("discovery_items")
          .select("id, latitude, longitude")
          .in("collection_id", ids)
          .not("latitude", "is", null);
        if (coords) {
          for (const c of coords) {
            if (c.latitude && c.longitude) coordMap.set(c.id, { latitude: c.latitude, longitude: c.longitude });
          }
        }
      } catch {
        // optional
      }

      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        items: (items ?? [])
          .filter((i: any) => i.collection_id === col.id)
          .map((i: any) => ({ ...i, ...coordMap.get(i.id) })),
      }));
    },
    enabled: bothEmpty,
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = motywyLoading || polecaneLoading;

  return (
    <>
      {isLoading ? (
        <div className="space-y-5">
          <div>
            <div className="h-4 w-44 bg-muted rounded mb-2 mx-1 animate-pulse" />
            <MotywySkeleton />
          </div>
          <div>
            <div className="h-4 w-24 bg-muted rounded mb-2 mx-1 animate-pulse" />
            <PolecaneSkeleton />
          </div>
        </div>
      ) : (
        <div className="space-y-5">
          {motywy.length > 0 && <MotywyRow collections={motywy} onOpen={setActiveCol} />}
          {userPolecajki.length > 0 && <UserPolecajkiRow collections={userPolecajki} onOpen={setActiveCol} />}
          {polecane.length > 0 && <PolecaneRow entries={polecane} onCreatorOpen={setActiveCreator} />}
          {bothEmpty && fallbackCollections.length > 0 && (
            <div>
              <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1">
                {fallbackCollections.map((col) => {
                  const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
                  return (
                    <button
                      key={col.id}
                      onClick={() => setActiveCol(col)}
                      className="shrink-0 w-[82vw] max-w-[320px] rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.97] transition-transform snap-start"
                    >
                      <div className="aspect-[16/10] overflow-hidden bg-muted">
                        {photoItem?.photo_url ? (
                          <img src={photoItem.photo_url} alt={col.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-amber-200 to-orange-300" />
                        )}
                      </div>
                      <div className="px-3.5 py-2.5 space-y-1">
                        <p className="font-bold text-sm leading-snug line-clamp-2">{col.title}</p>
                        {col.city && (
                          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {col.city}
                          </div>
                        )}
                        <AuthorChip name={col.author_name} avatar={col.author_avatar} />
                      </div>
                    </button>
                  );
                })}
                <div className="shrink-0 w-2" />
              </div>
            </div>
          )}
        </div>
      )}

      <Sheet open={!!activeCol} onOpenChange={(open) => { if (!open) setActiveCol(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 [&>button:last-child]:hidden"
          style={{ maxHeight: "92vh", height: "92vh" }}
        >
          {activeCol && <CollectionDetail col={activeCol} />}
        </SheetContent>
      </Sheet>

      <Sheet open={!!activeCreator} onOpenChange={(open) => { if (!open) setActiveCreator(null); }}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl p-0 [&>button:last-child]:hidden"
          style={{ maxHeight: "92vh", height: "92vh" }}
        >
          {activeCreator && <CreatorPlanDetail plan={activeCreator} />}
        </SheetContent>
      </Sheet>
    </>
  );
}
