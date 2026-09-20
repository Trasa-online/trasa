// Czat lokalu z nami. Panel wjezdza z prawej i zostaje otwarty, dopoki lokal go nie zamknie -
// rozmowa ma byc czyms, do czego sie wraca, a nie formularzem, ktory znika po wyslaniu.
//
// Odswiezanie: przy otwarciu i co 20 s, dopoki panel jest otwarty. Realtime przez websocket
// bylby ladniejszy, ale tu rozmawiaja dwie osoby na krzyz - polling jest tansze w utrzymaniu
// i nie trzyma polaczenia otwartego przez caly dzien pracy lokalu.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { X, Send, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { dateLocale } from "@/lib/dateLocale";
import { fetchThread, sendAsBusiness, markThreadRead, type BizMessage } from "@/lib/businessChat";

export function ChatPanel({ businessProfileId, businessName, open, onClose, onRead }: {
  businessProfileId: string;
  businessName: string;
  open: boolean;
  onClose: () => void;
  /** Panel zglasza, ze watek zostal przeczytany - belka gasi kropke bez przeladowania. */
  onRead?: () => void;
}) {
  const { t } = useTranslation("bizdash");
  const [messages, setMessages] = useState<BizMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !businessProfileId) return;
    let alive = true;
    const load = async (first = false) => {
      if (first) setLoading(true);
      const rows = await fetchThread(businessProfileId);
      if (!alive) return;
      setMessages(rows);
      setLoading(false);
      // Otwarty panel = przeczytane. Znacznik idzie do bazy, zeby kropka nie wracala
      // po odswiezeniu strony.
      await markThreadRead(businessProfileId);
      onRead?.();
    };
    void load(true);
    const id = setInterval(() => void load(), 20_000);
    return () => { alive = false; clearInterval(id); };
  }, [open, businessProfileId, onRead]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, open]);

  if (!open) return null;

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const msg = await sendAsBusiness(businessProfileId, body);
      if (msg) setMessages((prev) => [...prev, msg]);
      setDraft("");
    } catch (e: any) {
      toast.error(e?.message === "not_authenticated" ? t("access.login_prompt_short") : t("chat.send_error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative flex h-full w-full flex-col bg-white sm:w-[440px] sm:border-l sm:border-slate-200">
        <header className="flex items-start gap-3 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-black text-white">N</span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-black text-slate-900">{t("chat.title")}</p>
            <p className="text-[12px] text-slate-500">{t("chat.subtitle", { venue: businessName })}</p>
          </div>
          <button type="button" onClick={onClose} aria-label={t("shell.close")} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
          ) : messages.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5">
              <p className="text-[14px] font-bold text-slate-800">{t("chat.empty_title")}</p>
              <p className="mt-1 text-[13px] leading-relaxed text-slate-500">{t("chat.empty_hint")}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {messages.map((m) => {
                const mine = m.sender === "business";
                return (
                  <div key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-relaxed ${
                      mine ? "bg-primary text-white" : "bg-slate-100 text-slate-800"
                    }`}>
                      {m.body}
                    </div>
                    <span className="mt-1 text-[11px] text-slate-400">
                      {mine ? t("chat.you") : t("chat.us")} · {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: dateLocale() })}
                    </span>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
          )}
        </div>

        <div className="border-t border-slate-100 p-4">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); void send(); } }}
              rows={2}
              maxLength={4000}
              placeholder={t("chat.placeholder")}
              className="min-h-[56px] flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[14px] text-slate-900 outline-none placeholder:text-slate-400 focus:border-primary focus:bg-white"
            />
            <button
              type="button"
              onClick={send}
              disabled={sending || !draft.trim()}
              aria-label={t("chat.send")}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{t("chat.hint")}</p>
        </div>
      </div>
    </div>
  );
}
