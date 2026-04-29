const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { profile_id, business_name } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trasa <noreply@trasa.travel>",
        to: ["nat.maz98@gmail.com"],
        subject: `Nowy Founding Partner: ${business_name || "lokal bez nazwy"}`,
        html: `
          <h2>Nowy lokal chce dołączyć do Trasy!</h2>
          <p><strong>Nazwa:</strong> ${business_name || "(nie podano)"}</p>
          <p><strong>ID profilu:</strong> ${profile_id}</p>
          <p><strong>Czas:</strong> ${new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })}</p>
          <hr>
          <p>Lokal kliknął "Zakładam konto" w panelu roboczym i przechodzi do rejestracji.</p>
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
    console.error("[notify-draft-conversion]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
