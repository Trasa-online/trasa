// Strona glowna panelu. Do 15.09.2026 modul `home` mial dane, ale NIE mial ekranu,
// a `useAdminActivity()` byl napisany i nigdzie nieuzywany.
//
// Zasada: kazda karta prowadzi do KOLEJKI Z FILTREM, nigdy do strony, na ktorej user stoi.
import { Link } from "react-router-dom";
import { AppShell, PageHeader, Loading, EmptyState, StatusBadge } from "../../ui";
import { useAdminPending, useAdminActivity } from "./useAdminHome";

const CARDS: { id: string; label: string; key: "quarantine" | "reports" | "collections" | "business" | "flags" | "bugs" }[] = [
  { id: "zdjecia", label: "Zdjęcia", key: "quarantine" },
  { id: "zgloszenia", label: "Zgłoszenia", key: "reports" },
  { id: "kolekcje", label: "Kolekcje", key: "collections" },
  { id: "wizytowki", label: "Wizytówki", key: "business" },
  { id: "flagi", label: "Flagi", key: "flags" },
  { id: "bledy", label: "Błędy", key: "bugs" },
];

export function HomePage() {
  const pending = useAdminPending();
  const activity = useAdminActivity();
  const today = new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <AppShell>
      <PageHeader title="Dziś" subtitle={`${today[0].toUpperCase()}${today.slice(1)}. Stan kolejki odświeża się co minutę.`} />

      <section>
        <p className="pb-2 text-[10px] font-semibold uppercase tracking-[0.8px] text-[var(--stone)]">Czeka na decyzję</p>
        {pending.isLoading ? <Loading /> : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
            {CARDS.map((c) => (
              <Link
                key={c.id}
                to={`/kolejka?typ=${c.id}`}
                className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] p-4 transition-colors hover:border-[var(--accent)]"
              >
                <p className="text-[12px] text-[var(--stone)]">{c.label}</p>
                <p className="data mt-1 text-[30px] leading-9 text-[var(--ink)]">{pending.data?.[c.key] ?? 0}</p>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] px-5">
        <div className="flex items-center justify-between py-4">
          <h2 className="text-[16px] font-semibold text-[var(--ink)]">Ostatnio dodane</h2>
          <span className="data text-[11px] text-[var(--stone)]">useAdminActivity</span>
        </div>
        {activity.isLoading ? <Loading /> : !activity.data?.length ? (
          <EmptyState fact="Nic nowego nie przyszło." next="Wpisy pojawią się tu, gdy ktoś doda kolekcję, wizytówkę albo zgłosi miejsce." />
        ) : (
          <ul className="pb-3">
            {activity.data.map((it) => (
              <li key={it.id} className="flex items-center gap-3 border-b border-[var(--line)] py-3 last:border-0">
                <StatusBadge tone="neutral">{it.kind}</StatusBadge>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{it.title}</p>
                  {it.subtitle ? <p className="truncate text-[12px] text-[var(--stone)]">{it.subtitle}</p> : null}
                </div>
                {it.pending ? <StatusBadge tone="warn" mono>CZEKA</StatusBadge> : null}
                <span className="data shrink-0 text-[11px] text-[var(--stone)]">
                  {new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit" }).format(new Date(it.date))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
