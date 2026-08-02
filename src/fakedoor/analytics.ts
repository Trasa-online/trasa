import { track } from "@vercel/analytics";

// Pomiar lejka fake doora. Vercel Analytics (cookieless, dziala bez bannera
// zgody) = zrodlo prawdy. PostHog defensywnie (jesli user wczesniej zgodzil sie
// na cookies gdziekolwiek - `window.posthog` istnieje i jest opt-in).
//
// Lejek:
//   fd_view_list      -> wejscie na landing
//   fd_search         -> uzyto wyszukiwarki (dl. frazy)
//   fd_open_route     -> otwarto detal trasy
//   fd_open_place     -> otwarto wizytowke miejsca w trasie
//   fd_click_use      -> klik "Zapisz ta trase" (GLOWNE drzwi)
//   fd_click_create   -> klik "Zaplanuj wlasna trase" (drugie drzwi)
//   fd_submit_email   -> zostawiono mail
export type FdEvent =
  | "fd_view_list"
  | "fd_search"
  | "fd_open_route"
  | "fd_open_place"
  | "fd_click_use"
  | "fd_click_create"
  | "fd_submit_email";

type Props = Record<string, string | number | boolean>;

export function fdTrack(event: FdEvent, props?: Props): void {
  try {
    track(event, props);
  } catch {
    /* analytics never breaks UX */
  }
  try {
    (window as any).posthog?.capture?.(event, props);
  } catch {
    /* noop */
  }
}
