import { Link } from "react-router-dom";
import { Loader2, ShieldCheck, ListChecks, Flag, Bug, ArrowRight, CheckCircle2 } from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { pl } from "date-fns/locale";
import { useAdmin } from "../../RequireAdmin";
import { useAdminPending, useAdminActivity, type ActivityItem } from "./useAdminHome";

// "Dzis" = strona startowa panelu: lista spraw do zrobienia (pending per typ) +
// feed najnowszych tresci UGC / zgloszen do przejrzenia. Odswiezanie co 60s.
export function TodayPage() {
  const { email } = useAdmin();
  const { data: pending } = useAdminPending();
  const { data: activity, isLoading } = useAdminActivity();

  const cards = [
    { key: "collections", label: "Listy do moderacji", to: "/zestawienia", icon: ListChecks, n: pending?.collections ?? 0 },
    { key: "business", label: "Wizytówki do moderacji", to: "/moderacja", icon: ShieldCheck, n: pending?.business ?? 0 },
    { key: "flags", label: "Zgłoszone miejsca", to: "/flagi", icon: Flag, n: pending?.flags ?? 0 },
    { key: "bugs", label: "Zgłoszenia błędów", to: "/ops", icon: Bug, n: pending?.bugs ?? 0 },
  ].filter((c) => c.n > 0);

  const hello = email?.split("@")[0] || "";

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-slate-900">Dziś{hello ? `, ${hello}` : ""}</h1>
        <p className="text-sm text-slate-500 mt-1">Sprawy czekające na Ciebie i najnowsze treści do przejrzenia.</p>
      </div>

      {/* Do zrobienia */}
      <section className="mb-8">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Do zrobienia</h2>
        {cards.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 flex items-center gap-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-500 shrink-0" />
            <div>
              <p className="text-sm font-bold text-slate-900">Wszystko ogarnięte</p>
              <p className="text-xs text-slate-500 mt-0.5">Nic nie czeka na moderację. Świeże treści zobaczysz niżej.</p>
            </div>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {cards.map((c) => {
              const Icon = c.icon;
              return (
                <Link key={c.key} to={c.to}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:border-slate-300 transition-colors">
                  <span className="h-10 w-10 rounded-[4px] bg-slate-900 text-white flex items-center justify-center shrink-0"><Icon className="h-5 w-5" /></span>
                  <div className="flex-1 min-w-0">
                    <p className="text-2xl font-black text-slate-900 leading-none">{c.n}</p>
                    <p className="text-xs text-slate-500 mt-1 truncate">{c.label}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-slate-600 transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Najnowsze do przejrzenia */}
      <section>
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Najnowsze do przejrzenia</h2>
        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
        ) : !activity || activity.length === 0 ? (
          <p className="text-sm text-slate-400 py-8 text-center">Brak nowych treści.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {activity.map((a) => <ActivityRow key={a.id} item={a} />)}
          </div>
        )}
      </section>
    </div>
  );
}

const KIND_META: Record<ActivityItem["kind"], { icon: any; tint: string }> = {
  list: { icon: ListChecks, tint: "text-indigo-500 bg-indigo-50" },
  flag: { icon: Flag, tint: "text-amber-500 bg-amber-50" },
  bug: { icon: Bug, tint: "text-rose-500 bg-rose-50" },
};

function ActivityRow({ item }: { item: ActivityItem }) {
  const { icon: Icon, tint } = KIND_META[item.kind];
  return (
    <Link to={item.to} className="flex items-center gap-3 p-3.5 hover:bg-slate-50 transition-colors">
      <span className={`h-9 w-9 rounded-[4px] flex items-center justify-center shrink-0 ${tint}`}><Icon className="h-4 w-4" /></span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
          {item.pending && <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-900 text-white">czeka</span>}
        </div>
        <p className="text-xs text-slate-500 truncate mt-0.5">{item.subtitle}</p>
      </div>
      <span className="text-[11px] text-slate-400 shrink-0">{relTime(item.date)}</span>
    </Link>
  );
}

function relTime(date: string | null): string {
  if (!date) return "";
  const d = new Date(date);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "wczoraj";
  return format(d, "d MMM", { locale: pl });
}
