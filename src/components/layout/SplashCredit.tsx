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
// KAPITALIKI, nie wersaliki (prosba Nat 2026-09-16): `font-variant-caps: small-caps` zostawia
// wielka litere w "Stworzone" i "Polsce" w pelnej wysokosci, a reszte zmniejsza - zdanie
// nadal czyta sie jak zdanie, a nie jak krzyk. WebKit SYNTEZUJE kapitaliki, gdy font ich nie
// ma (Inter z Google Fonts nie wozi `smcp`), wiec na iOS renderuje sie to poprawnie.
// ⛔ Nie zamieniaj tego na `uppercase` - to inny krok typograficzny i inny wyglad.
// Kapitaliki sa gestsze od minusek, stad odrobina `letter-spacing`.
// ⚠️ 14 px, nie 13 px: kapitaliki ZJADAJA wzrost, bo male litery rysuja sie na wysokosci
// wersalika pomniejszonego, a nie na wysokosci minuski. Sprawdzone renderem w WebKit obok
// dotychczasowej wersji - przy 13 px podpis czytal sie MNIEJSZY niz stare 12 px zwyklych
// liter. Dopiero przy 14 px wersaliki S i P sa wyzsze niz dzis, a cala linia szersza.
export default function SplashCredit({ className = "" }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <p
      className={`absolute inset-x-0 flex items-center justify-center gap-1.5 text-[14px] font-semibold tracking-[0.07em] text-[#5B2C06]/70 ${className}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)", fontVariantCaps: "small-caps" }}
    >
      {t("splash.made_in")}
      <BrandHeart className="h-[12px] w-[14px] shrink-0 text-primary" />
    </p>
  );
}
