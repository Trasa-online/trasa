import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Share2, UserPlus, X } from "lucide-react";
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
      {/* Plaski zolty akcent zamiast gradientu (prosba Nat 2026-09-10): gradient byl
          najglosniejszym elementem profilu i przykrywal to, co karta ma powiedziec.
          Brazowy #5B2C06 na zoltym daje 10:1, wiec tresc czyta sie bez wysilku. */}
      <div className="rounded-3xl bg-[#FDF184] p-5 mb-5">
        <div className="flex items-start gap-3">
          <span className="h-10 w-10 shrink-0 rounded-2xl bg-white/70 flex items-center justify-center">
            <UserPlus className="h-5 w-5 text-[#5B2C06]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-bold text-[#5B2C06] leading-tight">
              {done ? t("referral.title_done") : t("referral.title")}
            </p>
            <p className="text-[13px] text-[#5B2C06]/80 leading-snug mt-1">
              {done ? t("referral.desc_done") : t("referral.desc", { count: REFERRAL_GOAL })}
            </p>
          </div>
          <button
            onClick={() => {
              haptics.light();
              try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* prywatne okno */ }
              setDismissed(true);
            }}
            aria-label={t("referral.dismiss_aria")}
            className="shrink-0 -mr-1 -mt-1 h-8 w-8 rounded-full flex items-center justify-center active:scale-90 transition-transform"
          >
            <X className="h-4 w-4 text-[#5B2C06]/60" />
          </button>
        </div>

        {/* Postep: tyle kropek, ile brakuje do progu - liczba jest mala, wiec kropki czyta sie
            szybciej niz pasek i od razu widac, ile jeszcze. */}
        <div className="flex items-center gap-2 mt-4">
          <div className="flex gap-1.5">
            {Array.from({ length: REFERRAL_GOAL }, (_, i) => (
              <span
                key={i}
                className={`h-2.5 w-2.5 rounded-full ${i < invited ? "bg-[#5B2C06]" : "bg-[#5B2C06]/20"}`}
              />
            ))}
          </div>
          <p className="text-[13px] font-bold text-[#5B2C06] tabular-nums">
            {t("referral.progress", { invited, goal: REFERRAL_GOAL })}
          </p>
        </div>

        <div className="flex items-center gap-2 mt-4">
          <button
            onClick={onShare}
            className="flex-1 h-11 rounded-2xl bg-primary text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Share2 className="h-4 w-4" />{t("referral.share_cta")}
          </button>
          <button
            onClick={() => { haptics.light(); setQrOpen(true); }}
            aria-label={t("referral.qr_aria")}
            className="shrink-0 h-11 w-11 rounded-2xl bg-white/70 flex items-center justify-center active:scale-90 transition-transform"
          >
            <QrCode className="h-5 w-5 text-[#5B2C06]" />
          </button>
        </div>
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
