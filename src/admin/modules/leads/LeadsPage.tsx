import { Loader2, TrendingUp, ListChecks, Route as RouteIcon, MapPin } from "lucide-react";
import { resolveStored } from "@/components/PlacePhoto";
import { useLeadPlaces, type LeadPlace } from "./useLeadPlaces";

// Leady = miejsca bez konta biznesowego, najczesciej dodawane do list/wyjazdow userow.
// Sygnal sprzedazowy: komu warto zaproponowac wizytowke. + liczbowa analityka na gorze.
export function LeadsPage() {
  const { data, isLoading, isError } = useLeadPlaces();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Leady</h1>
        <p className="text-sm text-slate-500 mt-1">Miejsca bez konta biznesowego, najczęściej dodawane do list i wyjazdów - potencjalni klienci.</p>
      </div>

      {/* Analityka liczbowa */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Kpi icon={TrendingUp} label="Lead-miejsca" value={data?.kpis.leadCount} />
        <Kpi icon={MapPin} label="Suma dodań" value={data?.kpis.totalAdds} />
        <Kpi icon={ListChecks} label="W listach" value={data?.kpis.listAdds} />
        <Kpi icon={RouteIcon} label="W wyjazdach" value={data?.kpis.tripAdds} />
      </div>
      {data?.kpis.topCity && <p className="text-xs text-slate-400 -mt-2 mb-4">Najwięcej leadów: <span className="font-semibold text-slate-600">{data.kpis.topCity}</span></p>}

      {isLoading ? <Spin /> : isError ? <ErrMsg /> : (data?.places.length ?? 0) === 0
        ? <Empty text="Brak leadów - żadne miejsce bez konta nie zostało dodane." />
        : (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-50">
            {data!.places.map((p, i) => <LeadRow key={p.key} lead={p} rank={i + 1} max={data!.places[0].total} />)}
          </div>
        )}
    </div>
  );
}

function LeadRow({ lead, rank, max }: { lead: LeadPlace; rank: number; max: number }) {
  const photo = lead.photo_url ? resolveStored(lead.photo_url) : null;
  return (
    <div className="flex items-center gap-3 p-3.5">
      <span className="w-6 text-center text-sm font-black text-slate-300 shrink-0">{rank}</span>
      <div className="h-12 w-12 rounded-xl bg-slate-100 overflow-hidden shrink-0">
        {photo ? <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" /> : <MapPin className="h-4 w-4 text-slate-300 m-auto mt-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-slate-900 truncate">{lead.place_name}</p>
        <div className="flex flex-wrap items-center gap-x-2.5 text-xs text-slate-500 mt-0.5">
          {lead.city && <span>{lead.city}</span>}
          {lead.category && <span>{lead.category}</span>}
          <span className="text-slate-400">{lead.listCount} list · {lead.tripCount} wyj.</span>
        </div>
        {/* mini-bar udzialu */}
        <div className="h-1.5 mt-1.5 rounded-full bg-slate-100 overflow-hidden max-w-[220px]">
          <div className="h-full bg-slate-900" style={{ width: `${Math.max(6, Math.round((lead.total / max) * 100))}%` }} />
        </div>
      </div>
      <span className="shrink-0 inline-flex items-center justify-center min-w-[2rem] h-8 px-2 rounded-[4px] bg-slate-900 text-white text-sm font-black">{lead.total}</span>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value?: number }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-3.5">
      <Icon className="h-4 w-4 text-slate-400 mb-1.5" />
      <p className="text-2xl font-black text-slate-900 leading-none">{value ?? "-"}</p>
      <p className="text-[11px] text-slate-500 mt-1">{label}</p>
    </div>
  );
}

const Spin = () => <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>;
const ErrMsg = () => <p className="text-sm text-red-500 py-12 text-center">Nie udało się wczytać.</p>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-400 py-12 text-center">{text}</p>;
