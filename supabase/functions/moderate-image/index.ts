// SafeSearch (Google Cloud Vision) dla zdjec wgrywanych przez uzytkownikow.
// Wymog App Store Guideline 1.2 - "filtrowanie tresci nieodpowiednich" obok zgloszen
// (content_reports / place_flags) i blokowania userow.
//
// Kontrakt: POST { url } -> { enabled, verdict: "ok" | "rejected" | "skipped", scores }
//  - brak sekretu GOOGLE_VISION_API_KEY  -> { enabled:false, verdict:"skipped" }  (fail-open:
//    dopoki klucz nie jest ustawiony, wgrywanie dziala normalnie - nie blokujemy aplikacji),
//  - blad Vision / timeout                -> { verdict:"skipped" } (nie karzemy usera za nasza awarie),
//  - adult|violence >= LIKELY albo racy = VERY_LIKELY -> "rejected".
// Progi swiadomie asymetryczne: "racy" bywa czule na zdjecia z plazy/basenu, wiec odrzucamy
// dopiero przy VERY_LIKELY.
//
// Uwierzytelnienie: wymagany JWT uzytkownika (jak w pozostalych funkcjach klienckich) -
// funkcja nie moze byc otwartym proxy do platnego API.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ORDER = ["UNKNOWN", "VERY_UNLIKELY", "UNLIKELY", "POSSIBLE", "LIKELY", "VERY_LIKELY"];
const atLeast = (value: string | undefined, min: string) =>
  ORDER.indexOf(String(value ?? "UNKNOWN")) >= ORDER.indexOf(min);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // ── Auth: tylko zalogowany user (funkcja bije w platne API Google) ──
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const { url, context, debugForceReject } = await req.json().catch(() => ({ url: null, context: null, debugForceReject: false }));
    if (!url || typeof url !== "string" || !/^https?:\/\//.test(url)) {
      return json({ enabled: true, verdict: "skipped", reason: "bad url" });
    }

    const KEY = Deno.env.get("GOOGLE_VISION_API_KEY");
    if (!KEY) {
      // Klucz jeszcze nieustawiony - nie blokujemy wgrywania.
      return json({ enabled: false, verdict: "skipped", reason: "no api key" });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        requests: [{ image: { source: { imageUri: url } }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }],
      }),
    }).catch(() => null);
    clearTimeout(timeout);

    if (!res || !res.ok) {
      console.warn("[moderate-image] vision call failed:", res?.status);
      return json({ enabled: true, verdict: "skipped", reason: "vision error" });
    }
    const data = await res.json();
    const ann = data?.responses?.[0]?.safeSearchAnnotation;
    if (!ann) return json({ enabled: true, verdict: "skipped", reason: "no annotation" });

    // Tryb testowy: pozwala sprawdzic caly tor odrzucenia (kwarantanna + log) bez wgrywania
    // nieodpowiedniej tresci. Dziala TYLKO dla admina - dla zwyklego usera flaga jest ignorowana.
    let forceReject = false;
    if (debugForceReject) {
      const { data: role } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      forceReject = !!role;
    }

    const rejected = forceReject ||
      atLeast(ann.adult, "LIKELY") ||
      atLeast(ann.violence, "LIKELY") ||
      atLeast(ann.racy, "VERY_LIKELY");

    // SLAD PO ODRZUCENIU: kopia pliku do PRYWATNEGO bucketa kwarantanny + wpis w
    // image_moderation_log (service role - klient nie moze tego pominac ani podrobic).
    // Best-effort: blad zapisu nie zmienia werdyktu, zeby awaria logu nie przepuscila zdjecia.
    let quarantinePath: string | null = null;
    if (rejected) {
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
        );
        const bin = await fetch(url).then((r) => (r.ok ? r.arrayBuffer() : null)).catch(() => null);
        if (bin) {
          const ext = (url.split("?")[0].split(".").pop() || "jpg").slice(0, 5);
          quarantinePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
          const up = await admin.storage.from("moderation-quarantine")
            .upload(quarantinePath, new Uint8Array(bin), { contentType: "image/jpeg", upsert: false });
          if (up.error) { console.warn("[moderate-image] quarantine upload:", up.error.message); quarantinePath = null; }
        }
        await admin.from("image_moderation_log").insert({
          user_id: user.id,
          context: typeof context === "string" ? context.slice(0, 40) : null,
          source_url: url,
          quarantine_path: quarantinePath,
          verdict: "rejected",
          scores: ann,
        });
      } catch (e) {
        console.warn("[moderate-image] log failed:", e instanceof Error ? e.message : e);
      }
    }

    return json({
      enabled: true,
      verdict: rejected ? "rejected" : "ok",
      logged: rejected ? { quarantined: !!quarantinePath, forced: forceReject } : undefined,
      scores: { adult: ann.adult, violence: ann.violence, racy: ann.racy, medical: ann.medical, spoof: ann.spoof },
    });
  } catch (e) {
    console.error("[moderate-image]", e instanceof Error ? e.message : e);
    return json({ enabled: true, verdict: "skipped", reason: "exception" });
  }
});
