import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

// Podglad zapisow na powiadomienie o premierze - licznik w gornym pasku, a po kliknieciu
// lista ostatnich adresow. Zrodlo: RPC `admin_waitlist_peek` (SECURITY DEFINER, rola 'admin').
// Licznik pokazuje OCZEKUJACYCH, czyli zapisanych BEZ konta - patrz komentarz przy useQuery.
//
// Skad sie biora te wpisy: modal "Premiera juz wkrotce" na spontaway.com. Kazde CTA na
// landingu go otwiera, bo apki nie da sie jeszcze pobrac - to jedyne miejsce, w ktorym
// mierzymy realne zainteresowanie przed startem. Zapisy z landingu maja source
// "landing_modal"; starsze, z nieistniejacej juz strony zapisow, maja inne zrodlo.
//
// Dwie pulapki mobilne, naprawione 2026-09-04:
// 1. POJEDYNCZE tapniecie nie dzialalo. Panel otwieral sie na `onMouseEnter`, a Safari
//    syntezuje `mouseenter` TUZ PRZED `click` - wiec dotyk otwieral panel, po czym `click`
//    natychmiast go zamykal. Stad hover tylko dla myszy (`pointerType === "mouse"`),
//    a zamykanie przez klik poza panelem / Escape, bo na dotyku nie ma `mouseleave`.
// 2. Panel wychodzil POZA LEWA krawedz ekranu. Byl kotwiczony `absolute right-0` do guzika,
//    ktory na waskim ekranie stoi blisko srodka, wiec 300 px szerokosci nie miescilo sie
//    w lewo. Na mobile panel jest wiec `fixed` i przyklejony do prawej krawedzi z szerokoscia
//    ograniczona do widoku; od `sm` wraca kotwiczenie pod guzikiem.

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
  const wrapRef = useRef<HTMLDivElement>(null);

  // Zrodlo: RPC `admin_waitlist_peek` (SECURITY DEFINER, bramka na roli 'admin').
  // Czytanie `waitlist` wprost pokazywalo WSZYSTKIE wiersze - takze osoby, ktore
  // juz zalozyly konto (7 z 24 na dzien 2026-09-11). "Ile osob czeka" to inna liczba
  // niz "ile wpisow jest w tabeli", a rozroznic je da sie tylko po auth.users, do
  // ktorego klient nie siega. Konwersje pokazujemy osobno, na dole panelu.
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["admin-waitlist-peek"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_waitlist_peek", { p_limit: 25 });
      if (error) throw error;
      return {
        count: Number(data?.waiting ?? 0),
        converted: Number(data?.converted ?? 0),
        rows: (data?.rows ?? []) as Row[],
      };
    },
    // Licznik ma byc AKTUALNY - to jedyny zywy sygnal zainteresowania przed premiera
    // (zgloszenie Nat 2026-09-11). Panel ops chodzi na desktopie, wiec minutowy poll
    // + odswiezenie po powrocie do karty nic nie kosztuje.
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const count = data?.count ?? 0;
  const converted = data?.converted ?? 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      ref={wrapRef}
      className="relative"
      onPointerEnter={(e) => {
        if (e.pointerType === "mouse") setOpen(true);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") setOpen(false);
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 transition-colors hover:bg-slate-50"
        title="Zapisy na powiadomienie o premierze"
      >
        <Mail className={`h-3.5 w-3.5 ${isFetching ? "text-blue-500" : "text-slate-400"} transition-colors`} />
        <span>{isLoading ? "..." : count}</span>
        <span className="hidden sm:inline font-semibold text-slate-400">czeka na premierę</span>
      </button>

      {open && (
        <div className="fixed right-3 top-[3.75rem] z-50 w-[min(320px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-[300px]">
          <div className="flex items-baseline justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-xs font-bold text-slate-700">Czekają na premierę</span>
            <span className="text-[11px] text-slate-400">{count} bez konta</span>
          </div>

          {data?.rows.length ? (
            <ul className="max-h-[min(60vh,320px)] divide-y divide-slate-50 overflow-y-auto">
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
              {isLoading ? "Wczytuję..." : "Nikt nie czeka - wszyscy zapisani mają już konto."}
            </p>
          )}

          {(count > 25 || converted > 0) && (
            <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-400">
              {count > 25 ? `Pokazuję 25 najnowszych z ${count}. ` : ""}
              {converted > 0 ? `${converted} z listy ma już konto (nie pokazuję).` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
