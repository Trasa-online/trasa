// Powiadomienie mailowe dla admina o nowej tresci UGC czekajacej na moderacje
// (zestawienie od anonimowego usera). Wolane z klienta po publikacji (best-effort).
// Adresat: ADMIN_NOTIFY_EMAIL (env, lista po przecinku) lub fallback nat.maz98@gmail.com.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, title, city, collection_id, author } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const to = (Deno.env.get("ADMIN_NOTIFY_EMAIL") || "nat.maz98@gmail.com")
      .split(",").map((s) => s.trim()).filter(Boolean);

    const kind = type === "ranking" ? "zestawienie" : "tresc";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trasa <noreply@trasa.travel>",
        to,
        subject: `Do moderacji: nowe ${kind} "${title || "bez tytulu"}"`,
        html: `
          <h2>Nowa tresc UGC czeka na akceptacje</h2>
          <p><strong>Typ:</strong> ${kind}</p>
          <p><strong>Tytul:</strong> ${title || "(brak)"}</p>
          <p><strong>Miasto:</strong> ${city || "(brak)"}</p>
          <p><strong>Autor:</strong> ${author || "(anonimowy)"}</p>
          <p><strong>ID:</strong> ${collection_id || "(brak)"}</p>
          <p><strong>Czas:</strong> ${new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
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
