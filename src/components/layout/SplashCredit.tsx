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
// ⚠️ ROZMIAR JEST STALY: 15 px (zgloszenie Nat 2026-09-17 "dalej sa kapitaliki zamiast
// wersalikow"). ⛔ To NIE byly kapitaliki - `text-transform: uppercase` bylo na miejscu,
// a `small-caps` nie ma w kodzie, w zbudowanym CSS ani w paczce natywnej (sprawdzone we
// wszystkich trzech warstwach). Napis po prostu BYL ZA MALY: 13 px wersalikow przy szerokim
// odstepie i kryciu 70 % czyta sie dokladnie tak, jak kapitaliki, bo kapitaliki to z definicji
// wersaliki sprowadzone do wysokosci x.
//
// ⛔ Wczesniejszy `clamp(12px, 3.4vw, 14px)` ZNIKA i nie przywracaj go. Mial chronic przed
// wyjechaniem angielskiej wersji poza ekran iPhone'a SE - i nie chronil przed niczym:
// "MADE IN POLAND, SHARED WORLDWIDE" ma 273 px, a na SE zostaje 268 px, wiec zdanie zawija
// sie na dwie linie TAKZE przy 12 px. Clamp zmniejszal wiec polski napis w zamian za nic.
// Zmierzone w WebKit na zbudowanym bundlu: przy 15 px przepelnienie wynosi 0 px na SE, 16
// i Pro Max, w obu jezykach - angielski zawija sie na dwie linie dokladnie tak jak wczesniej.
// `text-wrap: balance` dzieli te dwie linie rowno, zamiast zostawiac samotne slowo.
export default function SplashCredit({ className = "" }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <p
      className={`absolute inset-x-0 flex items-center justify-center gap-1.5 px-4 text-[15px] font-semibold uppercase tracking-[0.07em] text-[#5B2C06]/85 ${className}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)", textWrap: "balance" }}
    >
      {t("splash.made_in")}
      <BrandHeart className="h-[12px] w-[14px] shrink-0 text-primary" />
    </p>
  );
}
