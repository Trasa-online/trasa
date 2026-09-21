import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Maximize2, X } from "lucide-react";
import { toast } from "sonner";
import { avatarSrc } from "@/lib/avatar";
import { UserAvatar } from "@/components/profile/FramedAvatar";
import { resolveStored } from "@/components/PlacePhoto";
import { thumbUrl } from "@/lib/imageUrl";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { subcategoryLabelLocalized } from "@/lib/categories";
import TrasaBigCard from "@/components/home/TrasaBigCard";
import { ListTile, LIST_TILES, type GridItem, type GridPlace } from "@/components/home/FeedTiles";
import { listTheme } from "@/lib/listThemes";
import { buildShareTargets, ShareTargetButton, type ImageChannel } from "@/components/share/shareTargets";
import { renderShareImage, deliverShareImage, shareImageFilename } from "@/lib/shareImage";
import { isNative } from "@/lib/platform";
import PlaceStickerSheet from "@/components/share/PlaceStickerSheet";
import { stickerHandle, overlayPng, type StickerVariant } from "@/lib/placeSticker";
import StoriesSheet, { storiesHintDismissed } from "@/components/share/StoriesSheet";
import { canShareToStories, shareToInstagramStories, storyBackgroundFromPhoto, copyLinkToClipboard } from "@/lib/instagramStories";
import { track } from "@/lib/analytics";
import { SwipeCard, type MockPlace } from "@/components/plan-wizard/PlaceSwiper";
import { rowOwnPhotos } from "@/lib/placeUserPhotos";

// UDOSTEPNIANIE LISTY / WYJAZDU - arkusz z podgladem i kanalami (wzor: Pinterest, prosba Nat
// 2026-09-01). Otwiera sie z guzika udostepniania ORAZ automatycznie po zrzucie ekranu.
//
// Uklad ma trzy warstwy, kazda po cos innego:
//  1. PODGLAD - pomniejszona, wierna kopia karty. Pokazuje, co dokladnie pojdzie dalej.
//  2. KANALY - skroty do aplikacji, w ktorych ludzie faktycznie wysylaja linki.
//  3. PELNY EKRAN - dotkniecie podgladu rozwija karte na caly ekran, do zrzutu na Stories.
//
// DWA SZABLONY, nie jeden (eksploracja w Figmie, sekcja "Udostępnianie: lista vs wyjazd").
// Lista i wyjazd sprzedaja sie czym INNYM, wiec kazdy dowodzi czego innego:
//  - LISTA to zbior: liczy sie ILOSC i kuracja -> siatka kafelkow z licznikiem "+N",
//  - WYJAZD to historia: licza sie TRASA i ludzie -> okladka, ponumerowane przystanki, awatary.
// Jeden uniwersalny szablon obslugiwalby oba gorzej.
//
// Kanaly niosa LINK (otwiera te sama kolekcje/plan w aplikacji). Od 2026-09-21 doszla druga
// droga - karta jako OBRAZ (Instagram, „Pobierz PNG / JPG" pod Pinteresta i Stories): DOM
// podgladu renderuje `src/lib/shareImage.ts` (modern-screenshot), a plik idzie w systemowy
// arkusz z plikiem. Wczesniej celowo tego nie bylo (brak biblioteki i CORS-u na zdjeciach z
// Google) - dzis zdjecia sa wylacznie z naszego Storage, wiec oba warunki odpadly.

// Stopka karty: kto to zrobil + znak marki. Wspolna dla obu szablonow, zeby karta
// zawsze konczyla sie tak samo i dalo sie ja rozpoznac po jednym elemencie.
function Footer({ avatars, label, sub, tone }: {
  avatars: (string | null)[]; label: string; sub?: string; tone: "light" | "peach";
}) {
  return (
    <div
      className={`absolute left-5 right-5 h-[74px] rounded-2xl flex items-center gap-3 px-4 ${tone === "light" ? "bg-white" : "bg-[#FCEDE3]"}`}
      style={{ bottom: "max(24px, calc(env(safe-area-inset-bottom) + 12px))" }}
    >
      <div className="flex -space-x-2 shrink-0">
        {avatars.slice(0, 3).map((a, i) => (
          <img key={i} src={avatarSrc(a)} alt="" className="h-8 w-8 rounded-full object-cover bg-orange-100 ring-2 ring-white" />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-bold text-foreground truncate">{label}</p>
        {sub && <p className="text-[11px] text-muted-foreground truncate">{sub}</p>}
      </div>
      <span aria-hidden className="block h-6 w-6 shrink-0" style={{
        backgroundColor: "#F75708",
        WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
        WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
        WebkitMaskSize: "contain", maskSize: "contain",
        WebkitMaskPosition: "center", maskPosition: "center",
      }} />
    </div>
  );
}

// Arkusz: naglowek + podglad + kanaly. Karta (children) jest zaprojektowana na CALY ekran, wiec
// w podgladzie skalujemy ja transformem - dzieki temu miniatura jest co do piksela tym samym, co
// user zobaczy po rozwinieciu, bez drugiego zestawu rozmiarow do utrzymania.
type StripItem = { name: string; photo?: string | null; icon: string; category?: string | null };

/** Autor udostepnianej tresci - awatar z ramka w belce arkusza, po prawej od "udostępnij". */
type SheetAuthor = { userId?: string | null; avatar?: string | null; frame?: string | null; color?: string | null };

function ShareSheet({ children, kind, onClose, onShare, shareUrl, shareTitle, stripDays, stripMore, plainPreview, linkHeading, author, onSticker, storyPhoto, storySticker }: {
  children: React.ReactNode;
  /** Co udostepniamy - do analityki i nazwy pliku obrazu. */
  kind: "route" | "list" | "place";
  /** Miejsce: otwiera panel nakladki na Stories (kafelek „Nakladka" w rzedzie kanalow). */
  onSticker?: () => void;
  /** Instagram Stories na wprost (2026-09-21): zdjecie na TLO relacji (miejsce = jego okladka)... */
  storyPhoto?: string | null;
  /** ...i NAKLADKA na wierzch (miejsce = gwiazdki + pigulka z handle, zestaw wybrany w panelu).
   *  Bez tego naklejka = karta z podgladu. */
  storySticker?: { handle: string; render: (variant: StickerVariant) => Promise<Blob> };
  author?: SheetAuthor | null;
  onClose: () => void;
  onShare?: () => void;
  shareUrl?: string;
  shareTitle: string;
  /** Miejsca pod podgladem (tylko wyjazd) w JEDNYM przewijanym rzedzie, po dniach: naglowek
   *  dnia jest PRZYKLEJONY u gory (sticky w poziomie) - "Dzien 1" stoi, dopoki przewijaja sie
   *  jego miejsca, przy ostatnim zostaje wypchniety, a od pierwszego miejsca dnia 2 stoi
   *  "Dzien 2" (prosba Nat 2026-09-14). Na koncu kafelek "jeszcze N w aplikacji". */
  stripDays?: { label: string; items: StripItem[] }[];
  stripMore?: string | null;
  /** Naglowek nad kanalami. Domyslnie o wyjezdzie - lista podaje swoj. */
  linkHeading?: string;
  /** Podglad renderowany 1:1 (karta z eksploracji), a nie jako pomniejszony plakat 9:16. */
  plainPreview?: boolean;
}) {
  const { t } = useTranslation("sharing");
  const slotRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const [full, setFull] = useState(false);
  const [rendering, setRendering] = useState(false);

  // INSTAGRAM STORIES NA WPROST (prosba Nat 2026-09-21): kafelek „Instagram" otwiera edytor
  // relacji z NAKLADKA juz nalozona (miejsce: gwiazdki + pigulka @handle na zdjeciu miejsca;
  // plan / kolekcja: karta z podgladu na gradiencie marki), a LINK do tresci laduje w schowku -
  // w Stories user tapa naklejke „Link" i wkleja. Instagram nie przyjmuje linku z obrazem, wiec
  // to jedyna droga do klikalnego linku (patrz instagramStories.ts). Przed przelaczeniem stoi
  // panel (StoriesSheet): miejsce wybiera zestaw nakladki, a instruktaz „dodaj naklejke Link"
  // ma „Nie pokazuj wiecej" - po schowaniu plan / kolekcja ida do Instagrama od razu.
  // Bez App ID / bez Instagrama / na webie -> `false` i dotychczasowa droga (plik w arkuszu).
  const [panel, setPanel] = useState<((variant: StickerVariant | null) => void) | null>(null);
  const shareToStories = async (node: HTMLElement): Promise<boolean> => {
    if (!(await canShareToStories())) return false;
    let variant: StickerVariant = "full";
    if (storySticker || !storiesHintDismissed()) {
      const picked = await new Promise<StickerVariant | null>((resolve) => setPanel(() => resolve));
      setPanel(null);
      if (!picked) return true; // user odpuscil - nie otwieramy nic innego
      variant = picked;
    }
    setRendering(true);
    const toastId = toast.loading(t("share.image_preparing"));
    try {
      const [sticker, background] = await Promise.all([
        storySticker ? storySticker.render(variant) : renderShareImage(node, "png", { background: "transparent", padding: 0 }),
        storyPhoto ? storyBackgroundFromPhoto(storyPhoto) : Promise.resolve(null),
      ]);
      toast.dismiss(toastId);
      const res = await shareToInstagramStories({ sticker, background, link: shareUrl });
      if (res === "opened") {
        track("content_shared_image", { kind, channel: "instagram_stories", format: "stories" });
        if (shareUrl) toast(t("share.stories_link_hint"), { duration: 6000 });
        return true;
      }
      if (res === "unavailable") return false;
      toast.error(t("share.image_failed"));
      return true;
    } catch (e) {
      console.warn("[ShareSheet] stories:", (e as any)?.message ?? e);
      toast.dismiss(toastId);
      return false;
    } finally {
      setRendering(false);
    }
  };

  // Karta -> obraz -> Instagram / plik. Renderujemy DOKLADNIE ten DOM, ktory user widzi
  // w podgladzie (`exportRef`), na zoltym tle marki - PNG i JPG dostaja ten sam kadr.
  // Instagram = JPG (mniejszy plik, Stories i tak kompresuja), pobranie = wybrany format.
  const shareAsImage = async (channel: ImageChannel) => {
    const node = exportRef.current;
    if (!node || rendering) return;
    // Link do schowka OD RAZU, w gescie (WKWebView odrzuca `clipboard.writeText` po pierwszym
    // `await` - tak zginal link przy Instagramie, zgloszenie Nat 2026-09-21); natywka kopiuje
    // przez plugin, bez ograniczen gestu. Stories na wprost dokladaja link do wpisu ze
    // naklejka i przywracaja go po otwarciu Instagrama.
    if (channel === "instagram" && shareUrl) void copyLinkToClipboard(shareUrl);
    if (channel === "instagram" && (await shareToStories(node))) return;
    setRendering(true);
    const toastId = toast.loading(t("share.image_preparing"));
    try {
      const format = channel === "png" ? "png" : "jpeg";
      const blob = await renderShareImage(node, format);
      toast.dismiss(toastId);
      // Podpowiedz PRZED systemowym arkuszem - on wjezdza na wierzch i zostaje otwarty dluzej,
      // niz zyje toast; po zamknieciu nie byloby juz czego czytac.
      if (isNative) toast(channel === "instagram" ? t("share.image_hint_instagram") : t("share.image_hint_save"), { duration: 6000 });
      const res = await deliverShareImage(blob, shareImageFilename(shareTitle, format), { title: shareTitle, kind, channel });
      if (res === "failed") toast.error(t("share.image_failed"));
      else if (res === "downloaded") toast.success(t("share.image_downloaded"));
    } catch (e) {
      console.warn("[ShareSheet] image:", (e as any)?.message ?? e);
      toast.dismiss(toastId);
      toast.error(t("share.image_failed"));
    } finally {
      setRendering(false);
    }
  };

  useLayoutEffect(() => {
    const measure = () => {
      const el = slotRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setScale(Math.min(r.width / window.innerWidth, r.height / window.innerHeight));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  // Pelny ekran = sama karta, bez zadnego chrome poza krzyzykiem. To jest kadr do zrzutu.
  // data-vaul-no-drag / data-no-drag: arkusz udostepniania renderuje sie WEWNATRZ wizytowki
  // (drawer vaul) albo arkusza zapisu (Sheet z gestem w dol). Bez tych atrybutow przeciagniecie
  // w dol po zoltym arkuszu zamykalo GOSPODARZA razem z nim (zgloszenie Nat 2026-09-13: po
  // udostepnieniu nie dalo sie otworzyc kolejnej wizytowki - stary arkusz wracal w nowej).
  if (full) {
    return (
      <div data-vaul-no-drag data-no-drag className="fixed inset-0 z-[96] animate-in fade-in duration-200">
        {children}
        <button onClick={() => setFull(false)} aria-label={t("common:buttons.close")}
          className="absolute right-3 h-9 w-9 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
          <X className="h-4 w-4 text-white" />
        </button>
      </div>
    );
  }

  const targets = shareUrl
    ? buildShareTargets({
        url: shareUrl,
        title: shareTitle,
        onSystemShare: () => onShare?.(),
        onCopied: () => toast.success(t("share.link_copied")),
        onImage: plainPreview ? shareAsImage : undefined,
        onSticker,
      })
    : [];

  return (
    <>
    {panel && <StoriesSheet handle={storySticker?.handle} photo={storyPhoto} onGo={(v) => panel(v)} onSkip={() => panel(null)} />}
    {/* Zolte tlo + naglowek Sigmar wg makiety Nat (Figma "[NEW] Ekrany" -> "Udostępnianie
        wyjazdów oraz list" -> "Akcja: Udostępnij - Wyjazdy", 2026-09-08). Ekran ma wygladac jak
        czesc marki, a nie jak systemowy arkusz - to on ma zachecac do wyslania. */}
    <div data-vaul-no-drag data-no-drag className="fixed inset-0 z-[95] bg-spontaway-yellow flex flex-col animate-in fade-in duration-200 overflow-y-auto">
      <div className="shrink-0 flex items-center gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-1">
        <button onClick={onClose} aria-label={t("common:buttons.close")}
          className="h-9 w-9 rounded-full flex items-center justify-center active:scale-90 transition-transform">
          <X className="h-5 w-5 text-spontaway-brown" />
        </button>
        <p className="flex-1 text-center font-brand text-[26px] leading-none text-spontaway-orange">{t("share.share")}</p>
        {/* Awatar autora z jego nakladka po prawej od naglowka (prosba Nat 2026-09-11) - ta sama
            szerokosc co krzyzyk po lewej, wiec naglowek zostaje na srodku. Bez autora (miejsce)
            zostaje pusty odstep. */}
        <span className="flex h-9 w-9 shrink-0 items-center justify-center">
          {author && (
            <UserAvatar userId={author.userId} src={author.avatar} frame={author.frame} color={author.color} size={32} imgClassName="ring-2 ring-white" />
          )}
        </span>
      </div>

      <div ref={slotRef} className="flex-1 min-h-[280px] flex items-center justify-center px-6 py-3">
        {/* Podglad to TA SAMA karta, co w eksploracji (prosba Nat 2026-09-08) - user ma zobaczyc
            dokladnie to, co zobaczy odbiorca, a nie osobny plakat. Dlatego renderujemy ja
            w naturalnym rozmiarze, bez pomniejszania calego ekranu. */}
        {plainPreview ? (
          // Karta nachodzila na divider "Dzień 1" i pasek miejsc - dwa razy, za kazdym razem
          // dlatego, ze jej wysokosc byla UŁAMKIEM EKRANU (520 px, potem 58dvh). Ulamek nie wie
          // nic o bezpiecznych strefach iPhone'a: te same 58dvh, ktore mieszcily sie w oknie
          // przegladarki, na urzadzeniu wchodzily na pasek miejsc (zgloszenia Nat 2026-09-08
          // i 2026-09-09). Teraz wysokosc bierze sie z DOSTEPNEGO MIEJSCA - slot to flex-1,
          // wiec karta dostaje dokladnie to, co zostalo, i nie ma jak z niego wyjsc.
          <div className="w-full h-full flex justify-center items-center pb-3">
            {/* Szerokosc dobrana pod WIERSZ AUTORA: przy 250 px "@berd · Gdańsk · 5 miejsc"
                sciskalo sie do "@ · G · 5 miejsc" (zlapane na zrzucie). */}
            <div ref={exportRef} className="w-[min(82vw,330px)] h-full max-h-[520px]">{children}</div>
          </div>
        ) : scale > 0 && (
          <button onClick={() => setFull(true)} aria-label={t("share.open_fullscreen")}
            className="relative rounded-3xl overflow-hidden shadow-xl ring-1 ring-black/5 active:scale-[0.98] transition-transform"
            style={{ width: window.innerWidth * scale, height: window.innerHeight * scale }}>
            <div className="pointer-events-none origin-top-left"
              style={{ width: window.innerWidth, height: window.innerHeight, transform: `scale(${scale})` }}>
              {children}
            </div>
            <span className="absolute bottom-2.5 right-2.5 h-8 w-8 rounded-full bg-black/35 backdrop-blur-sm flex items-center justify-center">
              <Maximize2 className="h-4 w-4 text-white" strokeWidth={2.2} />
            </span>
          </button>
        )}
      </div>

      {/* Pasek miejsc z wyjazdu - to on tlumaczy, CO wysylasz. JEDEN rzad przewijany w poziomie,
          podzielony na SEKCJE dni: naglowek dnia jest sticky (left) w obrebie swojej sekcji, wiec
          "Dzien 1" stoi u gory, dopoki przewijaja sie jego miejsca, a przy ostatnim zostaje
          wypchniety przez "Dzien 2" (prosba Nat 2026-09-14). */}
      {stripDays && stripDays.some((d) => d.items.length > 0) && (
        <div className="shrink-0 pb-1">
          <div className="flex items-stretch gap-3 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {stripDays.filter((d) => d.items.length > 0).map((d) => (
              <section key={d.label} className="shrink-0">
                <div className="sticky left-5 z-[1] mb-2 inline-flex items-center gap-2 pr-4">
                  <span className="h-4 w-[3px] rounded-full bg-spontaway-orange" />
                  <p className="font-brand text-[15px] leading-none text-spontaway-orange whitespace-nowrap">{d.label}</p>
                </div>
                <div className="flex gap-3">
                  {d.items.map((it, i) => (
                    <div key={`${it.name}-${i}`} className="flex w-[264px] shrink-0 items-center gap-3 rounded-3xl bg-white px-3 py-3">
                      <div className="relative h-[80px] w-[54px] shrink-0 overflow-hidden rounded-xl bg-[#fcede3]">
                        {it.photo
                          ? <img src={it.photo} alt="" className="h-full w-full object-cover" />
                          : <img src={it.icon} alt="" className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2" />}
                        <span className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-[10px] bg-spontaway-orange px-1 text-[10px] font-black leading-none text-white">{i + 1}</span>
                      </div>
                      <div className="flex h-[80px] min-w-0 flex-1 flex-col justify-between py-0.5">
                        <p className="line-clamp-2 text-[14px] font-bold leading-[1.19] text-black">{it.name}</p>
                        <div className="flex items-center justify-between gap-2">
                          <span />
                          {it.category && <span className="shrink-0 text-[11px] font-medium text-[#666]">{it.category}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
            {stripMore && (
              <div className="shrink-0">
                <div aria-hidden className="mb-2 h-4" />
                <div className="flex h-[104px] w-[150px] items-center justify-center rounded-3xl border-2 border-dashed border-spontaway-orange/50 px-4 text-center">
                  <p className="text-[13px] font-bold leading-snug text-spontaway-brown">{stripMore}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {targets.length > 0 && (
        <div className="shrink-0 px-5 pt-2 pb-[max(20px,env(safe-area-inset-bottom))]">
          <p className="font-brand text-[18px] leading-none text-spontaway-orange pb-3">{linkHeading ?? t("share.link_heading")}</p>
          {/* Rzad przewijany w poziomie zamiast siatki 4-kolumnowej: kanalow przybywa, a siatka
              lamalaby sie na kolejne rzedy i spychala podglad karty poza ekran. */}
          <div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {targets.map((tg) => (
              <div key={tg.key} className="w-[76px] shrink-0"><ShareTargetButton target={tg} /></div>
            ))}
          </div>
        </div>
      )}
    </div>
    </>
  );
}

/**
 * Karta MIEJSCA (Figma "Udostępnianie wyjazdów oraz list" -> miejsce, makieta Nat 2026-09-11):
 * DOKLADNIE ta sama karta 9:16, ktora user widzi w zakladce Miejsca (SwipeCard w trybie
 * statycznym) - odbiorca linku dostaje pod nim te sama wizytowke. Zolte tlo, "udostępnij",
 * "udostępnij link do miejsca" i rzad kanalow daje wspolny ShareSheet.
 *
 * Okladka do wyboru: tapniecie w karte PRZELACZA na kolejne zdjecie miejsca (`onNextPhoto`,
 * w kolko, z delikatna haptyka) - bez osobnego arkusza wyboru i bez pigulki "zmien zdjecie"
 * (prosba Nat 2026-09-13: zbedny krok, zbedny napis). Przy jednym zdjeciu (albo zadnym) tap
 * nic nie robi. Karta w trybie `shareMode`: bez dystansu, cen, tagow i kolumny zapisz/rozwin.
 */
export function ShareCardPlace({ place, city, photos = [], onNextPhoto, onClose, onShare, shareUrl }: {
  place: MockPlace;
  city: string;
  /** Wszystkie zdjecia miejsca - kandydaci na okladke. */
  photos?: string[];
  onNextPhoto?: () => void;
  onClose: () => void;
  onShare?: () => void;
  shareUrl?: string;
}) {
  const { t } = useTranslation("sharing");
  const noop = () => {};
  const canPick = !!onNextPhoto && photos.length > 1;
  // Nakladka „★ @handle" na Stories (2026-09-21): handle = instagram lokalu albo nazwa bez spacji.
  const [stickerOpen, setStickerOpen] = useState(false);
  const handle = stickerHandle({ place_name: place.place_name, businessInstagram: (place as any).businessInstagram ?? null, city: place.city || city || null });
  return (
    <>
    <PlaceStickerSheet open={stickerOpen} handle={handle} placeName={place.place_name} onClose={() => setStickerOpen(false)} />
    <ShareSheet kind="place" onClose={onClose} onShare={onShare} shareUrl={shareUrl} shareTitle={place.place_name}
      plainPreview linkHeading={t("share.link_heading_place")} onSticker={() => setStickerOpen(true)}
      storyPhoto={place.photo_url || null} storySticker={{ handle, render: (v) => overlayPng(handle, v) }}>
      <div className="flex h-full w-full items-center justify-center">
        {/* SwipeCard jest `absolute inset-0` - potrzebuje pudelka 9:16 o znanej wysokosci.
            `key` = okladka: SwipeCard trzyma zdjecie w stanie z pierwszego renderu, wiec zmiana
            okladki musi go zamontowac od nowa. */}
        <div className="relative h-full max-w-full" style={{ aspectRatio: "9 / 16" }}>
          <SwipeCard key={place.photo_url || "none"} place={place} city={city} scrollMode shareMode isTop offset={0} skipGoogleFetch
            onLike={noop} onSkip={noop} onTap={() => { if (canPick) onNextPhoto?.(); }} />
        </div>
      </div>
    </ShareSheet>
    </>
  );
}

/** Karta LISTY: siatka miejsc + licznik "ile jeszcze". */
export function ShareCardList({ title, city, items, author, avatar, authorId, authorFrame, authorFrameColor, collectionId, theme, visitedCount, onClose, onShare, shareUrl }: {
  title: string;
  city?: string | null;
  items: any[];
  /** Id i motyw kolekcji - z nich powstaje MINIATURA kafelka (kolor tla liczy sie z id, gdy
   *  `theme` jest puste, dokladnie tak jak w eksploracji). */
  collectionId: string;
  theme?: string | null;
  visitedCount?: number;
  author: string;
  avatar?: string | null;
  /** Autor listy - do awatara z ramka w belce arkusza (ramka po id, gdy rodzic jej nie ma). */
  authorId?: string | null;
  authorFrame?: string | null;
  authorFrameColor?: string | null;
  onClose: () => void;
  onShare?: () => void;
  shareUrl?: string;
}) {
  const { t } = useTranslation("sharing");
  // MINIATURA KOLEKCJI zamiast generycznej bialej karty (prosba Nat 2026-09-15): arkusz
  // pokazuje DOKLADNIE ten kafelek, ktory kolekcja ma w eksploracji i na profilu - z jej
  // kolorem przewodnim, pigulka autora, chipami i okladkami miejsc.
  // Wczesniej byla tu biala karta z siatka 3x3: wyjazd pokazywal swoja karte z eksploracji,
  // a kolekcja cos, czego nie widac nigdzie indziej w produkcie.
  // ⛔ Nie duplikuj tu ukladu kafelka - `ListTile` jest jeden i ma sie zmieniac w jednym miejscu.
  // ⚠️ Zrodla zdjecia w TEJ kolejnosci: okladka podana przez widok kolekcji (`photo_url` jest
  // tam juz przeliczone przez `pinCover`, czyli wlasne zdjecie ALBO zdjecie usera z `place_photos`),
  // a dopiero potem zdjecia z samego wiersza (`images` / `user_photo_urls`).
  // ⛔ NIE czytaj tu `item._cover`: stara karta udostepniania to robila, a tego pola w widoku
  // kolekcji NIE MA (ustawiaja je tylko zapytania feedu i profilu). Efekt byl taki, ze wszystkie
  // miniatury miejsc na karcie udostepniania kolekcji byly puste - zgloszenie Nat 2026-09-15
  // ("miniatury nie renderuja sie wcale"), blad starszy niz przejscie na `ListTile`.
  const places: GridPlace[] = items.slice(0, LIST_TILES).map((it: any) => ({
    name: it.place_name,
    category: it.category ?? null,
    photo: resolveStored(it.photo_url ?? null) ?? rowOwnPhotos(it)[0] ?? null,
  }));
  const tile: GridItem = {
    kind: "list", id: collectionId, title,
    cover: places.find((x) => x.photo)?.photo ?? null,
    where: city ?? "",
    // Autor ma tu sam handle: `author` przychodzi juz w postaci "@nick".
    authorName: "", authorHandle: author,
    authorAvatar: avatar ?? null, authorId: authorId ?? null,
    authorFrame: authorFrame ?? null, authorFrameColor: authorFrameColor ?? null,
    showAuthor: true,
    at: 0, placesCount: items.length, days: null, mapUrl: null,
    theme: listTheme(theme ?? null, collectionId),
    places,
    visitedCount,
  };
  return (
    <ShareSheet kind="list" onClose={onClose} onShare={onShare} shareUrl={shareUrl} shareTitle={title}
      plainPreview linkHeading={t("share.link_heading_list")}
      author={{ userId: authorId, avatar, frame: authorFrame, color: authorFrameColor }}>
      {/* ⚠️ Biala oprawa jest KONIECZNA, nie dekoracyjna: arkusz ma tlo `#FDF184`, a dokladnie
          ten kolor jest w palecie kolekcji (razem ze zlotym i kremowym) - kolekcja w zoltym
          motywie zniknela by w tle bez zadnej krawedzi. Oprawa czyta sie tez jak miniatura. */}
      <div className="w-full rounded-[28px] bg-white p-2 shadow-sm">
        <ListTile it={tile} size="feed" />
      </div>
    </ShareSheet>
  );
}

/** Karta WYJAZDU: okladka + ponumerowane przystanki + uczestnicy. */
export function ShareCardTrip({ title, city, pins, cover, onClose, onShare, shareUrl, routeId, authorName, authorAvatar, authorId, authorFrame, authorFrameColor, participants, tags, mapPins, photoFor }: {
  title: string;
  city?: string | null;
  pins: any[];
  cover?: string | null;
  onClose: () => void;
  onShare?: () => void;
  shareUrl?: string;
  /** Dane, zeby podglad pokazywal DOKLADNIE te karte, ktora widac w eksploracji. */
  routeId: string;
  authorName?: string | null;
  authorAvatar?: string | null;
  /** Autor wyjazdu - awatar z ramka w belce arkusza i na karcie (ramka po id, gdy rodzic jej nie ma). */
  authorId?: string | null;
  authorFrame?: string | null;
  authorFrameColor?: string | null;
  participants?: (string | null)[];
  tags?: string[];
  mapPins?: { latitude: number; longitude: number }[];
  /** Okladka miejsca z galerii wspoldzielonej (place_photos) - gdy pin nie ma wlasnego zdjecia. */
  photoFor?: (pin: any) => string | null;
}) {
  const { t } = useTranslation("sharing");
  // Paski miejsc pod podgladem, po DNIACH: pierwsze dwa dni W CALOSCI, reszta tylko w aplikacji
  // (prosba Nat 2026-09-14; wczesniej osiem pierwszych miejsc pod jednym "Dzien 1").
  const toItem = (p: any): StripItem => ({
    name: p.place_name ?? "",
    // Ta sama regula co w wierszu wyjazdu: najpierw wlasne zdjecia pinu, a gdy ich nie ma -
    // okladka z galerii miejsca (place_photos), ktora podaje rodzic. Bez tego kafelek pokazywal
    // ikone kategorii, choc to samo miejsce mialo zdjecie na stronie linku (zlapane na zrzucie
    // 2026-09-09): liczyl sie tylko `photo_url`/`images`, bez `user_photo_urls` i bez galerii.
    photo: thumbUrl(rowOwnPhotos(p)[0] ?? photoFor?.(p) ?? null, 160),
    icon: categoryIconSrc(p.category ?? null),
    // "other" to wartosc techniczna z bazy, nie etykieta - bez tego na karcie widac
    // dosłownie "other" (zlapane na zrzucie).
    category: p.category && p.category !== "other" ? subcategoryLabelLocalized(p.category) : null,
  });
  const dayOf = (p: any) => Math.max(1, Number(p.day_index) || 1);
  const dayNumbers = Array.from(new Set(pins.map(dayOf))).sort((a, b) => a - b);
  const shownDays = dayNumbers.slice(0, 2);
  const stripDays = shownDays.map((d) => ({ label: t("share.day_n", { n: d }), items: pins.filter((p: any) => dayOf(p) === d).map(toItem) }));
  const hiddenCount = pins.filter((p: any) => !shownDays.includes(dayOf(p))).length;
  const stripMore = hiddenCount > 0 ? t("share.more_in_app", { count: hiddenCount }) : null;

  return (
    // Podglad = karta z EKSPLORACJI, nie osobny plakat (prosba Nat 2026-09-08). Autor ma
    // zobaczyc dokladnie to, co zobaczy odbiorca - okladka w calosci, awatary, tagi i licznik.
    <ShareSheet kind="route" onClose={onClose} onShare={onShare} shareUrl={shareUrl} shareTitle={title}
      stripDays={stripDays} stripMore={stripMore} plainPreview
      author={{ userId: authorId, avatar: authorAvatar, frame: authorFrame, color: authorFrameColor }}>
      {/* Bez miniaturki mapy: na podgladzie zjadala rog okladki, a to okladka jest tu trescia
          (makieta "Majówka 2025", prosba Nat 2026-09-09). W eksploracji mapka zostaje - tam
          sluzy do orientacji, nie do pokazania, co wysylasz. */}
      <TrasaBigCard
        id={routeId}
        photo={resolveStored(cover ?? null) ?? null}
        city={city}
        placeCount={pins.length}
        title={title}
        tags={tags ?? []}
        pins={mapPins ?? []}
        showMap={false}
        onOpen={() => {}}
        authorName={authorName}
        authorAvatar={authorAvatar}
        authorId={authorId}
        participants={participants ?? []}
        snap={false}
        heightClass="h-full"
        minHeightClass=""
      />
    </ShareSheet>
  );
}
