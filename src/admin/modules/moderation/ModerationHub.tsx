import { useState } from "react";
import { Link } from "react-router-dom";
import { ListChecks, ShieldCheck, Flag, Bug, ArrowRight, CheckCircle2 } from "lucide-react";
import { useAdminPending } from "../home/useAdminHome";
import { ModerationB2CPage } from "../moderation-b2c/ModerationB2CPage";
import { ModerationPage } from "./ModerationPage";

// Zakladka "Moderacja" = hub: podsumowanie "Do zrobienia" (z dawnej zakladki Dzis) +
// pod-zakladki B2C (tresci userow) | B2B (wizytowki biznesowe).
export function ModerationHub() {
  const [tab, setTab] = useState<"b2c" | "b2b">("b2c");
  const { data: p } = useAdminPending();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Moderacja</h1>
        <p className="text-sm text-slate-500 mt-1">Wszystko do zrobienia: treści użytkowników (B2C) i wizytówki biznesowe (B2B).</p>
      </div>

      <TodoOverview p={p} onB2C={() => setTab("b2c")} onB2B={() => setTab("b2b")} />

      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1 mb-4">
        <SubTab active={tab === "b2c"} onClick={() => setTab("b2c")} label="B2C" n={p?.collections ?? 0} />
        <SubTab active={tab === "b2b"} onClick={() => setTab("b2b")} label="B2B" n={p?.business ?? 0} />
      </div>

      {tab === "b2c" ? <ModerationB2CPage /> : <ModerationPage />}
    </div>
  );
}

function TodoOverview({ p, onB2C, onB2B }: { p?: { collections: number; business: number; flags: number; bugs: number }; onB2C: () => void; onB2B: () => void }) {
  const cards = [
    { key: "collections", label: "Listy do moderacji", icon: ListChecks, n: p?.collections ?? 0, onClick: onB2C },
    { key: "business", label: "Wizytówki do moderacji", icon: ShieldCheck, n: p?.business ?? 0, onClick: onB2B },
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
        const inner = (
          <>
            <span className="h-10 w-10 rounded-[4px] bg-slate-900 text-white flex items-center justify-center shrink-0"><Icon className="h-5 w-5" /></span>
            <div className="flex-1 min-w-0">
              <p className="text-2xl font-black text-slate-900 leading-none">{c.n}</p>
              <p className="text-xs text-slate-500 mt-1 truncate">{c.label}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-slate-300 shrink-0" />
          </>
        );
        const cls = "bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-3 hover:border-slate-300 transition-colors text-left w-full";
        return c.to
          ? <Link key={c.key} to={c.to} className={cls}>{inner}</Link>
          : <button key={c.key} type="button" onClick={c.onClick} className={cls}>{inner}</button>;
      })}
    </div>
  );
}

function SubTab({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button onClick={onClick} className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[4px] text-xs font-semibold transition-colors ${active ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
      {label}{n > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{n}</span>}
    </button>
  );
}
