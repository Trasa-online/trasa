// =====================================================================
// translate-text — Edge Function (2026-09-18)
// =====================================================================
// Tlumaczenie TRESCI USEROW na zadanie (guzik "Przetlumacz" pod notka / opisem wyjazdu /
// opisem kolekcji). Silnik: Claude Haiku 4.5 BEZPOSREDNIO przez API Anthropica - decyzja
// Nat 2026-09-18: bez bramki Lovable, przez ktora ida pozostale funkcje AI, bo slownictwo
// apki (miejscowki, slang, nazwy lokali) wymaga modelu, ktory rozumie kontekst, a klucz
// i faktura maja byc nasze.
//
// Kolejnosc: auth (zalogowany user) -> limit dlugosci -> CACHE (tabela translations,
// sha256 tresci + jezyk; trafienie NIE zuzywa limitu) -> LIMITY (claim_translation_quota:
// 30/h i 150/dobe na usera, 20 000 znakow/dobe na usera, 3 000/dobe globalnie) -> model ->
// zapis do cache -> odpowiedz. Tresc oryginalna NIGDY nie jest nadpisywana - klient pokazuje
// tlumaczenie POD oryginalem.
//
// Sekret: ANTHROPIC_API_KEY (supabase secrets). verify_jwt = true w config.toml, a tu
// dodatkowo getUser(token) - limit liczy sie per KONTO, wiec user musi byc znany.
// =====================================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MODEL = "claude-haiku-4-5-20251001";
const MAX_INPUT_CHARS = 1500;
const LANG_NAMES: Record<string, string> = { en: "English", pl: "Polish", de: "German", es: "Spanish", fr: "French", it: "Italian", uk: "Ukrainian", cs: "Czech", pt: "Portuguese", nl: "Dutch" };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { text, target_lang } = await req.json().catch(() => ({}));
    if (typeof text !== "string" || !text.trim()) return json({ error: "missing_text" }, 400);
    if (text.length > MAX_INPUT_CHARS) return json({ error: "too_long" }, 400);
    const lang = String(target_lang ?? "en").toLowerCase().slice(0, 2);
    const langName = LANG_NAMES[lang];
    if (!langName) return json({ error: "unsupported_lang" }, 400);

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = token ? await sb.auth.getUser(token) : { data: { user: null } };
    if (!user) return json({ error: "unauthorized" }, 401);

    // Cache: ta sama tresc (po normalizacji bialych znakow) w tym samym jezyku = jedna odpowiedz.
    const normalized = text.replace(/\s+/g, " ").trim();
    const hash = await sha256(normalized);
    const { data: hit } = await sb.from("translations").select("translated").eq("source_hash", hash).eq("target_lang", lang).maybeSingle();
    if (hit?.translated) return json({ translated: hit.translated, cached: true });

    const { data: quota, error: qErr } = await sb.rpc("claim_translation_quota", { p_user: user.id, p_chars: normalized.length });
    if (qErr) { console.error("[translate-text] quota rpc:", qErr.message); return json({ error: "quota_error" }, 500); }
    if (!quota?.ok) return json({ error: "limit", reason: quota?.reason ?? "unknown" }, 429);

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) return json({ error: "not_configured" }, 500);

    // Prompt: notka podroznika, nie dokument. Nazwy lokali i miejsc zostaja jak w oryginale,
    // emoji i ton tez. Model oddaje SAM przeklad - bez cudzyslowow, komentarzy i "oto tlumaczenie".
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        temperature: 0.2,
        system: `You translate short user-written travel notes for the Spontaway app into ${langName}. Rules: keep the author's tone, slang and emoji; keep names of venues, streets, dishes and places exactly as written (do not translate or transliterate them); keep line breaks; do not add explanations, quotes or prefixes. If the text is already in ${langName}, return it unchanged. Output only the translation.`,
        messages: [{ role: "user", content: normalized }],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      console.error("[translate-text] anthropic", res.status, errText.slice(0, 300));
      return json({ error: "model_error" }, 502);
    }
    const out = await res.json();
    const translated = String((out?.content ?? []).filter((c: any) => c?.type === "text").map((c: any) => c.text).join("")).trim();
    if (!translated) return json({ error: "empty" }, 502);

    // Zapis do cache - konflikt (rownolegle zadanie zdazylo pierwsze) ignorujemy.
    await sb.from("translations").upsert({ source_hash: hash, target_lang: lang, source_text: normalized, translated, model: MODEL }, { onConflict: "source_hash,target_lang", ignoreDuplicates: true });
    return json({ translated, cached: false });
  } catch (e) {
    console.error("[translate-text] failed:", String(e));
    return json({ error: "failed" }, 500);
  }
});
