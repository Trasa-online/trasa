import { useState, useEffect, useContext, createContext, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  /** true when user exists AND is `is_anonymous` (Supabase Anonymous Sign-Ins). */
  isAnonymous: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  isAnonymous: false,
  signOut: async () => {},
});

// Flaga ustawiana na czas trwania zakladki przegladarki - po `signOut` nie chcemy
// natychmiast tworzyc nowego anon konta (uzytkownik moze chciec zalogowac sie
// na inne konto). SessionStorage resetuje sie przy zamknieciu zakladki.
const SKIP_ANON_SIGNIN_KEY = "trasa_skip_anon_signin";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const anonSignInAttempted = useRef(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Auto-anon signin: jesli po splash nie ma sesji, w tle tworzymy anon konto.
  // Daje to gosciowi prawdziwy user_id - sesje grupowe i reactions dzialaja
  // przez RLS jak dla zalogowanego. Routes/Journal nadal gateuje isAnonymous.
  useEffect(() => {
    if (loading) return;
    if (user) return;
    if (anonSignInAttempted.current) return;
    let skipAnon = false;
    try { skipAnon = sessionStorage.getItem(SKIP_ANON_SIGNIN_KEY) === "1"; } catch { /* unavailable */ }
    if (skipAnon) return;
    // KRYTYCZNE: jezeli URL ma ?code= (powrot z linka aktywacyjnego maila / OAuth),
    // NIE wlanczaj anon-signin. Anon-signin nadpisuje code_verifier w localStorage,
    // wiec exchangeCodeForSession potem failuje i user zostaje gosciem.
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("code")) {
        console.log("[useAuth] auth code in URL, skipping anon signin to preserve PKCE state");
        return;
      }
    }
    anonSignInAttempted.current = true;
    supabase.auth.signInAnonymously().catch((err) => {
      // Najczestsze powody: Anonymous Sign-Ins wylaczone w Dashboard, rate limit IP.
      // Failujemy grace - aplikacja dziala jako "stary" guest (null user) jak wczesniej.
      console.warn("[useAuth] anon signin failed:", err?.message ?? err);
    });
  }, [loading, user]);

  const signOut = async () => {
    try { sessionStorage.setItem(SKIP_ANON_SIGNIN_KEY, "1"); } catch { /* unavailable */ }
    anonSignInAttempted.current = false;
    await supabase.auth.signOut();
  };

  const isAnonymous = !!user?.is_anonymous;

  return (
    <AuthContext.Provider value={{ user, session, loading, isAnonymous, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
