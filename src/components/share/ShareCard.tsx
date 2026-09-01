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

// Karta zajmuje CALY ekran (prosba Nat 2026-09-01) - to ona ma byc zrzutem, wiec nie moze byc
// kartka na przyciemnionym tle: zrzut zlapalby ramke i ciemna otoczke. Guzik zamkniecia i podpowiedz
// leza NAD karta i sa jedynymi elementami, ktore wejda w kadr - swiadomie male i przy krawedziach.
function Shell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[95] animate-in fade-in duration-200">
      {children}
      <button onClick={onClose} aria-label="Zamknij"
        className="absolute right-3 h-9 w-9 rounded-full bg-black/25 backdrop-blur-sm flex items-center justify-center active:scale-90 transition-transform"
        style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}>
        <X className="h-4 w-4 text-white" />
      </button>
    </div>
  );
}

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
      <div className="relative h-full w-full overflow-hidden bg-[#FCEDE3]">
        <div className="px-6" style={{ paddingTop: "max(64px, calc(env(safe-area-inset-top) + 44px))" }}>
          <p className="text-[12px] font-bold tracking-wide text-[#C58A66]">LISTA MIEJSC</p>
          <p className="text-[34px] font-black leading-[1.06] text-foreground mt-2 line-clamp-3">{title}</p>
          <p className="text-[15px] font-semibold text-[#8A6A57] mt-2.5">
            {[city, `${items.length} ${word}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {/* Kafelki = dowod, ze lista ma tresc. Nazwa pod kazdym, zeby dalo sie ja czytac
            takze bez zdjec (miejsce bez zdjecia dostaje ikone kategorii na peachy tle). */}
        <div className="grid grid-cols-3 gap-2.5 px-6 mt-7">
          {shown.map((it, i) => (
            <div key={it.id ?? i}>
              <div className="rounded-xl overflow-hidden bg-white">
                <PlaceTile tile={it} aspect="aspect-square" />
              </div>
              <p className="text-[11.5px] font-semibold text-[#5C4136] mt-1.5 leading-tight line-clamp-1">{it.place_name}</p>
            </div>
          ))}
          {rest > 0 && (
            <div className="aspect-square rounded-xl bg-[#F6D9C6] flex items-center justify-center">
              <span className="text-[28px] text-[#F75708]" style={{ fontFamily: "Sigmar, system-ui, sans-serif" }}>+{rest}</span>
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
      <div className="relative h-full w-full overflow-hidden bg-[#FEFEFE]">
        {/* Okladka. Bez zdjecia (wyjazd roboczy) - peachowe tlo ze znakiem, jak karta na profilu. */}
        <div className="relative h-[52%] bg-[#fcede3]">
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
            <p className="text-[12px] font-bold tracking-wide text-white/90">
              {["WYJAZD", dateLabel?.toUpperCase()].filter(Boolean).join(" · ")}
            </p>
            <p className="text-[34px] font-black leading-[1.06] text-white mt-1.5 line-clamp-2">{title}</p>
            <p className="text-[15px] font-semibold text-white/90 mt-1.5">
              {[city, `${pins.length} ${word}`].filter(Boolean).join(" · ")}
            </p>
          </div>
        </div>
        {/* Ponumerowane przystanki = dowod, ze to TRASA, a nie luzny zbior. */}
        <div className="px-6 pt-6 space-y-4">
          {stops.map((p, i) => (
            <div key={p.id ?? i} className="flex items-center gap-2.5">
              <span className="h-8 w-8 shrink-0 rounded-full bg-primary text-white text-[13px] font-bold flex items-center justify-center">{i + 1}</span>
              <p className="text-[16px] font-semibold text-foreground truncate">{p.place_name}</p>
            </div>
          ))}
          {rest > 0 && <p className="text-[13px] text-muted-foreground pl-[42px]">{`…i ${rest} ${rest < 5 ? "miejsca" : "miejsc"} więcej`}</p>}
        </div>
        <Footer avatars={avatars.length ? avatars : [null]} label={author} tone="peach" />
      </div>
    </Shell>
  );
}
