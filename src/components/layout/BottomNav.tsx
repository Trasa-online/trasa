import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { BookOpen, Compass, Home, Plus, X, MapPin, Users, Link2, User, Heart } from "lucide-react";
import { getTodayLikes, type ExploreLike } from "@/lib/exploreLikes";
import { isNative } from "@/lib/platform";

const HOME_FILTERS_KEY = "trasa_home_filters";

function getActiveHomeCity(): string {
  try {
    const raw = localStorage.getItem(HOME_FILTERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.city === "string" && parsed.city) return parsed.city;
    }
  } catch { /* unavailable */ }
  return "Warszawa";
}

const BottomNav = () => {
  const navigate = useNavigate();
  const [showMenu, setShowMenu] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [reusePrompt, setReusePrompt] = useState<{ city: string; likes: ExploreLike[] } | null>(null);

  const handleJoinSubmit = () => {
    const code = joinCode.trim();
    if (!code) return;
    setShowJoinModal(false);
    setJoinCode("");
    navigate(`/sesja/${code}`);
  };

  const handleGroupPlan = () => {
    setShowMenu(false);
    // Group sessions dzialaja dla goscia (sesja jest identyfikowana po join_code,
    // nie po user identity - mozna zaprosic przez kod, nie po username).
    navigate("/sesja/nowa");
  };

  const handleSoloPlan = () => {
    setShowMenu(false);
    const city = getActiveHomeCity();
    const todayLikes = getTodayLikes(city);
    if (todayLikes.length > 0) {
      setReusePrompt({ city, likes: todayLikes });
      return;
    }
    navigate("/plan");
  };

  const handleReuseAccept = () => {
    if (!reusePrompt) return;
    const { city, likes } = reusePrompt;
    setReusePrompt(null);
    navigate("/plan", {
      state: {
        step: 3, // straight to CategoryPicker with likes preloaded
        city,
        date: new Date().toISOString(),
        likedPlaceNames: likes.map(l => l.place_name),
      },
    });
  };

  const handleReuseDecline = () => {
    setReusePrompt(null);
    navigate("/plan");
  };

  return (
    <>
      {/* Backdrop for + menu */}
      {showMenu && (
        <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
      )}

      {/* Popup menu above "+" button */}
      {showMenu && (
        <div className="fixed bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 items-center pb-3">
          <button
            onClick={() => { setShowMenu(false); setJoinCode(""); setShowJoinModal(true); }}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-card border border-border text-foreground font-semibold text-sm shadow-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            <Link2 className="h-4 w-4 text-orange-600" />
            Dołącz do sesji
          </button>
          <button
            onClick={handleGroupPlan}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-foreground text-background font-semibold text-sm shadow-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            <Users className="h-4 w-4" />
            Zaplanuj grupowo
          </button>
          <button
            onClick={handleSoloPlan}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-primary text-white font-semibold text-sm shadow-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            <MapPin className="h-4 w-4" />
            Zaplanuj solo
          </button>
        </div>
      )}

      {/* Reuse likes prompt */}
      {reusePrompt && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setReusePrompt(null)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-7 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-11 w-11 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center shrink-0">
                <Heart className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-black leading-snug">
                  Wykorzystać polubione z&nbsp;dziś?
                </p>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  Masz <strong>{reusePrompt.likes.length}</strong> {reusePrompt.likes.length === 1 ? "polubione miejsce" : reusePrompt.likes.length < 5 ? "polubione miejsca" : "polubionych miejsc"} z {reusePrompt.city}. Mogę je dodać do nowej trasy.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={handleReuseAccept}
                className="w-full py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform shadow-md shadow-orange-500/20"
              >
                Tak, wykorzystaj polubione →
              </button>
              <button
                onClick={handleReuseDecline}
                className="w-full py-3 rounded-full border border-border text-sm font-semibold text-foreground active:scale-[0.97] transition-transform"
              >
                Nie, zacznij na nowo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Join session modal */}
      {showJoinModal && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowJoinModal(false)}
        >
          <div
            className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-6 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-4 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
            onClick={e => e.stopPropagation()}
          >
            <div>
              <h2 className="font-black text-lg">Dołącz do sesji</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Wpisz kod sesji otrzymany od znajomych</p>
            </div>
            <input
              type="text"
              value={joinCode}
              onChange={e => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === "Enter") handleJoinSubmit(); }}
              placeholder="np. ABC123"
              maxLength={10}
              className="w-full px-4 py-3.5 rounded-2xl border border-border bg-muted/40 text-base font-mono font-semibold tracking-widest text-center placeholder:text-muted-foreground/50 placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-400 transition-colors"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowJoinModal(false)}
                className="flex-1 py-3 rounded-full border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
              >
                Anuluj
              </button>
              <button
                onClick={handleJoinSubmit}
                disabled={!joinCode.trim()}
                className="flex-[2] py-3 rounded-full bg-primary text-white font-bold text-sm active:scale-[0.97] transition-transform disabled:opacity-40 disabled:active:scale-100"
              >
                Dołącz
              </button>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 bg-background border-t border-border/40 z-50 pb-safe">
        <div className="grid grid-cols-5 h-12 max-w-lg mx-auto">

          {/* Główna */}
          <NavLink
            to="/home"
            end
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
            activeClassName="text-orange-600"
          >
            {({ isActive }) => (
              <>
                <Home className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>Główna</span>
              </>
            )}
          </NavLink>

          {/* Eksploruj - tylko w native iOS/Android. Web/PWA ukrywa (feature jeszcze
              nie gotowy dla web, ale w native ma uzytkownikow). */}
          {isNative && (
            <NavLink
              to="/eksploruj"
              end={false}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-orange-600"
            >
              {({ isActive }) => (
                <>
                  <Compass className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                  <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>Eksploruj</span>
                </>
              )}
            </NavLink>
          )}

          {/* Center FAB */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="flex items-center justify-center"
            aria-label="Dodaj trasę"
          >
            <span className="h-10 w-10 rounded-full bg-primary flex items-center justify-center active:scale-95 transition-transform">
              {showMenu
                ? <X className="h-5 w-5 text-white stroke-[2.5px]" />
                : <Plus className="h-5 w-5 text-white stroke-[2.5px]" />
              }
            </span>
          </button>

          {/* Dziennik - tylko w native iOS/Android. Web/PWA ukrywa - feature jeszcze
              nie jest gotowe dla web, ale w native juz ma uzytkownikow. */}
          {isNative && (
            <NavLink
              to="/dziennik"
              end={false}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
              activeClassName="text-orange-600"
            >
              {({ isActive }) => (
                <>
                  <BookOpen className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                  <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>Dziennik</span>
                </>
              )}
            </NavLink>
          )}

          {/* Profil */}
          <NavLink
            to="/moj-profil"
            end={false}
            className="flex flex-col items-center justify-center gap-1 text-muted-foreground transition-colors"
            activeClassName="text-orange-600"
          >
            {({ isActive }) => (
              <>
                <User className={`h-5 w-5 ${isActive ? "stroke-[2.5px]" : "stroke-2"}`} />
                <span className={`text-[10px] font-medium ${isActive ? "text-orange-600" : ""}`}>Profil</span>
              </>
            )}
          </NavLink>

        </div>
      </nav>
    </>
  );
};

export default BottomNav;
