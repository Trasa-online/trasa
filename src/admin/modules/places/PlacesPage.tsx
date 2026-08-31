import { useState } from "react";
import { Loader2, Search, MapPin, Eye, Route as RouteIcon, ExternalLink, Phone, X } from "lucide-react";
import { usePlaces, useCities, usePlaceAnalytics, adminPhotoUrl, type PlaceRow } from "./usePlaces";

const RANGES = [7, 30, 90];

export function PlacesPage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState<PlaceRow | null>(null);
  const [range, setRange] = useState(30);
  const places = usePlaces(search, city);
  const cities = useCities();

  return (
    <div className="max-w-3xl">
      <div className="mb-5">
        <h1 className="text-2xl font-black text-slate-900">Miejsca</h1>
        <p className="text-sm text-slate-500 mt-1">Wszystkie lokale w bazie. Kliknij, żeby zobaczyć ruch (wyświetlenia, dodania, kliki).</p>
      </div>

      <div className="flex gap-2 mb-4">
        <div className="flex-1 flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 h-10">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Szukaj miejsca…" className="flex-1 bg-transparent text-sm outline-none text-slate-900" />
        </div>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="bg-white border border-slate-200 rounded-xl px-3 h-10 text-sm text-slate-700">
          <option value="">Wszystkie miasta</option>
          {(cities.data ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {places.isLoading ? <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
        : (places.data?.length ?? 0) === 0 ? <p className="text-sm text-slate-400 py-12 text-center">Brak miejsc dla tego filtra.</p>
        : (
          <div className="space-y-2">
            {places.data!.map((p) => {
              const img = adminPhotoUrl(p.photo_url);
              return (
                <button key={p.id} onClick={() => setSelected(p)} className="w-full flex items-center gap-3 bg-white border border-slate-100 rounded-[4px] p-2.5 text-left hover:border-slate-300 transition-colors">
                  <div className="h-12 w-12 rounded-xl bg-slate-100 overflow-hidden shrink-0">
                    {img ? <img src={img} alt="" className="h-full w-full object-cover" /> : <MapPin className="h-5 w-5 text-slate-300 m-auto mt-3.5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{p.place_name}</p>
                    <p className="text-xs text-slate-500">{p.city} · {p.category}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${p.claimed ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500"}`}>
                    {p.claimed ? "wizytówka" : "stan zero"}
                  </span>
                </button>
              );
            })}
            {places.data!.length === 60 && <p className="text-center text-xs text-slate-400 py-2">Pokazano pierwsze 60 - zawęź wyszukiwaniem.</p>}
          </div>
        )}

      {selected && <PlaceModal place={selected} range={range} setRange={setRange} onClose={() => setSelected(null)} />}
    </div>
  );
}

function PlaceModal({ place, range, setRange, onClose }: { place: PlaceRow; range: number; setRange: (n: number) => void; onClose: () => void }) {
  const { data, isLoading } = usePlaceAnalytics(place.id, range);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-lg max-h-[92dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-900 truncate">{place.place_name}</h3>
            <p className="text-xs text-slate-500">{place.city} · {place.category}{place.claimed ? " · wizytówka" : " · stan zero"}</p>
          </div>
          <div className="flex gap-1 bg-slate-100 rounded-full p-0.5">
            {RANGES.map((d) => (
              <button key={d} onClick={() => setRange(d)} className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold ${range === d ? "bg-slate-900 text-white" : "text-slate-500"}`}>{d}d</button>
            ))}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-[4px] hover:bg-slate-100 shrink-0"><X className="h-4 w-4 text-slate-500" /></button>
        </div>
        <div className="p-5">
          {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div> : (
            <div className="grid grid-cols-2 gap-3">
              <Kpi icon={Eye} label="Wyświetlenia" value={data?.views ?? 0} />
              <Kpi icon={RouteIcon} label="Dodania do trasy" value={data?.onRoutes ?? 0} />
              <Kpi icon={ExternalLink} label="Kliki strona" value={data?.websiteClicks ?? 0} />
              <Kpi icon={Phone} label="Kliki telefon" value={data?.phoneClicks ?? 0} />
            </div>
          )}
          {!isLoading && (data?.views ?? 0) === 0 && (
            <p className="text-center text-sm text-slate-400 py-6">Brak ruchu w tym okresie (stan zero). Dane pojawią się gdy miejsce zacznie być oglądane.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-1.5 text-slate-400 mb-1"><Icon className="h-3.5 w-3.5" /><span className="text-[11px] font-medium">{label}</span></div>
      <div className="text-2xl font-black text-slate-900">{value}</div>
    </div>
  );
}
