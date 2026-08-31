import { Link } from "react-router-dom";
import { ListChecks, ShieldCheck, Flag, Bug, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAdminPending } from "../home/useAdminHome";

// Podsumowanie "Do zrobienia" (dawna zakladka Dzis): karty pending -> klik do wlasciwej
// zakladki. Renderowane na gorze B2C (domyslne wejscie panelu).
export function TodoOverview() {
  const { data: p } = useAdminPending();
  const cards = [
    { key: "collections", label: "Listy do moderacji", icon: ListChecks, n: p?.collections ?? 0, to: "/moderacja/b2c" },
    { key: "business", label: "Wizytówki do moderacji", icon: ShieldCheck, n: p?.business ?? 0, to: "/moderacja/b2b" },
    { key: "flags", label: "Zgłoszone miejsca", icon: Flag, n: p?.flags ?? 0, to: "/flagi" },
    { key: "bugs", label: "Zgłoszenia błędów", icon: Bug, n: p?.bugs ?? 0, to: "/ops" },
  ].filter((c) => c.n > 0);

  if (cards.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 mb-5 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
        <div>
          <p className="text-sm font-bold text-slate-900">Wszystko ogarnięte</p>
          <p className="text-xs text-slate-500 mt-0.5">Nic nie czeka na moderację.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid sm:grid-cols-2 gap-3 mb-5">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Link key={c.key} to={c.to}
            className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:border-slate-300 transition-colors">
            <span className="h-10 w-10 rounded-[4px] bg-slate-900 text-white flex items-center justify-center shrink-0"><Icon className="h-5 w-5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-black text-slate-900 leading-none">{c.n}</p>
              <p className="text-xs text-slate-500 mt-1 truncate">{c.label}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />
          </Link>
        );
      })}
    </div>
  );
}
