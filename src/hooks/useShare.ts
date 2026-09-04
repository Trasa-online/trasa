import { Share } from "@capacitor/share";
import { isNative, capabilities } from "@/lib/platform";
import { track } from "@/lib/analytics";

export type ShareOpts = {
  title?: string;
  text?: string;
  url: string;
  /** Co udostepniamy - trafia do analityki jako `content_shared.kind`. */
  kind?: "route" | "list" | "profile" | "place";
};

export type ShareResult =
  | { ok: true; method: "native" | "webshare" | "clipboard" }
  | { ok: false; method: "none"; error?: unknown };

/**
 * Share or copy a link, choosing the best path per platform.
 *
 * - iOS/Android (Capacitor): opens native share sheet
 * - Web with navigator.share: opens web share sheet (mostly mobile)
 * - Web fallback: copies url to clipboard
 *
 * Returns { ok, method } so callers can show the right toast
 * ("Udostępniono", "Skopiowano", etc.).
 */
export const useShare = () => {
  return async (opts: ShareOpts): Promise<ShareResult> => {
    // Jeden punkt dla calej aplikacji - `kind` przekazuja wolajacy (trasa, lista, profil).
    track("content_shared", { kind: opts.kind ?? "unknown", url: opts.url });
    if (isNative) {
      try {
        await Share.share({ title: opts.title, text: opts.text, url: opts.url });
        return { ok: true, method: "native" };
      } catch (error) {
        // User cancelled or share failed — fall through to clipboard
        if ((error as any)?.message?.toLowerCase?.().includes("cancel")) {
          return { ok: false, method: "none" };
        }
      }
    }

    if (capabilities.webShare) {
      try {
        await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
        return { ok: true, method: "webshare" };
      } catch (error) {
        if ((error as any)?.name === "AbortError") {
          return { ok: false, method: "none" };
        }
      }
    }

    try {
      await navigator.clipboard.writeText(opts.url);
      return { ok: true, method: "clipboard" };
    } catch (error) {
      return { ok: false, method: "none", error };
    }
  };
};
