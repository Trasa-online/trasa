// Powiadomienie mailowe dla admina o nowej tresci UGC czekajacej na moderacje.
// Wolane z klienta po publikacji (best-effort). Adresat: ADMIN_NOTIFY_EMAIL (env)
// lub fallback nat.maz98@gmail.com.
//
// Hardening (pentest): (1) escape HTML danych od usera (byl HTML/phishing inject),
// (2) walidacja - wysylamy TYLKO jesli collection_id to realne zestawienie w
// statusie 'pending' (blokuje spam dowolnym payloadem). Dane do maila bierzemy z
// bazy (service role), nie z requestu.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Escape do bezpiecznego wstawienia w HTML maila.
const esc = (s: unknown): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { collection_id } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    // Walidacja: collection_id musi wskazywac realne, oczekujace na moderacje
    // zestawienie. Dane do maila bierzemy z bazy (nie ufamy requestowi).
    if (!collection_id || typeof collection_id !== "string") {
      return new Response(JSON.stringify({ ok: false, skipped: "no collection_id" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: col } = await sb
      .from("discovery_collections")
      .select("title, city, author_name, moderation_status")
      .eq("id", collection_id)
      .maybeSingle();
    if (!col || col.moderation_status !== "pending") {
      // Nie istnieje / nie czeka na moderacje -> nie wysylamy (anty-spam).
      return new Response(JSON.stringify({ ok: false, skipped: "not pending" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const to = (Deno.env.get("ADMIN_NOTIFY_EMAIL") || "nat.maz98@gmail.com")
      .split(",").map((s) => s.trim()).filter(Boolean);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "spontaway <noreply@trasa.travel>",
        to,
        subject: `Do moderacji: nowe zestawienie "${(col.title || "bez tytulu").slice(0, 120)}"`,
        html: `
          <h2>Nowa tresc UGC czeka na akceptacje</h2>
          <p><strong>Tytul:</strong> ${esc(col.title) || "(brak)"}</p>
          <p><strong>Miasto:</strong> ${esc(col.city) || "(brak)"}</p>
          <p><strong>Autor:</strong> ${esc(col.author_name) || "(anonimowy)"}</p>
          <p><strong>ID:</strong> ${esc(collection_id)}</p>
          <p><strong>Czas:</strong> ${esc(new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" }))}</p>
          <hr>
          <p>Wejdz w panel admina &rarr; zakladka Zestawienia, zeby zaakceptowac lub odrzucic.</p>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Resend error: ${text}`);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[notify-admin-content]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
