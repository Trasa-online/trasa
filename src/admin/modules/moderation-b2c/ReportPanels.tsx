import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldAlert, Check, X, ImageOff, User, Flag } from "lucide-react";
import { format } from "date-fns";
import {
  useModerationImages, useReviewImage, signQuarantine, type ModImage,
  useContentReports, useResolveReport, type ContentReport,
} from "./useReports";

// ── KWARANTANNA (auto-moderacja zdjec: Google Vision SafeSearch) ─────────────
export function QuarantinePanel() {
  const [reviewed, setReviewed] = useState(false);
  const { data, isLoading, isError } = useModerationImages(reviewed);
  return (
    <div>
      <Toggle value={reviewed} onChange={setReviewed} openLabel="Do sprawdzenia" doneLabel="Sprawdzone" n={data?.length} />
      {isLoading ? <Spin /> : isError ? <ErrMsg /> : (data?.length ?? 0) === 0
        ? <Empty text={reviewed ? "Brak sprawdzonych." : "Brak zdjęć w kwarantannie 🎉"} />
        : <div className="space-y-2">{data!.map((m) => <QuarantineCard key={m.id} img={m} />)}</div>}
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
  if (loading) return <div className="h-28 w-28 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><Loader2 className="h-4 w-4 animate-spin text-slate-300" /></div>;
  if (!url) return <div className="h-28 w-28 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><ImageOff className="h-5 w-5 text-slate-300" /></div>;
  return <a href={url} target="_blank" rel="noreferrer" className="h-28 w-28 rounded-xl overflow-hidden bg-slate-900 shrink-0"><img src={url} alt="" className="h-full w-full object-cover" /></a>;
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
    onError: (e: any) => toast.error(e.message || "Błąd"),
  });

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex gap-3">
        <QuarantineImg path={img.quarantine_path} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700"><ShieldAlert className="h-3 w-3" />{img.verdict || "flagged"}</span>
            {scoreChips(img.scores).map((s) => (
              <span key={s.k} className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">{s.k}: {s.v}</span>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {img.author ? <span className="inline-flex items-center gap-1"><User className="h-3 w-3 text-slate-400" />@{img.author}</span> : "nieznany autor"}
            {img.context ? ` · ${img.context}` : ""} · {fmt(img.created_at)}
          </p>
          {img.reviewer_note && <p className="text-xs text-slate-400 mt-1 italic">„{img.reviewer_note}"</p>}
        </div>
      </div>
      {!img.reviewed_at && (
        <div className="mt-3">
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notatka (opcjonalnie) - np. fałszywy alarm, zdjęcie z basenu…"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 mb-2" />
          <div className="flex gap-2">
            <button onClick={() => done("potwierdzono - treść nieodpowiednia")} disabled={review.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[4px] bg-slate-900 hover:bg-slate-800 text-white text-sm font-bold disabled:opacity-60"><Check className="h-4 w-4" />Potwierdź usunięcie</button>
            <button onClick={() => done("fałszywy alarm")} disabled={review.isPending}
              className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[4px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60"><X className="h-4 w-4" />Fałszywy alarm</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ZGLOSZENIA TRESCI (content_reports) ──────────────────────────────────────
const TARGET_META: Record<string, string> = { route: "Wyjazd", collection: "Lista", user: "Profil" };

export function ReportsPanel() {
  const [open, setOpen] = useState(true);
  const { data, isLoading, isError } = useContentReports(open);
  return (
    <div>
      <Toggle value={!open} onChange={(v) => setOpen(!v)} openLabel="Otwarte" doneLabel="Rozpatrzone" n={data?.length} />
      {isLoading ? <Spin /> : isError ? <ErrMsg /> : (data?.length ?? 0) === 0
        ? <Empty text={open ? "Brak zgłoszeń 🎉" : "Brak rozpatrzonych."} />
        : <div className="space-y-2">{data!.map((r) => <ReportCard key={r.id} report={r} />)}</div>}
    </div>
  );
}

function ReportCard({ report }: { report: ContentReport }) {
  const resolve = useResolveReport();
  const act = (status: "reviewed" | "dismissed") => resolve.mutate({ id: report.id, status }, {
    onSuccess: () => toast.success(status === "reviewed" ? "Rozpatrzone" : "Odrzucone"),
    onError: (e: any) => toast.error(e.message || "Błąd"),
  });
  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-700"><Flag className="h-3 w-3" />{TARGET_META[report.target_type] ?? report.target_type}</span>
            <p className="text-sm font-bold text-slate-900 truncate">{report.targetLabel ?? report.target_id.slice(0, 8)}</p>
          </div>
          <p className="text-sm text-slate-700 mt-1.5"><span className="font-semibold">{report.reason}</span>{report.note ? ` - ${report.note}` : ""}</p>
          <p className="text-xs text-slate-400 mt-1">zgłosił {report.reporter ? `@${report.reporter}` : "użytkownik"} · {fmt(report.created_at)}</p>
        </div>
      </div>
      {report.status === "open" && (
        <div className="flex gap-2 mt-3">
          <button onClick={() => act("reviewed")} disabled={resolve.isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[4px] bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-60"><Check className="h-4 w-4" />Rozpatrzone</button>
          <button onClick={() => act("dismissed")} disabled={resolve.isPending}
            className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-[4px] bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold disabled:opacity-60"><X className="h-4 w-4" />Odrzuć</button>
        </div>
      )}
    </div>
  );
}

// ── wspolne ──────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, openLabel, doneLabel, n }: { value: boolean; onChange: (v: boolean) => void; openLabel: string; doneLabel: string; n?: number }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex gap-1 bg-slate-100 rounded-full p-0.5">
        <button onClick={() => onChange(false)} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${!value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{openLabel}</button>
        <button onClick={() => onChange(true)} className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>{doneLabel}</button>
      </div>
      {typeof n === "number" && <span className="text-xs text-slate-400">{n}</span>}
    </div>
  );
}
const fmt = (d: string) => { try { return format(new Date(d), "dd.MM HH:mm"); } catch { return ""; } };
const Spin = () => <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;
const ErrMsg = () => <p className="text-sm text-red-500 py-10 text-center">Nie udało się wczytać.</p>;
const Empty = ({ text }: { text: string }) => <p className="text-sm text-slate-400 py-10 text-center">{text}</p>;
