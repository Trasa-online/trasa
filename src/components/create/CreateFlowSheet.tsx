import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { FileText, X, Users, ChevronRight, ArrowLeft, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";
import { haptics } from "@/hooks/useHaptics";
import { supabase } from "@/integrations/supabase/client";
import { PlaceTile } from "@/components/profile/PlaceTile";
import { avatarSrc } from "@/lib/avatar";
import CityCountryPicker, { defaultCityIndex } from "@/components/create/CityDrum";
import AddPeoplePicker, { type PersonLite } from "@/components/create/AddPeoplePicker";
import { fetchSavedPlaces, createListFromSavedPlaces, type SavedPlace, type PlaceForList } from "@/lib/placeLists";
import { citiesForCountry } from "@/lib/tripCountries";

type Step = "entry" | "listName" | "listPick" | "trip" | "tripPeople";

const NBSP = " ";
// Domyslne miasto startowe wyjazdu: Gdańsk (aktualny focus contentu) jak w CountryCityPicker.
const defaultCity = () => { const cs = citiesForCountry("Polska"); return cs[defaultCityIndex(cs)] ?? cs[0]; };

const toPlaceForList = (p: SavedPlace): PlaceForList => ({
  place_name: p.place_name, category: p.category, address: p.address, description: p.short_desc,
  latitude: p.latitude, longitude: p.longitude, photo_url: p.photo_url, place_id: p.place_id,
  google_place_id: p.google_place_id, rating: p.rating,
});

// Arkusz tworzenia (sheet-first, redesign 2026-08-20). "+" -> "Co dzisiaj tworzymy?" [Lista|Wyjazd].
// Lista: nazwa + prywatnosc + wybor z zapisanych (lub "Dodaj nowe" -> pelny edytor CreateRanking).
// Wyjazd: nazwa + kraj/miasto (drum w drawerze) + "Dodaj osoby" (realne zaproszenia) -> ComposeWyjazd.
export default function CreateFlowSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("entry");

  // Lista
  const [listName, setListName] = useState("");
  const [listPublic, setListPublic] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);

  // Wyjazd
  const [tripName, setTripName] = useState("");
  const [tripCity, setTripCity] = useState(defaultCity);
  const [tripPeople, setTripPeople] = useState<PersonLite[]>([]);

  // Reset przy kazdym otwarciu.
  useEffect(() => {
    if (open) {
      setStep("entry"); setListName(""); setListPublic(true); setSelected(new Set());
      setTripName(""); setTripCity(defaultCity()); setTripPeople([]); setCreating(false);
    }
  }, [open]);

  const { data: profile } = useQuery({
    queryKey: ["create-author", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data } = await (supabase as any).from("profiles").select("username, first_name, avatar_url").eq("id", user!.id).maybeSingle();
      return data as { username: string | null; first_name: string | null; avatar_url: string | null } | null;
    },
  });
  const author = { name: profile?.username || profile?.first_name || "Użytkownik", avatar: profile?.avatar_url ?? null };

  const { data: savedPlaces = [], isLoading: loadingSaved } = useQuery({
    queryKey: ["saved-places", user?.id],
    enabled: !!user?.id && open,
    queryFn: () => fetchSavedPlaces(user!.id),
  });

  const close = () => onClose();
  const toggleSel = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const togglePerson = (p: PersonLite) => setTripPeople((prev) => prev.some((x) => x.id === p.id) ? prev.filter((x) => x.id !== p.id) : [...prev, p]);
  const tripPeopleIds = new Set(tripPeople.map((p) => p.id));

  // "Dodaj nowe" -> pelny edytor listy (CreateRanking) z wyszukiwarka; przenosimy nazwe/prywatnosc/zaznaczone.
  const goFullEditor = () => {
    const places = savedPlaces.filter((p) => selected.has(p.id)).map(toPlaceForList);
    close();
    navigate("/zestawienie/nowe", { state: { title: listName.trim(), city: "", places, listStatus: "visited", isPublic: listPublic } });
  };

  const createList = async () => {
    if (!user) { close(); navigate("/auth"); return; }
    const places = savedPlaces.filter((p) => selected.has(p.id)).map(toPlaceForList);
    if (!places.length) { toast.error("Zaznacz przynajmniej jedno miejsce"); return; }
    setCreating(true);
    haptics.light();
    const id = await createListFromSavedPlaces(user.id, { title: listName.trim() || "Nowa lista", isPublic: listPublic, places, author });
    setCreating(false);
    if (!id) { haptics.error(); toast.error("Nie udało się utworzyć listy"); return; }
    haptics.success();
    toast.success(listPublic ? "Lista utworzona" : "Lista utworzona (prywatna)");
    close();
    navigate(`/lista/${id}`);
  };

  const startTrip = () => {
    close();
    // title || undefined: ComposeWyjazd czyta nav.title przez ?? (pusty string zostalby jako pusta
    // nazwa), wiec przy braku nazwy przekazujemy undefined -> tam default "Wyjazd do {miasto}".
    navigate("/wyjazd/nowy", { state: { city: tripCity, title: tripName.trim() || undefined, inviteeIds: tripPeople.map((p) => p.id) } });
  };

  // ── wspolny nagłowek Anuluj / tytul / Dalej ──
  const Header = ({ title, onBack, onNext, nextLabel = "Dalej", nextEnabled = true, backLabel = "Anuluj" }: {
    title: string; onBack: () => void; onNext?: () => void; nextLabel?: string; nextEnabled?: boolean; backLabel?: string;
  }) => (
    <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
      <button onClick={onBack} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 transition-opacity shrink-0">{backLabel}</button>
      <h2 className="text-[20px] font-semibold text-foreground truncate">{title}</h2>
      {onNext ? (
        <button onClick={onNext} disabled={!nextEnabled}
          className={`text-sm font-medium rounded-full border bg-white px-3.5 py-1.5 shrink-0 transition-opacity ${nextEnabled ? "text-[#181818] border-black/15 active:opacity-60" : "text-[#bcbcbc] border-black/[0.07]"}`}>
          {nextLabel}
        </button>
      ) : <span className="w-[68px] shrink-0" />}
    </div>
  );

  // ── wiersz "Dodaj osoby" ──
  const PeopleRow = ({ kind, disabled, people, onClick }: { kind: "listy" | "wyjazdu"; disabled?: boolean; people?: PersonLite[]; onClick?: () => void }) => (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className={`w-full flex items-center gap-4 px-5 py-3 text-left ${disabled ? "opacity-45" : "active:bg-muted/50"} transition-colors`}>
      <Users className="h-6 w-6 text-foreground shrink-0" strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        <p className="text-[15px] font-medium text-foreground">{kind === "listy" ? `Dodaj osoby do${NBSP}listy` : `Dodaj osoby do${NBSP}wyjazdu`}</p>
        <p className="text-[13px] text-muted-foreground">{kind === "listy" ? `Twórz listy razem z${NBSP}innymi` : `Twórz wyjazdy razem z${NBSP}innymi`}</p>
      </div>
      {disabled ? (
        <span className="shrink-0 text-[11px] font-bold text-muted-foreground bg-secondary rounded-full px-2 py-0.5">Wkrótce</span>
      ) : (
        <span className="shrink-0 flex items-center gap-2">
          {people && people.length > 0 && (
            <span className="flex items-center -space-x-2">
              {people.slice(0, 3).map((p) => (
                <img key={p.id} src={avatarSrc(p.avatar_url)} alt="" className="h-7 w-7 rounded-full border-2 border-white object-cover bg-secondary" />
              ))}
              {people.length > 3 && (
                <span className="h-7 w-7 rounded-full border-2 border-white bg-secondary text-[10px] font-bold text-foreground flex items-center justify-center">+{people.length - 3}</span>
              )}
            </span>
          )}
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </span>
      )}
    </button>
  );

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) close(); }}>
      <SheetContent side="bottom" className="rounded-t-3xl p-0 [&>button]:hidden flex flex-col bg-[#fefefe] border-0" style={{ maxHeight: "88vh" }}>
        {/* grabber */}
        <div className="pt-3 pb-1 shrink-0"><div className="mx-auto h-1 w-10 rounded-full bg-[#d9d9d9]" /></div>

        {/* ── ENTRY ── */}
        {step === "entry" && (
          <div className="px-5 pt-1 pb-[max(20px,env(safe-area-inset-bottom))]">
            <h2 className="text-[20px] font-semibold text-foreground text-center">Co dzisiaj tworzymy?</h2>
            <div className="mt-4 flex gap-4">
              {[
                { key: "list", label: "Lista", icon: <FileText className="h-8 w-8 text-foreground" strokeWidth={1.7} />, go: () => setStep("listName") },
                { key: "trip", label: "Wyjazd", icon: <img src="/spontaway-symbol.png" alt="" className="h-9 w-9 object-contain" style={{ filter: "brightness(0)" }} draggable={false} />, go: () => setStep("trip") },
              ].map((t) => (
                <button key={t.key} onClick={() => { haptics.light(); t.go(); }} className="flex-1 flex flex-col items-center gap-3 active:scale-[0.98] transition-transform outline-none focus:outline-none focus-visible:outline-none">
                  <span className="w-full h-[90px] rounded-2xl bg-[#efefef] flex items-center justify-center">{t.icon}</span>
                  <span className="text-sm font-medium text-foreground">{t.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── LISTA: nazwa + prywatnosc ── */}
        {step === "listName" && (
          <div className="pb-[max(16px,env(safe-area-inset-bottom))]">
            <Header title="Nowa lista" onBack={() => setStep("entry")} onNext={() => setStep("listPick")} nextEnabled={!!listName.trim()} />
            <div className="px-5 pt-1">
              <div className="relative">
                <input value={listName} onChange={(e) => setListName(e.target.value)} placeholder="Nazwa listy" autoFocus
                  className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 pl-4 pr-11 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30" />
                {listName && (
                  <button onClick={() => setListName("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[#ebebeb]/60 flex items-center justify-center active:scale-90 transition-transform">
                    <X className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
            <div className="mt-3">
              <PeopleRow kind="listy" disabled />
            </div>
            <div className="flex items-center justify-between gap-3 px-5 py-2">
              <p className="text-[15px] font-medium text-foreground">Rodzaj listy</p>
              <div className="flex items-center rounded-full bg-[#ededed] p-0.5">
                {[{ k: false, l: "Prywatna" }, { k: true, l: "Publiczna" }].map((o) => (
                  // onMouseDown preventDefault: nie kradnij fokusu z inputu nazwy (inaczej klawiatura
                  // chowa sie przy zmianie prywatnosci). onClick i tak leci.
                  <button key={o.l} onMouseDown={(e) => e.preventDefault()} onClick={() => setListPublic(o.k)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${listPublic === o.k ? "bg-white text-foreground shadow-sm" : "text-foreground/55"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── LISTA: wybor zapisanych ── */}
        {step === "listPick" && (
          <>
            <Header title={listName.trim() || "Nazwa listy"} onBack={() => setStep("listName")}
              onNext={createList} nextLabel={creating ? "..." : "Dalej"} nextEnabled={selected.size > 0 && !creating} />
            <PeopleRow kind="listy" disabled />
            <div className="flex-1 min-h-0 overflow-y-auto px-4 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
              {loadingSaved ? (
                <div className="py-10 text-center text-sm text-muted-foreground">Ładowanie...</div>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {/* "Dodaj nowe" */}
                  <button onClick={goFullEditor} className="aspect-square rounded-2xl bg-secondary/70 border-2 border-dashed border-border flex flex-col items-center justify-center gap-1.5 active:scale-[0.97] transition-transform">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                    <span className="text-[11px] font-semibold text-muted-foreground">Dodaj nowe</span>
                  </button>
                  {savedPlaces.map((p) => {
                    const on = selected.has(p.id);
                    return (
                      <button key={p.id} onClick={() => toggleSel(p.id)} className={`relative rounded-2xl transition-all active:scale-[0.97] ${on ? "ring-2 ring-[#f0a583]" : ""}`}>
                        <PlaceTile showCity tile={{ photo_url: p.photo_url, category: p.category, place_name: p.place_name, city: p.city }} />
                        <span className={`absolute top-1.5 right-1.5 h-6 w-6 rounded-full flex items-center justify-center transition-colors ${on ? "bg-[#f0a583] text-white" : "bg-white/85 border border-black/10"}`}>
                          {on && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
              {!loadingSaved && savedPlaces.length === 0 && (
                <p className="mt-4 px-2 text-center text-sm text-muted-foreground">{`Nie masz jeszcze zapisanych miejsc. Dodaj nowe albo zapisuj miejsca w${NBSP}eksploracji.`}</p>
              )}
            </div>
          </>
        )}

        {/* ── WYJAZD: nazwa + kraj/miasto + osoby ── */}
        {step === "trip" && (
          <>
            <Header title="Nowy wyjazd" onBack={() => setStep("entry")} onNext={startTrip} />
            <div className="flex-1 min-h-0 overflow-y-auto pb-[max(16px,env(safe-area-inset-bottom))]">
              <div className="px-5 pt-1">
                <div className="relative">
                  <input value={tripName} onChange={(e) => setTripName(e.target.value)} placeholder="Nazwa trasy"
                    className="w-full h-12 rounded-xl bg-secondary/60 border border-border/60 pl-4 pr-11 text-base text-foreground placeholder:text-muted-foreground/70 outline-none focus:ring-2 focus:ring-orange-500/30" />
                  {tripName && (
                    <button onClick={() => setTripName("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-[#ebebeb]/60 flex items-center justify-center active:scale-90 transition-transform">
                      <X className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>
              </div>
              <div className="px-5 pt-4">
                <CityCountryPicker city={tripCity} onCityChange={setTripCity} compact />
              </div>
              <div className="mt-2 border-t border-border/50">
                <PeopleRow kind="wyjazdu" people={tripPeople} onClick={() => setStep("tripPeople")} />
              </div>
            </div>
          </>
        )}

        {/* ── WYJAZD: wybor osob ── */}
        {step === "tripPeople" && (
          <>
            <div className="flex items-center justify-between gap-2 px-5 pt-1 pb-3">
              <button onClick={() => setStep("trip")} className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full active:bg-muted transition-colors"><ArrowLeft className="h-5 w-5" /></button>
              <h2 className="text-[20px] font-semibold text-foreground">Dodaj osoby</h2>
              <button onClick={() => setStep("trip")} className="text-sm font-medium text-[#181818] rounded-full border border-black/15 bg-white px-3.5 py-1.5 active:opacity-60 shrink-0">Gotowe</button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-[max(16px,env(safe-area-inset-bottom))]">
              {user && <AddPeoplePicker userId={user.id} selected={tripPeopleIds} onToggle={togglePerson} />}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
