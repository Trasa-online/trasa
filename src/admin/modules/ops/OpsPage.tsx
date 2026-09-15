// Zgloszenia bledow od userow i od lokali. Dwa niezalezne filtry: KTO zglosil
// i CZY sprawa jest zamknieta.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, RotateCcw, ImageIcon } from "lucide-react";
import { format } from "date-fns";
import { Card, Button, FilterChips, Loading, EmptyState } from "../../ui";
import { useBugReports, useResolveBug, type BugReport } from "./useOps";

// Zgloszenia biznesowe maja source='business'. Rekordy sprzed migracji poznajemy po
// prefiksie w opisie - inaczej wpadalyby do zakladki userow.
const isBusiness = (b: BugReport) => b.source === "business" || (b.source == null && !!b.description?.startsWith("[Panel biznesowy"));

export function OpsPage() {
  const { data, isLoading, isError } = useBugReports();
  const [source, setSource] = useState<"user" | "business">("user");
  const [tab, setTab] = useState<"open" | "resolved">("open");

  const bySource = useMemo(() => {
    const all = data ?? [];
    return { user: all.filter((b) => !isBusiness(b)), business: all.filter(isBusiness) };
  }, [data]);

  const list = bySource[source];
  const open = list.filter((b) => b.status !== "resolved");
  const resolved = list.filter((b) => b.status === "resolved");
  const shown = tab === "open" ? open : resolved;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChips
          chips={[
            { id: "user", label: "Od użytkowników", count: bySource.user.length },
            { id: "business", label: "Od lokali", count: bySource.business.length },
          ]}
          value={source}
          onChange={(id) => setSource(id as "user" | "business")}
        />
        <FilterChips
          chips={[{ id: "open", label: "Otwarte", count: open.length }, { id: "resolved", label: "Rozwiązane", count: resolved.length }]}
          value={tab}
          onChange={(id) => setTab(id as "open" | "resolved")}
        />
      </div>

      {isLoading ? <Loading /> : isError ? (
        <p className="py-10 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać zgłoszeń.</p>
      ) : !shown.length ? (
        <Card>
          <EmptyState
            fact={tab === "open"
              ? `Żadne otwarte zgłoszenie od ${source === "user" ? "użytkowników" : "lokali"}.`
              : "Nic nie zostało jeszcze zamknięte."}
            next={tab === "open"
              ? "Zgłoszenia z formularza w aplikacji trafiają tu od razu."
              : "Zamknięte sprawy pojawią się tu po decyzji w zakładce „Otwarte”."}
          />
        </Card>
      ) : shown.map((b) => <BugRow key={b.id} bug={b} />)}
    </div>
  );
}

function BugRow({ bug }: { bug: BugReport }) {
  const resolve = useResolveBug();
  const isResolved = bug.status === "resolved";
  const who = bug.reporter?.first_name || bug.reporter?.username || (bug.user_id ? "użytkownik" : "anonim");

  const toggle = () => resolve.mutate({ id: bug.id, status: isResolved ? "open" : "resolved" }, {
    onSuccess: () => toast.success(isResolved ? "Zgłoszenie znowu otwarte" : "Zgłoszenie zamknięte"),
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });

  return (
    <Card>
      <div className="flex gap-3">
        {bug.screenshot_url ? (
          <a href={bug.screenshot_url} target="_blank" rel="noreferrer" className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]">
            <img src={bug.screenshot_url} alt="" className="h-full w-full object-cover" />
          </a>
        ) : (
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[var(--r-control)] bg-[var(--photo)]">
            <ImageIcon className="h-5 w-5 text-[var(--stone)]" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="whitespace-pre-wrap text-[13px] leading-5 text-[var(--graphite)]">{bug.description}</p>
          <p className="mt-1.5 text-[12px] text-[var(--stone)]">
            {who} · <span className="data">{format(new Date(bug.created_at), "dd.MM.yyyy HH:mm")}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          variant={isResolved ? "ghost" : "primary"}
          disabled={resolve.isPending}
          onClick={toggle}
          icon={isResolved ? <RotateCcw className="h-3.5 w-3.5" /> : <Check className="h-4 w-4" />}
        >
          {isResolved ? "Otwórz ponownie" : "Rozwiązane"}
        </Button>
      </div>
    </Card>
  );
}
