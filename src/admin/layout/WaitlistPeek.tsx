import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Podglad zapisow na powiadomienie o premierze - licznik w gornym pasku, a po najechaniu
// lista ostatnich adresow. Zrodlo: tabela `waitlist` (RLS: odczyt tylko dla adminow).
//
// Skad sie biora te wpisy: modal "Premiera juz wkrotce" na spontaway.com. Kazde CTA na
// landingu go otwiera, bo apki nie da sie jeszcze pobrac - to jedyne miejsce, w ktorym
// mierzymy realne zainteresowanie przed startem. Zapisy z landingu maja source
// "landing_modal"; starsze, z nieistniejacej juz strony zapisow, maja inne zrodlo.

type Row = { email: string; created_at: string; source: string | null };

const SOURCE_LABEL: Record<string, string> = {
  landing_modal: "landing",
  waitlist_page: "stara strona",
};

function whenLabel(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "przed chwilą";
  if (mins < 60) return `${mins} min temu`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} godz. temu`;
  return new Date(iso).toLocaleDateString("pl-PL", { day: "numeric", month: "short" });
}

export function WaitlistPeek() {
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-waitlist-peek"],
    queryFn: async () => {
      // Licznik osobno, zeby nie ciagnac calej tabeli tylko po to, zeby ja policzyc.
      const [{ count }, { data: rows }] = await Promise.all([
        (supabase as any).from("waitlist").select("email", { count: "exact", head: true }),
        (supabase as any).from("waitlist").select("email, created_at, source").order("created_at", { ascending: false }).limit(25),
      ]);
      return { count: (count ?? 0) as number, rows: (rows ?? []) as Row[] };
    },
    staleTime: 60_000,
  });

  const count = data?.count ?? 0;

  return (
    <div className="relative" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
        title="Zapisy na powiadomienie o premierze"
      >
        <Mail className="h-3.5 w-3.5 text-slate-400" />
        <span>{isLoading ? "..." : count}</span>
        <span className="hidden sm:inline font-semibold text-slate-400">na premierę</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[300px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10">
          <div className="flex items-baseline justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-bold text-slate-700">Zapisy na premierę</span>
            <span className="text-[11px] text-slate-400">{count} łącznie</span>
          </div>

          {data?.rows.length ? (
            <ul className="max-h-[320px] divide-y divide-slate-50 overflow-y-auto">
              {data.rows.map((r) => (
                <li key={`${r.email}-${r.created_at}`} className="px-3 py-2">
                  <p className="truncate text-[12px] font-medium text-slate-800" title={r.email}>{r.email}</p>
                  <p className="text-[11px] text-slate-400">
                    {whenLabel(r.created_at)}
                    {r.source ? ` · ${SOURCE_LABEL[r.source] ?? r.source}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-3 py-4 text-center text-[12px] text-slate-400">
              {isLoading ? "Wczytuję..." : "Jeszcze nikt się nie zapisał."}
            </p>
          )}

          {count > 25 && (
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              Pokazuję 25 najnowszych z {count}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
