// EKRAN STARTOWY dla KOLEJNYCH zimnych startow (2026-09-08).
//
// Pelna animacja rysowania znaku (SplashDraw) gra raz na 12 godzin - marka dostaje swoja
// chwile, ale nie przy kazdym wejsciu. Dla pozostalych startow byl tu wczesniej szkielet
// ekranu docelowego, a po jego usunieciu (bo dublowal szkielet z Suspense) nie bylo NIC:
// aplikacja otwierala sie pustym bialym ekranem (zgloszenie Nat 2026-09-08).
//
// Stad ten wariant posredni: to samo tlo i ten sam znak, co w pelnym splashu, tylko bez
// opowiadania historii - delikatny puls mowi "pracuje", a nie "obejrzyj animacje". Dzieki
// temu pierwsza klatka po zimnym starcie jest ZAWSZE brandowana i zawsze taka sama.

import { TrasaLogo } from "@/components/TrasaLogo";

export default function SplashPulse() {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-background"
      aria-hidden
    >
      {/* Puls jest w skali I kryciu naraz - sama zmiana krycia czyta sie jak miganie,
          a sama skala jak drganie. Razem daja spokojny oddech. */}
      <TrasaLogo size={96} className="animate-splash-pulse" />
    </div>
  );
}
