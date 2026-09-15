// Leady = miejsca BEZ konta biznesowego, ktore userzy i tak dodaja do kolekcji i wyjazdow.
// To jest lista "komu zaproponowac wizytowke", posortowana po liczbie dodan.
import { useState } from "react";
import { Mail, Phone, Search } from "lucide-react";
import { adminPhotoUrl } from "../places/usePlaces";
import { AppShell, PageHeader, Section, Metric, DataTable, Bar, Thumb, StatusBadge, type Column } from "../../ui";
import { useLeadPlaces, type LeadPlace } from "./useLeadPlaces";
import { useLeadContacts, contactOf } from "./useLeadContacts";
import { LeadContactPanel } from "./LeadContactPanel";

export function LeadsPage() {
  const { data, isLoading, isError } = useLeadPlaces();
  const contacts = useLeadContacts();
  const [open, setOpen] = useState<LeadPlace | null>(null);
  const places = data?.places ?? [];
  const max = places[0]?.total ?? 1;

  // Ile leadow ma juz zdobyty kontakt - to jest miara postepu tej roboty, nie liczba wierszy.
  const withEmail = places.filter((p) => contactOf(contacts.data, p.place_name, p.city)?.email).length;

  const columns: Column<LeadPlace>[] = [
    {
      key: "name", label: "Miejsce", primary: true,
      render: (p) => (
        <div className="flex items-center gap-2.5">
          <Thumb url={adminPhotoUrl(p.photo_url, 200)} category={p.category} />
          <span className="truncate font-medium text-[var(--ink)]">{p.place_name}</span>
        </div>
      ),
    },
    {
      key: "where", label: "Miasto", secondary: true, width: 200,
      render: (p) => <span>{[p.city, p.category].filter(Boolean).join(" · ") || "-"}</span>,
    },
    {
      key: "kontakt", label: "Kontakt", width: 210,
      render: (p) => {
        const c = contactOf(contacts.data, p.place_name, p.city);
        if (c?.email) {
          return (
            <span className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 shrink-0 text-[var(--ok)]" />
              <span className="data truncate text-[12px]">{c.email}</span>
            </span>
          );
        }
        if (c?.phone) {
          return (
            <span className="flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 shrink-0 text-[var(--stone)]" />
              <span className="data truncate text-[12px]">{c.phone}</span>
            </span>
          );
        }
        if (c) return <StatusBadge tone="warn">bez kontaktu</StatusBadge>;
        return (
          <span className="flex items-center gap-1.5 text-[12px] text-[var(--stone)]">
            <Search className="h-3.5 w-3.5" />niesprawdzony
          </span>
        );
      },
    },
    { key: "lists", label: "W kolekcjach", width: 110, align: "right", render: (p) => <span className="data">{p.listCount}</span> },
    { key: "trips", label: "W wyjazdach", width: 110, align: "right", render: (p) => <span className="data">{p.tripCount}</span> },
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
          <Metric
            label="Ze zdobytym mailem"
            value={withEmail}
            hint={places.length ? `z ${places.length} leadów` : undefined}
            tone={withEmail > 0 ? "ok" : "neutral"}
          />
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
            onRowClick={(p) => setOpen(p)}
            empty={{
              fact: "Żadne miejsce bez konta nie zostało jeszcze dodane.",
              next: "Lista zapełni się, gdy użytkownicy zaczną dodawać miejsca do kolekcji i wyjazdów.",
            }}
          />
        )}
      </Section>

      {open ? (
        <LeadContactPanel
          lead={open}
          contact={contactOf(contacts.data, open.place_name, open.city)}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </AppShell>
  );
}
