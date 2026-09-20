import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { useNavigate } from "react-router-dom";

// Module-level state - przezywa React re-mounts (App.tsx rerenderuje sie
// przy nawigacji, splash hide, OAuth callback). Bez tego useEffect cleanup
// usuwa listenery PushNotifications zanim APNs zdazy odpowiedziec.
let registeredForUser: string | null = null;
let listenersAttached = false;
// Capture'uje aktualny navigate (zeby push action mial dostep do nawigacji)
let currentNavigate: ((url: string) => void) | null = null;
// Cel z ostatniego tapnietego pusha. Przy ZIMNYM starcie nawigacja z pusha sciga sie ze
// startowym przekierowaniem apki (RootPage `/` -> `/eksploruj`): retained event z natywki
// przychodzi po podpieciu listenera, czyli w tej samej chwili, w ktorej boot dopiero ustala
// ekran startowy. Kto wygra, zalezy od kolejnosci mikrotaskow i round-tripow do natywki -
// a przegrana wyglada jak "push nic nie otworzyl". Dlatego cel zyje tu, a RootPage pyta o
// niego PRZED wyborem ekranu startowego (`consumePendingPushUrl`), a `openPushUrl` sprawdza
// po chwili, czy adres faktycznie sie utrzymal, i w razie czego nawiguje raz jeszcze.
let pendingPushUrl: string | null = null;

/** RootPage: cel pusha zamiast domyslnego ekranu startowego (jednorazowo). */
export function consumePendingPushUrl(): string | null {
  const u = pendingPushUrl;
  pendingPushUrl = null;
  return u;
}

/** Docelowy hash (bez `#`) zaczyna sie od `url` - porownujemy sciezke z query, bez state. */
const atUrl = (url: string) => window.location.hash.replace(/^#/, "").startsWith(url);

function openPushUrl(url: string) {
  pendingPushUrl = url;
  if (currentNavigate) currentNavigate(url);
  // Dwie proby PO nawigacji: 600 ms lapie przekierowanie startowe, 2000 ms - wolniejszy boot
  // (Suspense + zapytanie o sesje). Gdy adres sie utrzymal, cel jest juz zuzyty i nic sie
  // nie dzieje; user, ktory w te 2 s sam gdzies poszedl, zostaje tam, gdzie poszedl, bo
  // powtorka idzie TYLKO gdy stoimy na ekranie startowym (`/` albo `/eksploruj`).
  for (const ms of [600, 2000]) {
    setTimeout(() => {
      if (pendingPushUrl !== url || atUrl(url)) { if (atUrl(url)) pendingPushUrl = null; return; }
      const here = window.location.hash.replace(/^#/, "");
      if (here === "" || here === "/" || here.startsWith("/eksploruj")) {
        console.log("[NativePush] push url lost to boot redirect - retrying", url);
        currentNavigate?.(url);
      }
    }, ms);
  }
}
// Cache user.id zeby callback registration mial do czego zapisac token
let currentUserId: string | null = null;

// Listenery dodajemy TYLKO RAZ na cale zycie modulu, nie per-render.
// Cleanup w useEffect kasowal je zanim APNs zdazy odpowiedziec (token
// przychodzi async po register(), a hook unmount sie wczesniej).
// Wywolywane PRZED jakimkolwiek register() (auto albo z onboardingu),
// zeby token mial gdzie wrocic niezaleznie od tego kto wywola register().
async function attachListeners(PushNotifications: any) {
  if (listenersAttached) return;
  listenersAttached = true;

  await PushNotifications.addListener("registration", async (token: { value?: string }) => {
    console.log("[NativePush] APNs token received, len:", token.value?.length);
    if (!token.value || !currentUserId) {
      console.warn("[NativePush] missing token or userId, skip upsert");
      return;
    }
    const { error: upsertErr } = await supabase.from("push_subscriptions" as any)
      .upsert({
        user_id: currentUserId,
        apns_token: token.value,
        platform: "ios",
        endpoint: null,
        p256dh: null,
        auth: null,
      } as any, { onConflict: "user_id,apns_token" });
    if (upsertErr) {
      console.error("[NativePush] DB upsert FAILED:", upsertErr.message, upsertErr.code);
    } else {
      console.log("[NativePush] DB upsert SUCCESS - token saved");
    }
  });

  await PushNotifications.addListener("registrationError", (err: unknown) => {
    console.warn("[NativePush] registration error:", JSON.stringify(err));
  });

  await PushNotifications.addListener("pushNotificationReceived", (notification: { title?: string; body?: string }) => {
    console.log("[NativePush] foreground received:", notification.title, notification.body);
  });

  await PushNotifications.addListener("pushNotificationActionPerformed", (action: { notification: { data?: Record<string, unknown> } }) => {
    const data = action.notification.data ?? {};
    const url = (data as any).url;
    if (typeof url === "string" && url.startsWith("/") && !url.startsWith("//")) {
      console.log("[NativePush] action -> navigate", url);
      openPushUrl(url);
    } else {
      console.warn("[NativePush] action without usable url:", JSON.stringify(data).slice(0, 200));
    }
  });
  console.log("[NativePush] all listeners attached (module-level, persistent)");
}

/**
 * Jawne zadanie zgody na powiadomienia + rejestracja. Wolane WYLACZNIE z bramy zgod
 * w kontekscie (lib/permissionPrompts: pierwsza kolekcja/wyjazd, dzwonek, Ustawienia) -
 * to user, nie start apki, decyduje, kiedy pojawia sie systemowy alert. Listenery sa juz
 * podpiete przez useNativePush() (albo podpina je tutaj), wiec token trafi do push_subscriptions.
 * Zwraca status zgody. Na web/PWA zwraca "unsupported" (osobny usePushNotifications).
 */
export async function requestAndRegisterNativePush(
  userId: string | null,
): Promise<"granted" | "denied" | "unsupported"> {
  if (!isNative) return "unsupported";
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await attachListeners(PushNotifications);
    if (userId) currentUserId = userId;

    // requestPermissions() pokazuje systemowy modal. UWAGA iOS: alert pojawia sie
    // TYLKO RAZ na instalacje - jesli zgoda zostala juz raz ustalona (np. w
    // poprzednim buildzie), zwraca zapisany status bez UI. Zeby znow zobaczyc
    // modal trzeba odinstalowac i zainstalowac apke od nowa (rebuild nie wystarczy).
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive === "granted") {
      if (userId) registeredForUser = userId;
      await PushNotifications.register();
      return "granted";
    }
    return "denied";
  } catch (err: any) {
    console.error("[NativePush] explicit request failed:", err?.message ?? err);
    return "denied";
  }
}

/**
 * Rejestracja BEZ pytania: gdy zgoda juz jest (user dal ja wczesniej), upewnij sie, ze token
 * APNs jest zapisany. Nigdy nie pokazuje systemowego alertu.
 */
export async function registerNativePushIfGranted(): Promise<boolean> {
  if (!isNative) return false;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await attachListeners(PushNotifications);
    const status = await PushNotifications.checkPermissions();
    if (status.receive !== "granted") return false;
    if (!currentUserId) {
      const { data } = await supabase.auth.getSession();
      currentUserId = data.session?.user?.id ?? null;
    }
    if (!currentUserId) return false;
    registeredForUser = currentUserId;
    await PushNotifications.register();
    return true;
  } catch (err: any) {
    console.warn("[NativePush] register-if-granted failed:", err?.message ?? err);
    return false;
  }
}

export function useNativePush() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Trzymaj navigate aktualne (zmienia sie przy kazdym re-render)
  useEffect(() => {
    currentNavigate = (url: string) => navigate(url);
  }, [navigate]);

  useEffect(() => {
    console.log("[NativePush] hook fired", {
      isNative,
      hasUser: !!user,
      registeredForUser,
      userId: user?.id?.slice(0, 8),
    });
    if (!isNative || !user) {
      console.log("[NativePush] early return - not native or no user");
      return;
    }
    if (registeredForUser === user.id) {
      console.log("[NativePush] early return - already registered for this user");
      return;
    }
    registeredForUser = user.id;
    currentUserId = user.id;
    console.log("[NativePush] starting init for user", user.id.slice(0, 8));

    (async () => {
      try {
        console.log("[NativePush] importing plugin...");
        const { PushNotifications } = await import("@capacitor/push-notifications");
        // Podepnij listenery ZAWSZE (niezaleznie od stanu zgody) - zeby pozniejszy
        // register() (auto albo z ekranu onboardingu) mial gdzie dostarczyc token.
        await attachListeners(PushNotifications);

        const status = await PushNotifications.checkPermissions();
        console.log("[NativePush] current permission status:", status.receive);

        if (status.receive === "granted") {
          // Zgoda juz jest - rejestruj (odswieza token po reinstalacji / nowym buildzie).
          console.log("[NativePush] already granted - calling register()...");
          await PushNotifications.register();
          return;
        }
        // Zgody nie ma (prompt/denied): NIC nie pokazujemy przy starcie. Systemowy alert
        // odpala wylacznie brama zgod w kontekscie (lib/permissionPrompts) - po pierwszej
        // kolekcji/wyjezdzie, przy dzwonku albo w Ustawieniach (decyzja Nat 2026-09-14; do tego
        // dnia po ukonczonym onboardingu alert wyskakiwal od razu po zalogowaniu).
        console.log("[NativePush] no permission yet - waiting for an in-context ask");
        registeredForUser = null; // pozwol ponowic rejestracje, gdy zgoda przyjdzie pozniej
      } catch (err: any) {
        console.error("[NativePush] init failed:", err?.message ?? err, JSON.stringify(err));
        registeredForUser = null;
      }
    })();

    // NIE zwracamy cleanup - listenery musza przezyc unmount'y zeby APNs token
    // mial gdzie wrocic. Single-instance app, jeden user na raz, nie ma race.
  }, [user]);
}
