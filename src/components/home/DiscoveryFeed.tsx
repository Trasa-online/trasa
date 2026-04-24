import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MapPin } from "lucide-react";

type DiscoveryItem = {
  id: string;
  order_index: number;
  place_name: string;
  short_desc: string | null;
  photo_url: string | null;
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

function PhotoGrid({ items }: { items: DiscoveryItem[] }) {
  const photos = items.filter((i) => i.photo_url).slice(0, 5);
  if (photos.length === 0) return null;

  const [main, ...rest] = photos;

  return (
    <div className="flex gap-1 h-44 overflow-hidden">
      {/* Big photo — left 2/3 */}
      <div className="relative flex-[2] min-w-0 overflow-hidden rounded-l-xl">
        <img
          src={main.photo_url!}
          alt={main.place_name}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/60 to-transparent">
          <p className="text-white text-[10px] font-semibold leading-tight line-clamp-1">
            {main.place_name}
          </p>
        </div>
      </div>

      {/* Side photos — right 1/3, stacked */}
      {rest.length > 0 && (
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {rest.slice(0, 2).map((item, idx) => (
            <div
              key={item.id}
              className={`relative flex-1 overflow-hidden ${idx === 0 ? "rounded-tr-xl" : rest.slice(0, 2).length === 1 || idx === rest.slice(0, 2).length - 1 ? "rounded-br-xl" : ""}`}
            >
              <img
                src={item.photo_url!}
                alt={item.place_name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute bottom-0 left-0 right-0 px-1.5 py-1 bg-gradient-to-t from-black/60 to-transparent">
                <p className="text-white text-[9px] font-semibold leading-tight line-clamp-1">
                  {item.place_name}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PlaceList({ items }: { items: DiscoveryItem[] }) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none pb-0.5">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-start gap-1.5 shrink-0 max-w-[140px]">
          <span className="text-[10px] font-black text-orange-500 mt-0.5 shrink-0">
            {idx + 1}.
          </span>
          <div>
            <p className="text-[11px] font-semibold leading-tight line-clamp-1">{item.place_name}</p>
            {item.short_desc && (
              <p className="text-[10px] text-muted-foreground leading-tight line-clamp-1 mt-0.5">
                {item.short_desc}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function CollectionCard({ col }: { col: DiscoveryCollection }) {
  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden">
      {/* Photo grid */}
      <PhotoGrid items={col.items} />

      {/* Info */}
      <div className="px-3.5 pt-3 pb-3.5 space-y-2">
        {/* Title + city */}
        <div className="flex items-start justify-between gap-2">
          <p className="font-black text-sm leading-snug flex-1">{col.title}</p>
          {col.city && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0 mt-0.5">
              <MapPin className="h-3 w-3" />
              {col.city}
            </div>
          )}
        </div>

        {/* Place list */}
        <PlaceList items={col.items} />

        {/* Author + description */}
        <div className="flex items-center justify-between pt-0.5">
          <AuthorChip name={col.author_name} avatar={col.author_avatar} />
          {col.description && (
            <p className="text-[10px] text-muted-foreground line-clamp-1 flex-1 ml-3 text-right">
              {col.description}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function CollectionSkeleton() {
  return (
    <div className="rounded-2xl bg-card border border-border/50 overflow-hidden animate-pulse">
      <div className="h-44 bg-muted" />
      <div className="px-3.5 pt-3 pb-3.5 space-y-2">
        <div className="h-4 bg-muted rounded w-3/4" />
        <div className="h-3 bg-muted rounded w-1/2" />
        <div className="h-3 bg-muted rounded w-1/3" />
      </div>
    </div>
  );
}

export default function DiscoveryFeed() {
  const { data: collections = [], isLoading } = useQuery({
    queryKey: ["discovery-collections"],
    queryFn: async () => {
      const { data: cols } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar")
        .eq("is_public", true)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!cols?.length) return [];

      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        items: (items ?? []).filter((i: any) => i.collection_id === col.id),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CollectionSkeleton />
        <CollectionSkeleton />
      </div>
    );
  }

  if (collections.length === 0) return null;

  return (
    <div className="space-y-4">
      {collections.map((col) => (
        <CollectionCard key={col.id} col={col} />
      ))}
    </div>
  );
}
