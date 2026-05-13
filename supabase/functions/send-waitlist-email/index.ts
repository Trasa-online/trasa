const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();
    if (!email) throw new Error("email required");

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not set");

    const html = `
<!DOCTYPE html>
<html lang="pl">
<body style="margin:0;padding:0;background:#FEFEFE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0E0E0E;">
  <div style="max-width:480px;margin:0 auto;padding:48px 32px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fb923c,#ea580c 60%,#c2410c);margin:0 auto 24px;"></div>
    <h1 style="font-size:32px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;">Cześć!</h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 12px;">
      Dzięki, że dołączasz do <strong style="color:#0E0E0E;">Trasy</strong>.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">
      Już niedługo aplikacja będzie dostępna na iOS i Androida. Damy Ci znać jako jedna z pierwszych osób, gdy nadejdzie ten moment.
    </p>
    <div style="background:#FFF5EB;border:1px solid #FDE3CC;border-radius:16px;padding:20px;text-align:left;margin:0 0 32px;">
      <p style="font-size:14px;font-weight:700;color:#9A3412;margin:0 0 8px;">🚀 Premiera: czerwiec 2026</p>
      <p style="font-size:13px;line-height:1.5;color:#525252;margin:0;">
        Budujemy aplikację do planowania city breaków i wspólnych wyjazdów z przyjaciółmi. Coś, czego sami szukaliśmy.
      </p>
    </div>
    <p style="font-size:13px;color:#979797;margin:0 0 24px;line-height:1.6;">
      Masz pomysł, sugestię albo chcesz pomóc?<br/>
      Odpowiedz na tego maila — czytamy każdą wiadomość.
    </p>
    <p style="font-size:13px;color:#979797;margin:0;">
      Do zobaczenia w Trasie,<br/>
      <strong style="color:#0E0E0E;">Nat &amp; Bart</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0;">
        Dostałeś tego maila ponieważ zapisałeś się na waitlistę na <a href="https://trasa.travel" style="color:#F9662B;text-decoration:none;">trasa.travel</a>.
      </p>
    </div>
  </div>
</body>
</html>`.trim();

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Trasa <hello@trasa.travel>",
        to: [email],
        subject: "Cześć! Dzięki, że dołączasz do Trasy 🧡",
        html,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(JSON.stringify(data));

    return new Response(JSON.stringify({ ok: true, id: data.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("[send-waitlist-email]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
