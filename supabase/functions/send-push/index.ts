import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Web Push helpers using Web Crypto API ──

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const binary = atob(b64 + padding);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concatUint8(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((a, b) => a + b.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function encodeLength(len: number): Uint8Array {
  return new Uint8Array([0, len]);
}

async function generateVapidAuth(
  audience: string,
  subject: string,
  publicKey: string,
  privateKey: string,
  expiration: number
) {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = { aud: audience, exp: expiration, sub: subject };

  const headerB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(header)));
  const payloadB64 = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const unsignedToken = `${headerB64}.${payloadB64}`;

  // Import the private key
  const privKeyBytes = base64UrlToUint8Array(privateKey);
  const pubKeyBytes = base64UrlToUint8Array(publicKey);
  
  // Create JWK from raw keys
  const jwk = {
    kty: "EC",
    crv: "P-256",
    x: uint8ArrayToBase64Url(pubKeyBytes.slice(1, 33)),
    y: uint8ArrayToBase64Url(pubKeyBytes.slice(33, 65)),
    d: uint8ArrayToBase64Url(privKeyBytes),
  };

  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      new TextEncoder().encode(unsignedToken)
    )
  );

  const sigB64 = uint8ArrayToBase64Url(sig);
  return {
    token: `${unsignedToken}.${sigB64}`,
    publicKey,
  };
}

async function encryptPayload(
  clientPublicKeyB64: string,
  clientAuthB64: string,
  payload: string
) {
  const clientPublicKey = base64UrlToUint8Array(clientPublicKeyB64);
  const clientAuth = base64UrlToUint8Array(clientAuthB64);
  const payloadBytes = new TextEncoder().encode(payload);

  // Generate local ECDH keys
  const localKeyPair = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );

  const localPublicKeyRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", localKeyPair.publicKey)
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // Derive shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      localKeyPair.privateKey,
      256
    )
  );

  // Generate salt
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // HKDF for auth info
  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prk = await hkdfExtract(clientAuth, sharedSecret);
  const ikm = await hkdfExpand(prk, authInfo, 32);

  // Key info and nonce info
  const keyInfo = concatUint8(
    new TextEncoder().encode("Content-Encoding: aesgcm\0P-256\0"),
    encodeLength(clientPublicKey.length),
    clientPublicKey,
    encodeLength(localPublicKeyRaw.length),
    localPublicKeyRaw
  );
  const nonceInfo = concatUint8(
    new TextEncoder().encode("Content-Encoding: nonce\0P-256\0"),
    encodeLength(clientPublicKey.length),
    clientPublicKey,
    encodeLength(localPublicKeyRaw.length),
    localPublicKeyRaw
  );

  const prk2 = await hkdfExtract(salt, ikm);
  const contentKey = await hkdfExpand(prk2, keyInfo, 16);
  const nonce = await hkdfExpand(prk2, nonceInfo, 12);

  // Encrypt
  const aesKey = await crypto.subtle.importKey(
    "raw",
    contentKey,
    { name: "AES-GCM" },
    false,
    ["encrypt"]
  );

  const paddedPayload = concatUint8(new Uint8Array(2), payloadBytes);

  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce },
      aesKey,
      paddedPayload
    )
  );

  return { encrypted, salt, localPublicKey: localPublicKeyRaw };
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, ikm));
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const input = concatUint8(info, new Uint8Array([1]));
  const output = new Uint8Array(await crypto.subtle.sign("HMAC", key, input));
  return output.slice(0, length);
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600;

  const vapid = await generateVapidAuth(
    audience,
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey,
    expiration
  );

  const { encrypted, salt, localPublicKey } = await encryptPayload(
    subscription.p256dh,
    subscription.auth,
    payload
  );

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Content-Length": String(encrypted.length),
      TTL: "86400",
      Encryption: `salt=${uint8ArrayToBase64Url(salt)}`,
      "Crypto-Key": `dh=${uint8ArrayToBase64Url(localPublicKey)};p256ecdsa=${vapid.publicKey}`,
      Authorization: `WebPush ${vapid.token}`,
    },
    body: encrypted,
  });
}

// ── Main handler ──

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
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@trasa.app";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

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

    const payloadStr = JSON.stringify({ title, body: body || "", url: url || "/" });

    let sent = 0;
    let failed = 0;

    for (const sub of subscriptions) {
      try {
        const resp = await sendWebPush(
          { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
          payloadStr,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject
        );

        if (resp.ok || resp.status === 201) {
          sent++;
        } else if (resp.status === 410 || resp.status === 404) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
          failed++;
        } else {
          const errText = await resp.text();
          console.error(`Push error for ${sub.id}: ${resp.status} ${errText}`);
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
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
