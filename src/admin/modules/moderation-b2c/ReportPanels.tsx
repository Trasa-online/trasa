// Dwa panele kolejki: kwarantanna zdjec (auto-moderacja Vision) i zgloszenia tresci.
//
// Zdjecie ogladamy na powierzchni `--photo`, ktora w ciemnym trybie jest JASNIEJSZA
// niz reszta panelu - ocena ekspozycji nie moze zalezec od pory dnia.
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Check, X, ImageOff, Flag } from "lucide-react";
import { format } from "date-fns";
import { Card, Button, TextField, StatusBadge, FilterChips, Loading, Spinner, EmptyState } from "../../ui";
import {
  useModerationImages, useReviewImage, signQuarantine, type ModImage,
  useContentReports, useResolveReport, type ContentReport,
} from "./useReports";

const fmt = (d: string) => { try { return format(new Date(d), "dd.MM HH:mm"); } catch { return ""; } };
const ErrMsg = () => <p className="py-10 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać.</p>;

// ── KWARANTANNA ──────────────────────────────────────────────────────────────
export function QuarantinePanel() {
  const [reviewed, setReviewed] = useState(false);
  const { data, isLoading, isError } = useModerationImages(reviewed);

  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        chips={[{ id: "open", label: "Do sprawdzenia" }, { id: "done", label: "Sprawdzone" }]}
        value={reviewed ? "done" : "open"}
        onChange={(id) => setReviewed(id === "done")}
      />
      {isLoading ? <Loading /> : isError ? <ErrMsg /> : !data?.length ? (
        <Card>
          <EmptyState
            fact={reviewed ? "Nic jeszcze nie zostało sprawdzone." : "Żadne zdjęcie nie czeka na sprawdzenie."}
            next={reviewed
              ? "Wpisy trafią tu po decyzji w zakładce „Do sprawdzenia”."
              : "Auto-moderacja wrzuci tu zdjęcie, gdy Vision uzna je za ryzykowne."}
          />
        </Card>
      ) : data.map((m) => <QuarantineCard key={m.id} img={m} />)}
    </div>
  );
}

function QuarantineImg({ path }: { path: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!path);
  useEffect(() => {
    let ok = true;
    if (!path) { setLoading(false); return; }
    signQuarantine(path).then((u) => { if (ok) { setUrl(u); setLoading(false); } });
    return () => { ok = false; };
  }, [path]);

  const box = "flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]";
  if (loading) return <div className={box}><Spinner className="h-4 w-4" /></div>;
  if (!url) return <div className={box}><ImageOff className="h-5 w-5 text-[var(--stone)]" /></div>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={box}>
      <img src={url} alt="" className="h-full w-full object-cover" />
    </a>
  );
}

function scoreChips(scores: any): { k: string; v: string }[] {
  if (!scores || typeof scores !== "object") return [];
  return Object.entries(scores).map(([k, v]) => ({ k, v: String(v) }))
    .filter((s) => /likely|racy|adult|violence|1|true|high/i.test(s.v) || /adult|racy|violence/i.test(s.k))
    .slice(0, 4);
}

function QuarantineCard({ img }: { img: ModImage }) {
  const review = useReviewImage();
  const [note, setNote] = useState("");
  const done = (defaultNote: string) => review.mutate({ id: img.id, note: note.trim() || defaultNote }, {
    onSuccess: () => toast.success("Oznaczono jako sprawdzone"),
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });

  return (
    <Card>
      <div className="flex gap-3">
        <QuarantineImg path={img.quarantine_path} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge tone="bad"><ShieldAlert className="mr-1 h-3 w-3" />{img.verdict || "flagged"}</StatusBadge>
            {scoreChips(img.scores).map((s) => (
              <StatusBadge key={s.k} tone="neutral" mono>{s.k}: {s.v}</StatusBadge>
            ))}
          </div>
          <p className="mt-1.5 text-[12px] text-[var(--stone)]">
            {img.author ? `@${img.author}` : "nieznany autor"}
            {img.context ? ` · ${img.context}` : ""} · <span className="data">{fmt(img.created_at)}</span>
          </p>
          {img.reviewer_note ? <p className="mt-1 text-[12px] italic text-[var(--stone)]">„{img.reviewer_note}”</p> : null}
        </div>
      </div>

      {!img.reviewed_at ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextField
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Notatka do decyzji, np. fałszywy alarm, zdjęcie z basenu"
          />
          <div className="flex gap-2">
            <Button
              variant="danger" className="flex-1" disabled={review.isPending}
              icon={<Check className="h-4 w-4" />}
              onClick={() => done("potwierdzono - treść nieodpowiednia")}
            >
              Potwierdź usunięcie
            </Button>
            <Button
              className="flex-1" disabled={review.isPending}
              icon={<X className="h-4 w-4" />}
              onClick={() => done("fałszywy alarm")}
            >
              Fałszywy alarm
            </Button>
          </div>
        </div>
      ) : null}
    </Card>
  );
}

// ── ZGLOSZENIA TRESCI ────────────────────────────────────────────────────────
const TARGET_META: Record<string, string> = { route: "Wyjazd", collection: "Kolekcja", user: "Profil" };

export function ReportsPanel() {
  const [open, setOpen] = useState(true);
  const { data, isLoading, isError } = useContentReports(open);

  return (
    <div className="flex flex-col gap-3">
      <FilterChips
        chips={[{ id: "open", label: "Otwarte" }, { id: "done", label: "Rozpatrzone" }]}
        value={open ? "open" : "done"}
        onChange={(id) => setOpen(id === "open")}
      />
      {isLoading ? <Loading /> : isError ? <ErrMsg /> : !data?.length ? (
        <Card>
          <EmptyState
            fact={open ? "Nikt nic nie zgłosił." : "Żadne zgłoszenie nie zostało jeszcze rozpatrzone."}
            next={open
              ? "Zgłoszenia z aplikacji trafiają tu od razu, bez odświeżania strony."
              : "Rozpatrzone sprawy pojawią się tu po decyzji w zakładce „Otwarte”."}
          />
        </Card>
      ) : data.map((r) => <ReportCard key={r.id} report={r} />)}
    </div>
  );
}

function ReportCard({ report }: { report: ContentReport }) {
  const resolve = useResolveReport();
  const act = (status: "reviewed" | "dismissed") => resolve.mutate({ id: report.id, status }, {
    onSuccess: () => toast.success(status === "reviewed" ? "Zgłoszenie rozpatrzone" : "Zgłoszenie odrzucone"),
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });

  return (
    <Card>
      <div className="flex items-center gap-2">
        <StatusBadge tone="warn"><Flag className="mr-1 h-3 w-3" />{TARGET_META[report.target_type] ?? report.target_type}</StatusBadge>
        <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{report.targetLabel ?? report.target_id.slice(0, 8)}</p>
      </div>
      <p className="mt-1.5 text-[13px] text-[var(--graphite)]">
        <span className="font-semibold text-[var(--ink)]">{report.reason}</span>{report.note ? ` - ${report.note}` : ""}
      </p>
      <p className="mt-1 text-[12px] text-[var(--stone)]">
        zgłosił {report.reporter ? `@${report.reporter}` : "użytkownik"} · <span className="data">{fmt(report.created_at)}</span>
      </p>

      {report.status === "open" ? (
        <div className="mt-3 flex gap-2">
          <Button variant="primary" className="flex-1" disabled={resolve.isPending} icon={<Check className="h-4 w-4" />} onClick={() => act("reviewed")}>
            Rozpatrzone
          </Button>
          <Button className="flex-1" disabled={resolve.isPending} icon={<X className="h-4 w-4" />} onClick={() => act("dismissed")}>
            Odrzuć
          </Button>
        </div>
      ) : null}
    </Card>
  );
}
