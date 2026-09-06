import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import { goBackOr } from "@/hooks/useGoBack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useScreenshot } from "@/hooks/useScreenshot";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MapPin, ArrowLeft, Bookmark, Building2, Trash2, Share2, Plus, Camera, Loader2, X } from "lucide-react";
import { compressImage } from "@/lib/imageCompression";
import AddPlaceSheet from "@/components/route/AddPlaceSheet";
import { addPlaceToList, type PlaceForList } from "@/lib/placeLists";
import { useShare } from "@/hooks/useShare";
import { useUnsavePlace } from "@/hooks/useUnsavePlace";
import { buildShareUrl } from "@/lib/shareUrl";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { PlacePhoto, resolveStored } from "@/components/PlacePhoto";
import StoredImage from "@/components/StoredImage";
import { RoutePlaceRow } from "@/components/route/RoutePlaceRow";
import PlaceNoteEditor from "@/components/route/PlaceNoteEditor";
import ReportContentSheet from "@/components/moderation/ReportContentSheet";
import ScreenSkeleton from "@/components/layout/ScreenSkeleton";
import PhotoViewer from "@/components/route/PhotoViewer";
import { saveCollectionDb, unsaveCollectionDb, markCollectionSeenDb } from "@/lib/savedCollections";
import { EmptyPlacesState } from "@/components/route/EmptyPlacesState";
import { getRandomPinPlaceholder } from "@/lib/pinPlaceholders";
import { avatarSrc } from "@/lib/avatar";
import PlaceSwiperDetail from "@/components/plan-wizard/PlaceSwiperDetail";
import SavePlaceSheet, { type SavePlaceInput } from "@/components/plan-wizard/SavePlaceSheet";
import { placeKeyOf, fetchPlacePhotosForKeys, pickPlaceCover, linkPhotoToPlace, unlinkPhotoFromPlace, detachPlacePhotos, restorePlacePhotos } from "@/lib/placePhotoSocial";
import { useSavedPlaces } from "@/hooks/useSavedPlaces";
import { CategoryIcon } from "@/components/CategoryIcon";
import { subcategoryLabelLocalized } from "@/lib/categories";
import { ShareCardList } from "@/components/share/ShareCard";
import { resolvePlaceDbId } from "@/lib/placeLists";
import { fetchEnrichedPlace } from "@/components/plan-wizard/PlaceSwiper";
import { inferCategoryFromName } from "@/lib/placeCategoryIcon";
import { uploadThumb } from "@/lib/imageThumbs";

// Widok LISTY miejsc (polecajki) - UI/UX 1:1 z widokiem trasy (SharedRoute), ale zasilany z
// discovery_collections/discovery_items. Lista NIE jest trasa (brak kolejnosci-planu), ale
// prezentacyjnie ma wygladac tak samo. RLS: publiczny odczyt wymaga approved; wlasciciel widzi
// swoja tez pending.
export default function SharedList() {
  const { t } = useTranslation("routelist");
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { isSaved } = useSavedPlaces();
  const unsave = useUnsavePlace();

  // Widok listy jak trasa: Miejsca | Galeria (BEZ mapy - decyzja Nat). Galeria = zdjecia miejsc z listy.
  // Zakladka Galeria USUNIETA (decyzja Nat 2026-09-01) - lista to zbior MIEJSC, a osobna siatka
  // zdjec dublowala to, co widac przy kazdym wierszu. Zostaje jeden widok.
  const [detailPin, setDetailPin] = useState<any | null>(null);
  const [detailRaw, setDetailRaw] = useState<any | null>(null);
  // Podglad zdjec dodanych do miejsca na liscie (klik w miniaturke).
  const [photoViewer, setPhotoViewer] = useState<{ urls: string[]; idx: number } | null>(null);
  // Zapis pojedynczego miejsca z listy (bookmark per-miejsce -> SavePlaceSheet). Zapis CAŁEJ listy
  // (przycisk na dole) to osobna akcja (localStorage trasa_saved_collections) - oba zostają.
  const [savePlace, setSavePlace] = useState<SavePlaceInput | null>(null);
  const [saved, setSaved] = useState<boolean>(() => {
    try { return new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]")).has(id ?? ""); } catch { return false; }
  });
  // Usuniecie listy (wlasciciel) - nieodwracalne, walidacja "czy na pewno?".
  const [askDelete, setAskDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addPlaceOpen, setAddPlaceOpen] = useState(false);
  const share = useShare();
  // Notki + zdjecia usera na miejscach listy (prosba Nat 2026-08-26). Wlasciciel edytuje
  // discovery_items.short_desc (notka, AUTO-ZAPIS przez PlaceNoteEditor) i images (route-images).
  const [uploadingItem, setUploadingItem] = useState<string | null>(null);
  // Pisanie notki chowa dolny pasek - guzik t("cta.add_place") zaslanial pole i klawiature
  // (zgloszenie Nat 2026-08-31). Ten sam wzorzec co w widoku wyjazdu (SharedRoute).
  const [noteEditing, setNoteEditing] = useState(false);
  // UWAGA: ten stan (jak KAZDY hook w tym pliku) musi byc PRZED `if (isLoading) return ...`.
  // Postawiony nizej dawal React error #310 - przy pierwszym renderze hookow bylo mniej niz przy
  // kolejnym i lista przestawala sie otwierac (zgloszenie Nat 2026-09-01).
  const [shareCardOpen, setShareCardOpen] = useState(false);
  // Zrzut ekranu = intencja "chce to pokazac". Zamiast szukac guzika, user dostaje gotowy
  // kadr od razu po zrzucie (logika jak na Pintereście). iOS nie pozwala podmienic juz
  // zrobionego zdjecia, wiec karta pojawia sie PO nim i user robi drugi zrzut - z karta.
  useScreenshot(() => setShareCardOpen(true), !shareCardOpen);

  const saveItemNote = async (item: any, value: string) => {
    const { error } = await (supabase as any).from("discovery_items").update({ short_desc: value || null }).eq("id", item.id);
    if (error) { toast.error(t("toast.note_failed")); return; }
    queryClient.invalidateQueries({ queryKey: ["shared-list-items", id] });
  };

  const addItemPhotos = async (item: any, files: FileList | null) => {
    if (!user || !files || !files.length) return;
    setUploadingItem(item.id);
    try {
      const urls: string[] = [...(Array.isArray(item.images) ? item.images : [])];
      for (const file of Array.from(files)) {
        const compressed = await compressImage(file, 1200, 1200, 0.8);
        const path = `${user.id}/list_${id}/item_${item.id}_${Math.random().toString(36).slice(2)}.jpg`;
        const { error } = await supabase.storage.from("route-images").upload(path, compressed, { contentType: "image/jpeg", upsert: false });
        await uploadThumb("route-images", path, compressed);
        if (error) { console.error("[SharedList] photo upload:", error.message); continue; }
        const { data } = supabase.storage.from("route-images").getPublicUrl(path);
        if (data?.publicUrl) urls.push(data.publicUrl);
      }
      const { error: upErr } = await (supabase as any).from("discovery_items").update({ images: urls }).eq("id", item.id);
      if (upErr) { toast.error(t("toast.photo_add_failed")); return; }
      // Zdjecie zyje tez w galerii MIEJSCA (place_photos) - inaczej widac je tylko na tej liscie,
      // a wizytowka miejsca i okladki w innych widokach o nim nie wiedza (zgloszenie Nat 2026-08-28).
      const placeKey = placeKeyOf({ googlePlaceId: item.google_place_id ?? null, placeName: item.place_name });
      const added = urls.filter((u) => !(Array.isArray(item.images) ? item.images : []).includes(u));
      await Promise.all(added.map((photoUrl) => linkPhotoToPlace({
        userId: user.id, placeKey, placeName: item.place_name, city: item.city ?? col?.city ?? null, photoUrl,
      })));
      queryClient.invalidateQueries({ queryKey: ["shared-list-items", id] });
    } finally { setUploadingItem(null); }
  };

  const removeItemPhoto = async (item: any, url: string) => {
    const urls = (Array.isArray(item.images) ? item.images : []).filter((u: string) => u !== url);
    const { error } = await (supabase as any).from("discovery_items").update({ images: urls }).eq("id", item.id);
    if (error) { toast.error(t("toast.photo_delete_failed")); return; }
    // Zdejmij tez z galerii miejsca (tylko wlasny wiersz - cudze zdjecia miejsca zostaja).
    if (user) {
      await unlinkPhotoFromPlace({
        userId: user.id, placeKey: placeKeyOf({ googlePlaceId: item.google_place_id ?? null, placeName: item.place_name }), photoUrl: url,
      });
    }
    queryClient.invalidateQueries({ queryKey: ["shared-list-items", id] });
  };

  const handleDelete = async () => {
    if (!user || !id) return;
    setDeleting(true);
    try {
      await (supabase as any).from("discovery_items").delete().eq("collection_id", id);
      const { error } = await (supabase as any).from("discovery_collections").delete().eq("id", id).eq("user_id", user.id);
      if (error) throw new Error(error.message);
      // Odswiez listy w drawerze zapisu + na profilu (inaczej usunieta lista wisi w cache).
      queryClient.invalidateQueries({ queryKey: ["save-sheet-lists", user.id] });
      queryClient.invalidateQueries({ queryKey: ["profile-list-feed", user.id] });
      toast.success(t("toast.list_deleted"));
      setAskDelete(false);
      goBackOr(navigate, "/moj-profil");
    } catch (e: any) {
      toast.error(t("toast.list_delete_failed"));
      console.error("[SharedList] delete failed:", e?.message ?? e);
      setDeleting(false);
    }
  };

  const { data: col, isLoading } = useQuery({
    queryKey: ["shared-list", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("discovery_collections")
        .select("id, title, city, description, user_id, author_name, author_avatar, cover_url, tags, is_public, list_status")
        .eq("id", id as string)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: items = [] } = useQuery({
    queryKey: ["shared-list-items", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("discovery_items")
        .select("id, place_id, place_name, category, address, city, latitude, longitude, rating, google_place_id, photo_url, short_desc, images, added_by, tags, order_index")
        .eq("collection_id", id as string)
        .order("order_index", { ascending: true });
      return (data ?? []) as any[];
    },
  });

  // #2/#3: zdjecia userow dodane do miejsc tej listy w wizytowkach (place_photos). Sluza jako
  // okladki miejsc (gdy discovery_items nie ma photo_url) ORAZ zasilaja Galerie listy.
  // Dwa klucze na miejsce (gpid: oraz nc:nazwa|miasto) - wizytowka zapisuje pod jednym z nich.
  const listCity = (col as any)?.city ?? null;
  const itemCoverKeys = (p: any): string[] => {
    const nc = placeKeyOf({ googlePlaceId: null, placeName: p.place_name, city: listCity });
    const gp = p.google_place_id ? placeKeyOf({ googlePlaceId: p.google_place_id, placeName: p.place_name, city: listCity }) : null;
    return gp ? [gp, nc] : [nc];
  };
  const listItemKeys = Array.from(new Set((items as any[]).flatMap(itemCoverKeys))).filter(Boolean);
  const { data: placePhotoMap } = useQuery({
    queryKey: ["shared-list-place-photos", listItemKeys.join("|")],
    enabled: listItemKeys.length > 0,
    queryFn: () => fetchPlacePhotosForKeys(listItemKeys),
  });

  // Autor listy (link do profilu + awatar). author_name/avatar sa denormalizowane na kolekcji,
  // ale username (do /profil/:username) dociagamy z profiles.
  const { data: author } = useQuery({
    queryKey: ["shared-list-author", col?.user_id],
    enabled: !!col?.user_id,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles").select("username, first_name, avatar_url").eq("id", col!.user_id).maybeSingle();
      return data as any;
    },
  });

  // Licznik wyswietlen (dedup per-urzadzenie, jak SharedRoute).
  useEffect(() => {
    if (!col?.id) return;
    try {
      const key = "trasa_viewed_collections";
      const seen: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      if (seen.includes(col.id)) return;
      localStorage.setItem(key, JSON.stringify([...seen, col.id].slice(-200)));
    } catch { /* brak localStorage */ }
    void (supabase as any).rpc("increment_collection_views", { p_collection_id: col.id });
  }, [col?.id]);

  // Ile miejsc widzialem przy poprzedniej wizycie. Czytamy RAZ (staleTime: Infinity) i trzymamy,
  // bo zaraz potem efekt ponizej podbija seen_item_count - bez zamrozenia tej wartosci separator
  // "Nowe od Twojej ostatniej wizyty" zniknalby w tej samej sekundzie, w ktorej sie pojawil.
  const { data: seenAtEntry } = useQuery({
    queryKey: ["list-seen-at-entry", id, user?.id],
    enabled: !!id && !!user?.id,
    staleTime: Infinity,
    gcTime: Infinity,
    refetchOnMount: false,
    queryFn: async () => {
      const { data } = await (supabase as any).from("saved_collections")
        .select("seen_item_count").eq("user_id", user!.id).eq("collection_id", id!).maybeSingle();
      return data ? (data.seen_item_count ?? 0) : null;   // null = lista nie jest zapisana
    },
  });

  // Zapisujacy (nie autor) obejrzal liste -> "widzial" wszystkie aktualne miejsca (kasuje chip
  // "Nowe miejsce!" na profilu). markCollectionSeenDb aktualizuje TYLKO jesli lista zapisana (no-op inaczej).
  useEffect(() => {
    if (!user || !id || !col || col.user_id === user.id) return;
    void markCollectionSeenDb(user.id, id, items.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, id, col?.user_id, items.length]);

  const categoryLabel = (cat: string | null) => (cat ? subcategoryLabelLocalized(cat) : "Miejsce");
  // Kategoria: zapisana -> wywnioskowana z nazwy (miejsca z Google bywaja bez kategorii,
  // inaczej ikona=Landmark, chip="Miejsce").
  const catOf = (pin: any): string | null => pin.category ?? inferCategoryFromName(pin.place_name);

  const openGoogle = (pin: any) => {
    const q = encodeURIComponent([pin.place_name, pin.address, col?.city].filter(Boolean).join(", "));
    const pid = typeof pin.google_place_id === "string" && pin.google_place_id.trim() ? pin.google_place_id.trim() : "";
    const placeIdParam = pid ? `&query_place_id=${encodeURIComponent(pid)}` : "";
    window.open(`https://www.google.com/maps/search/?api=1&query=${q}${placeIdParam}`, "_blank", "noopener,noreferrer");
  };

  // Raw pozycja listy dla wizytowki (zapis miejsca potrzebuje place_id/google_place_id,
  // ktorych MockPlace nie niesie).
  // Jak w widoku wyjazdu: karta otwiera sie natychmiast z danych wiersza, a gdy miejsce wskazuje
  // na nasz rekord `places`, podmieniamy ja na PELNA wizytowke (z profilem biznesowym lokalu).
  const upgradeDetail = async (pin: any) => {
    const dbId = typeof pin.place_id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pin.place_id)
      ? pin.place_id
      : await resolvePlaceDbId(pin.google_place_id, pin.place_name, col?.city);
    if (!dbId) return;
    const full = await fetchEnrichedPlace(dbId);
    if (full) setDetailPin((cur) => (cur && cur.place_name === pin.place_name ? full : cur));
  };

  const openDetail = (pin: any) => { void upgradeDetail(pin); setDetailRaw(pin); setDetailPin({
    id: pin.place_id || pin.id || pin.place_name,
    place_name: pin.place_name,
    category: (catOf(pin) || "other") as any,
    city: col?.city ?? "",
    address: pin.address || "",
    latitude: pin.latitude ?? 0,
    longitude: pin.longitude ?? 0,
    rating: pin.rating ?? 0,
    photo_url: resolveStored(pin.photo_url) ?? "",
    // Notka autora listy NIE jest opisem miejsca - ma wlasna sekcje "Od użytkowników".
    description: "",
  }); };

  // Zapisz liste (bookmark) - localStorage, 1:1 z toggleSaveCollection (feed/Zapisane).
  const toggleSave = () => {
    if (!id) return;
    try {
      const set = new Set<string>(JSON.parse(localStorage.getItem("trasa_saved_collections") || "[]"));
      const dates: Record<string, string> = (() => { try { return JSON.parse(localStorage.getItem("trasa_saved_collections_dates") || "{}"); } catch { return {}; } })();
      if (set.has(id)) { set.delete(id); delete dates[id]; setSaved(false); toast(t("toast.removed_saved")); if (user) void unsaveCollectionDb(user.id, id); }
      else { set.add(id); dates[id] = new Date().toISOString(); setSaved(true); toast.success(t("toast.list_saved")); void (supabase as any).rpc("notify_collection_saved", { p_collection_id: id }); if (user) void saveCollectionDb(user.id, id, items.length); }
      localStorage.setItem("trasa_saved_collections", JSON.stringify([...set]));
      localStorage.setItem("trasa_saved_collections_dates", JSON.stringify(dates));
    } catch { /* localStorage niedostepny */ }
  };

  // Otwórz sheet zapisu pojedynczego miejsca do listy usera (bookmark per-miejsce).
  // Zapisujemy CZYSTĄ kartę - notka autora listy NIE jedzie do mojego zapisu (to była notka
  // innego usera; swoją dodaję sam). Od 2026-08-28 pilnuje tego sam typ PlaceForList
  // (nie ma juz pola na notke) - patrz lib/placeLists.ts.
  const itemToPlace = (pin: any) => ({
    place_name: pin.place_name,
    category: catOf(pin),
    address: pin.address ?? null,
    city: pin.city ?? col?.city ?? null,
    latitude: pin.latitude ?? null,
    longitude: pin.longitude ?? null,
    photo_url: pin.photo_url ?? null,
    place_id: pin.place_id ?? null,
  });
  const openSavePlace = (pin: any) => setSavePlace(itemToPlace(pin));
  // Tap bookmarka: zapisane -> odzapisz (toast+cofnij); niezapisane -> otworz drawer zapisu.
  const toggleSaveBookmark = (pin: any) => { if (isSaved(pin.place_name)) void unsave(itemToPlace(pin) as any); else openSavePlace(pin); };

  if (isLoading) return <ScreenSkeleton variant="list" />;
  if (!col) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-6 text-center gap-4">
        {/* Brandowa ikona zamiast emoji (regula z CLAUDE.md). */}
        <span aria-hidden className="h-20 w-20 block" style={{ backgroundColor: "#ef9d78", WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskPosition: "center", maskPosition: "center" }} />
        <p className="text-lg font-bold">{t("missing.title")}</p>
        <p className="text-sm text-muted-foreground">{t("missing.desc")}</p>
        <button onClick={() => navigate("/eksploruj")} className="mt-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-semibold">{t("missing.back")}</button>
      </div>
    );
  }

  // Hero = recznie wybrana okladka listy (cover_url); fallback do zdjecia pierwszego miejsca.
  const cover = resolveStored(col.cover_url) ?? resolveStored(items.find((i: any) => i.photo_url)?.photo_url) ?? null;
  const hasRealPhoto = !!cover;
  const heroPhoto = cover ?? getRandomPinPlaceholder(col.id);
  const cityLabel = col.city || "";
  const authorName = author?.first_name || author?.username || col.author_name || t("someone");
  const isOwner = !!user && col.user_id === user.id;
  const placesCountLabel = t("places_count", { count: items.length });


  // Guzik "Udostepnij" pokazuje KARTE do zrzutu ekranu (szablon listy). Wysylka linku zostaje
  // pod dlugim przytrzymaniem - ekran z kanalami i eksportem obrazu to osobny temat.
  const handleShare = () => setShareCardOpen(true);
  const handleShareLink = () => { void share({ title: col.title || cityLabel || "Lista", url: buildShareUrl(`/lista/${col.id}`) }); };

  // Wlasciciel dodaje miejsca do listy (drawer jak w wyjazdach): batch insert do discovery_items.
  const handleAddPlacesToList = async (places: PlaceForList[]) => {
    // Miasto: wlasne miasto miejsca, a gdy nieznane - miasto listy.
    for (const p of places) await addPlaceToList(col.id, { ...p, city: p.city ?? col.city ?? null });
    queryClient.invalidateQueries({ queryKey: ["shared-list-items", id] });
    toast.success(t("toast.list_updated"));
    // Autor dodal miejsca -> powiadom (in-app) wszystkich, ktorzy zapisali te liste ("Nowe miejsce!").
    if (isOwner && places.length) void (supabase as any).rpc("notify_collection_updated", { p_collection_id: col.id, p_added: places.length });
  };

  // Usun miejsce z listy (wlasciciel, kosz w wierszu). Toast + "Cofnij".
  const handleDeleteItem = async (item: any) => {
    const { error } = await (supabase as any).from("discovery_items").delete().eq("id", item.id);
    if (error) { toast.error(t("toast.place_delete_failed")); return; }
    // Zdjecia dodane do TEGO miejsca znikaja razem z nim takze z galerii miejsca (place_photos) -
    // zgloszenie Nat 2026-09-01. Kasujemy wylacznie te konkretne adresy, wiec zdjecia tego samego
    // lokalu dodane w innej liscie albo w wyjezdzie zostaja.
    const gone = await detachPlacePhotos(itemCoverKeys(item), [
      ...((item.images ?? []) as string[]),
      ...(typeof item.photo_url === "string" ? [item.photo_url] : []),
    ]);
    queryClient.invalidateQueries({ queryKey: ["shared-list-items", id] });
    queryClient.invalidateQueries({ queryKey: ["place-photos"] });
    const { id: _id, ...rest } = item;
    toast.success(t("toast.place_deleted"), {
      action: { label: "Cofnij", onClick: async () => {
        await (supabase as any).from("discovery_items").insert({ ...rest });
        await restorePlacePhotos(gone);
        queryClient.invalidateQueries({ queryKey: ["shared-list-items", id] });
        queryClient.invalidateQueries({ queryKey: ["place-photos"] });
      } },
    });
  };

  // #2: okladka miejsca = zapisane zdjecie (discovery_items.photo_url) LUB zdjecie usera dodane
  // w wizytowce (place_photos). Gdy pin nie ma photo_url, bierzemy pierwsze place_photo.
  const pinCover = (p: any): string | null => {
    const own = resolveStored(p.photo_url) ?? p.photo_url;
    if (typeof own === "string" && (own.startsWith("http") || own.startsWith("/"))) return own;
    return pickPlaceCover(placePhotoMap, itemCoverKeys(p));
  };

  // #3: Galeria listy = okladki miejsc + WSZYSTKIE zdjecia userow dodane do tych miejsc (place_photos).
  // Kazde zdjecie zmapowane na miejsce (tap -> wizytowka). Dedup po URL.
  // NOWE OD OSTATNIEJ WIZYTY (wariant D z Figmy, sekcja "Zapisana lista: ktos dodal nowe miejsce").
  // Ile: aktualna liczba miejsc minus stan z poprzedniej wizyty. Ktore: ostatnie pozycje wg
  // order_index (dodawanie dopisuje na koniec). Nowe ladują NAD separatorem, zeby po wejsciu
  // z powiadomienia nie trzeba bylo ich szukac w liscie kilkunastu miejsc.
  const newCount = seenAtEntry == null ? 0 : Math.max(0, (items as any[]).length - seenAtEntry);
  const newItems = newCount ? (items as any[]).slice(-newCount) : [];
  const oldItems = newCount ? (items as any[]).slice(0, (items as any[]).length - newCount) : (items as any[]);

  const sectionHeader = (label: string, strong: boolean) => (
    <div className="pt-4 pb-2 flex items-center gap-2">
      <p className={`text-[12.5px] ${strong ? "font-bold text-primary" : "font-semibold text-muted-foreground"}`}>{label}</p>
      <div className={`flex-1 h-px ${strong ? "bg-[#F4C9AE]" : "bg-border/60"}`} />
    </div>
  );

  const renderList = () => (
    <div>
      {newCount > 0 && (
        <>
          {sectionHeader(t("new_since_visit", { count: newCount }), true)}
          <div className="-mx-5 px-5 bg-[#FFF8F3] rounded-2xl">
            {renderRows(newItems, 0, true)}
          </div>
        </>
      )}
      {renderRows(oldItems, newCount, false)}
    </div>
  );

  const renderRows = (rows: any[], offset: number, isNew: boolean) => (
    <div>
      {rows.map((pin: any, idx: number) => {
        const i = offset + idx;
        const noteText = (pin.short_desc ?? "").trim();
        const photos: string[] = Array.isArray(pin.images) ? pin.images : [];
        const busy = uploadingItem === pin.id;
        // Notka (auto-zapis, bez headera) + zdjecia miejsca. Widz: read-only. Slot renderowany
        // tylko gdy jest tresc lub jestem wlascicielem. Uklad wspolny z wyjazdami (PlaceNoteEditor).
        const hasContent = !!noteText || photos.length > 0 || isOwner;
        const photoSlot = isOwner ? (
          <label className={`inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-xs font-bold text-foreground cursor-pointer active:scale-95 transition-transform ${busy ? "opacity-60 pointer-events-none" : ""}`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
            {busy ? "Dodawanie..." : t("photo")}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addItemPhotos(pin, e.target.files); e.currentTarget.value = ""; }} />
          </label>
        ) : null;
        const note = hasContent ? (
          <div className="space-y-2.5 mt-0.5">
            {/* Notka wyglada TAK SAMO jak na wyjezdzie: szary dymek + awatar autora w prawym-dolnym
                rogu (prosba Nat 2026-08-30). Autor = wlasciciel listy. */}
            <PlaceNoteEditor note={noteText} editable={isOwner} showAvatar avatarUrl={author?.avatar_url ?? col.author_avatar}
              onSave={(v) => saveItemNote(pin, v)} photoSlot={photoSlot} onEditingChange={setNoteEditing} />
            {/* Zdjecia miejsca (2:3) - dodane przez wlasciciela listy. */}
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {photos.map((url) => (
                  <div key={url} className="relative w-[76px] aspect-[2/3] shrink-0 rounded-xl overflow-hidden bg-muted">
                    {/* Klik w zdjecie = pelnoekranowy podglad. */}
                    {/* Kafelek 76 px -> miniatura; podglad pelnoekranowy bierze oryginal. */}
                    <StoredImage
                      url={url} size={76} role="button"
                      onClick={() => setPhotoViewer({ urls: photos.map((u: string) => resolveStored(u) ?? u), idx: photos.indexOf(url) })}
                      className="w-full h-full object-cover active:opacity-90 transition-opacity"
                    />
                    {isOwner && <button onClick={() => removeItemPhoto(pin, url)} aria-label={t("aria.delete_photo")} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/55 text-white flex items-center justify-center active:scale-90"><X className="h-3 w-3" /></button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : undefined;
        return (
          <RoutePlaceRow
            key={pin.id}
            pin={{ ...pin, category: catOf(pin), photo_url: pinCover(pin) }}
            index={i}
            categoryLabel={categoryLabel(catOf(pin))}
            onOpen={() => openDetail(pin)}
            onGoogle={() => openGoogle(pin)}
            onSave={!isOwner ? () => toggleSaveBookmark(pin) : undefined}
            saved={isSaved(pin.place_name)}
            onDelete={isOwner ? () => handleDeleteItem(pin) : undefined}
            note={isNew ? (
              <div className="space-y-2">
                {/* Awatar autora listy + samo "nowe miejsce" (decyzja Nat 2026-09-01). Imie bylo
                    zbedne - awatar juz mowi, kto dodal, a liczy sie sama informacja o nowosci. */}
                <div className="flex items-center gap-2">
                  <img src={avatarSrc(col?.author_avatar ?? null)} alt="" className="h-5 w-5 rounded-full object-cover bg-orange-100" />
                  <span className="text-[11.5px] font-semibold text-[#8A6A57]">{t("new_place_badge")}</span>
                </div>
                {note}
              </div>
            ) : note}
          />
        );
      })}
    </div>
  );

  // Galeria zdjec miejsc z listy (kafelki 4:3, 2 kolumny). Tap -> wizytowka miejsca.
  return (
    <div className="h-[100dvh] bg-background flex flex-col max-w-lg mx-auto">
      {/* Staly TopBar (naglowek nad obszarem scrolla): wstecz + autor + miasto + liczba miejsc + serce */}
      <div className="shrink-0 bg-background px-5 pb-2.5 border-b border-border/40" style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}>
        <div className="flex items-center gap-2 text-sm">
            <button onClick={() => goBackOr(navigate, "/eksploruj")} aria-label={t("back")}
              className="h-9 w-9 -ml-2 shrink-0 rounded-full flex items-center justify-center active:scale-90 transition-transform">
              <ArrowLeft className="h-5 w-5 text-foreground" />
            </button>
            {/* Awatar + username WYSRODKOWANE (#5 - przeniesione ze skraju). Miasto/liczba miejsc -> pod tytul. */}
            <div className="flex-1 min-w-0 flex justify-center">
              {author?.username ? (
                <button onClick={() => navigate(`/profil/${author.username}`)} className="flex items-center gap-1.5 font-semibold text-foreground active:opacity-60 transition-opacity min-w-0">
                  <img src={avatarSrc(author?.avatar_url ?? col.author_avatar)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 shrink-0" />
                  <span className="truncate">@{author.username}</span>
                </button>
              ) : (
                <span className="flex items-center gap-1.5 font-semibold text-foreground min-w-0">
                  <img src={avatarSrc(col.author_avatar ?? null)} alt="" className="h-6 w-6 rounded-full object-cover bg-orange-100 shrink-0" />
                  <span className="truncate">{authorName}</span>
                </span>
              )}
            </div>
            {/* Polubien list NIE MA (decyzja Nat 2026-09-01) - zostaje sam zapis listy, ktory
                niesie realna intencje i buduje powiadomienia o nowych miejscach. */}
          </div>
      </div>

      {/* Obszar scrolla - #3: BEZ okladki tla listy (spojne z widokiem trasy). */}
      <div className="flex-1 min-h-0 overflow-y-auto pb-44">
        {/* Naglowek: tytul + opis, spacing 35px pod TopBarem */}
        <div className="px-5 pt-[35px]">
          <div className="flex items-start gap-3">
            <h1 className="flex-1 text-2xl font-black text-foreground leading-tight">{col.title || cityLabel}</h1>
            {/* a) Ikony jak na wyjazdach: udostepnij / usun. Olowek usuniety (prosba Nat 2026-09-01,
                tak samo jak wczesniej na wyjezdzie) - ten widok JEST edycja: miejsca, notki i
                zdjecia zmienia sie na miejscu, wiec osobne wejscie w stepper mnozylo sciezki.
                UDOSTEPNIANIE WIDZI KAZDY, takze na cudzej liscie (prosba Nat 2026-09-01) - polecenie
                dalej cudzej listy to sedno tego widoku, a link i tak jest publiczny. Edycja i
                usuwanie zostaja przy wlascicielu. */}
            <div className="shrink-0 flex items-center gap-2">
              <button onClick={handleShare} onContextMenu={(e) => { e.preventDefault(); handleShareLink(); }} aria-label={t("aria.share")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Share2 className="h-4 w-4 text-foreground" /></button>
              {isOwner && (
                <>
                  <button onClick={() => setAskDelete(true)} aria-label={t("aria.delete_list")} className="h-9 w-9 rounded-full bg-secondary flex items-center justify-center active:scale-90 transition-transform"><Trash2 className="h-4 w-4 text-destructive" /></button>
                </>
              )}
            </div>
          </div>
          {/* #5: miasto + liczba miejsc bezposrednio pod tytulem (przeniesione z TopBara). */}
          <div className="flex items-center gap-4 mt-2.5 text-sm text-muted-foreground">
            {cityLabel && <span className="flex items-center gap-1.5"><Building2 className="h-4 w-4 shrink-0" />{cityLabel}</span>}
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 shrink-0" />{placesCountLabel}</span>
          </div>
          {col.description && <p className="text-sm text-muted-foreground leading-relaxed mt-3">{col.description}</p>}
        </div>

        {/* Jeden widok: miejsca. Zakladka Galeria usunieta (decyzja Nat 2026-09-01). */}
        <div>
          <div className="px-5 pt-4">
            {items.length > 0 ? (
              /* Jeden widok miejsc (lista) - przelacznik "karty" usuniety 2026-08-29. */
              renderList()
            ) : (
              <EmptyPlacesState
                title={t("empty.title")}
                hint={isOwner ? t("empty.desc_owner") : t("empty.desc_visitor")}
              />
            )}
          </div>
        {shareCardOpen && (
        <ShareCardList
          title={col.title || t("fallback_title")}
          city={col.city}
          items={(items as any[]).map((it) => ({ ...it, photo_url: pinCover(it) ?? it.photo_url }))}
          author={col.author_name ? `@${col.author_name}` : "spontaway"}
          avatar={col.author_avatar ?? null}
          onClose={() => setShareCardOpen(false)}
          onShare={handleShareLink}
          shareUrl={buildShareUrl(`/lista/${col.id}`)}
        />
      )}

      {/* Zgloszenie tresci - wymog App Store (Guideline 1.2). Autor nie zglasza siebie. */}
        {!isOwner && (
          <div className="px-5 pt-6 pb-2 flex justify-center">
            <ReportContentSheet targetType="collection" targetId={col.id} />
          </div>
        )}
        </div>
      </div>

      {/* Wizytowka miejsca z listy - z guzikiem zapisu (bookmark na hero + CTA na dole). */}
      {photoViewer && (
        <PhotoViewer urls={photoViewer.urls} startIndex={photoViewer.idx} onClose={() => setPhotoViewer(null)} />
      )}
      <PlaceSwiperDetail
        open={!!detailPin} onOpenChange={(o) => !o && setDetailPin(null)} place={detailPin} city={col.city}
        onLike={user && detailRaw ? () => setSavePlace(itemToPlace(detailRaw) as SavePlaceInput) : undefined}
        saved={detailPin ? isSaved(detailPin.place_name) : false}
      />

      {/* CTA - zapis CAŁEJ listy (driver engagementu). TYLKO cudza lista - nie zapisujesz wlasnej (#4).
          Zapis pojedynczych miejsc = bookmark przy każdym miejscu (SavePlaceSheet). */}
      {/* b) Dolny CTA: wlasciciel = t("cta.add_place") (drawer jak w wyjazdach); gosc = zapisz liste. */}
      {!noteEditing && (
      <div className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto px-5 pt-2 bg-background border-t border-border/30" style={{ paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))" }}>
        {isOwner ? (
          <button onClick={() => setAddPlaceOpen(true)} className="w-full py-3 rounded-full border border-border bg-background text-foreground font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform">
            <Plus className="h-4 w-4" />{t("cta.add_place")}</button>
        ) : (
          <button onClick={toggleSave} className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-lg shadow-primary/25">
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />{saved ? t("toast.list_saved") : t("cta.save_list")}
          </button>
        )}
      </div>
      )}

      {isOwner && (
        <AddPlaceSheet
          open={addPlaceOpen}
          onClose={() => setAddPlaceOpen(false)}
          city={col.city ?? null}
          existingPlaces={items.map((it: any) => ({
            place_name: it.place_name, category: it.category ?? null, address: it.address ?? null,
            city: it.city ?? col.city ?? null,
            latitude: it.latitude ?? null, longitude: it.longitude ?? null, photo_url: it.photo_url ?? null, place_id: it.place_id ?? null,
            google_place_id: it.google_place_id ?? null, rating: it.rating ?? null,
          }))}
          onAdd={handleAddPlacesToList}
        />
      )}

      <SavePlaceSheet open={!!savePlace} onOpenChange={(o) => !o && setSavePlace(null)} place={savePlace} city={col.city ?? ""} />

      {/* Potwierdzenie usuniecia listy - nieodwracalne. */}
      <AlertDialog open={askDelete} onOpenChange={(o) => { if (!o && !deleting) setAskDelete(false); }}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirm.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirm.delete_desc", { title: col.title })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Anuluj</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void handleDelete(); }} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? "Usuwanie…" : t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
