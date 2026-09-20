// EKRAN STARTOWY dla KOLEJNYCH zimnych startow (2026-09-08).
//
// Pelna animacja skladania znaku (SplashDraw) gra raz na 12 godzin - marka dostaje swoja
// chwile, ale nie przy kazdym wejsciu. Dla pozostalych startow byl tu wczesniej szkielet
// ekranu docelowego, a po jego usunieciu (bo dublowal szkielet z Suspense) nie bylo NIC:
// aplikacja otwierala sie pustym bialym ekranem (zgloszenie Nat 2026-09-08).
//
// Stad ten wariant posredni: to samo tlo i ten sam znak, co w pelnym splashu, tylko bez
// opowiadania historii - delikatny puls mowi "pracuje", a nie "obejrzyj animacje". Dzieki
// temu pierwsza klatka po zimnym starcie jest ZAWSZE brandowana i zawsze taka sama.
//
// ⚠️ Znak MUSI byc ten sam, co w SplashDraw - czyli z gwiazdka z nowego logo (2026-09-15).
// Wczesniej stal tu `TrasaLogo` (/spontaway-symbol.png), czyli samo "S": dwa warianty
// ekranu startowego pokazywalyby wtedy dwa rozne znaki.

import { SpontawayMark } from "@/components/SpontawayMark";
import SplashCredit from "@/components/layout/SplashCredit";

export default function SplashPulse() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      aria-hidden
    >
      {/* ⛔ Puls chodzi WYLACZNIE w skali. Do 2026-09-15 ruszal tez krycie (0,72 -> 1), przez co
          znak w kolko blednial: #F75708 przy 72 % na bialym to (249,134,77). Nat zglosila to jako
          „gradient na znaku S" - i slusznie, bo tak to wyglada, choc zadnego gradientu nie ma
          w kodzie. Znak ma byc ZAWSZE kryjacym #F75708; oddech niesie sama skala. */}
      <SpontawayMark size={104} className="animate-splash-pulse" />
      <SplashCredit />
    </div>
  );
}
