// Wizytowki czekajace na akcept. Cel: decyzja w 24 h, wiec czas oczekiwania stoi
// przy kazdej sprawie, a po przekroczeniu doby robi sie czerwony - nie szary.
import { useState } from "react";
import { toast } from "sonner";
import { Check, X, MapPin, Phone, Mail } from "lucide-react";
import { Card, Button, TextArea, StatusBadge, Loading, EmptyState, type Tone } from "../../ui";
import { useModerationQueue, useModerate, completeness, type QueueItem, type Completeness } from "./useModeration";

const COMPLETENESS_META: Record<Completeness, { label: string; tone: Tone }> = {
  not_started: { label: "Pusta", tone: "bad" },
  in_progress: { label: "W trakcie", tone: "warn" },
  ready: { label: "Gotowa", tone: "ok" },
};

export function ModerationQueue() {
  const { data, isLoading, isError } = useModerationQueue();

  if (isLoading) return <Loading />;
  if (isError) return <p className="py-12 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać kolejki.</p>;
  if (!data?.length) {
    return (
      <Card>
        <EmptyState
          fact="Żadna wizytówka nie czeka na decyzję."
          next="Nowe zgłoszenia lokali pojawią się tu same, licznik w nawigacji odświeża się co minutę."
        />
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-[12px] text-[var(--stone)]">
        Najdłużej czekające na&nbsp;górze. Cel: decyzja w&nbsp;24&nbsp;h.
      </p>
      {data.map((item) => <QueueCard key={item.id} item={item} />)}
    </div>
  );
}

function QueueCard({ item }: { item: QueueItem }) {
  const moderate = useModerate();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const busy = moderate.isPending;

  const sla = waitingLabel(item.review_requested_at ?? item.created_at);
  const comp = COMPLETENESS_META[completeness(item)];
  const img = item.cover_image_url || item.logo_url;

  const approve = () => moderate.mutate({ profileId: item.id, action: "approve" }, {
    onSuccess: () => toast.success(`Zaakceptowano: ${item.business_name || "wizytówka"}`),
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });
  const doReject = () => moderate.mutate({ profileId: item.id, action: "reject", reason: reason.trim() }, {
    onSuccess: () => { toast.success("Wizytówka odrzucona"); setRejecting(false); setReason(""); },
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });

  return (
    <Card>
      <div className="flex gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]">
          {img
            ? <img src={img} alt="" className="h-full w-full object-cover" />
            : <span className="text-[11px] text-[var(--stone)]">brak</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[14px] font-semibold text-[var(--ink)]">{item.business_name || "Wizytówka bez nazwy"}</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <StatusBadge tone={comp.tone}>{comp.label}</StatusBadge>
              <StatusBadge tone={sla.over ? "bad" : "neutral"} mono>{sla.text}</StatusBadge>
            </div>
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-[var(--stone)]">
            {item.main_category ? <span>{item.main_category}</span> : null}
            {item.city ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.city}</span> : null}
            {item.phone ? <span className="data inline-flex items-center gap-1"><Phone className="h-3 w-3" />{item.phone}</span> : null}
            {item.email ? <span className="inline-flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{item.email}</span> : null}
          </div>
          {item.description ? <p className="mt-2 line-clamp-2 text-[12px] text-[var(--graphite)]">{item.description}</p> : null}
        </div>
      </div>

      {rejecting ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextArea
            value={reason} onChange={(e) => setReason(e.target.value)} rows={2} autoFocus
            placeholder="Powód odrzucenia (zostaje w dzienniku audytu)"
          />
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" disabled={busy || !reason.trim()} onClick={doReject}>
              {busy ? "…" : "Potwierdź odrzucenie"}
            </Button>
            <Button disabled={busy} onClick={() => { setRejecting(false); setReason(""); }}>Anuluj</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button variant="primary" className="flex-1" disabled={busy} icon={<Check className="h-4 w-4" />} onClick={approve}>
            Akceptuj
          </Button>
          <Button className="flex-1" disabled={busy} icon={<X className="h-4 w-4" />} onClick={() => setRejecting(true)}>
            Odrzuć
          </Button>
        </div>
      )}
    </Card>
  );
}

// Czas oczekiwania + flaga przekroczenia SLA (24 h).
function waitingLabel(since: string): { text: string; over: boolean } {
  const ms = Date.now() - new Date(since).getTime();
  const h = Math.floor(ms / 3_600_000);
  if (h < 1) return { text: `${Math.max(1, Math.floor(ms / 60_000))} min`, over: false };
  if (h < 48) return { text: `${h} h`, over: h >= 24 };
  return { text: `${Math.floor(h / 24)} dni`, over: true };
}
