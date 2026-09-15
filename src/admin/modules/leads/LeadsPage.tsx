// Leady = miejsca BEZ konta biznesowego, ktore userzy i tak dodaja do kolekcji i wyjazdow.
// To jest lista "komu zaproponowac wizytowke", posortowana po liczbie dodan.
import { MapPin } from "lucide-react";
import { adminPhotoUrl } from "../places/usePlaces";
import { AppShell, PageHeader, Section, Metric, DataTable, Bar, type Column } from "../../ui";
import { useLeadPlaces, type LeadPlace } from "./useLeadPlaces";

export function LeadsPage() {
  const { data, isLoading, isError } = useLeadPlaces();
  const places = data?.places ?? [];
  const max = places[0]?.total ?? 1;

  const columns: Column<LeadPlace>[] = [
    {
      key: "name", label: "Miejsce", primary: true,
      render: (p) => {
        const photo = adminPhotoUrl(p.photo_url, 200);
        return (
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]">
              {photo
                ? <img src={photo} alt="" loading="lazy" className="h-full w-full object-cover" />
                : <MapPin className="h-4 w-4 text-[var(--stone)]" />}
            </span>
            <span className="truncate font-medium text-[var(--ink)]">{p.place_name}</span>
          </div>
        );
      },
    },
    {
      key: "where", label: "Miasto", secondary: true, width: 200,
      render: (p) => <span>{[p.city, p.category].filter(Boolean).join(" · ") || "-"}</span>,
    },
    { key: "lists", label: "W kolekcjach", width: 120, align: "right", render: (p) => <span className="data">{p.listCount}</span> },
    { key: "trips", label: "W wyjazdach", width: 120, align: "right", render: (p) => <span className="data">{p.tripCount}</span> },
    {
      key: "total", label: "Razem", width: 140, align: "right",
      render: (p) => (
        <div className="flex items-center justify-end gap-2">
          <Bar pct={Math.round((p.total / max) * 100)} className="hidden w-16 md:block" />
          <span className="data font-semibold text-[var(--ink)]">{p.total}</span>
        </div>
      ),
    },
  ];

  return (
    <AppShell>
      <PageHeader
        title="Leady"
        subtitle="Miejsca bez konta biznesowego, które użytkownicy sami dodają do kolekcji i wyjazdów."
      />

      <Section title="Skala">
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Metric label="Miejsca bez konta" value={data?.kpis.leadCount ?? "-"} />
          <Metric label="Dodania razem" value={data?.kpis.totalAdds ?? "-"} />
          <Metric label="W kolekcjach" value={data?.kpis.listAdds ?? "-"} />
          <Metric label="W wyjazdach" value={data?.kpis.tripAdds ?? "-"} hint={data?.kpis.topCity ? `Najwięcej leadów: ${data.kpis.topCity}` : undefined} />
        </div>
      </Section>

      <Section title="Ranking">
        {isError ? (
          <p className="py-12 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać leadów.</p>
        ) : (
          <DataTable
            columns={columns}
            rows={places}
            keyOf={(p) => p.key}
            loading={isLoading}
            empty={{
              fact: "Żadne miejsce bez konta nie zostało jeszcze dodane.",
              next: "Lista zapełni się, gdy użytkownicy zaczną dodawać miejsca do kolekcji i wyjazdów.",
            }}
          />
        )}
      </Section>
    </AppShell>
  );
}
