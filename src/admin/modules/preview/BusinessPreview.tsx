// Podglad WIZYTOWKI lokalu tak, jak prezentuje sie w aplikacji: okladka 4:3, logo,
// nazwa, kategorie, adres, godziny, opis i galeria. Plus KONTAKT - zeby odezwac sie
// do lokalu bez szukania jego maila w innej zakladce.
//
// ⚠️ Proporcja 4:3 dla WSZYSTKICH zdjec wizytowki to twarda regula z CLAUDE.md
// (tak kadruje je apka), wiec podglad, ktory pokazuje inna, klamie.
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, Globe, Copy, ImageOff, MapPin } from "lucide-react";
import { Panel, Loading, EmptyState, StatusBadge, Button, Section, type Tone } from "../../ui";
import { CategoryChip, OutlineChip, previewPhoto } from "./PreviewParts";
import { useBusinessPreview, type BusinessPreviewData } from "./usePreviews";

const STATUS_TONE: Record<string, Tone> = { approved: "ok", pending: "warn", rejected: "bad" };
const STATUS_LABEL: Record<string, string> = { approved: "Zaakceptowana", pending: "Czeka na decyzję", rejected: "Odrzucona" };

const DAYS: { key: string; label: string }[] = [
  { key: "mon", label: "Poniedziałek" }, { key: "tue", label: "Wtorek" }, { key: "wed", label: "Środa" },
  { key: "thu", label: "Czwartek" }, { key: "fri", label: "Piątek" }, { key: "sat", label: "Sobota" },
  { key: "sun", label: "Niedziela" },
];

export function BusinessPreview({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, isLoading, isError } = useBusinessPreview(id);

  return (
    <Panel
      wide
      title="Podgląd wizytówki"
      subtitle="Tak lokal prezentuje się w aplikacji."
      onClose={onClose}
    >
      {isLoading ? <Loading /> : isError || !data ? (
        <EmptyState fact="Nie udało się wczytać wizytówki." next="Mogła zostać usunięta - odśwież listę." />
      ) : (
        <div className="flex flex-col gap-5">
          <Card data={data} />
          <Contact data={data} />
        </div>
      )}
    </Panel>
  );
}

function Card({ data }: { data: BusinessPreviewData }) {
  const gallery = (data.gallery_urls ?? []).filter(Boolean);
  const hours = (data.opening_hours && typeof data.opening_hours === "object" ? data.opening_hours : null) as Record<string, any> | null;
  const address = [data.street, data.city].filter(Boolean).join(", ") || data.address;

  return (
    <div className="overflow-hidden rounded-[var(--r-card)] border border-[var(--line)]">
      {/* Okladka 4:3 - tak samo jak hero wizytowki w apce. */}
      <div className="relative aspect-[4/3] bg-[var(--photo)]">
        {data.cover_image_url
          ? <img src={previewPhoto(data.cover_image_url, 900) ?? undefined} alt="" className="h-full w-full object-cover" />
          : <span className="flex h-full items-center justify-center text-[12px] text-[var(--stone)]">
              <ImageOff className="mr-1.5 h-4 w-4" />lokal nie dodał okładki
            </span>}
        {data.logo_url ? (
          <img
            src={previewPhoto(data.logo_url, 200) ?? undefined} alt=""
            className="absolute bottom-3 left-3 h-14 w-14 rounded-[var(--r-control)] border border-[var(--line)] bg-[var(--surface)] object-cover"
          />
        ) : null}
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[20px] font-semibold leading-7 text-[var(--ink)]">
            {data.business_name || "Wizytówka bez nazwy"}
          </h2>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            <StatusBadge tone={STATUS_TONE[data.moderation_status] ?? "neutral"}>
              {STATUS_LABEL[data.moderation_status] ?? data.moderation_status}
            </StatusBadge>
            <StatusBadge tone={data.is_active ? "ok" : "neutral"} mono>
              {data.is_active ? "WIDOCZNA" : "SCHOWANA"}
            </StatusBadge>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <CategoryChip category={data.main_category} />
          {(data.subcategories ?? []).map((s) => <CategoryChip key={s} category={s} />)}
          {(data.tags ?? []).map((t) => <OutlineChip key={t}>{t}</OutlineChip>)}
        </div>

        {address ? (
          <p className="flex items-center gap-1.5 text-[13px] text-[var(--graphite)]">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-[var(--stone)]" />{address}
          </p>
        ) : null}

        {data.description ? (
          <p className="whitespace-pre-wrap text-[14px] leading-6 text-[var(--graphite)]">{data.description}</p>
        ) : (
          <p className="text-[13px] italic text-[var(--stone)]">Lokal nie napisał jeszcze opisu.</p>
        )}

        {hours ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
            {DAYS.map((d) => {
              const h = hours[d.key];
              const text = !h ? "brak danych" : h.closed ? "zamknięte" : `${h.open ?? "?"} - ${h.close ?? "?"}`;
              return (
                <div key={d.key} className="flex justify-between gap-2 text-[12px]">
                  <dt className="text-[var(--stone)]">{d.label}</dt>
                  <dd className="data text-[var(--graphite)]">{text}</dd>
                </div>
              );
            })}
          </dl>
        ) : null}

        {gallery.length ? (
          <div className="grid grid-cols-3 gap-1.5">
            {gallery.map((u, i) => (
              <a key={i} href={u} target="_blank" rel="noreferrer" className="aspect-[4/3] overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]">
                <img src={previewPhoto(u, 600) ?? undefined} alt="" loading="lazy" className="h-full w-full object-cover" />
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ── KONTAKT ──────────────────────────────────────────────────────────────────
// Dzisiaj to mail, telefon i strona - czyli to, czym lokal faktycznie da sie zlapac.
// Czat w panelu lokalu jest zaprojektowany, ale jeszcze nie istnieje po stronie biznesu,
// wiec NIE udajemy tu okienka rozmowy: wiadomosc nie mialaby gdzie dojsc.
function Contact({ data }: { data: BusinessPreviewData }) {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (what: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1500);
    } catch { toast.error("Przeglądarka nie dała skopiować"); }
  };

  const subject = encodeURIComponent(`spontaway - wizytówka ${data.business_name ?? ""}`.trim());
  const body = encodeURIComponent(
    `Cześć,\n\npiszę ze spontaway w sprawie wizytówki „${data.business_name ?? ""}".\n\n`,
  );

  const rows: { icon: typeof Mail; label: string; value: string | null; href: string | null }[] = [
    { icon: Mail, label: "Mail", value: data.email, href: data.email ? `mailto:${data.email}?subject=${subject}&body=${body}` : null },
    { icon: Phone, label: "Telefon", value: data.phone, href: data.phone ? `tel:${data.phone.replace(/\s/g, "")}` : null },
    { icon: Globe, label: "Strona", value: data.website, href: data.website || null },
  ];

  const anyChannel = rows.some((r) => r.value);

  return (
    <Section title="Kontakt z lokalem">
      <div className="flex flex-col gap-2">
        {anyChannel ? rows.filter((r) => r.value).map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.label} className="flex items-center gap-3 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
              <Icon className="h-4 w-4 shrink-0 text-[var(--stone)]" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[var(--stone)]">{r.label}</p>
                <p className="data truncate text-[13px] text-[var(--ink)]">{r.value}</p>
              </div>
              <Button onClick={() => copy(r.label, r.value!)} icon={<Copy className="h-3.5 w-3.5" />}>
                {copied === r.label ? "Skopiowane" : "Kopiuj"}
              </Button>
              <a
                href={r.href!} target={r.label === "Strona" ? "_blank" : undefined} rel="noreferrer"
                className="inline-flex h-9 items-center rounded-[var(--r-control)] bg-[var(--accent)] px-3 text-[13px] font-semibold text-[var(--on-accent)] hover:opacity-90"
              >
                {r.label === "Mail" ? "Napisz" : r.label === "Telefon" ? "Zadzwoń" : "Otwórz"}
              </a>
            </div>
          );
        }) : (
          <EmptyState
            fact="Ten lokal nie zostawił żadnego kontaktu."
            next="Bez maila i telefonu odezwiesz się tylko przez właściciela konta albo Google."
          />
        )}

        <p className="text-[12px] leading-5 text-[var(--stone)]">
          {data.owner_user_id
            ? "Wizytówka ma właściciela, więc mail trafia do osoby, która prowadzi panel lokalu."
            : "Wizytówka nie ma jeszcze właściciela - to lead, nikt się na nią nie zalogował."}
          {" "}Czat w panelu lokalu dopiero powstaje, więc do tego czasu kontakt idzie mailem albo telefonem.
        </p>
      </div>
    </Section>
  );
}
