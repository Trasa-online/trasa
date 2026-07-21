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
