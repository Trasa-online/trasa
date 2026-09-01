import { X } from "lucide-react";
import { PlaceTile } from "@/components/profile/PlaceTile";
import { avatarSrc } from "@/lib/avatar";
import { resolveStored } from "@/components/PlacePhoto";
import { thumbUrl } from "@/lib/imageUrl";

// KARTA DO UDOSTEPNIENIA - format 9:16, do zrzutu ekranu i wrzucenia na Stories.
//
// DWA SZABLONY, nie jeden (eksploracja w Figmie, sekcja "Udostępnianie: lista vs wyjazd").
// Lista i wyjazd sprzedaja sie czym INNYM, wiec kazdy dowodzi czego innego:
//  - LISTA to zbior: liczy sie ILOSC i kuracja -> siatka kafelkow z licznikiem "+N",
//  - WYJAZD to historia: licza sie TRASA i ludzie -> okladka, ponumerowane przystanki, awatary.
// Jeden uniwersalny szablon obslugiwalby oba gorzej.
//
// Karta renderuje sie jako zwykly widok (nie obrazek) - user robi zrzut ekranu, tak jak na
// Pintereście. Eksport do pliku i kanaly (Instagram, zapis do rolki) to osobny ekran, jeszcze
// nie zbudowany - dlatego tutaj zostaje tylko podglad i wyjscie.

const CARD_W = 320;   // szerokosc karty w px CSS; 9:16 -> wysokosc 569
const CARD_H = Math.round(CARD_W * 16 / 9);

function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-5 px-6 animate-in fade-in duration-200">
      <button onClick={onClose} aria-label="Zamknij"
        className="absolute right-4 h-10 w-10 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
        <X className="h-5 w-5 text-white" />
      </button>
      {children}
      <p className="text-[12.5px] text-white/70 text-center max-w-[280px] leading-relaxed">
        Zrób zrzut ekranu i wrzuć na Stories
      </p>
    </div>
  );
}

// Stopka karty: kto to zrobil + znak marki. Wspolna dla obu szablonow, zeby karta
// zawsze konczyla sie tak samo i dalo sie ja rozpoznac po jednym elemencie.
function Footer({ avatars, label, sub, tone }: {
  avatars: (string | null)[]; label: string; sub?: string; tone: "light" | "peach";
}) {
  return (
    <div className={`absolute left-4 right-4 bottom-4 h-16 rounded-2xl flex items-center gap-3 px-3 ${tone === "light" ? "bg-white" : "bg-[#FCEDE3]"}`}>
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

/** Karta LISTY: siatka miejsc + licznik "ile jeszcze". */
export function ShareCardList({ title, city, items, author, avatar, onClose }: {
  title: string;
  city?: string | null;
  items: any[];
  author: string;
  avatar?: string | null;
  onClose: () => void;
}) {
  const shown = items.slice(0, 5);
  const rest = Math.max(0, items.length - shown.length);
  const word = items.length === 1 ? "miejsce" : items.length < 5 ? "miejsca" : "miejsc";
  return (
    <Shell onClose={onClose}>
      <div className="relative rounded-3xl overflow-hidden bg-[#FCEDE3] shadow-2xl" style={{ width: CARD_W, height: CARD_H }}>
        <div className="px-5 pt-8">
          <p className="text-[10.5px] font-bold tracking-wide text-[#C58A66]">LISTA MIEJSC</p>
          <p className="text-[26px] font-black leading-[1.08] text-foreground mt-1.5 line-clamp-2">{title}</p>
          <p className="text-[12.5px] font-semibold text-[#8A6A57] mt-2">
            {[city, `${items.length} ${word}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {/* Kafelki = dowod, ze lista ma tresc. Nazwa pod kazdym, zeby dalo sie ja czytac
            takze bez zdjec (miejsce bez zdjecia dostaje ikone kategorii na peachy tle). */}
        <div className="grid grid-cols-3 gap-2 px-5 mt-4">
          {shown.map((it, i) => (
            <div key={it.id ?? i}>
              <div className="rounded-xl overflow-hidden bg-white">
                <PlaceTile tile={it} aspect="aspect-square" />
              </div>
              <p className="text-[9.5px] font-semibold text-[#5C4136] mt-1 leading-tight line-clamp-1">{it.place_name}</p>
            </div>
          ))}
          {rest > 0 && (
            <div className="aspect-square rounded-xl bg-[#F6D9C6] flex items-center justify-center">
              <span className="text-[22px] text-[#F75708]" style={{ fontFamily: "Sigmar, system-ui, sans-serif" }}>+{rest}</span>
            </div>
          )}
        </div>
        <Footer avatars={[avatar ?? null]} label={author} sub="zapisz tę listę w spontaway" tone="light" />
      </div>
    </Shell>
  );
}

/** Karta WYJAZDU: okladka + ponumerowane przystanki + uczestnicy. */
export function ShareCardTrip({ title, city, dateLabel, pins, author, avatars, cover, onClose }: {
  title: string;
  city?: string | null;
  dateLabel?: string | null;
  pins: any[];
  author: string;
  avatars: (string | null)[];
  cover?: string | null;
  onClose: () => void;
}) {
  const stops = pins.slice(0, 4);
  const rest = Math.max(0, pins.length - stops.length);
  const word = pins.length === 1 ? "miejsce" : pins.length < 5 ? "miejsca" : "miejsc";
  const coverUrl = thumbUrl(resolveStored(cover ?? null), 360);
  return (
    <Shell onClose={onClose}>
      <div className="relative rounded-3xl overflow-hidden bg-[#FEFEFE] shadow-2xl" style={{ width: CARD_W, height: CARD_H }}>
        {/* Okladka. Bez zdjecia (wyjazd roboczy) - peachowe tlo ze znakiem, jak karta na profilu. */}
        <div className="relative h-[46%] bg-[#fcede3]">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <span aria-hidden className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 block" style={{
              backgroundColor: "#EF9D78",
              WebkitMaskImage: "url(/Ikona_Trasy.svg)", maskImage: "url(/Ikona_Trasy.svg)",
              WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat",
              WebkitMaskSize: "contain", maskSize: "contain",
              WebkitMaskPosition: "center", maskPosition: "center",
            }} />
          )}
          <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute left-5 right-5 bottom-4">
            <p className="text-[10.5px] font-bold tracking-wide text-white/90">
              {["WYJAZD", dateLabel?.toUpperCase()].filter(Boolean).join(" · ")}
            </p>
            <p className="text-[26px] font-black leading-[1.08] text-white mt-1 line-clamp-2">{title}</p>
            <p className="text-[12.5px] font-semibold text-white/90 mt-1">
              {[city, `${pins.length} ${word}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {/* Ponumerowane przystanki = dowod, ze to TRASA, a nie luzny zbior. */}
        <div className="px-5 pt-4 space-y-2.5">
          {stops.map((p, i) => (
            <div key={p.id ?? i} className="flex items-center gap-2.5">
              <span className="h-6 w-6 shrink-0 rounded-full bg-primary text-white text-[11px] font-bold flex items-center justify-center">{i + 1}</span>
              <p className="text-[13px] font-semibold text-foreground truncate">{p.place_name}</p>
            </div>
          ))}
          {rest > 0 && <p className="text-[11.5px] text-muted-foreground pl-[34px]">{`…i ${rest} ${rest < 5 ? "miejsca" : "miejsc"} więcej`}</p>}
        </div>
        <Footer avatars={avatars.length ? avatars : [null]} label={author} tone="peach" />
      </div>
    </Shell>
  );
}
