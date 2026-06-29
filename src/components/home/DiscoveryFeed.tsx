import { useState } from "react";
import { avatarSrc } from "@/lib/avatar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { MapPin, X, Globe, Sparkles, Star, Pencil, Trash2, ChevronRight, ArrowRight } from "lucide-react";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import RouteMap from "@/components/RouteMap";
import { type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { resolveStored } from "@/components/PlacePhoto";

type DiscoveryItem = {
  id: string;
  order_index: number;
  place_name: string;
  short_desc: string | null;
  photo_url: string | null;
  latitude?: number | null;
  longitude?: number | null;
  place_id?: string | null;     // != null -> miejsce z bazy (tap -> wizytowka)
  category?: string | null;
  address?: string | null;
  rating?: number | null;       // gwiazdki Google (dla miejsca spoza bazy)
};

type DiscoveryCollection = {
  id: string;
  title: string;
  city: string | null;
  description: string | null;
  author_name: string;
  author_avatar: string | null;
  items: DiscoveryItem[];
  user_id?: string | null;
  author_home_city?: string | null;  // do badge "lokals poleca!"
};

type PolecaneRoute = {
  kind: "route";
  id: string;
  title: string;
  city: string | null;
  photo: string | null;
  ai_highlight: string | null;
  summary?: string | null;
  categories?: string[];
  author_name: string;
  author_avatar: string | null;
  placeCount?: number;
};

const CAT_LABEL: Record<string, string> = {
  restaurant: "Restauracja", cafe: "Kawiarnia", museum: "Muzeum", park: "Park",
  bar: "Bar", club: "Klub", monument: "Zabytek", gallery: "Galeria",
  market: "Targ", viewpoint: "Punkt widokowy", shopping: "Zakupy", experience: "Atrakcja",
  walk: "Spacer", other: "Miejsce",
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function AuthorChip({ name, avatar }: { name: string; avatar: string | null }) {
  // Oficjalne trasy ("trasa") - realne logo Trasy zamiast placeholdera awatara.
  const isTrasa = ["trasa", "trasa.travel", "@trasa"].includes(name.trim().toLowerCase());
  return (
    <div className="flex items-center gap-1.5">
      {isTrasa ? (
        <img src="/Icon_Trasa.png" alt="trasa" className="h-5 w-5 object-contain shrink-0" />
      ) : (
        <img src={avatarSrc(avatar)} alt={name} className="h-5 w-5 rounded-full object-cover bg-orange-100" />
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
  // Custom miejsca (spoza bazy) trzymaja surowy Google photo_reference - przepusc przez proxy
  // (resolveStored: pelny URL bez zmian, raw ref -> getPhotoUrl). Inaczej <img src=ref> = pusty kafel.
  const url = resolveStored(item.photo_url);
  return url ? (
    <img src={url} alt={item.place_name} className={`object-cover ${className ?? ""}`} loading="lazy" />
  ) : (
    <div className={`bg-gradient-to-br ${gradient} flex items-center justify-center ${className ?? ""}`}>
      <span className="text-2xl opacity-60">📍</span>
    </div>
  );
}

// ── Detail sheet ───────────────────────────────────────────────────────────────

function CollectionDetail({ col, onClose }: { col: DiscoveryCollection; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [detailPlace, setDetailPlace] = useState<MockPlace | null>(null);
  const [deleting, setDeleting] = useState(false);
  const isOwner = !!user && user.id === col.user_id;
  const isLocal = !!col.author_home_city && !!col.city && col.author_home_city.trim().toLowerCase() === col.city.trim().toLowerCase();

  // Miejsce z bazy (place_id) -> otworz pelna wizytowke. Custom (place_id null) = nieklikalne.
  const openPlace = async (item: DiscoveryItem) => {
    if (!item.place_id) return;
    const { data } = await (supabase as any).from("places").select("*").eq("id", item.place_id).maybeSingle();
    if (!data) return;
    setDetailPlace({
      id: data.id, place_name: data.place_name, category: (data.category || "other"),
      city: data.city ?? col.city ?? "", address: data.address ?? "", latitude: data.latitude ?? 0, longitude: data.longitude ?? 0,
      rating: data.rating ?? 0, photo_url: data.photo_url ?? "", vibe_tags: data.vibe_tags ?? [], description: data.description ?? "",
    } as MockPlace);
  };

  const handleDelete = async () => {
    if (!isOwner || deleting) return;
    if (!confirm("Usunąć to zestawienie?")) return;
    setDeleting(true);
    await (supabase as any).from("discovery_collections").delete().eq("id", col.id);
    queryClient.invalidateQueries({ queryKey: ["explore-rankings"] });
    onClose();
  };

  // Piny do mapy-podgladu (RouteMap = Google, dziala natywnie; leaflet w iframe srcDoc
  // sie nie ladowal w WebView - stad bialy placeholder).
  const mapPins = col.items
    .filter((i) => i.latitude && i.longitude)
    .map((i) => ({ latitude: i.latitude!, longitude: i.longitude!, place_name: i.place_name }));

  // "Uzyj tej trasy" - przejmij miejsca zestawienia do nowej trasy (swiper -> Dopasowania).
  const adoptRoute = () => {
    const names = col.items.map((i) => i.place_name).filter(Boolean);
    onClose();
    navigate("/plan", { state: { step: 4, city: col.city, date: new Date().toISOString(), likedPlaceNames: names } });
  };
  const planOwn = () => { onClose(); navigate("/plan", { state: { step: 2, city: col.city } }); };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 pt-4 pb-3 shrink-0">
        <div className="flex-1 min-w-0">
          <h2 className="font-display font-extrabold text-xl leading-tight line-clamp-2">{col.title}</h2>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <AuthorChip name={col.author_name} avatar={col.author_avatar} />
            {isLocal && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 rounded-full px-1.5 py-0.5">lokals poleca!</span>}
            {col.city && (
              <><span className="text-muted-foreground/40 text-xs">·</span><span className="text-xs text-muted-foreground">{col.city}</span></>
            )}
          </div>
          {isOwner && (
            <div className="flex gap-3 mt-2">
              <button onClick={() => navigate(`/zestawienie/${col.id}/edytuj`)} className="text-xs font-semibold text-orange-600 flex items-center gap-1"><Pencil className="h-3 w-3" /> Edytuj</button>
              <button onClick={handleDelete} disabled={deleting} className="text-xs font-semibold text-destructive flex items-center gap-1 disabled:opacity-50"><Trash2 className="h-3 w-3" /> Usuń</button>
            </div>
          )}
        </div>
        <SheetClose className="h-8 w-8 flex items-center justify-center rounded-full bg-muted text-muted-foreground active:scale-90 transition-transform shrink-0 mt-0.5">
          <X className="h-4 w-4" />
        </SheetClose>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Waski podglad mapy z trasa miejsc (statyczny - overlay blokuje interakcje) */}
        {mapPins.length > 0 && (
          <div className="relative h-40 mx-4 mb-1 rounded-2xl overflow-hidden border border-border/40">
            <RouteMap pins={mapPins as any} className="w-full h-full" />
            <div className="absolute inset-0" />
          </div>
        )}

        {col.description && (
          <p className="text-sm text-muted-foreground leading-relaxed px-4 pt-3">{col.description}</p>
        )}

        {/* Timeline: okladki miejsc polaczone liniami + kropkami (jak loading state PlanWizard) */}
        <div className="px-4 pt-4 pb-4">
          {col.items.map((item, idx) => {
            const tappable = !!item.place_id;
            const Tag: any = tappable ? "button" : "div";
            const isLast = idx === col.items.length - 1;
            return (
              <div key={item.id} className="flex gap-3">
                {/* Szyna: numerowana kropka + przerywana linia laczaca */}
                <div className="flex flex-col items-center shrink-0 w-7">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-[#F4A259] to-[#F9662B] flex items-center justify-center shadow-sm ring-4 ring-background z-10">
                    <span className="text-white text-xs font-black">{idx + 1}</span>
                  </div>
                  {!isLast && <div className="flex-1 w-0 my-1 border-l-2 border-dotted border-orange-300/70" />}
                </div>
                {/* Okladka z nazwa + ocena bezposrednio na zdjeciu */}
                <Tag
                  {...(tappable ? { onClick: () => openPlace(item) } : {})}
                  className={`flex-1 min-w-0 mb-4 text-left block ${tappable ? "active:scale-[0.99] transition-transform" : ""}`}
                >
                  <div className="relative rounded-2xl overflow-hidden aspect-[16/10]">
                    <PlacePhoto item={item} placeholderIdx={idx} className="w-full h-full" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                    {item.rating != null && (
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-0.5 px-2 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-sm">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-[11px] font-bold text-foreground">{item.rating}</span>
                      </div>
                    )}
                    {tappable ? (
                      <div className="absolute top-2.5 left-2.5 h-7 pl-2.5 pr-1.5 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-0.5 shadow-sm">
                        <span className="text-[10px] font-bold text-foreground">Zobacz</span>
                        <ChevronRight className="h-3.5 w-3.5 text-foreground" />
                      </div>
                    ) : (
                      <div className="absolute top-2.5 left-2.5 flex items-center gap-1 px-2 py-1 rounded-full bg-foreground/55 backdrop-blur-sm">
                        <Globe className="h-3 w-3 text-white/90 shrink-0" />
                        <span className="text-[9px] font-semibold text-white leading-tight">jeszcze nie&nbsp;ma w&nbsp;Trasie</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 p-3">
                      <p className="text-white font-display font-extrabold text-lg leading-tight drop-shadow-sm">{item.place_name}</p>
                      {item.address && <p className="text-white/80 text-[11px] mt-0.5 line-clamp-1">{item.address}</p>}
                    </div>
                  </div>
                  {item.short_desc && <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed px-0.5">{item.short_desc}</p>}
                </Tag>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="shrink-0 border-t border-border/20 px-4 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] bg-background">
        <button
          onClick={adoptRoute}
          className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
        >
          Użyj tej trasy <ArrowRight className="h-4 w-4" />
        </button>
        {col.city && (
          <button onClick={planOwn} className="w-full mt-1.5 py-2 text-sm font-semibold text-muted-foreground active:scale-[0.97] transition-transform">
            albo zaplanuj własną w&nbsp;{col.city}
          </button>
        )}
      </div>

      {detailPlace && (
        <PlaceSwiperDetail open={!!detailPlace} onOpenChange={(o) => { if (!o) setDetailPlace(null); }} place={detailPlace} city={col.city ?? undefined} skipGoogleFetch={false} />
      )}
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

// Skeletony 1:1 z realna trescia Eksploruj (RouteCardH poziome + RouteCardV pionowe),
// zeby przy zaladowaniu nie bylo skoku layoutu.
function RouteCardHSkeleton() {
  return (
    <div className="shrink-0 w-[46vw] max-w-[200px] animate-pulse">
      <div className="aspect-[3/4] rounded-2xl bg-muted" />
      <div className="mt-2 flex items-center gap-1.5 px-0.5">
        <div className="h-4 w-4 rounded-full bg-muted" />
        <div className="h-3 w-20 bg-muted rounded" />
      </div>
    </div>
  );
}

function RouteCardVSkeleton() {
  return (
    <div className="w-full animate-pulse">
      <div className="aspect-[16/9] rounded-2xl bg-muted" />
      <div className="mt-2.5 space-y-2">
        <div className="h-4 w-3/4 bg-muted rounded" />
        <div className="h-3 w-full bg-muted rounded" />
        <div className="h-3 w-2/3 bg-muted rounded" />
        <div className="flex gap-1.5 pt-0.5">
          <div className="h-4 w-14 bg-muted rounded-full" />
          <div className="h-4 w-16 bg-muted rounded-full" />
        </div>
        <div className="flex items-center gap-1.5 pt-0.5">
          <div className="h-5 w-5 rounded-full bg-muted" />
          <div className="h-3 w-24 bg-muted rounded" />
        </div>
      </div>
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
          const photoUrl = resolveStored(photoItem?.photo_url);
          const gradient = PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length];
          return (
            <button
              key={col.id}
              onClick={() => onOpen(col)}
              className="shrink-0 w-[88px] flex flex-col items-center gap-1.5 snap-start active:scale-95 transition-transform"
            >
              <div className="h-[88px] w-[88px] rounded-full overflow-hidden ring-1 ring-border/40">
                {photoUrl ? (
                  <img src={photoUrl} alt={col.title} className="w-full h-full object-cover" loading="lazy" />
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
      <p className="text-sm font-bold mb-2 px-1">Zestawienia miejsc</p>
      <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1">
        {collections.map((col, idx) => {
          const photoItem = col.items.find((i) => i.photo_url) ?? col.items[0];
          const photoUrl = resolveStored(photoItem?.photo_url);
          const gradient = PLACEHOLDER_GRADIENTS[idx % PLACEHOLDER_GRADIENTS.length];
          const placesCount = col.items.length;
          const isLocal = !!col.author_home_city && !!col.city && col.author_home_city.trim().toLowerCase() === col.city.trim().toLowerCase();
          return (
            <button
              key={col.id}
              onClick={() => onOpen(col)}
              className="shrink-0 w-[68vw] max-w-[280px] rounded-2xl bg-card border border-border/50 overflow-hidden text-left active:scale-[0.97] transition-transform snap-start"
            >
              <div className="aspect-[16/10] w-full overflow-hidden bg-muted relative">
                {photoUrl ? (
                  <img src={photoUrl} alt={col.title} className="w-full h-full object-cover" loading="lazy" />
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
                <div className="flex items-center gap-1.5 flex-wrap">
                  <AuthorChip name={col.author_name} avatar={col.author_avatar} />
                  {isLocal && <span className="text-[9px] font-bold text-orange-700 bg-orange-100 rounded-full px-1.5 py-0.5">lokals poleca!</span>}
                </div>
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

// ── Redesign: trasy uzytkownikow (Najnowsze + w Warszawie) ─────────────────────

// Ranking kategorii dla okladki: najbardziej "pocztowkowe" pierwsze.
const CAT_RANK: Record<string, number> = {
  viewpoint: 0, monument: 1, park: 2, gallery: 3, museum: 4, experience: 5,
  market: 6, shopping: 7, club: 8, bar: 9, cafe: 10, restaurant: 11, walk: 12,
};

const placesLabel = (n: number): string => {
  if (n === 1) return "1 miejsce";
  const l = n % 10, l2 = n % 100;
  if (l >= 2 && l <= 4 && (l2 < 10 || l2 >= 20)) return `${n} miejsca`;
  return `${n} miejsc`;
};

// Wzbogaca wiersze routes o okladke (najatrakcyjniejsze zdjecie miejsca),
// autora (profil) i liczbe miejsc. Reuzywane przez obie sekcje.
async function enrichRouteRows(routes: any[]): Promise<PolecaneRoute[]> {
  if (!routes.length) return [];
  const routeIds = routes.map((r) => r.id);
  const photoMap = new Map<string, string>();
  const countMap = new Map<string, number>();
  const catMap = new Map<string, string[]>(); // 3 glowne kategorie (wg pin_order)
  const { data: pinRows } = await (supabase as any)
    .from("pins")
    .select("route_id, photo_url, image_url, category, pin_order")
    .in("route_id", routeIds)
    .order("pin_order", { ascending: true });
  const best = new Map<string, { url: string; rank: number; order: number }>();
  for (const p of (pinRows ?? []) as any[]) {
    countMap.set(p.route_id, (countMap.get(p.route_id) ?? 0) + 1);
    if (p.category) {
      const arr = catMap.get(p.route_id) ?? [];
      if (arr.length < 3 && !arr.includes(p.category)) { arr.push(p.category); catMap.set(p.route_id, arr); }
    }
    const url = resolveStored(p.photo_url || p.image_url);
    if (!url) continue;
    const rank = CAT_RANK[p.category as string] ?? 50;
    const order = p.pin_order ?? 999;
    const cur = best.get(p.route_id);
    if (!cur || rank < cur.rank || (rank === cur.rank && order < cur.order)) {
      best.set(p.route_id, { url, rank, order });
    }
  }
  for (const [rid, v] of best) photoMap.set(rid, v.url);

  const userIds = [...new Set(routes.map((r) => r.user_id).filter(Boolean))];
  const profileMap = new Map<string, any>();
  if (userIds.length) {
    const { data: profiles } = await (supabase as any)
      .from("profiles").select("id, username, first_name, avatar_url").in("id", userIds);
    for (const p of profiles ?? []) profileMap.set(p.id, p);
  }

  return routes.map((r): PolecaneRoute => {
    const prof = profileMap.get(r.user_id);
    return {
      kind: "route", id: r.id, title: r.title, city: r.city,
      photo: photoMap.get(r.id) ?? null,
      ai_highlight: r.ai_highlight ?? null,
      summary: r.ai_summary ?? null,
      categories: catMap.get(r.id) ?? [],
      author_name: prof?.first_name || prof?.username || "Użytkownik",
      author_avatar: prof?.avatar_url ?? null,
      placeCount: countMap.get(r.id) ?? 0,
    };
  });
}

// Karta pozioma (Najnowsze trasy) - portretowa okladka z tytulem na zdjeciu.
function RouteCardH({ route, onClick }: { route: PolecaneRoute; onClick: () => void }) {
  const photo = route.photo ?? getRandomPinPlaceholder(route.id);
  return (
    <button onClick={onClick} className="shrink-0 w-[46vw] max-w-[200px] snap-start text-left active:scale-[0.97] transition-transform">
      <div className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-muted shadow-sm">
        <img src={photo} alt={route.title} loading="lazy" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(route.id + "_fb"); }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <p className="text-white font-bold text-sm leading-snug line-clamp-2 drop-shadow-sm">{route.title}</p>
          <p className="text-white/85 text-[11px] mt-1 flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />{route.city ?? "-"}
            {route.placeCount ? <span className="opacity-70">· {route.placeCount}</span> : null}
          </p>
        </div>
      </div>
      <div className="mt-2 px-0.5"><AuthorChip name={route.author_name} avatar={route.author_avatar} /></div>
    </button>
  );
}

// Karta pionowa (Trasy w Warszawie) - duza okladka + tytul + autor pod spodem.
function RouteCardV({ route, onClick }: { route: PolecaneRoute; onClick: () => void }) {
  const photo = route.photo ?? getRandomPinPlaceholder(route.id);
  return (
    <button onClick={onClick} className="w-full text-left active:scale-[0.98] transition-transform">
      <div className="relative aspect-[16/9] rounded-2xl overflow-hidden bg-muted shadow-sm">
        <img src={photo} alt={route.title} loading="lazy" className="w-full h-full object-cover"
          onError={(e) => { (e.target as HTMLImageElement).src = getRandomPinPlaceholder(route.id + "_fb"); }} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
        {route.placeCount ? (
          <span className="absolute top-3 left-3 bg-black/45 backdrop-blur-sm rounded-full px-2.5 py-1 text-[11px] font-semibold text-white flex items-center gap-1">
            <MapPin className="h-3 w-3" />{placesLabel(route.placeCount)}
          </span>
        ) : null}
      </div>
      <div className="mt-2.5">
        <p className="font-black text-base leading-snug line-clamp-2">{route.title}</p>
        {(route.summary || route.ai_highlight) && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-1">{route.summary || route.ai_highlight}</p>
        )}
        {route.categories && route.categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {route.categories.slice(0, 3).map((c) => (
              <span key={c} className="text-[10px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {CAT_LABEL[c] ?? c}
              </span>
            ))}
          </div>
        )}
        <div className="mt-2.5"><AuthorChip name={route.author_name} avatar={route.author_avatar} /></div>
      </div>
    </button>
  );
}

// ── Main export ────────────────────────────────────────────────────────────────

// Sekcja "Zestawienia miejsc" w Eksploruj - WYLACZONA (feature na TODO, nie w MVP).
// Flip na true gdy zestawienia wracaja do aplikacji.
const SHOW_ZESTAWIENIA = false;

export default function DiscoveryFeed() {
  const [activeCol, setActiveCol] = useState<DiscoveryCollection | null>(null);
  const [activeCreator, setActiveCreator] = useState<PolecaneCreatorPlan | null>(null);
  const navigate = useNavigate();

  // Najnowsze udostepnione trasy (poziomy scroll).
  const { data: newest = [], isLoading: newestLoading } = useQuery({
    queryKey: ["discovery-newest-routes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, ai_highlight, user_id, created_at")
        .eq("is_shared", true).not("title", "is", null)
        .order("created_at", { ascending: false })
        .limit(10);
      return enrichRouteRows(data ?? []);
    },
    staleTime: 60_000,
  });

  // Trasy w Warszawie (lista pionowa).
  const { data: warszawa = [], isLoading: wawaLoading } = useQuery({
    queryKey: ["discovery-warszawa-routes"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("routes")
        .select("id, title, city, ai_highlight, ai_summary, user_id, created_at, views")
        .eq("is_shared", true).not("title", "is", null).ilike("city", "warszawa%")
        .order("views", { ascending: false, nullsFirst: false })
        .limit(30);
      return enrichRouteRows(data ?? []);
    },
    staleTime: 60_000,
  });

  const { data: motywy = [], isLoading: motywyLoading } = useQuery({
    queryKey: ["discovery-motywy-warszawa"],
    enabled: false,
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
    enabled: false,
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

      // Okladka karty = najatrakcyjniejsze ZDJECIE MIEJSCA z trasy (nie zdjecie
      // usera). Ranking kategorii (najbardziej "pocztowkowe" pierwsze) + pierwszy
      // pin ze zdjeciem jako tie-break.
      const routeIds = routes.map((r) => r.id);
      const placePhotoMap = new Map<string, string>();
      if (routeIds.length > 0) {
        const { data: pinRows } = await (supabase as any)
          .from("pins")
          .select("route_id, photo_url, image_url, category, pin_order")
          .in("route_id", routeIds);
        const RANK: Record<string, number> = {
          viewpoint: 0, monument: 1, park: 2, gallery: 3, museum: 4, experience: 5,
          market: 6, shopping: 7, club: 8, bar: 9, cafe: 10, restaurant: 11, walk: 12,
        };
        const best = new Map<string, { url: string; rank: number; order: number }>();
        for (const p of (pinRows ?? []) as any[]) {
          const url = resolveStored(p.photo_url || p.image_url);
          if (!url) continue;
          const rank = RANK[p.category as string] ?? 50;
          const order = p.pin_order ?? 999;
          const cur = best.get(p.route_id);
          if (!cur || rank < cur.rank || (rank === cur.rank && order < cur.order)) {
            best.set(p.route_id, { url, rank, order });
          }
        }
        for (const [rid, v] of best) placePhotoMap.set(rid, v.url);
      }

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
        // Okladka ze zdjec miejsc (najatrakcyjniejsze), nie ze zdjec usera.
        const photo = placePhotoMap.get(r.id) ?? null;
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

  // Zestawienia/rankingi miejsc (kind='ranking'). TYMCZASOWO WYLACZONE w Eksploruj
  // (feature jeszcze nie w MVP - na TODO). Flaga ponizej -> latwy powrot. Kod + query
  // zostaja w gotowosci. enabled=SHOW_ZESTAWIENIA zeby nie strzelac niepotrzebnie do DB.
  const { data: userPolecajki = [] } = useQuery({
    queryKey: ["explore-rankings"],
    enabled: SHOW_ZESTAWIENIA,
    queryFn: async () => {
      const { data: cols, error } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, author_name, author_avatar, user_id")
        .eq("is_public", true)
        .eq("kind", "ranking")
        .eq("hidden_by_admin", false)
        .eq("moderation_status", "approved")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error || !cols?.length) return [] as DiscoveryCollection[];

      const ids = cols.map((c: any) => c.id);
      const { data: items } = await (supabase as any)
        .from("discovery_items")
        .select("id, collection_id, order_index, place_name, short_desc, photo_url, latitude, longitude, place_id, category, address, rating")
        .in("collection_id", ids)
        .order("order_index", { ascending: true });

      // home_city autorow -> badge "lokals poleca!"
      const userIds = [...new Set(cols.map((c: any) => c.user_id).filter(Boolean))];
      const homeMap = new Map<string, string | null>();
      if (userIds.length) {
        const { data: profs } = await (supabase as any).from("profiles").select("id, home_city").in("id", userIds);
        for (const p of profs ?? []) homeMap.set(p.id, p.home_city ?? null);
      }

      return cols.map((col: any): DiscoveryCollection => ({
        ...col,
        author_home_city: homeMap.get(col.user_id) ?? null,
        items: (items ?? []).filter((i: any) => i.collection_id === col.id),
      }));
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: fallbackCollections = [] } = useQuery({
    queryKey: ["discovery-fallback"],
    enabled: false,
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
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = newestLoading || wawaLoading;
  void motywyLoading; void polecaneLoading;

  return (
    <>
      {isLoading ? (
        <div className="space-y-7">
          {/* Najnowsze trasy - poziomy scroll */}
          <div>
            <div className="h-3.5 w-32 bg-muted rounded mb-3 mx-1 animate-pulse" />
            <div className="flex gap-3 overflow-hidden pb-1 -mx-1 px-1">
              {Array.from({ length: 3 }).map((_, i) => <RouteCardHSkeleton key={i} />)}
            </div>
          </div>
          {/* Trasy w Warszawie - duze pionowe karty */}
          <div>
            <div className="h-6 w-44 bg-muted rounded mb-4 mx-1 animate-pulse" />
            <div className="space-y-5">
              {Array.from({ length: 2 }).map((_, i) => <RouteCardVSkeleton key={i} />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-7">
          {/* Najnowsze trasy - poziomy scroll (jak RECENT ISSUES) */}
          {newest.length > 0 && (
            <div>
              <p className="text-sm font-black uppercase tracking-wide mb-3 px-1">Najnowsze trasy</p>
              <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1 -mx-1 px-1">
                {newest.map((r) => (
                  <RouteCardH key={r.id} route={r} onClick={() => navigate(`/route/${r.id}`)} />
                ))}
                <div className="shrink-0 w-0.5" />
              </div>
            </div>
          )}

          {/* Zestawienia miejsc - WYLACZONE (TODO, nie w MVP). Flaga SHOW_ZESTAWIENIA. */}
          {SHOW_ZESTAWIENIA && userPolecajki.length > 0 && (
            <UserPolecajkiRow collections={userPolecajki} onOpen={setActiveCol} />
          )}

          {/* Trasy w Warszawie - lista pionowa (jak LATEST) */}
          {warszawa.length > 0 && (
            <div>
              <div className="mb-4 px-1">
                <h2 className="text-xl font-black tracking-tight">Trasy w Warszawie</h2>
              </div>
              <div className="space-y-5">
                {warszawa.map((r) => (
                  <RouteCardV key={r.id} route={r} onClick={() => navigate(`/route/${r.id}`)} />
                ))}
              </div>
            </div>
          )}

          {newest.length === 0 && warszawa.length === 0 && userPolecajki.length === 0 && (
            <div className="py-16 text-center px-8">
              <div className="text-5xl mb-3">🗺️</div>
              <p className="text-base font-bold">Trasy społeczności już wkrótce</p>
              <p className="text-sm text-muted-foreground mt-1">Stwórz swoją pierwszą trasę i&nbsp;udostępnij ją, żeby pomóc innym zaplanować podróż.</p>
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
          {activeCol && <CollectionDetail col={activeCol} onClose={() => setActiveCol(null)} />}
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
