import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { QrCode, Share2, UserPlus } from "lucide-react";
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
      {/* Karta jak "Get credits" w FYI (prosba Nat 2026-09-11): SAM szary obrys (kreskowany),
          ostre krawedzie, mala pomaranczowa ikona nad naglowkiem, pelnej szerokosci guzik
          primary z kodem QR obok i "Nie teraz" pod spodem. Wczesniej: plaska zolta karta.
          Ostre rogi sa tu SWIADOMYM wyjatkiem od zaokraglen z CLAUDE.md - karta ma wygladac
          jak wsuwka/kupon, nie jak kolejny kafelek tresci. */}
      <div className="mb-5 border border-dashed border-border px-4 pt-4 pb-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <UserPlus className="h-4 w-4 text-primary" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
              {done ? t("referral.eyebrow_done") : t("referral.eyebrow")}
            </p>
            <p className="mt-0.5 text-[16px] font-bold leading-snug text-foreground">
              {done ? t("referral.title_done") : t("referral.desc", { count: REFERRAL_GOAL })}
            </p>
            {!done && (
              <p className="mt-1.5 flex items-center gap-2 text-[12.5px] text-muted-foreground tabular-nums">
                <span className="flex gap-1">
                  {Array.from({ length: REFERRAL_GOAL }, (_, i) => (
                    <span key={i} className={`h-2 w-2 rounded-full ${i < invited ? "bg-primary" : "bg-border"}`} />
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
            className="flex-1 h-11 bg-primary text-white font-bold text-[13px] uppercase tracking-wide flex items-center justify-center gap-2 active:scale-[0.98] transition-transform"
          >
            <Share2 className="h-4 w-4" />{t("referral.share_cta")}
          </button>
          <button
            onClick={() => { haptics.light(); setQrOpen(true); }}
            aria-label={t("referral.qr_aria")}
            className="shrink-0 h-11 w-11 border border-border bg-background flex items-center justify-center active:scale-90 transition-transform"
          >
            <QrCode className="h-5 w-5 text-foreground" />
          </button>
        </div>
        <button
          onClick={() => {
            haptics.light();
            try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* prywatne okno */ }
            setDismissed(true);
          }}
          className="mt-1 w-full py-2 text-center text-[13px] font-medium text-muted-foreground active:text-foreground transition-colors"
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
