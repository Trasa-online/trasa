import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "@/components/NavLink";
import { BookOpen, Home, Plus, X, MapPin, Users, ArrowRight, Link2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const GuestModal = ({ onClose }: { onClose: () => void }) => {
  const navigate = useNavigate();
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm bg-card rounded-t-3xl px-6 pt-8 pb-[max(24px,env(safe-area-inset-bottom))] flex flex-col gap-5 shadow-2xl animate-in slide-in-from-bottom-4 duration-300"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-1.5">
          <p className="text-3xl">📒</p>
          <h2 className="text-xl font-black">Twój dziennik czeka</h2>
          <p className="text-sm text-muted-foreground">Zapisuj wspomnienia, zdjęcia i oceny miejsc z każdej podróży.</p>
        </div>
        <div className="flex flex-col gap-2.5">
          <button
            onClick={() => navigate("/auth")}
            className="w-full py-3.5 rounded-full bg-primary text-white font-bold text-base flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg shadow-primary/25"
          >
            Zaloguj się
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 rounded-full border border-border text-sm font-medium text-muted-foreground active:scale-[0.97] transition-transform"
          >
            Wróć
          </button>
        </div>
      </div>
    </div>
  );
};

const MAINTENANCE_BYPASS = new Set(["nat.maz98@gmail.com", "tomalab97@gmail.com"]);

const BottomNav = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const isGuest = !user;
  const maintenanceMode = !MAINTENANCE_BYPASS.has(user?.email ?? "");

  const handleJoinSubmit = () => {
    const code = joinCode.trim();
    if (!code) return;
    setShowJoinModal(false);
    setJoinCode("");
    navigate(`/sesja/${code}`);
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
            onClick={() => {
              setShowMenu(false);
              navigate("/sesja/nowa");
            }}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-foreground text-background font-semibold text-sm shadow-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            <Users className="h-4 w-4" />
            Zaplanuj grupowo
          </button>
          <button
            onClick={() => { setShowMenu(false); navigate("/plan"); }}
            className="flex items-center gap-2.5 px-5 py-3 rounded-full bg-primary text-white font-semibold text-sm shadow-xl active:scale-95 transition-transform whitespace-nowrap"
          >
            <MapPin className="h-4 w-4" />
            Zaplanuj solo
          </button>
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
              autoFocus
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
        <div className="grid grid-cols-3 h-12 max-w-lg mx-auto">

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

          {/* Center FAB */}
          {maintenanceMode ? (
            <button disabled className="flex items-center justify-center cursor-not-allowed" aria-label="Dodaj trasę">
              <span className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                <Plus className="h-5 w-5 text-muted-foreground/40 stroke-[2.5px]" />
              </span>
            </button>
          ) : (
            <button
              onClick={() => isGuest ? setShowGuestModal(true) : setShowMenu(!showMenu)}
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
          )}

          {/* Dziennik */}
          {isGuest ? (
            <button
              onClick={() => setShowGuestModal(true)}
              className="flex flex-col items-center justify-center gap-1 text-muted-foreground/40 transition-colors"
            >
              <BookOpen className="h-5 w-5 stroke-2" />
              <span className="text-[10px] font-medium">Dziennik</span>
            </button>
          ) : (
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

        </div>
      </nav>

      {/* Guest modal */}
      {showGuestModal && <GuestModal onClose={() => setShowGuestModal(false)} />}
    </>
  );
};

export default BottomNav;
