// Rozmowy z lokalami. Lista watkow po lewej, rozmowa po prawej - zamiast wchodzenia
// i wychodzenia z ekranu przy kazdym lokalu.
//
// ⚠️ Watek = LOKAL, nie konto. Wlasciciel trzech kawiarni ma trzy rozmowy, bo problem
// z menu w jednej z nich nie jest problemem pozostalych.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Send, Loader2, Store, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { AppShell, PageHeader, Card, Button, TextArea, StatusBadge, Loading, EmptyState } from "../../ui";
import { useMessageThreads, useThread, useSendReply, useMarkThreadRead, type MessageThread } from "./useMessages";

export function MessagesPage() {
  const threads = useMessageThreads();
  const [openId, setOpenId] = useState<string | null>(null);
  // Pierwsza rozmowa otwiera sie sama TYLKO RAZ (lista bez otwartego watku to pol ekranu
  // pustki) - po tym, jak Nat zamknie podglad krzyzykiem, nie ma wracac (prosba 2026-09-20).
  const [autoOpened, setAutoOpened] = useState(false);
  const markRead = useMarkThreadRead();

  useEffect(() => {
    if (autoOpened || !threads.data?.length) return;
    setAutoOpened(true);
    setOpenId(threads.data[0].business_profile_id);
  }, [threads.data, autoOpened]);

  useEffect(() => {
    if (openId) markRead.mutate(openId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openId]);

  const open = threads.data?.find((t) => t.business_profile_id === openId) ?? null;
  const waiting = threads.data?.filter((t) => t.unread > 0).length ?? 0;

  return (
    <AppShell>
      <PageHeader
        title="Rozmowy"
        subtitle={waiting
          ? `${waiting} ${waiting === 1 ? "lokal czeka" : "lokali czeka"} na odpowiedź.`
          : "Czat z lokalami. Jeden wątek na lokal, ten sam co w panelu lokalu."}
      />

      {threads.isLoading ? <Loading /> : !threads.data?.length ? (
        <Card>
          <EmptyState
            fact="Żaden lokal jeszcze nie napisał."
            next="Rozmowa zaczyna się po stronie lokalu - w panelu ma dymek „Napisz do nas”."
          />
        </Card>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_1fr]">
          <Card padded={false} className="overflow-hidden">
            <ul className="max-h-[70vh] overflow-y-auto">
              {threads.data.map((t) => (
                <li key={t.business_profile_id}>
                  {/* Tapniecie w OTWARTY watek zamyka go - to samo, co krzyzyk w naglowku rozmowy. */}
                  <ThreadRow
                    thread={t}
                    active={t.business_profile_id === openId}
                    onClick={() => setOpenId((cur) => (cur === t.business_profile_id ? null : t.business_profile_id))}
                  />
                </li>
              ))}
            </ul>
          </Card>

          {open ? <Conversation thread={open} onClose={() => setOpenId(null)} /> : null}
        </div>
      )}
    </AppShell>
  );
}

function ThreadRow({ thread, active, onClick }: { thread: MessageThread; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition-colors last:border-0 ${
        active ? "bg-[var(--canvas)]" : "hover:bg-[var(--canvas)]"
      }`}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[var(--r-control)] bg-[var(--photo)]">
        {thread.logo_url
          ? <img src={thread.logo_url} alt="" className="h-full w-full object-cover" />
          : <Store className="h-4 w-4 text-[var(--stone)]" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink)]">
            {thread.business_name || "Lokal bez nazwy"}
          </span>
          {thread.unread > 0 ? <StatusBadge tone="warn" mono>{thread.unread}</StatusBadge> : null}
        </span>
        <span className="mt-0.5 block truncate text-[12px] text-[var(--stone)]">
          {thread.last_sender === "admin" ? "Ty: " : ""}{thread.last_body}
        </span>
        <span className="data mt-0.5 block text-[11px] text-[var(--stone)]">
          {thread.last_at ? formatDistanceToNow(new Date(thread.last_at), { addSuffix: true, locale: dateLocale() }) : ""}
        </span>
      </span>
    </button>
  );
}

function Conversation({ thread, onClose }: { thread: MessageThread; onClose: () => void }) {
  const messages = useThread(thread.business_profile_id);
  const send = useSendReply();
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.data]);
  useEffect(() => { setDraft(""); }, [thread.business_profile_id]);

  const reply = () => {
    const body = draft.trim();
    if (!body) return;
    send.mutate({ businessProfileId: thread.business_profile_id, body }, {
      onSuccess: () => setDraft(""),
      onError: (e: any) => toast.error(e.message || "Nie udało się wysłać odpowiedzi"),
    });
  };

  return (
    <Card padded={false} className="flex max-h-[70vh] flex-col">
      <div className="flex items-center gap-3 border-b border-[var(--line)] px-5 py-3.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-[var(--ink)]">{thread.business_name || "Lokal bez nazwy"}</p>
          <p className="truncate text-[12px] text-[var(--stone)]">
            {[thread.city, `${thread.total} wiadomości`].filter(Boolean).join(" · ")}
          </p>
        </div>
        {/* Zamkniecie podgladu rozmowy - na telefonie karta rozmowy staje POD lista i bez
            tego nie dalo sie jej schowac (prosba Nat 2026-09-20). */}
        <Button onClick={onClose} aria-label="Zamknij rozmowę" icon={<X className="h-4 w-4" />} className="h-8 w-8 shrink-0 px-0" />
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.isLoading ? <Loading /> : (
          <div className="flex flex-col gap-3">
            {(messages.data ?? []).map((m) => {
              const mine = m.sender === "admin";
              return (
                <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <div className={`max-w-[80%] whitespace-pre-wrap rounded-[var(--r-card)] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    mine ? "bg-[var(--accent)] text-[var(--on-accent)]" : "bg-[var(--canvas)] text-[var(--ink)]"
                  }`}>
                    {m.body}
                  </div>
                  <span className="data mt-1 text-[11px] text-[var(--stone)]">
                    {mine ? "spontaway" : thread.business_name || "lokal"} ·{" "}
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: dateLocale() })}
                  </span>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <div className="border-t border-[var(--line)] p-4">
        <div className="flex items-end gap-2">
          <TextArea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); reply(); } }}
            rows={2}
            maxLength={4000}
            placeholder="Odpowiedz lokalowi…"
            className="min-h-[56px] flex-1"
          />
          <Button
            variant="primary"
            onClick={reply}
            disabled={send.isPending || !draft.trim()}
            icon={send.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          >
            Wyślij
          </Button>
        </div>
        <p className="mt-2 text-[11px] text-[var(--stone)]">
          Ctrl + Enter wysyła. Lokal zobaczy odpowiedź w swoim panelu, przy dymku „Napisz do nas”.
        </p>
      </div>
    </Card>
  );
}
