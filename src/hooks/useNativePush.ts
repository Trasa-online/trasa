import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { isNative } from "@/lib/platform";
import { useNavigate } from "react-router-dom";

// Native iOS push notifications via Capacitor APNs.
// - Wywolywany RAZ z root tree (App.tsx) gdy user logged in i isNative.
// - Web/PWA nie uzywa tego hooka - tam jest osobny usePushNotifications
//   ktory robi Service Worker + VAPID.
//
// Flow:
//   1. requestPermissions -> uzytkownik dostaje iOS prompt "Trasa would like to..."
//   2. register -> Capacitor uzyskuje APNs token z iOS
//   3. on 'registration' event -> token zapisany w push_subscriptions
//   4. on 'pushNotificationActionPerformed' -> user tapnal notyfikacje -> deep link
export function useNativePush() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (!isNative || !user || hasInitialized.current) return;
    hasInitialized.current = true;

    let removeReg: (() => void) | null = null;
    let removeRecv: (() => void) | null = null;
    let removeAction: (() => void) | null = null;

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        // Sprawdz permission, jesli denied/prompt - poproś
        const status = await PushNotifications.checkPermissions();
        if (status.receive === "denied") {
          console.log("[NativePush] permission denied by user");
          return;
        }
        if (status.receive !== "granted") {
          const req = await PushNotifications.requestPermissions();
          if (req.receive !== "granted") {
            console.log("[NativePush] permission not granted:", req.receive);
            return;
          }
        }

        // Registration u APNs
        const regL = await PushNotifications.addListener("registration", async (token) => {
          console.log("[NativePush] APNs token received, len:", token.value?.length);
          if (!token.value) return;
          await supabase.from("push_subscriptions" as any)
            .upsert({
              user_id: user.id,
              apns_token: token.value,
              platform: "ios",
              endpoint: null,
              p256dh: null,
              auth: null,
            } as any, { onConflict: "user_id,apns_token" });
        });
        removeReg = () => regL.remove();

        await PushNotifications.addListener("registrationError", (err) => {
          console.warn("[NativePush] registration error:", JSON.stringify(err));
        });

        // Push otrzymany gdy apka jest w foreground (system NIE pokaze sam)
        const recvL = await PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("[NativePush] foreground received:", notification.title, notification.body);
          // TODO: opcjonalnie wyswietlić in-app toast tutaj
        });
        removeRecv = () => recvL.remove();

        // User tapnął push z lock screen / Notification Center
        const actL = await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          const data = action.notification.data ?? {};
          const url = (data as any).url;
          if (typeof url === "string" && url.startsWith("/")) {
            console.log("[NativePush] action -> navigate", url);
            navigate(url);
          }
        });
        removeAction = () => actL.remove();

        await PushNotifications.register();
      } catch (err: any) {
        console.error("[NativePush] init failed:", err?.message ?? err);
      }
    })();

    return () => {
      removeReg?.();
      removeRecv?.();
      removeAction?.();
    };
  }, [user, navigate]);
}
