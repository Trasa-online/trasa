import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { isNative } from "@/lib/platform";

/**
 * Lightweight haptic feedback for native platforms. No-op on web.
 *
 * Use sparingly — at moments where the user expects tactile confirmation:
 * - light(): button taps, toggle, minor confirm
 * - medium(): swipe action like/dislike, drag drop
 * - success(): completed flow, match created
 * - warning(): destructive confirm prompt
 * - error(): failed action
 */
// Zwykly obiekt (nie hook) - mozna importowac i wolac wszedzie, tez w funkcjach modulowych:
//   import { haptics } from "@/hooks/useHaptics";  haptics.light();
// Na web to no-op. Uzywaj oszczednie (momenty oczekiwanego dotyku).
export const haptics = {
  light: () => {
    if (!isNative) return;
    Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  medium: () => {
    if (!isNative) return;
    Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  heavy: () => {
    if (!isNative) return;
    Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  },
  selection: () => {
    // Lekki "tick" przy przelaczaniu (toggle/segment). Na iOS = selectionChanged.
    if (!isNative) return;
    Haptics.selectionChanged().catch(() => {});
  },
  success: () => {
    if (!isNative) return;
    Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
  warning: () => {
    if (!isNative) return;
    Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  },
  error: () => {
    if (!isNative) return;
    Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  },
};

// Hook zachowany dla kompatybilnosci (zwraca ten sam obiekt).
export const useHaptics = () => haptics;
