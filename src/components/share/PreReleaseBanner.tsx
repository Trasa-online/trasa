// Pasek instalacji na WIDOKU, KTORY WIDZI ODBIORCA linku (Figma "[NEW] Ekrany" ->
// "Udostępnianie wyjazdów oraz list" -> "Widok wyświetlania wyjazdu", 2026-09-08).
//
// Kontekst: link do wyjazdu otwiera sie u odbiorcy w przegladarce - najczesciej w oknie
// komunikatora. Ta osoba zwykle nie ma jeszcze aplikacji, a wyjazd jest jedynym powodem,
// dla ktorego moglaby ja chciec. Pasek daje jej te sciezke od razu, zamiast liczyc, ze sama
// znajdzie nas w sklepie.
//
// Widoczny WYLACZNIE na webie: w aplikacji natywnej zapraszalby do zainstalowania czegos,
// co user wlasnie ma otwarte.

import { isWeb } from "@/lib/platform";
import { TrasaLogo } from "@/components/TrasaLogo";
import { useTranslation } from "react-i18next";

/** Zapisy do testow przedpremierowych (TestFlight). Do premiery zastapi to link do App Store. */
const TESTFLIGHT_URL = "https://testflight.apple.com/join/a9rtGFuq";

export default function PreReleaseBanner() {
  const { t } = useTranslation("sharing");
  if (!isWeb) return null;
  return (
    <div className="shrink-0 flex items-center justify-between gap-3 border-b border-spontaway-yellow bg-[#F9F9F9] px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-spontaway-yellow">
          <TrasaLogo size={26} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-bold text-spontaway-brown">Spontaway</span>
          <span className="block text-[12px] leading-tight text-spontaway-brown/85">{t("prerelease.tagline")}</span>
        </span>
      </div>
      <a
        href={TESTFLIGHT_URL}
        target="_blank"
        rel="noreferrer noopener"
        className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-spontaway-orange px-3.5 text-[12.5px] font-extrabold text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
      >
        {t("prerelease.cta")}
      </a>
    </div>
  );
}
