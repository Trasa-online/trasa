import { useTranslation } from "react-i18next";
import { BrandHeart } from "@/components/BrandHeart";

// Podpis u dolu ekranu startowego (prosba Nat 2026-09-16): "Stworzone w Polsce" / "Made in
// Poland, Shared Worldwide" z brandowym sercem. Wspolny dla OBU wariantow splashu
// (`SplashDraw` i `SplashPulse`), zeby nie rozjechal sie miedzy nimi.
//
// ⚠️ Zdanie NIE jest tlumaczeniem samo siebie: po polsku mowimy krocej ("Stworzone w Polsce"),
// bo dla polskiego odbiorcy druga polowa jest oczywista, a po angielsku niesie caly sens
// ("Shared Worldwide"). Dlatego to DWA rozne teksty pod jednym kluczem, nie kalka.
//
// Serce jest PELNE i w pomaranczu marki; tekst brazowy, bo to podpis, nie komunikat.
//
// WERSALIKI (decyzja Nat 2026-09-16 - kapitaliki probowane tego samego dnia i odrzucone:
// "nie pasuja"). Wersaliki chodza `text-transform`em, wiec tresc w locale zostaje pisana
// normalnie i tlumacz nie musi krzyczec.
//
// ⚠️ ROZMIAR JEST ZMIENNY I TAK MA BYC. Wersaliki sa DUZO szersze od minusek, a angielska
// wersja jest dluga: zmierzone w WebKit przy `letter-spacing: .07em` - "MADE IN POLAND,
// SHARED WORLDWIDE" ma 273 px przy 12 px, 295 przy 13 px i 318 przy 14 px. Na iPhonie SE
// (320 px szerokosci, minus serce i odstep) mieści sie tylko ta pierwsza. Stad `clamp`:
// waski telefon dostaje 12 px, zwykly ~13 px, Pro Max pelne 14 px. Polska wersja (160-186 px)
// miesci sie zawsze - to angielska wyznacza gorna granice.
// ⛔ Nie wpisuj tu stalych 14 px "bo tak wygladalo na podgladzie" - na SE napis wyjedzie
// poza ekran albo zawinie sie na dwie linie tuz nad krawedzia.
export default function SplashCredit({ className = "" }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <p
      className={`absolute inset-x-0 flex items-center justify-center gap-1.5 px-4 font-semibold uppercase tracking-[0.07em] text-[#5B2C06]/70 ${className}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)", fontSize: "clamp(12px, 3.4vw, 14px)" }}
    >
      {t("splash.made_in")}
      <BrandHeart className="h-[12px] w-[14px] shrink-0 text-primary" />
    </p>
  );
}
