// Tresci od uzytkownikow w kolejce: KOLEKCJE (akcept/odrzuc) i WYJAZDY (ukryj/przywroc).
// Zgrupowane po autorze - jedna osoba, ktora wrzucila dziesiec rzeczy, to jedna decyzja
// operatorki, a nie dziesiec niezaleznych kart bez kontekstu.
//
// Klik w miniature otwiera moderacje pojedynczego zdjecia (ukryj / usun z audytem).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Check, X, Eye, EyeOff, ChevronDown, ImageOff } from "lucide-react";
import { avatarSrc } from "@/lib/avatar";
import { resolveStored } from "@/components/PlacePhoto";
import { Card, Button, TextArea, StatusBadge, Loading, Spinner, EmptyState, type Tone } from "../../ui";
import {
  useRankings, useModerateRanking, useToggleHidden, fetchCollectionItems, type RankingCol,
} from "../rankings/useRankings";
import { useTrips, useToggleTripHidden, fetchTripDetail, type TripCol, type TripPlace } from "./useTrips";
import { PhotoModerationModal } from "./PhotoModerationModal";

const PhotoCtx = createContext<(url: string) => void>(() => {});

// "Ogolne" to prywatna wishlista kazdego konta - nie jest tresci publiczna i nie podlega
// moderacji, wiec nie ma czego pokazywac operatorce.
const isOgolne = (l: RankingCol) => l.is_public === false || (l.title ?? "").trim().toLowerCase() === "ogólne";

interface UserGroup<T> { user_id: string; username: string | null; avatar: string | null; items: T[] }

function groupByUser<T extends { user_id: string | null; username: string | null; avatar: string | null }>(rows: T[]): UserGroup<T>[] {
  const map = new Map<string, UserGroup<T>>();
  for (const r of rows) {
    const k = r.user_id ?? "?";
    if (!map.has(k)) map.set(k, { user_id: k, username: r.username, avatar: r.avatar, items: [] });
    map.get(k)!.items.push(r);
  }
  return [...map.values()];
}

// ── KOLEKCJE ─────────────────────────────────────────────────────────────────
export function CollectionsPanel() {
  const lists = useRankings();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const rows = useMemo(() => (lists.data ?? []).filter((l) => !isOgolne(l)), [lists.data]);
  const groups = useMemo(() => groupByUser(rows), [rows]);

  return (
    <PhotoCtx.Provider value={setPhotoUrl}>
      {lists.isLoading ? <Loading /> : lists.isError ? (
        <p className="py-10 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać kolekcji.</p>
      ) : !groups.length ? (
        <Card>
          <EmptyState
            fact="Żadna publiczna kolekcja nie czeka na przejrzenie."
            next="Kolekcje pojawią się tu, gdy ktoś opublikuje nową albo doda do istniejącej zdjęcia."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <UserSection key={g.user_id} group={g} noun="kolekcja" nounPl="kolekcje" nounGen="kolekcji">
              {g.items.map((l) => <ListCard key={l.id} col={l} />)}
            </UserSection>
          ))}
        </div>
      )}
      <PhotoModerationModal url={photoUrl} onClose={() => setPhotoUrl(null)} />
    </PhotoCtx.Provider>
  );
}

// ── WYJAZDY ──────────────────────────────────────────────────────────────────
export function TripsPanel() {
  const trips = useTrips();
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const groups = useMemo(() => groupByUser(trips.data ?? []), [trips.data]);

  return (
    <PhotoCtx.Provider value={setPhotoUrl}>
      {trips.isLoading ? <Loading /> : trips.isError ? (
        <p className="py-10 text-center text-[13px] text-[var(--bad)]">Nie udało się wczytać wyjazdów.</p>
      ) : !groups.length ? (
        <Card>
          <EmptyState
            fact="Nikt jeszcze nie opublikował wyjazdu."
            next="Wyjazdy trafiają tu po kliknięciu „Zapisz trasę” w aplikacji."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.map((g) => (
            <UserSection key={g.user_id} group={g} noun="wyjazd" nounPl="wyjazdy" nounGen="wyjazdów">
              {g.items.map((t) => <TripCard key={t.id} trip={t} />)}
            </UserSection>
          ))}
        </div>
      )}
      <PhotoModerationModal url={photoUrl} onClose={() => setPhotoUrl(null)} />
    </PhotoCtx.Provider>
  );
}

// ── autor + jego tresci ──────────────────────────────────────────────────────
function UserSection<T>({ group, children, noun, nounPl, nounGen }: {
  group: UserGroup<T>; children: ReactNode; noun: string; nounPl: string; nounGen: string;
}) {
  const n = group.items.length;
  const uname = group.username || "nieznany";
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-2.5 px-1">
        {group.avatar
          ? <img src={avatarSrc(group.avatar)} alt="" className="h-8 w-8 rounded-full bg-[var(--photo)] object-cover" />
          : <span className="data flex h-8 w-8 items-center justify-center rounded-full bg-[var(--canvas)] text-[12px] text-[var(--graphite)]">
              {uname.slice(0, 1).toUpperCase()}
            </span>}
        <div className="min-w-0">
          <p className="data truncate text-[13px] font-semibold text-[var(--ink)]">@{uname}</p>
          <p className="text-[11px] text-[var(--stone)]">{n} {n === 1 ? noun : n >= 2 && n <= 4 ? nounPl : nounGen}</p>
        </div>
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function Thumbs({ urls }: { urls: string[] }) {
  const openPhoto = useContext(PhotoCtx);
  const items = urls.filter(Boolean);
  if (!items.length) {
    return (
      <div className="mb-2.5 flex items-center gap-1.5 text-[11px] text-[var(--stone)]">
        <ImageOff className="h-3.5 w-3.5" />brak zdjęć
      </div>
    );
  }
  return (
    <div className="scrollbar-none mb-2.5 flex gap-1.5 overflow-x-auto">
      {items.map((u, i) => (
        <button
          key={i} type="button" onClick={() => openPhoto(u)}
          className="h-14 w-14 shrink-0 overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)] transition-transform active:scale-95"
        >
          <img src={resolveStored(u) || u} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

// ── WYJAZD ───────────────────────────────────────────────────────────────────
function TripCard({ trip }: { trip: TripCol }) {
  const toggle = useToggleTripHidden();
  const [detail, setDetail] = useState<TripPlace[] | null>(null);
  const [loading, setLoading] = useState(false);

  const open = async () => {
    if (detail) { setDetail(null); return; }
    setLoading(true);
    try { setDetail(await fetchTripDetail(trip.id)); } finally { setLoading(false); }
  };
  const hide = () => toggle.mutate({ id: trip.id, hidden: !trip.hidden_by_admin }, {
    onSuccess: () => toast.success(trip.hidden_by_admin ? "Wyjazd wrócił do eksploracji" : "Wyjazd ukryty"),
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });

  return (
    <Card>
      <Thumbs urls={trip.thumbs} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[var(--ink)]">{trip.title || "Wyjazd bez nazwy"}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-[var(--stone)]">
            {trip.city ? <span>{trip.city}</span> : null}
            <button type="button" onClick={open} className="inline-flex items-center gap-0.5 font-medium text-[var(--graphite)]">
              {trip.place_count} miejsc
              <ChevronDown className={`h-3 w-3 transition-transform ${detail ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        {trip.hidden_by_admin ? <StatusBadge tone="bad" mono>UKRYTE</StatusBadge> : null}
      </div>

      {loading ? <Loading label="Wczytuję miejsca…" /> : null}
      {detail ? <PlacesPreview places={detail} /> : null}

      <div className="mt-3 flex justify-end">
        <Button
          variant={trip.hidden_by_admin ? "ghost" : "danger"}
          disabled={toggle.isPending}
          onClick={hide}
          icon={trip.hidden_by_admin ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        >
          {trip.hidden_by_admin ? "Przywróć" : "Ukryj z eksploracji"}
        </Button>
      </div>
    </Card>
  );
}

// ── KOLEKCJA ─────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "Czeka", tone: "warn" },
  approved: { label: "Zaakceptowana", tone: "ok" },
  rejected: { label: "Odrzucona", tone: "bad" },
};

function ListCard({ col }: { col: RankingCol }) {
  const moderate = useModerateRanking();
  const toggleHidden = useToggleHidden();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");
  const [items, setItems] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);
  const st = STATUS_META[col.moderation_status] ?? STATUS_META.pending;
  const busy = moderate.isPending || toggleHidden.isPending;

  const open = async () => {
    if (items) { setItems(null); return; }
    setLoading(true);
    try { setItems(await fetchCollectionItems(col.id)); } finally { setLoading(false); }
  };
  const approve = () => moderate.mutate({ col, status: "approved" }, {
    onSuccess: () => toast.success("Kolekcja zaakceptowana"),
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });
  const doReject = () => moderate.mutate({ col, status: "rejected", note }, {
    onSuccess: () => { toast.success("Kolekcja odrzucona"); setRejecting(false); setNote(""); },
    onError: (e: any) => toast.error(e.message || "Nie udało się zapisać decyzji"),
  });

  const preview: TripPlace[] = (items ?? []).map((it) => ({
    place_name: it.place_name,
    photos: it.photo_url ? [it.photo_url] : [],
    notes: it.short_desc?.trim() ? [{ text: it.short_desc.trim(), author: null }] : [],
  }));

  return (
    <Card>
      <Thumbs urls={col.thumbs} />
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-[var(--ink)]">{col.title || "Kolekcja bez tytułu"}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12px] text-[var(--stone)]">
            {col.city ? <span>{col.city}</span> : null}
            <button type="button" onClick={open} className="inline-flex items-center gap-0.5 font-medium text-[var(--graphite)]">
              {col.item_count} miejsc
              <ChevronDown className={`h-3 w-3 transition-transform ${items ? "rotate-180" : ""}`} />
            </button>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <StatusBadge tone={st.tone}>{st.label}</StatusBadge>
          {col.hidden_by_admin ? <StatusBadge tone="bad" mono>UKRYTA</StatusBadge> : null}
        </div>
      </div>

      {loading ? <Loading label="Wczytuję miejsca…" /> : null}
      {items ? <PlacesPreview places={preview} /> : null}

      {rejecting ? (
        <div className="mt-3 flex flex-col gap-2">
          <TextArea
            value={note} onChange={(e) => setNote(e.target.value)} rows={2} autoFocus
            placeholder="Powód odrzucenia (zobaczy go autor)"
          />
          <div className="flex gap-2">
            <Button variant="danger" className="flex-1" disabled={busy || !note.trim()} onClick={doReject}>
              {busy ? "…" : "Potwierdź odrzucenie"}
            </Button>
            <Button disabled={busy} onClick={() => { setRejecting(false); setNote(""); }}>Anuluj</Button>
          </div>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          {col.moderation_status !== "approved" ? (
            <Button variant="primary" className="flex-1" disabled={busy} icon={<Check className="h-4 w-4" />} onClick={approve}>
              Akceptuj
            </Button>
          ) : null}
          {col.moderation_status !== "rejected" ? (
            <Button className="flex-1" disabled={busy} icon={<X className="h-4 w-4" />} onClick={() => setRejecting(true)}>
              Odrzuć
            </Button>
          ) : null}
          <Button
            disabled={busy}
            title={col.hidden_by_admin ? "Przywróć kolekcję" : "Ukryj kolekcję"}
            onClick={() => toggleHidden.mutate({ id: col.id, hidden: !col.hidden_by_admin })}
            icon={col.hidden_by_admin ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          />
        </div>
      )}
    </Card>
  );
}

// Rozwiniecie: zdjecia i notki przy miejscach - to jest material do moderacji.
function PlacesPreview({ places }: { places: TripPlace[] }) {
  const openPhoto = useContext(PhotoCtx);
  if (!places.length) {
    return (
      <div className="mt-3 rounded-[var(--r-control)] bg-[var(--canvas)] p-3">
        <p className="text-[12px] text-[var(--stone)]">Ta pozycja nie ma jeszcze żadnego miejsca.</p>
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-col gap-3 rounded-[var(--r-control)] bg-[var(--canvas)] p-3">
      {places.map((p, i) => (
        <div key={i} className="border-b border-[var(--line)] pb-3 last:border-0 last:pb-0">
          <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{p.place_name}</p>
          {p.photos.length ? (
            <div className="scrollbar-none mt-2 flex gap-1.5 overflow-x-auto">
              {p.photos.map((u, j) => (
                <button
                  key={j} type="button" onClick={() => openPhoto(u)}
                  className="h-16 w-16 shrink-0 overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)] transition-transform active:scale-95"
                >
                  <img src={resolveStored(u) || u} alt="" loading="lazy" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          ) : null}
          {p.notes.length ? (
            <div className="mt-2 flex flex-col gap-1">
              {p.notes.map((n, j) => (
                <p key={j} className="text-[12px] leading-snug text-[var(--graphite)]">
                  {n.author ? <span className="font-semibold text-[var(--ink)]">@{n.author}: </span> : null}„{n.text}”
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
