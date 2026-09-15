// Miejsca w bazie. Wiersz prowadzi do panelu z ruchem (wyswietlenia, dodania, kliki).
import { useState } from "react";
import { MapPin } from "lucide-react";
import {
  AppShell, PageHeader, Toolbar, Select, DataTable, StatusBadge, Loading, EmptyState,
  FilterChips, Metric, Panel, type Column,
} from "../../ui";
import { usePlaces, useCities, usePlaceAnalytics, adminPhotoUrl, type PlaceRow } from "./usePlaces";

const RANGES = [
  { id: "7", label: "7 dni" },
  { id: "30", label: "30 dni" },
  { id: "90", label: "90 dni" },
];

export function PlacesPage() {
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [selected, setSelected] = useState<PlaceRow | null>(null);
  const [range, setRange] = useState("30");
  const places = usePlaces(search, city);
  const cities = useCities();

  const rows = places.data ?? [];

  const columns: Column<PlaceRow>[] = [
    {
      key: "name", label: "Miejsce", primary: true,
      render: (p) => {
        const img = adminPhotoUrl(p.photo_url);
        return (
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]">
              {img
                ? <img src={img} alt="" loading="lazy" className="h-full w-full object-cover" />
                : <MapPin className="h-4 w-4 text-[var(--stone)]" />}
            </span>
            <span className="truncate font-medium text-[var(--ink)]">{p.place_name}</span>
          </div>
        );
      },
    },
    { key: "city", label: "Miasto", secondary: true, width: 180, render: (p) => <span>{p.city ?? "-"}</span> },
    { key: "category", label: "Kategoria", width: 180, render: (p) => <span className="data text-[12px]">{p.category ?? "-"}</span> },
    {
      key: "claimed", label: "Wizytówka", width: 140, align: "right",
      render: (p) => p.claimed
        ? <StatusBadge tone="ok" mono>PRZEJĘTE</StatusBadge>
        : <StatusBadge tone="neutral" mono>STAN ZERO</StatusBadge>,
    },
  ];

  return (
    <AppShell>
      <PageHeader title="Miejsca" subtitle="Lokale w bazie. Wejdź w wiersz, żeby zobaczyć ruch miejsca." />

      <Toolbar
        search={search}
        onSearch={setSearch}
        placeholder="Szukaj miejsca"
        count={rows.length === 60 ? "60 z większej listy" : `${rows.length} miejsc`}
      >
        <Select label="Miasto" value={city} onChange={setCity} options={(cities.data ?? []).map((c) => ({ value: c, label: c }))} />
      </Toolbar>

      <DataTable
        columns={columns}
        rows={rows}
        keyOf={(p) => p.id}
        loading={places.isLoading}
        onRowClick={(p) => setSelected(p)}
        empty={{ fact: "Żadne miejsce nie pasuje do filtrów.", next: "Zmień miasto albo wyczyść szukanie." }}
      />

      {rows.length === 60 ? (
        <p className="text-center text-[12px] text-[var(--stone)]">
          Widać pierwsze 60 miejsc. Zawęź szukaniem albo miastem, żeby zobaczyć resztę.
        </p>
      ) : null}

      {selected ? (
        <PlaceTraffic place={selected} range={range} setRange={setRange} onClose={() => setSelected(null)} />
      ) : null}
    </AppShell>
  );
}

function PlaceTraffic({ place, range, setRange, onClose }: {
  place: PlaceRow; range: string; setRange: (v: string) => void; onClose: () => void;
}) {
  const { data, isLoading, isError } = usePlaceAnalytics(place.id, Number(range));
  const views = data?.views ?? 0;

  return (
    <Panel
      title={place.place_name}
      subtitle={`${place.city ?? "bez miasta"} · ${place.category ?? "bez kategorii"} · ${place.claimed ? "wizytówka przejęta" : "stan zero"}`}
      onClose={onClose}
    >
      <FilterChips chips={RANGES} value={range} onChange={setRange} className="mb-4" />

      {isLoading ? <Loading /> : isError ? (
        <EmptyState fact="Dane o ruchu nie przyszły." next="Spróbuj za chwilę - odpowiada ta sama funkcja, co analityka produktu." />
      ) : views === 0 ? (
        <EmptyState
          fact="W tym okresie nikt nie otworzył tego miejsca."
          next="Zmień zakres na 90 dni albo sprawdź, czy miejsce w ogóle pokazuje się w aplikacji."
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5">
          <Metric label="Wyświetlenia" value={views} />
          <Metric label="Dodania do wyjazdu" value={data?.onRoutes ?? 0} />
          <Metric label="Kliki w stronę" value={data?.websiteClicks ?? 0} />
          <Metric label="Kliki w telefon" value={data?.phoneClicks ?? 0} />
        </div>
      )}
    </Panel>
  );
}
