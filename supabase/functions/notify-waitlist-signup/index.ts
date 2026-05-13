const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAILS = ["nat.maz98@gmail.com", "tomalab97@gmail.com"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    // Trigger payload (pg_net): { email: string, created_at: string, count?: number }
    // Direct call payload: { email, created_at?, count? }
    const email: string | undefined = body.email ?? body.record?.email;
    const createdAt: string | undefined = body.created_at ?? body.record?.created_at;
    const count: number | undefined = body.count;

    if (!email) throw new Error("email required");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const whenPL = createdAt
      ? new Date(createdAt).toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" })
      : new Date().toLocaleString("pl-PL", { timeZone: "Europe/Warsaw" });

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trasa <noreply@trasa.travel>",
        to: ADMIN_EMAILS,
        subject: `🎉 Nowy zapis na waitlistę: ${email}`,
        html: `
          <h2 style="margin:0 0 12px;">Nowy user na waitliście!</h2>
          <p style="margin:8px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin:8px 0;"><strong>Czas:</strong> ${whenPL}</p>
          ${count !== undefined ? `<p style="margin:8px 0;"><strong>Łącznie zapisanych:</strong> ${count}</p>` : ""}
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:16px 0;">
          <p style="margin:8px 0;font-size:12px;color:#666;">
            Sprawdź listę: <a href="https://trasa.travel/admin">trasa.travel/admin</a>
          </p>
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
    console.error("[notify-waitlist-signup]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
