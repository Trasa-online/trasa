import { useCallback } from "react";
import { useNavigate, type NavigateFunction } from "react-router-dom";

/**
 * Bezpieczne cofanie: wraca w historii TYLKO gdy jest dokad wracac W APLIKACJI,
 * inaczej idzie na podany ekran zapasowy.
 *
 * Zrodlem prawdy jest `window.history.state.idx` - licznik pozycji utrzymywany przez React Router.
 * NIE uzywaj `window.history.length`: w WKWebView (Capacitor) liczy ono wpisy calej sesji
 * przegladarki, wiec bywa > 1 nawet gdy aplikacja stoi na pierwszym ekranie (wejscie z deep-linka,
 * z powiadomienia push albo po wznowieniu) - `navigate(-1)` nie mial wtedy dokad isc i przycisk
 * "wstecz" po prostu nie dzialal, albo wyrzucal poza flow (zgloszenie Nat 2026-08-29).
 */
export function goBackOr(navigate: NavigateFunction, fallback: string) {
  const idx = (window.history.state as { idx?: number } | null)?.idx;
  if (typeof idx === "number" && idx > 0) navigate(-1);
  else navigate(fallback, { replace: true });
}

/** Hookowa wersja goBackOr (gdy wygodniej trzymac gotowy handler). */
export function useGoBack(fallback = "/") {
  const navigate = useNavigate();
  return useCallback(() => goBackOr(navigate, fallback), [navigate, fallback]);
}
