import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, X } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { avatarSrc } from "@/lib/avatar";
import { markChatRead } from "@/lib/chatReads";

interface ChatMsg { id: string; user_id: string | null; text: string; created_at: string; username: string | null; avatar_url: string | null }

// Czat wyjazdu (2026-08-26): uczestnicy przegaduja miejsca. Realtime (tabela trip_messages).
// Otwierany dymkiem na widoku wyjazdu (SharedRoute). RLS: tylko uczestnicy (owner/is_shared).
export default function TripChatSheet({ open, onOpenChange, routeId, tripTitle, participants = [] }: {
  open: boolean; onOpenChange: (o: boolean) => void; routeId: string | null; tripTitle?: string | null;
  participants?: { id: string; username: string | null; avatar_url: string | null }[];
}) {
  const { t } = useTranslation("route");
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: messages = [] } = useQuery({
    queryKey: ["trip-messages", routeId],
    enabled: open && !!routeId,
    queryFn: async (): Promise<ChatMsg[]> => {
      const { data } = await (supabase as any).from("trip_messages")
        .select("id, user_id, text, created_at").eq("route_id", routeId).order("created_at", { ascending: true }).limit(300);
      const rows = (data ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
      const byId = new Map<string, any>();
      if (ids.length) {
        const { data: profs } = await (supabase as any).from("profiles").select("id, username, avatar_url").in("id", ids);
        for (const p of (profs ?? []) as any[]) byId.set(p.id, p);
      }
      return rows.map((r) => ({ ...r, username: byId.get(r.user_id)?.username ?? null, avatar_url: byId.get(r.user_id)?.avatar_url ?? null }));
    },
  });

  // Realtime: nowe wiadomosci innych uczestnikow od razu (INSERT na trip_messages tej trasy).
  useEffect(() => {
    if (!open || !routeId) return;
    const channel = supabase.channel(`trip-chat-${routeId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "trip_messages", filter: `route_id=eq.${routeId}` },
        () => queryClient.invalidateQueries({ queryKey: ["trip-messages", routeId] }))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [open, routeId, queryClient]);

  // Auto-scroll na dol przy nowych wiadomosciach / otwarciu.
  useEffect(() => {
    if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length, open]);

  // Oznacz czat jako przeczytany po otwarciu + gdy user widzi nowe wiadomosci -> zeruje licznik na dymku.
  useEffect(() => {
    if (open && routeId && user?.id) {
      void markChatRead(routeId, user.id).then(() => queryClient.invalidateQueries({ queryKey: ["chat-unread", routeId, user.id] }));
    }
  }, [open, routeId, user?.id, messages.length, queryClient]);

  const send = async () => {
    const t = text.trim();
    if (!t || !user || !routeId || sending) return;
    setSending(true);
    setText("");
    haptics.light();
    const { error } = await (supabase as any).from("trip_messages").insert({ route_id: routeId, user_id: user.id, text: t });
    if (error) { console.error("[tripChat] send:", error.message); setText(t); }
    else queryClient.invalidateQueries({ queryKey: ["trip-messages", routeId] });
    setSending(false);
    inputRef.current?.focus();
  };

  const timeOf = (iso: string) => { try { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; } catch { return ""; } };

  // Uczestnicy rozmowy (dedup po id) - awatary na gorze czatu.
  const uniqueParticipants = Array.from(new Map(participants.filter((p) => p.id).map((p) => [p.id, p])).values());

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {/* Wysokosc przez top/bottom (inset), NIE dvh: przy klawiaturze (resize:native) WebView zmienia
          rozmiar plynnie, a jednostka dvh skacze skokowo -> caly arkusz migal (fix Nat 2026-08-26).
          bottom:0 (Radix) trzyma input tuz nad klawiatura; top = staly odstep od gory. */}
      <SheetContent side="bottom" onOpenAutoFocus={(e) => e.preventDefault()} className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col bg-[#fefefe] border-0" style={{ top: "max(48px, calc(env(safe-area-inset-top, 0px) + 40px))", height: "auto" }}>
        {/* Naglowek */}
        <div className="flex items-center justify-between gap-2 px-5 pt-3 pb-2.5 shrink-0 border-b border-border/40">
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-semibold text-foreground leading-tight truncate">{tripTitle ? t("chat.title_named", { title: tripTitle }) : t("chat.title")}</h2>
            {/* Awatary uczestnikow rozmowy (kto bierze udzial) */}
            {uniqueParticipants.length > 0 && (
              <div className="flex items-center mt-1.5">
                <div className="flex items-center -space-x-2">
                  {uniqueParticipants.slice(0, 10).map((p) => (
                    <img key={p.id} src={avatarSrc(p.avatar_url)} alt={p.username ?? ""} title={p.username ?? undefined} className="h-6 w-6 rounded-full object-cover border-2 border-white bg-secondary" />
                  ))}
                </div>
                {uniqueParticipants.length > 10 && <span className="ml-2 text-[11px] font-semibold text-muted-foreground">+{uniqueParticipants.length - 10}</span>}
              </div>
            )}
          </div>
          <button onClick={() => onOpenChange(false)} aria-label={t("common:buttons.close")} className="h-9 w-9 rounded-full border border-black/15 bg-white flex items-center justify-center active:opacity-60 transition-opacity shrink-0">
            <X className="h-4 w-4 text-foreground" />
          </button>
        </div>

        {/* Lista wiadomosci */}
        <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-2.5">
          {messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-10">{t("chat.empty")}</p>
          ) : messages.map((m) => {
  const { t } = useTranslation("route");
            const mine = m.user_id === user?.id;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {/* Awatar autora - przy KAZDEJ wiadomosci (tez wlasnej). */}
                <img src={avatarSrc(m.avatar_url)} alt="" className="h-7 w-7 rounded-full object-cover bg-secondary shrink-0" />
                <div className="max-w-[70%] min-w-0">
                  {!mine && <p className="text-[11px] font-semibold text-muted-foreground mb-0.5 px-1">{m.username || "Uczestnik"}</p>}
                  <div className={`rounded-2xl px-3.5 py-2 ${mine ? "bg-primary text-white rounded-br-md" : "bg-secondary text-foreground rounded-bl-md"}`}>
                    <p className="text-[14px] leading-snug whitespace-pre-wrap break-words">{m.text}</p>
                  </div>
                  <p className={`text-[10px] text-muted-foreground mt-0.5 px-1 ${mine ? "text-right" : ""}`}>{timeOf(m.created_at)}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Input */}
        <div className="shrink-0 flex items-center gap-2 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] border-t border-border/40 bg-[#fefefe]">
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
            placeholder={t("chat.placeholder")}
            className="flex-1 min-w-0 bg-secondary rounded-2xl px-4 h-11 text-[15px] text-foreground placeholder:text-muted-foreground outline-none"
          />
          <button onClick={send} disabled={!text.trim() || sending} aria-label={t("chat.send")}
            className={`h-11 w-11 rounded-2xl flex items-center justify-center shrink-0 transition-transform ${text.trim() && !sending ? "bg-primary text-white active:scale-90" : "bg-secondary text-muted-foreground"}`}>
            <Send className="h-5 w-5" />
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
