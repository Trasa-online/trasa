// Strona glowna panelu. Do 15.09.2026 modul `home` mial dane, ale NIE mial ekranu,
// a `useAdminActivity()` byl napisany i nigdzie nieuzywany.
//
// Zasady:
// 1. Kazda karta licznika prowadzi do KOLEJKI Z FILTREM, nigdy do strony, na ktorej stoisz.
// 2. Wiersz w "Ostatnio dodane" otwiera PODGLAD tresci (kolekcja, wyjazd) - tak jak widzi
//    ja uzytkownik apki. Flaga i blad podgladu nie maja, wiec prowadza do kolejki.
import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { AppShell, PageHeader, Loading, EmptyState, StatusBadge } from "../../ui";
import { CollectionPreview } from "../preview/CollectionPreview";
import { TripPreview } from "../preview/TripPreview";
import { useAdminPending, useAdminActivity, ACTIVITY_LABEL, type ActivityItem } from "./useAdminHome";

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
  const [preview, setPreview] = useState<{ kind: "collection" | "trip"; id: string } | null>(null);
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
          <span className="text-[11px] text-[var(--stone)]">kolekcja albo wyjazd otwiera podgląd</span>
        </div>
        {activity.isLoading ? <Loading /> : !activity.data?.length ? (
          <EmptyState fact="Nic nowego nie przyszło." next="Wpisy pojawią się tu, gdy ktoś opublikuje kolekcję albo wyjazd, zgłosi miejsce lub błąd." />
        ) : (
          <ul className="pb-3">
            {activity.data.map((it) => (
              <ActivityRow key={it.id} item={it} onPreview={(kind, id) => setPreview({ kind, id })} />
            ))}
          </ul>
        )}
      </section>

      {preview?.kind === "collection" ? <CollectionPreview id={preview.id} onClose={() => setPreview(null)} /> : null}
      {preview?.kind === "trip" ? <TripPreview id={preview.id} onClose={() => setPreview(null)} /> : null}
    </AppShell>
  );
}

function ActivityRow({ item, onPreview }: {
  item: ActivityItem;
  onPreview: (kind: "collection" | "trip", id: string) => void;
}) {
  const previewable = item.previewId && (item.kind === "collection" || item.kind === "trip") ? item.kind : null;

  const body = (
    <>
      <StatusBadge tone="neutral">{ACTIVITY_LABEL[item.kind]}</StatusBadge>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{item.title}</p>
        {item.subtitle ? <p className="truncate text-[12px] text-[var(--stone)]">{item.subtitle}</p> : null}
      </div>
      {item.pending ? <StatusBadge tone="warn" mono>CZEKA</StatusBadge> : null}
      <span className="data shrink-0 text-[11px] text-[var(--stone)]">
        {item.date ? new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit" }).format(new Date(item.date)) : "-"}
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--stone)]" />
    </>
  );

  const cls = "flex w-full items-center gap-3 border-b border-[var(--line)] py-3 text-left last:border-0 hover:bg-[var(--canvas)]";

  return (
    <li>
      {previewable ? (
        <button type="button" onClick={() => onPreview(previewable, item.previewId!)} className={cls}>{body}</button>
      ) : (
        <Link to={item.to} className={cls}>{body}</Link>
      )}
    </li>
  );
}
