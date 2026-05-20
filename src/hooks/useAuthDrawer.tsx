import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";

type AuthDrawerMode = "login" | "register";

interface AuthDrawerState {
  isOpen: boolean;
  mode: AuthDrawerMode;
  hint?: string | null;
}

interface AuthDrawerContextValue extends AuthDrawerState {
  open: (opts?: { mode?: AuthDrawerMode; hint?: string | null }) => void;
  close: () => void;
}

const AuthDrawerContext = createContext<AuthDrawerContextValue | null>(null);

const FIRST_VISIT_KEY = "trasa_auth_drawer_first_visit_seen";

interface AuthDrawerProviderProps {
  children: ReactNode;
  user: { id: string } | null | undefined;
  loading: boolean;
}

export function AuthDrawerProvider({ children, user, loading }: AuthDrawerProviderProps) {
  const [state, setState] = useState<AuthDrawerState>({ isOpen: false, mode: "register", hint: null });

  const open = useCallback((opts?: { mode?: AuthDrawerMode; hint?: string | null }) => {
    setState({ isOpen: true, mode: opts?.mode ?? "register", hint: opts?.hint ?? null });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  // Auto-open on first visit when user is anonymous/null and on an in-app route.
  useEffect(() => {
    if (loading) return;
    if (user) return;
    let alreadySeen = false;
    try { alreadySeen = sessionStorage.getItem(FIRST_VISIT_KEY) === "1"; } catch { /* unavailable */ }
    if (alreadySeen) return;

    const path = window.location.hash.replace(/^#/, "") || "/";
    const skip =
      path.startsWith("/auth") ||
      path.startsWith("/waitlist") ||
      path.startsWith("/landing") ||
      path.startsWith("/terms") ||
      path.startsWith("/biznes") ||
      path.startsWith("/dla-firm") ||
      path.startsWith("/set-password") ||
      path.startsWith("/demo") ||
      path.startsWith("/join/") ||
      path.startsWith("/lokal/") ||
      path.startsWith("/profil/") ||
      path.startsWith("/route/");
    if (skip) return;

    try { sessionStorage.setItem(FIRST_VISIT_KEY, "1"); } catch { /* unavailable */ }
    setState({ isOpen: true, mode: "register", hint: null });
  }, [user, loading]);

  return (
    <AuthDrawerContext.Provider value={{ ...state, open, close }}>
      {children}
    </AuthDrawerContext.Provider>
  );
}

export function useAuthDrawer() {
  const ctx = useContext(AuthDrawerContext);
  if (!ctx) throw new Error("useAuthDrawer must be used within AuthDrawerProvider");
  return ctx;
}
