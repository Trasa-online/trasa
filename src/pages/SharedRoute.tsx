import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/notify";
import { sendClientPush, getCurrentUserName } from "@/lib/clientPush";
import { format } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { MapPin, ArrowLeft, Sparkles, ChevronRight, ChevronLeft, Bookmark, List, GalleryHorizontalEnd, Calendar as CalendarIcon, Image as ImageIcon, Maximize2, X, Building2 } from "lucide-react";
import { PlacePhoto } from "@/components/PlacePhoto";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import { pinCoverKeys, fetchPlacePhotosForKeys } from "@/lib/placePhotoSocial";
import RouteMap from "@/components/RouteMap";
import { API_BASE } from "@/lib/platform";

// Statyczna mapa trasy (Google przez proxy) - ujednolicona z widokiem "Plan wyjazdu".
// Pomaranczowo-peachy markery (#F0A583). Klik -> interaktywna RouteMap (pelny ekran).
function buildStaticRouteMap(pins: { latitude: number; longitude: number }[], size = "560x300"): string | null {
  const pts = pins.filter((p) => p.latitude != null && p.longitude != null).slice(0, 20);
  if (!pts.length) return null;
  // Numerowane peachy piny (label 1-9; Google static przyjmuje 1 znak - dla 10+ bez numeru).
  const markers = pts.map((p, i) => {
    const label = i + 1 <= 9 ? `label:${i + 1}%7C` : "";
    return `markers=color:0xf0a583%7C${label}${p.latitude},${p.longitude}`;
  }).join("&");
  return `${API_BASE}/api/static-map?size=${size}&scale=2&maptype=roadmap&${markers}&style=feature:poi%7Cvisibility:off&style=feature:transit%7Cvisibility:off`;
}
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { avatarSrc } from "@/lib/avatar";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import FullCalendarPicker from "@/components/plan-wizard/FullCalendarPicker";
import { resolveStored } from "@/components/PlacePhoto";
import type { MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { CategoryIcon } from "@/components/CategoryIcon";

export default function SharedRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useTranslation("sharing");
  const categoryLabel = (cat: string) => t(`categories.${cat}`, { defaultValue: t("categories.other") });
  const { isSaved } = useSavedPlaces();
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
  const pinToSave = (pin: any): SavePlaceInput => ({
    place_name: pin.place_name, category: pin.category ?? null, address: pin.address ?? null,
    description: pin.description ?? null, latitude: pin.latitude ?? null, longitude: pin.longitude ?? null,
    photo_url: pin.photo_url ?? null, place_id: pin.place_id ?? null,
  });
  const [planView, setPlanView] = useState<"list" | "cards">("list");
  const [planTab, setPlanTab] = useState<"miejsca" | "galeria" | "mapa">("miejsca");
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDateSheet, setShowDateSheet] = useState(false);
  const [planMapOpen, setPlanMapOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null); // fullscreen podglad zdjecia galerii

  // Otworz miejsce w Google Maps (WIZYTOWKA / place page, NIE nawigacja). query_place_id gdy
  // pin.place_id to Google Place ID (nie nasze DB uuid) - trafiamy w dokladne miejsce.
  const openGooglePlace = (pin: any) => {
    if (!pin) return;
    const q = encodeURIComponent([pin.place_name, pin.address, route?.city].filter(Boolean).join(", "));
    const pid = typeof pin.place_id === "string" && pin.place_id.trim() ? pin.place_id.trim() : "";
    const isDbUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pid);
    const placeIdParam = pid && !isDbUuid ? `&query_place_id=${encodeURIComponent(pid)}` : "";
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`, "_blank", "noopener,noreferrer");
  };

  const { data: route, isLoading: routeLoading } = useQuery({
    queryKey: ["shared-route", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routes")
        .select("id, title, city, user_id, day_number, start_date, ai_summary, ai_highlight, review_photos, review_narrative, group_session_id")
        .eq("id", id as string)
        .eq("is_shared", true)
        .single();
      if (error) return null;
      return data as any;
    },
    enabled: !!id,
  });

  // Autor trasy - do logiki "lokals poleca!" (home_city autora == miasto trasy).
  const { data: author } = useQuery({
    queryKey: ["shared-route-author", route?.user_id],
    enabled: !!route?.user_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("username, first_name, avatar_url, home_city")
        .eq("id", route!.user_id)
        .maybeSingle();
      return data as any;
    },
  });

  // Uczestnicy trasy grupowej (awatary obok hosta) - bez hosta.
  const { data: groupParticipants = [] } = useQuery({
    queryKey: ["shared-route-participants", (route as any)?.group_session_id, route?.user_id],
    enabled: !!(route as any)?.group_session_id,
    queryFn: async () => {
      const { data: members } = await (supabase as any)
        .from("group_session_members").select("user_id").eq("session_id", (route as any).group_session_id);
      const ids = (members ?? []).map((m: any) => m.user_id).filter((id: string) => id !== route!.user_id);
      if (!ids.length) return [] as (string | null)[];
      const { data: profs } = await (supabase as any).from("profiles").select("id, avatar_url").in("id", ids);
      return (profs ?? []).map((p: any) => (p.avatar_url ?? null)) as (string | null)[];
    },
  });

  // Podpis autora + oznaczeni czlonkowie (#11). Best-effort (kolumny z migracji
  // 20260705) - gdy jeszcze nie zaaplikowana, po prostu brak wartosci.
  const { data: shareMeta } = useQuery({
    queryKey: ["shared-route-meta", id],
    enabled: !!id,
    queryFn: async () => {
      try {
        const { data, error } = await (supabase as any)
          .from("routes").select("share_caption, tagged_members, share_anonymous").eq("id", id as string).maybeSingle();
        if (error) return null;
        return data as { share_caption: string | null; tagged_members: string[] | null; share_anonymous: boolean | null } | null;
      } catch {
        return null;
      }
    },
  });

  // Inkrementacja licznika wyswietlen (nagroda dla autora). Dedup per-urzadzenie
  // (localStorage), zeby refresh/powroty nie zawyzaly "X osob obejrzalo".
  useEffect(() => {
    if (!route?.id) return;
    try {
      const key = "trasa_viewed_routes";
      const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (seen.includes(route.id)) return;
      localStorage.setItem(key, JSON.stringify([...seen, route.id].slice(-200)));
    } catch { /* brak localStorage - i tak inkrementuj raz na mount */ }
    void (supabase as any).rpc("increment_route_views", { route_id: route.id });
  }, [route?.id]);

  // Zapisz cudza trase do swojego dziennika (kopia pinow). Domyka petle
  // discovery -> moja sesja (re-discovery). Wymaga konta.
  const saveToMine = async (tripDate?: Date) => {
    if (!user) { navigate("/auth"); return; }
    if (!route || !pins.length || saving) return;
    setSaving(true);
    setShowDateSheet(false);
    const dateStr = tripDate ? format(tripDate, "yyyy-MM-dd") : null;
    try {
      const { data: newRoute, error } = await (supabase as any)
        .from("routes")
        .insert({
          user_id: user.id,
          title: route.title || route.city,
          city: route.city,
          status: "draft",
          trip_type: "planning",
          day_number: 1,
          start_date: dateStr,
          end_date: dateStr,
          is_shared: false,
          new_for_users: [user.id],
        })
        .select("id")
        .single();
      if (error || !newRoute) throw error;
      await (supabase as any).from("pins").insert(
        pins.map((p: any, idx: number) => ({
          route_id: newRoute.id,
          place_name: p.place_name,
          address: p.address ?? null,
          description: p.description ?? null,
          category: p.category ?? "other",
          latitude: p.latitude ?? null,
          longitude: p.longitude ?? null,
          place_id: p.place_id ?? null,
          photo_url: p.photo_url ?? null,
          suggested_time: p.suggested_time ?? null,
          pin_order: idx,
          original_creator_id: user.id,
        }))
      );
      notify.success(t("toast_saved"));
      // Powiadom autora oryginalnej trasy, ze ktos jej uzyl (best-effort; SECURITY DEFINER RPC -
      // klient nie moze insertowac notyfikacji dla innego usera). Push leci triggerem notify_push.
      if (route.user_id && route.user_id !== user.id) {
        // Zapisz "wykorzystanie" oryginalnej trasy (feeduje statystyki autora: my_route_stats
        // liczy saved_routes -> "osób wykorzystało Twoje trasy" + "Zapisania"). PK(user_id, route_id)
        // -> upsert idempotentny, ponowne uzycie tej samej trasy nie duplikuje.
        void (supabase as any)
          .from("saved_routes")
          .upsert({ user_id: user.id, route_id: id }, { onConflict: "user_id,route_id", ignoreDuplicates: true });
        void (supabase as any).rpc("notify_route_used", { p_route_id: id });
        // Push Z KLIENTA (trigger DB dostaje z send-push 401). Odbiorca = autor oryginalnej trasy.
        const me = await getCurrentUserName();
        void sendClientPush({ userId: route.user_id, title: t("push_used_title"), body: route.city ? t("push_used_body_city", { name: me, city: route.city }) : t("push_used_body", { name: me }), url: "/dziennik" });
      }
      navigate(`/review-summary?route=${newRoute.id}`);
    } catch (e: any) {
      console.error("[SharedRoute] save failed:", e?.message ?? e);
      notify.error(t("toast_save_error"));
    }
    setSaving(false);
  };

  const { data: pins = [] } = useQuery({
    queryKey: ["shared-route-pins", id],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("pins")
        .select("id, place_name, address, category, suggested_time, images, image_url, user_photo_urls, photo_url, place_id, latitude, longitude, pin_order, description")
        .eq("route_id", id!)
        .order("pin_order");
      return (data ?? []) as any[];
    },
    enabled: !!id,
  });

  // #okladki: zdjecia userow dodane do miejsc tej trasy (place_photos) - do okladek miejsc bez
  // wlasnego zdjecia. Klucze inline (male tablice); queryKey stabilny per zestaw pinow+miasto.
  const routePinKeys = Array.from(new Set((pins as any[]).flatMap((p) => pinCoverKeys(p, route?.city ?? null)))).filter(Boolean);
  const { data: placePhotoCoverMap } = useQuery({
    queryKey: ["shared-route-place-photos", routePinKeys.join("|")],
    enabled: routePinKeys.length > 0,
    queryFn: () => fetchPlacePhotosForKeys(routePinKeys),
  });

  // Notki autora trasy (pin_ratings SELECT jest publiczny).
  const { data: authorNotes = [] } = useQuery({
    queryKey: ["shared-route-notes", id, route?.user_id],
    queryFn: async () => {
      if (!route?.user_id) return [];
      const { data } = await (supabase as any)
        .from("pin_ratings")
        .select("place_name, note")
        .eq("route_id", id!)
        .eq("user_id", route.user_id);
      return (data ?? []) as any[];
    },
    enabled: !!id && !!route?.user_id,
  });

  const noteMap: Record<string, { note: string | null }> = {};
  for (const r of authorNotes) noteMap[r.place_name] = { note: r.note };

  // Opis + tagi z tabeli places (wizytowka miejsca). Piny nie maja vibe_tags.
  const { data: placeMeta = {} } = useQuery({
    queryKey: ["shared-place-meta", route?.city, id],
    queryFn: async () => {
      const names = [...new Set((pins as any[]).map((p) => p.place_name).filter(Boolean))];
      if (!names.length || !route?.city) return {};
      const { data } = await (supabase as any)
        .from("places")
        .select("place_name, description, vibe_tags")
        .ilike("city", `${route.city}%`)
        .in("place_name", names);
      const map: Record<string, { description: string | null; tags: string[] }> = {};
      for (const pl of data ?? []) {
        map[String(pl.place_name).toLowerCase()] = {
          description: pl.description ?? null,
          tags: Array.isArray(pl.vibe_tags) ? pl.vibe_tags.filter(Boolean) : [],
        };
      }
      return map;
    },
    enabled: pins.length > 0 && !!route?.city,
  });
  const metaFor = (pin: any) => (placeMeta as Record<string, any>)[String(pin?.place_name ?? "").toLowerCase()] ?? { description: null, tags: [] };

  if (routeLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <div className="text-muted-foreground text-sm animate-pulse">{t("loading")}</div>
      </div>
    );
  }

  if (!route) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        <p className="text-4xl">🗺️</p>
        <p className="text-lg font-bold">{t("route_unavailable_title")}</p>
        <p className="text-sm text-muted-foreground">{t("route_unavailable_desc")}</p>
        <button onClick={() => navigate("/")} className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">
          {t("back_to_trasa")}
        </button>
      </div>
    );
  }

  // Okladki miejsc ze zdjec dodanych przez userow w wizytowkach (place_photos) - gdy pin nie ma
  // wlasnego zdjecia. Spojnie z widokiem trasy/listy: place_photos to zdjecia miejsca (Storage).
  const routeCity = route.city ?? null;
  const pinHasOwnPhoto = (p: any) =>
    !!(p.image_url || (Array.isArray(p.images) && p.images[0]) || (Array.isArray(p.user_photo_urls) && p.user_photo_urls[0]) || p.photo_url);
  const coverFor = (p: any): string | null => {
    if (pinHasOwnPhoto(p)) return null; // PlacePhoto sam wybierze wlasne zdjecie pinu
    if (!placePhotoCoverMap) return null;
    const urls = pinCoverKeys(p, routeCity).map((k) => placePhotoCoverMap.get(k)).find((u) => u && u.length);
    return urls && urls.length ? urls[0] : null;
  };

  // Hero: okladka autora (review_photos[0]) -> zdjecie pierwszego miejsca z trasy (wlasne LUB
  // place_photo) -> ilustracja placeholder.
  const userCover = (route.review_photos ?? []).find((u: any) => typeof u === "string" && u.trim() !== "") ?? null;
  const placeCover = resolveStored(pins[0]?.photo_url || pins[0]?.image_url) ?? (pins[0] ? coverFor(pins[0]) : null);
  // Piny do mapy (ujednolicone z widokiem Trasy - RouteMap oczekuje latitude/longitude/place_name).
  const navMapPins = (pins as any[])
    .filter((p) => p.latitude != null && p.longitude != null)
    .map((p) => ({ latitude: p.latitude as number, longitude: p.longitude as number, place_name: p.place_name as string }));
  const staticMapUrl = buildStaticRouteMap(navMapPins);
  const cover = userCover ?? placeCover;
  const hasRealPhoto = !!cover;
  const heroPhoto = cover ?? getRandomPinPlaceholder(route.id);
  // Opis trasy (pod tytulem) = podsumowanie AI albo podpis autora.
  // Opis trasy: preferuj reczny opis autora (review_narrative), potem AI/podpis udostepnienia.
  const routeDescription: string = (route as any).review_narrative || route.ai_summary || shareMeta?.share_caption || "";
  // Galeria = wszystkie zdjecia wyjazdu autora (review_photos), z rozwiazanym URL-em.
  const galleryPhotos: string[] = ((route.review_photos ?? []) as any[])
    .map((u) => (typeof u === "string" ? resolveStored(u) : null))
    .filter((u): u is string => !!u);
  const dateLabel = route.start_date ? format(new Date(route.start_date), "d MMMM yyyy", { locale: dateLocale() }) : "";
  const cityLabel = route.city || t("trip_default");
  // Tryb anonimowy: autor ukryty (bez profilu/awatara/lokalsa).
  const isAnon = shareMeta?.share_anonymous === true;
  // "lokals poleca!" - autor pochodzi z miasta tej trasy.
  const authorName = isAnon ? t("author_anon") : (author?.first_name || author?.username || t("author_default"));
  const isLocal = !isAnon && !!author?.home_city && !!route.city &&
    author.home_city.trim().toLowerCase() === route.city.trim().toLowerCase();

  const openDetail = (pin: any) => setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (pin.category || "other") as any,
    city: route.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: 0,
    photo_url: resolveStored(pin.photo_url || pin.image_url || (Array.isArray(pin.images) ? pin.images[0] : null)) ?? "",
    vibe_tags: metaFor(pin).tags,
    // Zrodlo prawdy = opis miejsca z bazy (places.description, jak w swiperze).
    // pin.description (generowany AI per-trasa) tylko jako fallback dla custom pinow.
    description: metaFor(pin).description || pin.description || "",
  } satisfies MockPlace);

  // Read-only notka autora pod miejscem.
  const renderRatingNote = (placeName: string, centered = false) => {
    const r = noteMap[placeName];
    if (!r || !r.note) return null;
    return (
      <div className={`mt-3 pt-3 border-t border-border/40 ${centered ? "text-center" : ""}`}>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">{t("author_note")}</p>
        <p className="text-sm text-foreground/80 leading-relaxed text-left whitespace-pre-wrap">{r.note}</p>
      </div>
    );
  };

  // Plaska lista miejsc (wg Figmy: bez grupowania po kategorii) - wspoldzielony RoutePlaceRow
  // (duze zdjecie 104px, chip kategorii + guzik Google). Notka autora pod wierszem gdy jest.
  const renderList = () => (
    <div className="space-y-2.5">
      {pins.map((pin: any, i: number) => {
        const noteText = (noteMap[pin.place_name]?.note ?? "").trim();
        const note = noteText ? (
          <div>
            <p className="text-sm font-semibold text-foreground">Notka Autora</p>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap mt-0.5">{noteText}</p>
          </div>
        ) : undefined;
        return (
          <RoutePlaceRow
            key={pin.id}
            pin={coverFor(pin) ? { ...pin, photo_url: coverFor(pin) } : pin}
            index={i}
            categoryLabel={categoryLabel(pin.category || "other")}
            onOpen={() => openDetail(pin)}
            onGoogle={() => openGooglePlace(pin)}
            onSave={user ? () => setSavePlace(pinToSave(pin)) : undefined}
            saved={isSaved(pin.place_name)}
            note={note}
          />
        );
      })}
    </div>
  );

  const renderSwiper = () => (
    <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-5 px-5 pb-2">
      {pins.map((pin: any, i: number) => (
        <div key={pin.id} className="snap-center shrink-0 w-[80vw] max-w-[320px] rounded-2xl bg-secondary border border-border/40 overflow-hidden shadow-sm flex flex-col">
          <button onClick={() => openDetail(pin)} className="block w-full text-left active:opacity-90 transition-opacity">
            <div className="relative w-full aspect-[4/3] bg-muted">
              <PlacePhoto pin={coverFor(pin) ? { ...pin, photo_url: coverFor(pin) } : pin} className="w-full h-full object-cover" />
              <div className="absolute top-3 left-3 h-8 w-8 rounded-full bg-black/55 backdrop-blur text-white text-sm font-bold flex items-center justify-center">{i + 1}</div>
            </div>
            <div className="px-4 pt-4">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted text-xs font-semibold text-foreground mb-2">
                <CategoryIcon category={pin.category} className="h-3.5 w-3.5 shrink-0" />{categoryLabel(pin.category)}
              </span>
              <p className="text-base font-black leading-tight">{pin.place_name}</p>
              {(() => {
                const m = metaFor(pin);
                const desc = pin.description || m.description;
                return (
                  <>
                    {desc && <p className="text-sm text-muted-foreground leading-relaxed mt-2 line-clamp-3">{desc}</p>}
                    {m.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {m.tags.slice(0, 3).map((t: string) => (
                          <span key={t} className="text-[10px] text-muted-foreground bg-white px-2 py-0.5 rounded-full">{t}</span>
                        ))}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </button>
          <div className="px-4 pb-4 pt-1">{renderRatingNote(pin.place_name, true)}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">

      {/* Hero - nizsza okladka (zdjecie nie jest kluczowe w polecajce trasy) */}
      <div className="relative w-full aspect-[16/10] flex-shrink-0 overflow-hidden bg-gradient-to-br from-orange-400 via-rose-400 to-purple-500">
        <img src={heroPhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
        <div className={`absolute inset-0 bg-gradient-to-b ${hasRealPhoto ? "from-black/40 via-transparent to-black/75" : "from-black/35 via-black/25 to-black/80"}`} />

        <div className="absolute left-0 right-0 flex items-center px-4"
          style={{ top: "max(16px, env(safe-area-inset-top, 16px))" }}>
          <button onClick={() => { if (window.history.length > 1) navigate(-1); else navigate("/eksploruj"); }}
            className="h-10 w-10 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          {isLocal && (
            <span className="ml-3 text-xs font-bold text-white bg-black/45 backdrop-blur-sm rounded-full pl-1 pr-3 py-1 flex items-center gap-1.5">
              <img src={avatarSrc(author?.avatar_url)} alt="" className="h-5 w-5 rounded-full object-cover bg-orange-100" />
              {t("local_recommends")} · {authorName}
            </span>
          )}
        </div>

      </div>

      {/* Content - ujednolicony z widokiem "Plan wyjazdu" (zakladka Trasy) */}
      <div className="flex-1 overflow-y-auto pb-44">

        {/* Naglowek: badge + tytul + data + opis */}
        <div className="px-5 pt-5">
          {/* Autor trasy (awatar + @username) + miasto + liczba miejsc - zamiast badge "Plan wyjazdu". */}
          <div className="flex items-center gap-2.5 flex-wrap text-sm">
            {!isAnon && author?.username ? (
              <button
                onClick={() => navigate(`/profil/${author.username}`)}
                className="flex items-center gap-1.5 font-semibold text-foreground active:opacity-60 transition-opacity"
              >
                <img src={avatarSrc(author?.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />
                @{author.username}
              </button>
            ) : (
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                {!isAnon && <img src={avatarSrc(author?.avatar_url)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100" />}
                {authorName}
              </span>
            )}
            {/* Uczestnicy trasy grupowej - nachodzacy stack awatarow obok hosta. */}
            {groupParticipants.length > 0 && (
              <span className="flex items-center -space-x-2">
                {groupParticipants.slice(0, 3).map((a, i) => (
                  <img key={i} src={avatarSrc(a)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 ring-2 ring-background" />
                ))}
                {groupParticipants.length > 3 && (
                  <span className="h-6 w-6 rounded-full bg-muted ring-2 ring-background flex items-center justify-center text-[9px] font-bold text-foreground">+{groupParticipants.length - 3}</span>
                )}
              </span>
            )}
            {cityLabel && <span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-4 w-4" />{cityLabel}</span>}
            <span className="flex items-center gap-1 text-muted-foreground"><MapPin className="h-4 w-4" />{pins.length} {pins.length === 1 ? "miejsce" : pins.length < 5 ? "miejsca" : "miejsc"}</span>
          </div>
          <h1 className="text-2xl font-black text-foreground leading-tight mt-3">{route.title || cityLabel}</h1>
          {dateLabel && (
            <div className="flex items-center gap-1.5 mt-2.5 text-foreground">
              <CalendarIcon className="h-5 w-5 shrink-0" />
              <span className="text-base">{dateLabel}</span>
            </div>
          )}
          {route.ai_highlight && (
            <p className="text-[17px] font-bold leading-snug text-foreground mt-3">„{route.ai_highlight}"</p>
          )}
          {routeDescription && (
            <p className="text-sm text-muted-foreground leading-relaxed mt-3">{routeDescription}</p>
          )}
          {(shareMeta?.tagged_members?.length ?? 0) > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mt-3">
              <span className="text-xs text-muted-foreground">{t("with_prefix")}</span>
              {shareMeta!.tagged_members!.map((m) => (
                <span key={m} className="inline-flex items-center rounded-full bg-secondary text-secondary-foreground px-2.5 py-1 text-xs font-semibold">{m}</span>
              ))}
            </div>
          )}
        </div>

        {/* Miejsca | Galeria | Mapa */}
        <div className="px-5 pt-6">
          <div className="flex rounded-full bg-muted p-0.5 text-sm font-bold">
            <button onClick={() => setPlanTab("miejsca")} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "miejsca" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Miejsca</button>
            <button onClick={() => setPlanTab("galeria")} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "galeria" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Galeria</button>
            <button onClick={() => setPlanTab("mapa")} className={`flex-1 py-2 rounded-full transition-colors ${planTab === "mapa" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}>Mapa</button>
          </div>
        </div>

        {planTab === "miejsca" ? (
          <div className="px-5 pt-4">
            {pins.length > 0 && (
              <>
                <div className="flex items-center justify-end pb-3">
                  <div className="flex rounded-full bg-muted p-0.5">
                    <button onClick={() => setPlanView("list")} aria-label={t("view_list")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "list" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><List className="h-4 w-4" /></button>
                    <button onClick={() => setPlanView("cards")} aria-label={t("view_cards")} className={`px-2.5 py-1.5 rounded-full transition-colors ${planView === "cards" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground"}`}><GalleryHorizontalEnd className="h-4 w-4" /></button>
                  </div>
                </div>
                {planView === "list" ? renderList() : renderSwiper()}
              </>
            )}
          </div>
        ) : planTab === "mapa" ? (
          /* Mapa w wlasnej zakladce (obok Galeria) - statyczna Google + rozwiniecie do interaktywnej. */
          <div className="px-5 pt-4">
            {navMapPins.length > 0 && staticMapUrl ? (
              <button onClick={() => setPlanMapOpen(true)} className="relative block w-full h-64 rounded-2xl overflow-hidden border border-border/40 bg-muted active:opacity-95 transition-opacity">
                <img src={staticMapUrl} alt={t("route_map")} className="w-full h-full object-cover" />
                <span className="absolute bottom-3 right-3 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center">
                  <Maximize2 className="h-[18px] w-[18px] text-foreground" strokeWidth={2.2} />
                </span>
              </button>
            ) : (
              <p className="text-center text-sm text-muted-foreground py-10">Brak lokalizacji miejsc na mapie.</p>
            )}
          </div>
        ) : (
          <div className="px-5 pt-4">
            {galleryPhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {galleryPhotos.map((url, i) => (
                  <button key={i} onClick={() => setViewerIndex(i)} className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-muted active:opacity-90 transition-opacity">
                    <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-14 text-center gap-2">
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">{t("gallery_empty", { defaultValue: "Brak zdjęć w tej trasie" })}</p>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Podglad wizytowki miejsca */}
      <PlaceSwiperDetail
        open={!!detailPin}
        onOpenChange={(o) => !o && setDetailPin(null)}
        place={detailPin}
        city={route.city}
        onLike={user && detailPin ? () => setSavePlace(pinToSave(detailPin)) : undefined}
      />

      {/* Zapis miejsca do listy (odwiedzone / do odwiedzenia) - bookmark przy wierszu miejsca */}
      <SavePlaceSheet
        open={!!savePlace}
        onOpenChange={(o) => { if (!o) setSavePlace(null); }}
        place={savePlace}
        city={route.city ?? ""}
      />

      {/* Rozwinięta interaktywna mapa (zoom) - jak w widoku "Plan wyjazdu" */}
      {planMapOpen && (
        <div className="fixed inset-0 z-[90] bg-background flex flex-col animate-in fade-in duration-200">
          <div className="relative flex-1 min-h-0">
            <RouteMap pins={navMapPins as any} className="w-full h-full" showRoute={false} />
            <button onClick={() => setPlanMapOpen(false)} aria-label={t("close", { defaultValue: "Zamknij" })} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-card shadow-md flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
              <X className="h-5 w-5 text-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Fullscreen podglad zdjecia galerii (object-contain, strzalki + licznik). */}
      {viewerIndex !== null && galleryPhotos[viewerIndex] && (
        <div className="fixed inset-0 z-[95] bg-black flex items-center justify-center animate-in fade-in duration-200" onClick={() => setViewerIndex(null)}>
          <img src={galleryPhotos[viewerIndex]} alt="" className="max-w-full max-h-full object-contain" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setViewerIndex(null)} aria-label={t("close", { defaultValue: "Zamknij" })} className="absolute right-3 z-10 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform" style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
            <X className="h-5 w-5 text-white" />
          </button>
          {galleryPhotos.length > 1 && (
            <>
              <button onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex - 1 + galleryPhotos.length) % galleryPhotos.length); }} aria-label="Poprzednie" className="absolute left-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
                <ChevronLeft className="h-6 w-6 text-white" />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setViewerIndex((viewerIndex + 1) % galleryPhotos.length); }} aria-label="Następne" className="absolute right-2 top-1/2 -translate-y-1/2 h-11 w-11 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform">
                <ChevronRight className="h-6 w-6 text-white" />
              </button>
              <span className="absolute bottom-[max(24px,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-white/85 text-sm font-medium">{viewerIndex + 1} / {galleryPhotos.length}</span>
            </>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-3 bg-background/90 backdrop-blur-md border-t border-border/30"
        style={{ paddingBottom: "max(20px, env(safe-area-inset-bottom, 20px))" }}>
        <button
          onClick={() => { if (!user) { navigate("/auth"); return; } setShowDateSheet(true); }}
          disabled={saving}
          className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/25 disabled:opacity-50"
        >
          <Bookmark className="h-4 w-4" />{saving ? t("saving") : "Zapisz tą trasę"}
        </button>
        <button
          onClick={() => navigate(`/plan?city=${encodeURIComponent(cityLabel)}`)}
          className="w-full mt-2 py-2 text-sm font-medium text-muted-foreground active:text-foreground transition-colors"
        >
          {t("plan_own_route", { city: cityLabel })}
        </button>
      </div>

      {/* Sheet wyboru daty wyjazdu przy zapisie cudzej trasy do dziennika */}
      {showDateSheet && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowDateSheet(false)}
        >
          <div
            className="w-full max-w-md bg-card rounded-t-3xl flex flex-col max-h-[88dvh] shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 pt-5 pb-1 text-center shrink-0">
              <p className="text-lg font-black leading-tight">{t("date_sheet_title")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("date_sheet_desc")}</p>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto">
              <FullCalendarPicker onConfirm={(d) => saveToMine(d)} />
            </div>
            <button
              onClick={() => saveToMine()}
              disabled={saving}
              className="mx-5 mt-1 mb-[max(16px,env(safe-area-inset-bottom))] py-2.5 text-sm font-medium text-muted-foreground active:text-foreground transition-colors shrink-0 disabled:opacity-50"
            >
              {t("save_without_date")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
