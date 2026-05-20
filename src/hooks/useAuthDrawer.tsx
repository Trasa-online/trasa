import { createContext, useCallback, useContext, useState, ReactNode } from "react";

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

interface AuthDrawerProviderProps {
  children: ReactNode;
  user: { id: string } | null | undefined;
  loading: boolean;
}

// Gość ląduje od razu na swipe view. Drawer otwiera się dopiero z CTA
// (GuestBanner / BottomNav / przy próbie akcji wymagającej konta).
export function AuthDrawerProvider({ children }: AuthDrawerProviderProps) {
  const [state, setState] = useState<AuthDrawerState>({ isOpen: false, mode: "register", hint: null });

  const open = useCallback((opts?: { mode?: AuthDrawerMode; hint?: string | null }) => {
    setState({ isOpen: true, mode: opts?.mode ?? "register", hint: opts?.hint ?? null });
  }, []);

  const close = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

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
