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
// WERSALIKI (decyzja Nat 2026-09-16 - kapitaliki probowane tego samego dnia i odrzucone).
//
// ⛔ TRZECIE zgloszenie "to nadal kapitaliki" (2026-09-17). `font-variant-caps: small-caps`
// zostalo usuniete juz przy pierwszym (commit d05f0701) i nie ma go ANI w zrodle, ANI
// w zbudowanym CSS, ANI w paczce natywnej - sprawdzone, computed style w WebKit oddaje
// `uppercase` / `fontVariantCaps: normal`. Skoro nie umiem tego odtworzyc, zamykamy KAZDA
// furtke naraz zamiast zgadywac dalej:
//   1. tekst w locale jest juz ZAPISANY WIELKIMI LITERAMI - wielkosc liter nie zalezy wiec
//      od tego, czy `text-transform` gdziekolwiek zadziala (`uppercase` zostaje, bo na
//      wielkich literach nic nie zmienia, a chroni przed tlumaczem piszacym minuskami);
//   2. `fontVariantCaps: "normal"` i `fontFeatureSettings: "normal"` gasza kapitaliki
//      nawet gdyby szly z dziedziczenia albo z funkcji OpenType fontu;
//   3. ODSTEP MIEDZYLITEROWY zszedl z .07em na .035em - szeroko rozstrzelone male wersaliki
//      to jest dokladnie wizualny podpis kapitalikow, wiec przy tej wielkosci litery czytaly
//      sie jak kapitaliki, nawet bedac wersalikami.
// ⛔ Regula "tresc w locale pisana normalnie, wielkie litery robi CSS" zostaje tu ZLAMANA
// swiadomie - po trzech podejsciach pewnosc jest wazniejsza od elegancji.
//
// ⚠️ ROZMIAR: 12 px i tak ma zostac. Podpis ma byc AKCENTEM, nie komunikatem (prosba Nat
// 2026-09-17: "zalezy mi na malym tekscie"). Podniesienie do 15 px tego samego dnia bylo
// moja bledna diagnoza - problemem nie byla wielkosc, tylko to, jak litery sie czytaly.
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
      className={`absolute inset-x-0 flex items-center justify-center gap-1.5 px-4 text-[12px] font-medium uppercase tracking-[0.035em] text-[#5B2C06]/75 ${className}`}
      style={{
        bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)",
        textWrap: "balance",
        // Gasimy kapitaliki jawnie - patrz komentarz na gorze pliku.
        fontVariantCaps: "normal",
        fontFeatureSettings: "normal",
      }}
    >
      {t("splash.made_in")}
      <BrandHeart className="h-[12px] w-[14px] shrink-0 text-primary" />
    </p>
  );
}
