import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Gift, Share2, X } from "lucide-react";
import { toast } from "sonner";
import { useShare } from "@/hooks/useShare";
import { haptics } from "@/hooks/useHaptics";
import { track } from "@/lib/analytics";
import { REFERRAL_GOAL, fetchReferralStats, referralLink } from "@/lib/referral";

// Zapraszanie znajomych (2026-09-10). Zamiast paywalla - ekran zachety.
//
// Nic nie jest odciete. Pasek postepu jest OBIETNICA WCZESNIEJSZEGO DOSTEPU, a nie brama:
// przed premiera odcinanie funkcji odbiloby dokladnie tych ludzi, ktorych wlasnie zbieramy
// z TestFlight i waitlisty. Model danych (profiles.referred_by) jest gotowy pod twardszy
// prog, gdyby liczby o niego poprosily.
//
// Licznik pokazuje REJESTRACJE z linku, nie wyslane linki - stad bierze sie jego wiarygodnosc.
// Zamkniecie karty trzymamy w sessionStorage, NIE w localStorage (prosba Nat 2026-09-10):
// baner ma znikac na czas biezacego uzycia, a wracac przy kolejnym odpaleniu aplikacji.
// W natywce kazde uruchomienie to nowy WebView, wiec sessionStorage startuje pusty -
// dokladnie to zachowanie. localStorage schowalby go raz na zawsze.
const DISMISS_KEY = "spontaway_referral_card_dismissed";

export default function ReferralCard({ userId }: { userId: string }) {
  const { t } = useTranslation("profiles");
  const share = useShare();
  const [copied, setCopied] = useState(false);
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

  const onCopy = async () => {
    haptics.light();
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
      toast.success(t("referral.copied"));
    } catch {
      toast.error(t("referral.copy_failed"));
    }
  };

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#FDF184] to-[#FDCD84] p-5">
      <div className="flex items-start gap-3">
        <span className="h-10 w-10 shrink-0 rounded-2xl bg-white/70 flex items-center justify-center">
          <Gift className="h-5 w-5 text-[#5B2C06]" />
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
          onClick={onCopy}
          aria-label={t("referral.copy_aria")}
          className="shrink-0 h-11 w-11 rounded-2xl bg-white/70 flex items-center justify-center active:scale-90 transition-transform"
        >
          {copied ? <Check className="h-4 w-4 text-[#5B2C06]" /> : <Copy className="h-4 w-4 text-[#5B2C06]" />}
        </button>
      </div>

      {/* Kod pisany wielkimi literami, bez 0/O/1/I/L - da sie go podac przez telefon. */}
      <p className="mt-3 text-center text-[12px] text-[#5B2C06]/70">
        {t("referral.code_label")} <span className="font-bold tracking-[0.2em] text-[#5B2C06]">{code}</span>
      </p>
    </div>
  );
}
