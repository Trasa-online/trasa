import { useState } from "react";
import { ModerationQueue } from "./ModerationQueue";
import { AllBusinesses } from "./AllBusinesses";
import { useModerationQueue } from "./useModeration";

// Strona wizytowek: kolejka do akceptu + zarzadzanie wszystkimi.
export function ModerationPage() {
  const [tab, setTab] = useState<"queue" | "all">("queue");
  const queue = useModerationQueue();
  const pending = queue.data?.length ?? 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Moderacja B2B</h1>
        <p className="text-sm text-slate-500 mt-1">Wizytówki biznesowe: kolejka do akceptu i zarządzanie wszystkimi.</p>
      </div>

      <div className="flex gap-1.5 rounded-2xl bg-slate-100 p-1 mb-4">
        <button onClick={() => setTab("queue")}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-[4px] text-xs font-semibold transition-colors ${tab === "queue" ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
          Kolejka{pending > 0 && <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{pending}</span>}
        </button>
        <button onClick={() => setTab("all")}
          className={`flex-1 py-2 rounded-[4px] text-xs font-semibold transition-colors ${tab === "all" ? "bg-white text-slate-900" : "text-slate-500 hover:text-slate-800"}`}>
          Wszystkie wizytówki
        </button>
      </div>

      {tab === "queue" ? <ModerationQueue /> : <AllBusinesses />}
    </div>
  );
}
