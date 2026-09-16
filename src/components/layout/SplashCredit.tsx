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
export default function SplashCredit({ className = "" }: { className?: string }) {
  const { t } = useTranslation("common");
  return (
    <p
      className={`absolute inset-x-0 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-[#5B2C06]/70 ${className}`}
      style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 28px)" }}
    >
      {t("splash.made_in")}
      <BrandHeart className="h-[11px] w-[13px] shrink-0 text-primary" />
    </p>
  );
}
