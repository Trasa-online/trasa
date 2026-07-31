import { isNative } from "@/lib/platform";

// ─────────────────────────────────────────────────────────────────────────────
// Tryb uproszczony aplikacji (2026-07-21)
//
// Decyzja produktowa: na TERAZ upraszczamy apkę do rdzenia
//   Eksploruj -> Zapisz -> Wyjazd z zapisanych + notki.
// Wyłączamy planowanie tras, generowanie planu przez AI, timeline i sesje
// grupowe jako osobny silnik planowania. Wracamy do tego "za dwa lata".
//
// WAŻNE: to jest przełącznik UI, NIE usunięcie kodu ani danych. Cały kod
// planowania (PlanWizard, CreateRoute, PlanChatExperience, sesje grupowe) oraz
// tabele w Supabase (routes, pins, chat_sessions, group_sessions...) zostają
// nietknięte. Ustaw SIMPLIFIED_APP = false, żeby przywrócić pełny stary flow.
// ─────────────────────────────────────────────────────────────────────────────
export const SIMPLIFIED_APP = true;

// Planowanie wyłączamy tylko w natywnej apce (to ona jest produktem uproszczonym).
// Web/PWA zostaje bez zmian - m.in. testowy flow sesji grupowej (/sesja, /create)
// odblokowany w WebWaitlistGate nadal działa.
export const PLANNING_DISABLED = SIMPLIFIED_APP && isNative;

// ─────────────────────────────────────────────────────────────────────────────
// Cięcie kosztów Google Places (2026-07-26)
//
// Decyzja: przestajemy wołać PŁATNE Place Details od Google (recenzje, godziny,
// opis, oceny "na żywo"). To był najdroższy telefon do Google - odpalany przy
// KAŻDYM otwarciu wizytówki, w najwyższym koszyku cenowym (Atmosphere + Reviews),
// dodatkowo poprzedzony 2-3 telefonami "które to miejsce?" (Nearby/Text Search).
//
// Co ZOSTAJE:
//   - Nasze dane z bazy (nazwa, kategoria, lokalizacja, ocena/adres jeśli w DB)
//   - Zdjęcia przez `cache-place-photo` (jeden tani telefon, cache w Storage NA ZAWSZE)
//   - Link "Zobacz w Google Maps" w sekcji "Na mapie" wizytówki (user idzie po
//     recenzje/godziny bezpośrednio do Google)
//   - Wizytówki firm B2B (mają własne dane, nigdy nie zależały od Google Details)
//
// Co ZNIKA z wizytówki zwykłego miejsca: recenzje/godziny/opis z Google w apce
// (były już częściowo ukryte - reviews przez `hideReviews`).
//
// To przełącznik, NIE usunięcie kodu. Ustaw = false, żeby wrócić do Place Details.
// ─────────────────────────────────────────────────────────────────────────────
export const GOOGLE_PLACE_DETAILS_DISABLED = true;

// ─────────────────────────────────────────────────────────────────────────────
// Fake door (web, 2026-07-31)
//
// Osobny byt WEBOWY do walidacji "szukania i wykorzystywania tras" (fake door
// testing). Zyje na branchu `web` + domenie trasatravel.com, deployowany jako
// osobny projekt Vercel. NIE dotyczy apki natywnej (tam flaga = off).
//
// Wlaczana WYLACZNIE przez env `VITE_FAKE_DOOR=1` w projekcie Vercel `web`.
// Gdy true: App.tsx robi early-return na dedykowany landing fake doora,
// z pominieciem routera i WebWaitlistGate (patrz App.tsx).
// ─────────────────────────────────────────────────────────────────────────────
export const FAKE_DOOR = import.meta.env.VITE_FAKE_DOOR === "1";
