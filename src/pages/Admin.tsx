import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Copy, Check, Loader2, ArrowLeft, Trash2 } from "lucide-react";
import { format } from "date-fns";

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  notified_at: string | null;
  source: string | null;
  has_account?: boolean;
}

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [fetchingList, setFetchingList] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!user) { navigate("/auth"); return; }

    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle()
      .then(({ data }) => {
        if (!data) { navigate("/"); return; }
        setIsAdmin(true);
        loadWaitlist();
      });
  }, [user, loading, navigate]);

  const loadWaitlist = async () => {
    setFetchingList(true);
    try {
      const response = await supabase.functions.invoke("check-waitlist-status");
      if (response.data?.entries) {
        setWaitlist(response.data.entries as WaitlistEntry[]);
      }
    } catch (err) {
      console.error("Failed to load waitlist:", err);
    }
    setFetchingList(false);
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => {
      loadWaitlist();
    }, 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

  const handleInvite = async (entry: WaitlistEntry) => {
    setInviting(entry.id);
    try {
      const response = await supabase.functions.invoke("invite-user", {
        body: {
          email: entry.email,
          username: entry.email.split("@")[0],
          waitlist_id: entry.id,
        },
      });

      if (response.error || !response.data?.link) {
        throw new Error(response.error?.message ?? "Błąd generowania linku");
      }

      const link = response.data.link as string;
      setGeneratedLinks(prev => ({ ...prev, [entry.id]: link }));
      setWaitlist(prev =>
        prev.map(e => e.id === entry.id ? { ...e, notified_at: new Date().toISOString() } : e)
      );
      toast.success(`Link dla ${entry.email} gotowy — skopiuj i wyślij!`);
    } catch (err: any) {
      toast.error(err.message ?? "Nie udało się wygenerować linku");
    } finally {
      setInviting(null);
    }
  };

  const copyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success("Link skopiowany!");
  };

  const handleDelete = async (entry: WaitlistEntry) => {
    if (!confirm(`Usunąć ${entry.email} z listy oczekujących?`)) return;
    setDeleting(entry.id);
    try {
      const { error } = await supabase.from("waitlist").delete().eq("id", entry.id);
      if (error) throw error;
      setWaitlist(prev => prev.filter(e => e.id !== entry.id));
      toast.success(`${entry.email} usunięto z listy`);
    } catch (err: any) {
      toast.error(err.message ?? "Nie udało się usunąć");
    } finally {
      setDeleting(null);
    }
  };

  if (loading || isAdmin === null) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 p-4 border-b border-border/40">
        <button onClick={() => navigate("/")} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Panel admina — Lista oczekujących</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {fetchingList ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : waitlist.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">
            Brak zgłoszeń na liście oczekujących.
          </p>
        ) : (
          <div className="space-y-3">
            {waitlist.map(entry => {
              const link = generatedLinks[entry.id];
              return (
                <div key={entry.id} className="border border-border rounded-xl p-4 bg-card space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{entry.email}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Zgłoszono: {format(new Date(entry.created_at), "dd.MM.yyyy HH:mm")}
                        {entry.notified_at && (
                          <> · Zaproszono: {format(new Date(entry.notified_at), "dd.MM.yyyy HH:mm")}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      entry.has_account
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : entry.notified_at
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}>
                        {entry.has_account ? "Konto stworzone" : entry.notified_at ? "Zaproszono" : "Oczekuje"}
                      </span>
                      <button
                        onClick={() => handleDelete(entry)}
                        disabled={deleting === entry.id}
                        className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        title="Usuń z listy"
                      >
                        {deleting === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  {link ? (
                    <div className="flex gap-2">
                      <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                        {link}
                      </div>
                      <button
                        onClick={() => copyLink(entry.id, link)}
                        className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                      >
                        {copiedId === entry.id
                          ? <Check className="h-4 w-4 text-green-600" />
                          : <Copy className="h-4 w-4" />}
                      </button>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant={entry.notified_at ? "outline" : "default"}
                      onClick={() => handleInvite(entry)}
                      disabled={inviting === entry.id}
                      className="w-full rounded-lg"
                    >
                      {inviting === entry.id ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Generuję link...</>
                      ) : entry.notified_at ? (
                        "Wygeneruj nowy link"
                      ) : (
                        "Generuj link aktywacyjny"
                      )}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
