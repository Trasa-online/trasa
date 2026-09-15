// Kontakt do jednego leada: co znalazl robot, co mozna poprawic recznie i czym sie odezwac.
//
// ⚠️ Wysylki NIE ma tutaj swiadomie (decyzja Nat 15.09.2026): panel znajduje kontakt,
// a ofertę wysyłasz sama ze swojej skrzynki. Guzik "Napisz maila" otwiera zwykly mailto
// z wpisanym adresem, więc nic nie wychodzi bez Twojego kliknięcia w kliencie poczty.
import { useState } from "react";
import { toast } from "sonner";
import { Mail, Phone, Globe, Copy, Search, Check } from "lucide-react";
import { Panel, Button, TextField, StatusBadge, Section, EmptyState, type Tone } from "../../ui";
import {
  useLookupContact, useSaveLeadContact, useCreateLeadContact, type LeadContact,
} from "./useLeadContacts";
import type { LeadPlace } from "./useLeadPlaces";

const STATUS_META: Record<LeadContact["status"], { label: string; tone: Tone }> = {
  new: { label: "Niesprawdzony", tone: "neutral" },
  found: { label: "Mamy mail", tone: "ok" },
  not_found: { label: "Bez maila", tone: "warn" },
  contacted: { label: "Wysłana oferta", tone: "ok" },
};

export function LeadContactPanel({ lead, contact, onClose }: {
  lead: LeadPlace;
  contact: LeadContact | null;
  onClose: () => void;
}) {
  const lookup = useLookupContact();
  const save = useSaveLeadContact();
  const create = useCreateLeadContact();
  const [manual, setManual] = useState(contact?.email ?? "");
  const [note, setNote] = useState(contact?.note ?? "");

  const busy = lookup.isPending || save.isPending || create.isPending;
  const status = contact ? STATUS_META[contact.status] : STATUS_META.new;

  const runLookup = () => lookup.mutate(
    { placeName: lead.place_name, city: lead.city, force: !!contact },
    {
      onSuccess: (c) => {
        setManual(c.email ?? "");
        toast.success(c.email ? `Znaleziony adres: ${c.email}` : "Bez adresu e-mail. Został telefon albo strona.");
      },
      onError: (e: any) => toast.error(e.message || "Nie udało się sprawdzić kontaktu"),
    },
  );

  const saveManual = async () => {
    const patch = {
      email: manual.trim() || null,
      note: note.trim() || null,
      found_by: manual.trim() && manual.trim() !== contact?.emails?.[0] ? "manual" as const : contact?.found_by ?? null,
      status: manual.trim() ? "found" as const : contact?.status ?? "new" as const,
    };
    if (contact) save.mutate({ id: contact.id, patch }, {
      onSuccess: () => toast.success("Zapisano"),
      onError: (e: any) => toast.error(e.message || "Nie udało się zapisać"),
    });
    else create.mutate({ placeName: lead.place_name, city: lead.city }, {
      onSuccess: (c) => save.mutate({ id: c.id, patch }, { onSuccess: () => toast.success("Zapisano") }),
      onError: (e: any) => toast.error(e.message || "Nie udało się zapisać"),
    });
  };

  const markContacted = () => {
    if (!contact) return;
    save.mutate({ id: contact.id, patch: { status: contact.status === "contacted" ? "found" : "contacted" } }, {
      onSuccess: () => toast.success(contact.status === "contacted" ? "Cofnięto oznaczenie" : "Oznaczono jako wysłaną ofertę"),
    });
  };

  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success("Skopiowane"); }
    catch { toast.error("Przeglądarka nie dała skopiować"); }
  };

  const mailto = contact?.email
    ? `mailto:${contact.email}?subject=${encodeURIComponent(`spontaway - ${lead.place_name}`)}`
    : null;

  return (
    <Panel
      title={lead.place_name}
      subtitle={[lead.city, lead.category].filter(Boolean).join(" · ") || undefined}
      onClose={onClose}
      actions={<StatusBadge tone={status.tone}>{status.label}</StatusBadge>}
    >
      <div className="flex flex-col gap-5">
        <Section title="Dlaczego to lead">
          <p className="text-[13px] leading-5 text-[var(--graphite)]">
            Dodany {lead.total} razy: {lead.listCount} w&nbsp;kolekcjach, {lead.tripCount} w&nbsp;wyjazdach.
            Lokal nie ma konta w&nbsp;spontaway.
          </p>
        </Section>

        <Section
          title="Kontakt"
          right={
            <Button disabled={busy} icon={<Search className="h-3.5 w-3.5" />} onClick={runLookup}>
              {lookup.isPending ? "Szukam…" : contact ? "Sprawdź ponownie" : "Znajdź kontakt"}
            </Button>
          }
        >
          {!contact ? (
            <EmptyState
              fact="Tego lokalu nikt jeszcze nie sprawdzał."
              next="„Znajdź kontakt” pyta Google o stronę i telefon, a potem szuka adresu e-mail na stronie lokalu."
            />
          ) : (
            <div className="flex flex-col gap-2">
              <Row icon={Mail} label="Mail" value={contact.email} onCopy={copy} href={mailto} action="Napisz" />
              <Row icon={Phone} label="Telefon" value={contact.phone} onCopy={copy}
                href={contact.phone ? `tel:${contact.phone.replace(/\s/g, "")}` : null} action="Zadzwoń" />
              <Row icon={Globe} label="Strona" value={contact.website} onCopy={copy} href={contact.website} action="Otwórz" newTab />

              {contact.emails?.length > 1 ? (
                <p className="text-[12px] text-[var(--stone)]">
                  Inne adresy ze strony: <span className="data">{contact.emails.slice(1).join(", ")}</span>
                </p>
              ) : null}
              {contact.source_url ? (
                <p className="text-[12px] text-[var(--stone)]">
                  Adres wzięty z: <a href={contact.source_url} target="_blank" rel="noreferrer" className="underline">{contact.source_url}</a>
                </p>
              ) : null}
              {contact.checked_at ? (
                <p className="data text-[11px] text-[var(--stone)]">
                  sprawdzone {new Date(contact.checked_at).toLocaleString("pl-PL")}
                </p>
              ) : null}
              {contact.status === "not_found" ? (
                <p className="text-[12px] leading-5 text-[var(--warn)]">
                  Na stronie lokalu nie ma adresu e-mail. Zostaje telefon, Instagram albo formularz - wpisz adres
                  ręcznie, jeśli zdobędziesz go inaczej.
                </p>
              ) : null}
            </div>
          )}
        </Section>

        <Section title="Poprawka ręczna">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--stone)]">Adres e-mail do kontaktu</span>
              <TextField value={manual} onChange={(e) => setManual(e.target.value)} placeholder="kontakt@lokal.pl" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] text-[var(--stone)]">Notatka</span>
              <TextField value={note} onChange={(e) => setNote(e.target.value)} placeholder="np. rozmawiałam z właścicielem, wraca w październiku" />
            </label>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" disabled={busy} onClick={saveManual}>Zapisz</Button>
              {contact ? (
                <Button
                  disabled={busy}
                  icon={<Check className="h-3.5 w-3.5" />}
                  onClick={markContacted}
                >
                  {contact.status === "contacted" ? "Cofnij „wysłana oferta”" : "Oznacz: wysłana oferta"}
                </Button>
              ) : null}
            </div>
          </div>
        </Section>
      </div>
    </Panel>
  );
}

function Row({ icon: Icon, label, value, href, action, onCopy, newTab }: {
  icon: typeof Mail; label: string; value: string | null; href: string | null;
  action: string; onCopy: (v: string) => void; newTab?: boolean;
}) {
  if (!value) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
        <Icon className="h-4 w-4 shrink-0 text-[var(--stone)]" />
        <p className="flex-1 text-[13px] text-[var(--stone)]">{label}: nie znaleziono</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--surface)] px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-[var(--stone)]" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-[var(--stone)]">{label}</p>
        <p className="data truncate text-[13px] text-[var(--ink)]">{value}</p>
      </div>
      <Button onClick={() => onCopy(value)} icon={<Copy className="h-3.5 w-3.5" />} />
      {href ? (
        <a
          href={href} target={newTab ? "_blank" : undefined} rel="noreferrer"
          className="inline-flex h-9 items-center rounded-[var(--r-control)] bg-[var(--accent)] px-3 text-[13px] font-semibold text-[var(--on-accent)] hover:opacity-90"
        >
          {action}
        </a>
      ) : null}
    </div>
  );
}
