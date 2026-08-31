import { useState, useEffect, useContext, createContext, ReactNode, useRef } from "react";
import { User, Session } from "@supabase/supabase-js";
import posthog from "posthog-js";
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
    // Global safety net: ensure profile row exists for every signed-in non-anon user.
    // group_sessions.created_by, group_session_members.user_id, user_place_reactions.user_id,
    // routes.original_creator_id i kilka innych tabel maja FK -> public.profiles(id).
    // Jezeli profile row nie istnieje (np. pre-20260601 handle_new_user trigger failure
    // dla username collision, OAuth user_id mismatch, anon -> OAuth linkIdentity edge case),
    // inserty do tych tabel padaja z FK violation. RPC robi idempotent INSERT z resilient
    // username generation. Wywolanie raz per SIGNED_IN event - akceptowalny koszt.
    const ensuredForUserId = { current: null as string | null };
    const ensureProfileIfNeeded = (session: Session | null) => {
      if (!session?.user || session.user.is_anonymous) return;
      if (ensuredForUserId.current === session.user.id) return;
      ensuredForUserId.current = session.user.id;
      supabase.rpc("ensure_current_user_profile").then(({ error }) => {
        if (error) console.warn("[useAuth] ensure_current_user_profile failed:", error.message);
      }).catch((err) => console.warn("[useAuth] ensure_current_user_profile threw:", err));
    };

    // PostHog: przypisanie zdarzen do usera. Robimy to CENTRALNIE (nie w Auth.tsx), zeby
    // objac WSZYSTKIE sciezki: email, OAuth (Apple/Google), magic link i wznowienie sesji po
    // restarcie apki. Bez identify lejki licza anonimowe distinct_id zamiast userow.
    // Anonimowych (guest mode) NIE identyfikujemy - to nie sa konta.
    const identifiedUserId = { current: null as string | null };
    const identifyIfNeeded = (session: Session | null) => {
      const u = session?.user;
      if (!u || (u as any).is_anonymous) return;
      if (identifiedUserId.current === u.id) return;
      identifiedUserId.current = u.id;
      try { posthog.identify(u.id, { email: u.email }); }
      catch (e) { console.warn("[useAuth] posthog.identify:", e instanceof Error ? e.message : e); }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        identifyIfNeeded(session);
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "USER_UPDATED") {
          ensureProfileIfNeeded(session);
        }
      }
    );

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        identifyIfNeeded(session);
        ensureProfileIfNeeded(session);
      })
      .catch(() => setLoading(false));

    const timeout = setTimeout(() => setLoading(false), 3000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  // Tryb goscia WYLACZONY: NIE tworzymy juz automatycznie konta anonimowego.
  // Apka konsumencka wymaga realnego logowania (AuthGate w App.tsx przekierowuje
  // niezalogowanych na /auth). B2B onboarding (BusinessStart) uzywa wlasnego anon.

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
