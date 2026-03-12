import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Copy, Check, Loader2, ArrowLeft, Trash2, Plus, ToggleLeft, ToggleRight, Link as LinkIcon, Sparkles } from "lucide-react";
import { format } from "date-fns";

interface WaitlistEntry {
  id: string;
  email: string;
  created_at: string;
  notified_at: string | null;
  source: string | null;
  has_account?: boolean;
}

interface CreatorPlace {
  id: string;
  creator_handle: string;
  city: string;
  place_name: string;
  category: string | null;
  description: string | null;
  instagram_reel_url: string | null;
  google_maps_url: string | null;
  photo_url: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyPlaceForm = {
  creator_handle: "",
  city: "",
  place_name: "",
  category: "",
  description: "",
  instagram_reel_url: "",
  google_maps_url: "",
  photo_url: "",
};

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [tab, setTab] = useState<"waitlist" | "places">("waitlist");

  // Waitlist state
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [fetchingList, setFetchingList] = useState(true);
  const [inviting, setInviting] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [generatedLinks, setGeneratedLinks] = useState<Record<string, string>>({});
  const [deleting, setDeleting] = useState<string | null>(null);

  // Creator places state
  const [places, setPlaces] = useState<CreatorPlace[]>([]);
  const [fetchingPlaces, setFetchingPlaces] = useState(false);
  const [placeForm, setPlaceForm] = useState(emptyPlaceForm);
  const [savingPlace, setSavingPlace] = useState(false);
  const [togglingPlace, setTogglingPlace] = useState<string | null>(null);
  const [deletingPlace, setDeletingPlace] = useState<string | null>(null);
  const [extractUrl, setExtractUrl] = useState("");
  const [extracting, setExtracting] = useState(false);

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
        loadPlaces();
      });
  }, [user, loading, navigate]);

  // Auto-refresh waitlist
  useEffect(() => {
    if (!isAdmin) return;
    const interval = setInterval(() => loadWaitlist(), 30000);
    return () => clearInterval(interval);
  }, [isAdmin]);

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

  const loadPlaces = async () => {
    setFetchingPlaces(true);
    const { data } = await supabase
      .from("creator_places")
      .select("*")
      .order("created_at", { ascending: false });
    setPlaces((data as CreatorPlace[]) || []);
    setFetchingPlaces(false);
  };

  const handleInvite = async (entry: WaitlistEntry) => {
    setInviting(entry.id);
    try {
      const response = await supabase.functions.invoke("invite-user", {
        body: { email: entry.email, username: entry.email.split("@")[0], waitlist_id: entry.id },
      });
      if (response.error || !response.data?.link) throw new Error(response.error?.message ?? "Błąd generowania linku");
      const link = response.data.link as string;
      setGeneratedLinks(prev => ({ ...prev, [entry.id]: link }));
      setWaitlist(prev => prev.map(e => e.id === entry.id ? { ...e, notified_at: new Date().toISOString() } : e));
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

  const handleExtractUrl = async () => {
    const url = extractUrl.trim();
    if (!url) return;
    setExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke("extract-creator-place", {
        body: { url },
      });
      if (error || !data) throw new Error(error?.message ?? "Błąd ekstrakcji");
      if (data.error) throw new Error(data.error);

      setPlaceForm(prev => ({
        ...prev,
        place_name: data.place_name ?? prev.place_name,
        city: data.city ?? prev.city,
        category: data.category ?? prev.category,
        description: data.description ?? prev.description,
        creator_handle: data.creator_handle ?? prev.creator_handle,
        photo_url: data.photo_url ?? prev.photo_url,
        instagram_reel_url: data.instagram_reel_url ?? prev.instagram_reel_url,
      }));
      toast.success("Dane wyciągnięte — sprawdź i uzupełnij formularz");
      setExtractUrl("");
    } catch (err: any) {
      toast.error(err.message ?? "Nie udało się przetworzyć URL");
    }
    setExtracting(false);
  };

  const handleSavePlace = async () => {
    if (!placeForm.creator_handle.trim() || !placeForm.city.trim() || !placeForm.place_name.trim()) {
      toast.error("Wypełnij: kreator, miasto i nazwa miejsca");
      return;
    }
    setSavingPlace(true);
    const { error } = await supabase.from("creator_places").insert({
      creator_handle: placeForm.creator_handle.trim(),
      city: placeForm.city.trim().toLowerCase(),
      place_name: placeForm.place_name.trim(),
      category: placeForm.category.trim() || null,
      description: placeForm.description.trim() || null,
      instagram_reel_url: placeForm.instagram_reel_url.trim() || null,
      google_maps_url: placeForm.google_maps_url.trim() || null,
      photo_url: placeForm.photo_url.trim() || null,
    });
    if (error) {
      toast.error("Błąd zapisu: " + error.message);
    } else {
      toast.success("Miejsce dodane!");
      setPlaceForm(emptyPlaceForm);
      loadPlaces();
    }
    setSavingPlace(false);
  };

  const handleTogglePlace = async (place: CreatorPlace) => {
    setTogglingPlace(place.id);
    const { error } = await supabase
      .from("creator_places")
      .update({ is_active: !place.is_active })
      .eq("id", place.id);
    if (error) {
      toast.error("Błąd aktualizacji");
    } else {
      setPlaces(prev => prev.map(p => p.id === place.id ? { ...p, is_active: !p.is_active } : p));
    }
    setTogglingPlace(null);
  };

  const handleDeletePlace = async (place: CreatorPlace) => {
    if (!confirm(`Usunąć „${place.place_name}"?`)) return;
    setDeletingPlace(place.id);
    const { error } = await supabase.from("creator_places").delete().eq("id", place.id);
    if (error) {
      toast.error("Błąd usuwania");
    } else {
      setPlaces(prev => prev.filter(p => p.id !== place.id));
      toast.success("Miejsce usunięte");
    }
    setDeletingPlace(null);
  };

  if (loading || isAdmin === null) return null;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center gap-3 p-4 border-b border-border/40">
        <button onClick={() => navigate("/")} className="p-1">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-semibold">Panel admina</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/40">
        {(["waitlist", "places"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t ? "border-b-2 border-foreground text-foreground" : "text-muted-foreground"
            }`}
          >
            {t === "waitlist" ? "Lista oczekujących" : "Miejsca twórców"}
          </button>
        ))}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {/* ── Waitlist Tab ── */}
        {tab === "waitlist" && (
          fetchingList ? (
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
                            ? "bg-blue-100 text-blue-700"
                            : entry.notified_at
                              ? "bg-green-100 text-green-700"
                              : "bg-yellow-100 text-yellow-700"
                        }`}>
                          {entry.has_account ? "Konto stworzone" : entry.notified_at ? "Zaproszono" : "Oczekuje"}
                        </span>
                        <button
                          onClick={() => handleDelete(entry)}
                          disabled={deleting === entry.id}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {deleting === entry.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {link ? (
                      <div className="flex gap-2">
                        <div className="flex-1 bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground font-mono truncate">{link}</div>
                        <button
                          onClick={() => copyLink(entry.id, link)}
                          className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border border-border bg-card hover:bg-muted transition-colors"
                        >
                          {copiedId === entry.id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
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
                        ) : entry.notified_at ? "Wygeneruj nowy link" : "Generuj link aktywacyjny"}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {/* ── Creator Places Tab ── */}
        {tab === "places" && (
          <div className="space-y-6">
            {/* Add form */}
            <div className="border border-border rounded-xl p-4 bg-card space-y-3">
              <p className="font-semibold text-sm">Dodaj miejsce</p>

              {/* URL auto-fill */}
              <div className="bg-muted/40 rounded-xl p-3 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  Auto-wypełnij z URL (YouTube / TikTok)
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={extractUrl}
                    onChange={e => setExtractUrl(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && (e.preventDefault(), handleExtractUrl())}
                    className="flex-1 bg-background text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExtractUrl}
                    disabled={!extractUrl.trim() || extracting}
                    className="shrink-0"
                  >
                    {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Wklej link → AI wyciągnie nazwę, miasto, kategorię i opis. Instagram wklej ręcznie niżej.
                </p>
              </div>

              {[
                { key: "creator_handle", label: "Kreator (np. @krakowhello)", required: true },
                { key: "city", label: "Miasto (małe litery, np. krakow)", required: true },
                { key: "place_name", label: "Nazwa miejsca", required: true },
                { key: "category", label: "Kategoria (bar/cafe/restaurant/viewpoint…)" },
                { key: "description", label: "Opis (krótki)" },
                { key: "instagram_reel_url", label: "Link do Instagram Reel" },
                { key: "google_maps_url", label: "Link do Google Maps" },
                { key: "photo_url", label: "URL zdjęcia" },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-xs text-muted-foreground mb-1 block">{field.label}</label>
                  <Input
                    value={(placeForm as any)[field.key]}
                    onChange={e => setPlaceForm(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="bg-background text-sm"
                  />
                </div>
              ))}
              <Button
                onClick={handleSavePlace}
                disabled={savingPlace}
                className="w-full"
              >
                {savingPlace ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Zapisywanie...</>
                ) : (
                  <><Plus className="h-4 w-4 mr-2" /> Dodaj miejsce</>
                )}
              </Button>
            </div>

            {/* List */}
            {fetchingPlaces ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : places.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Brak miejsc twórców.</p>
            ) : (
              <div className="space-y-3">
                {places.map(place => (
                  <div key={place.id} className="border border-border rounded-xl p-4 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{place.place_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {place.creator_handle} · {place.city}
                          {place.category && ` · ${place.category}`}
                        </p>
                        {place.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{place.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleTogglePlace(place)}
                          disabled={togglingPlace === place.id}
                          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
                          title={place.is_active ? "Dezaktywuj" : "Aktywuj"}
                        >
                          {togglingPlace === place.id ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : place.is_active ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDeletePlace(place)}
                          disabled={deletingPlace === place.id}
                          className="h-7 w-7 flex items-center justify-center rounded-lg text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          {deletingPlace === place.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                    {!place.is_active && (
                      <span className="inline-block mt-2 text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">Nieaktywne</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Admin;
