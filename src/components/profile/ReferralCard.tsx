import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { QrCode } from "lucide-react";
import { BrandShare, BrandUserPlus } from "@/components/BrandIcon";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useShare } from "@/hooks/useShare";
import { haptics } from "@/hooks/useHaptics";
import { track } from "@/lib/analytics";
import { TESTFLIGHT_URL } from "@/lib/testflight";
import { REFERRAL_GOAL, fetchReferralStats, referralLink } from "@/lib/referral";

// Zapraszanie znajomych (2026-09-10). Zamiast paywalla - ekran zachety.
//
// Nic nie jest odciete. Pasek postepu jest OBIETNICA WCZESNIEJSZEGO DOSTEPU, a nie brama:
// przed premiera odcinanie funkcji odbiloby dokladnie tych ludzi, ktorych wlasnie zbieramy
// z TestFlight i waitlisty. Model danych (profiles.referred_by) jest gotowy pod twardszy
// prog, gdyby liczby o niego poprosily.
//
// Licznik pokazuje REJESTRACJE z linku, nie wyslane linki - stad bierze sie jego wiarygodnosc.
//
// DWIE DROGI ZAPROSZENIA, celowo rozne:
//  - "Wyślij zaproszenie" posyla link z kodem (spontaway.com/?ref=...). Kod jedzie dalej
//    i zaproszenie moze sie policzyc.
//  - Kod QR prowadzi WPROST na TestFlight (prosba Nat 2026-09-10): to droga na zywo, przy
//    stole, gdy druga osoba ma po prostu wejsc do testow. Adres TestFlight nie przyjmuje
//    parametrow, wiec takie wejscie nie doliczy sie do licznika.

// Zamkniecie karty trzymamy w sessionStorage, NIE w localStorage (prosba Nat 2026-09-10):
// baner ma znikac na czas biezacego uzycia, a wracac przy kolejnym odpaleniu aplikacji.
// W natywce kazde uruchomienie to nowy WebView, wiec sessionStorage startuje pusty -
// dokladnie to zachowanie. localStorage schowalby go raz na zawsze.
const DISMISS_KEY = "spontaway_referral_card_dismissed";

export default function ReferralCard({ userId }: { userId: string }) {
  const { t } = useTranslation("profiles");
  const share = useShare();
  const [qrOpen, setQrOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
  });

  const { data } = useQuery({
    queryKey: ["referral-stats", userId],
    queryFn: () => fetchReferralStats(userId),
    staleTime: 60_000,
  });

  const code = data?.code ?? null;
  const invited = data?.invited ?? 0;
  const done = invited >= REFERRAL_GOAL;
  if (!code || dismissed) return null;
  const link = referralLink(code);

  const onShare = async () => {
    haptics.light();
    track("referral_shared", { invited });
    await share({ title: t("referral.share_title"), text: t("referral.share_text"), url: link });
  };

  return (
    <>
      {/* POWROT do zoltej karty (prosba Nat 2026-09-15). Wariant "kupon" z FYI (kreskowany
          szary obrys, OSTRE rogi) byl probowany od 2026-09-11 i zostal odrzucony: na profilu
          pelnym zaokraglonych kafelkow ostra ramka czytala sie jak obcy element, a szarosc
          gubila baner w tle. Wraca plaskie zolte tlo marki #FDF184 z promieniem 24 px
          i brazowym tekstem #5B2C06 (10:1 - tresc czyta sie bez wysilku).
          ⛔ NIE wracaj do kreskowanego kuponu ani do gradientu (odrzucony 2026-09-10 jako
          najglosniejszy element profilu). Tresc i "Nie teraz" zostaja z wersji kuponowej. */}
      <div className="mb-5 rounded-3xl bg-[#FDF184] px-5 pt-5 pb-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/70">
            <BrandUserPlus className="h-5 w-5 text-[#5B2C06]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#5B2C06]/70">
              {done ? t("referral.eyebrow_done") : t("referral.eyebrow")}
            </p>
            <p className="mt-0.5 text-[16px] font-bold leading-snug text-[#5B2C06]">
              {done ? t("referral.title_done") : t("referral.desc", { count: REFERRAL_GOAL })}
            </p>
            {!done && (
              <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-[#5B2C06]/80 tabular-nums">
                <span className="flex gap-1">
                  {Array.from({ length: REFERRAL_GOAL }, (_, i) => (
                    <span key={i} className={`h-2 w-2 rounded-full ${i < invited ? "bg-[#5B2C06]" : "bg-[#5B2C06]/25"}`} />
                  ))}
                </span>
                {t("referral.progress", { invited, goal: REFERRAL_GOAL })}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={onShare}
            className="flex-1 h-11 rounded-2xl bg-primary text-white font-bold text-[13px] uppercase tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <BrandShare className="h-4 w-4" />{t("referral.share_cta")}
          </button>
          <button
            onClick={() => { haptics.light(); setQrOpen(true); }}
            aria-label={t("referral.qr_aria")}
            className="shrink-0 h-11 w-11 rounded-2xl bg-white/70 flex items-center justify-center active:scale-90 transition-transform"
          >
            <QrCode className="h-5 w-5 text-[#5B2C06]" />
          </button>
        </div>
        <button
          onClick={() => {
            haptics.light();
            try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* prywatne okno */ }
            setDismissed(true);
          }}
          className="mt-1 w-full py-2 text-center text-[13px] font-semibold text-[#5B2C06]/70 active:text-[#5B2C06] transition-colors"
        >
          {t("referral.not_now")}
        </button>
      </div>

      {/* Kod QR na pelnym arkuszu: ma byc na tyle duzy, zeby dalo sie go zeskanowac
          z drugiego telefonu trzymanego w reku. */}
      <Sheet open={qrOpen} onOpenChange={setQrOpen}>
        <SheetContent side="bottom" className="rounded-t-3xl pt-6 pb-[max(24px,env(safe-area-inset-bottom))]">
          <SheetTitle className="text-center text-lg font-black">{t("referral.qr_title")}</SheetTitle>
          <p className="mt-1.5 text-center text-sm text-muted-foreground leading-relaxed px-4">
            {t("referral.qr_desc")}
          </p>
          <div className="mt-5 flex justify-center">
            <div className="rounded-3xl bg-white p-4 border border-border/60">
              <QRCodeSVG value={TESTFLIGHT_URL} size={220} level="M" marginSize={0} />
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
