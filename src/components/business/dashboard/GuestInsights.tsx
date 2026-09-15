// Prawa kolumna sekcji „Od gości": ile tresci przyszlo w tym miesiacu i JAKIE SLOWA
// wracaja w notatkach.
//
// Liczenie slow jest CELOWO proste i jawne: dzielimy notatki na slowa, wyrzucamy slowa
// funkcyjne i za krotkie, zliczamy. To nie jest analiza sentymentu i nie udaje jej -
// ma pokazac lokalowi, ze goscie pisza „flat white" i „ogródek", a nie ze „sa zadowoleni".
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BizCard, BizCardTitle } from "./BizCard";

// i18n-ignore-start: ponizej SLOWA FUNKCYJNE - to dane jezykowe, nie copy interfejsu.
// Polskie i angielskie slowa funkcyjne + slowa, ktore w kazdej notatce znacza to samo.
const STOP = new Set([
  "i","oraz","albo","lub","ale","ten","ta","to","te","tego","tej","tym","tych","jest","sa","są","byl","była","było",
  "sie","się","nie","tak","jak","juz","już","bardzo","takze","także","tylko","jeszcze","gdzie","kiedy","ktora","która",
  "ktory","który","ktore","które","dla","przy","pod","nad","przez","bez","oraz","czy","co","na","w","we","z","ze","do",
  "od","po","za","o","u","a","the","and","for","with","was","were","this","that","very","just","they","have","from",
  "miejsce","lokal","polecam","super","fajnie","fajne","dobre","dobra","dobry",
]);
// i18n-ignore-end

export interface GuestInsightsProps {
  noteCount: number;
  photoCount: number;
  savesCount?: number;
  notes: string[];
}

export function GuestInsights({ noteCount, photoCount, savesCount, notes }: GuestInsightsProps) {
  const { t } = useTranslation("bizdash");

  const words = useMemo(() => {
    const freq = new Map<string, number>();
    for (const note of notes) {
      const seen = new Set<string>(); // slowo liczy sie RAZ na notatke, zeby jedna rozpisana
      for (const raw of String(note ?? "").toLowerCase().split(/[^a-ząćęłńóśźż]+/i)) {
        const w = raw.trim();
        if (w.length < 4 || STOP.has(w) || seen.has(w)) continue;
        seen.add(w);
        freq.set(w, (freq.get(w) ?? 0) + 1);
      }
    }
    return [...freq.entries()]
      .filter(([, n]) => n >= 2) // jedno wystapienie to nie „wraca"
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [notes]);

  return (
    <div className="flex flex-col gap-4">
      <BizCard>
        <BizCardTitle title={t("community.stats_title")} />
        <dl className="flex flex-col gap-2">
          <Row value={noteCount} label={t("community.stats_notes")} />
          <Row value={photoCount} label={t("community.stats_photos")} />
          {typeof savesCount === "number" ? <Row value={savesCount} label={t("community.stats_saves")} /> : null}
        </dl>
      </BizCard>

      {words.length ? (
        <BizCard className="bg-[#FDF184]/40">
          <BizCardTitle title={t("community.words_title")} />
          <div className="flex flex-wrap gap-2">
            {words.map(([word, n]) => (
              <span key={word} className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-slate-800">
                {word}
                <span className="text-[11px] font-bold text-primary">{n}</span>
              </span>
            ))}
          </div>
        </BizCard>
      ) : null}
    </div>
  );
}

function Row({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="sr-only">{label}</dt>
      <dd className="text-[26px] font-black leading-none text-primary">{value}</dd>
      <span className="text-[13px] text-slate-600">{label}</span>
    </div>
  );
}
