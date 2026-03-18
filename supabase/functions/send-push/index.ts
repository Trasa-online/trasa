import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Web Push utilities using Web Crypto API
async function importVapidKeys(publicKey: string, privateKey: string) {
  const rawPrivateKey = base64UrlToUint8Array(privateKey);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    rawPrivateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return { publicKey, privateKey: cryptoKey };
}

function base64UrlToUint8Array(base64Url: string): Uint8Array {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function uint8ArrayToBase64Url(uint8Array: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function generateJWT(
  endpoint: string,
  subject: string,
  privateKey: CryptoKey
): Promise<string> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: subject,
  };

  const encoder = new TextEncoder();
  const headerB64 = uint8ArrayToBase64Url(
    encoder.encode(JSON.stringify(header))
  );
  const payloadB64 = uint8ArrayToBase64Url(
    encoder.encode(JSON.stringify(payload))
  );

  const signingInput = encoder.encode(`${headerB64}.${payloadB64}`);
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    signingInput
  );

  // Convert DER signature to raw r||s format for JWT
  const sigArray = new Uint8Array(signature);
  const signatureB64 = uint8ArrayToBase64Url(sigArray);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: CryptoKey,
  vapidSubject: string
): Promise<Response> {
  const jwt = await generateJWT(subscription.endpoint, vapidSubject, vapidPrivateKey);

  const response = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
    },
    body: new TextEncoder().encode(payload),
  });

  return response;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, body, url } = await req.json();

    if (!user_id || !title) {
      return new Response(
        JSON.stringify({ error: "user_id and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKeyRaw = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get user's push subscriptions
    const { data: subscriptions, error: subError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", user_id);

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No subscriptions found for user", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keys = await importVapidKeys(vapidPublicKey, vapidPrivateKeyRaw);
    const payload = JSON.stringify({ title, body: body || "", url: url || "/" });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const response = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payload,
          vapidPublicKey,
          keys.privateKey,
          vapidSubject
        );
        const responseBody = await response.text();

        if (response.status === 201 || response.status === 200) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired, remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          failed++;
        } else {
          console.error(`Push failed for ${sub.id}: ${response.status} ${responseBody}`);
          failed++;
        }
      } catch (err) {
        console.error(`Push error for ${sub.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ sent, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("send-push error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
