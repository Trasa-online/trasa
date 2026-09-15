// Czesci wspolne podgladow. CELOWO wygladaja jak aplikacja, nie jak panel:
// to jest odpowiedz na pytanie "co widzi uzytkownik", wiec proporcje zdjec, chipy
// kategorii i dymki notek sa takie, jak w apce (patrz CLAUDE.md, sekcja o proporcjach).
//
// Peachowy chip kategorii ma WLASNE tlo i WLASNY kolor tekstu, wiec czyta sie tak samo
// w jasnym i ciemnym trybie panelu - nie podpinam go pod tokeny, bo to cytat z apki.
import type { ReactNode } from "react";
import { Star, ImageOff } from "lucide-react";
import { categoryIconSrc } from "@/lib/placeCategoryIcon";
import { adminPhotoUrl } from "../places/usePlaces";
import { avatarSrc } from "@/lib/avatar";
import type { PreviewAuthor, PreviewPlace } from "./usePreviews";

// ⚠️ Zdjecia w panelu ida przez proxy na GLOWNEJ domenie: admin.spontaway.com nie ma
// /api/place-photo, wiec `resolveStored` (relatywna sciezka) zwrocilby tu martwy link.
// Do moderacji przekazujemy dalej ORYGINALNA wartosc z bazy, nie ta rozwiazana.
export const previewPhoto = (url: string | null | undefined, w = 400) => adminPhotoUrl(url, w);

const PEACH = "#FCEDE3";
const BROWN = "#5B2C06";

export function AuthorPill({ author, tone = "surface" }: { author: PreviewAuthor | null; tone?: "surface" | "onColor" }) {
  const name = author?.username || author?.first_name || "nieznany autor";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-[12px] font-medium"
      style={tone === "onColor"
        ? { background: "#FFFFFF", color: BROWN }
        : { background: "var(--canvas)", color: "var(--graphite)" }}
    >
      {author?.avatar_url
        ? <img src={avatarSrc(author.avatar_url)} alt="" className="h-5 w-5 rounded-full object-cover" />
        : <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--line)] text-[10px] text-[var(--graphite)]">
            {name.slice(0, 1).toUpperCase()}
          </span>}
      @{name}
    </span>
  );
}

/** Chip z obrysem spod tytulu w apce (miasto, liczba miejsc, dni). */
export function OutlineChip({ children, onColor }: { children: ReactNode; onColor?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px]"
      style={onColor
        ? { borderColor: "rgba(255,255,255,0.55)", color: "#FFFFFF" }
        : { borderColor: "var(--line)", color: "var(--graphite)" }}
    >
      {children}
    </span>
  );
}

export function CategoryChip({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
      style={{ background: PEACH, color: BROWN }}
    >
      <img src={categoryIconSrc(category)} alt="" className="h-3 w-3" />
      {category}
    </span>
  );
}

/** Miniatura miejsca: 2:3 pion, tak jak wiersz miejsca w wyjezdzie i kolekcji. */
export function PlaceThumb({ url, onClick }: { url: string | null; onClick?: () => void }) {
  const src = previewPhoto(url);
  const box = "h-24 w-16 shrink-0 overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]";
  if (!src) {
    return <span className={`${box} flex items-center justify-center`}><ImageOff className="h-4 w-4 text-[var(--stone)]" /></span>;
  }
  return (
    <button type="button" onClick={onClick} disabled={!onClick} className={`${box} block transition-transform active:scale-95 disabled:active:scale-100`}>
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </button>
  );
}

/** Dodatkowe zdjecia miejsca (userzy wrzucaja ich kilka) - poziomy pasek 4:3. */
export function PhotoStrip({ urls, onPhoto }: { urls: string[]; onPhoto?: (url: string) => void }) {
  if (!urls.length) return null;
  return (
    <div className="scrollbar-none mt-2 flex gap-1.5 overflow-x-auto">
      {urls.map((u, i) => (
        <button
          key={i} type="button" onClick={onPhoto ? () => onPhoto(u) : undefined} disabled={!onPhoto}
          className="h-[72px] w-24 shrink-0 overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)] transition-transform active:scale-95 disabled:active:scale-100"
        >
          <img src={previewPhoto(u) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

export function NoteBubble({ text, author }: { text: string; author: string | null }) {
  return (
    <p className="mt-1.5 rounded-[var(--r-control)] bg-[var(--canvas)] px-2.5 py-1.5 text-[12px] leading-snug text-[var(--graphite)]">
      {author ? <span className="font-semibold text-[var(--ink)]">@{author}: </span> : null}„{text}”
    </p>
  );
}

/** Wiersz miejsca: miniatura 2:3, nazwa, chip kategorii, notki, reszta zdjec. */
export function PlaceRow({ place, index, onPhoto }: { place: PreviewPlace; index: number; onPhoto?: (url: string) => void }) {
  const [cover, ...rest] = place.photos;
  return (
    <li className="flex gap-3 border-b border-[var(--line)] py-3 last:border-0">
      <PlaceThumb url={cover ?? null} onClick={cover && onPhoto ? () => onPhoto(cover) : undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <span className="data mt-0.5 text-[11px] text-[var(--stone)]">{index}</span>
          <p className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[var(--ink)]">{place.place_name}</p>
          {place.isTop ? <Star className="h-4 w-4 shrink-0 fill-[var(--accent)] text-[var(--accent)]" /> : null}
        </div>
        {place.address ? <p className="truncate text-[12px] text-[var(--stone)]">{place.address}</p> : null}
        {place.category ? <div className="mt-1.5"><CategoryChip category={place.category} /></div> : null}
        {place.notes.map((n, i) => <NoteBubble key={i} text={n.text} author={n.author} />)}
        <PhotoStrip urls={rest} onPhoto={onPhoto} />
      </div>
    </li>
  );
}
