function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildBusinessWelcomeHtml({ businessName, panelUrl }: { businessName: string; panelUrl: string }): string {
  const name = escapeHtml(businessName);
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Twoja wizytówka na Trasie jest gotowa</title>
</head>
<body style="margin:0;padding:0;background:#FEFEFE;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0E0E0E;">
  <div style="height:8px;background:#1d4ed8;line-height:8px;font-size:0;">&nbsp;</div>
  <div style="max-width:480px;margin:0 auto;padding:48px 32px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#60a5fa,#2563eb 60%,#1d4ed8);margin:0 auto 24px;"></div>
    <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;line-height:1.25;">
      Witaj w&#160;Trasie dla&#160;firm
    </h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 12px;">
      Twoja wizytówka <strong style="color:#0E0E0E;">${name}</strong> jest&#160;aktywna.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">
      Użytkownicy Trasy mogą już trafić na&#160;Twój lokal podczas planowania wyjazdów po&#160;mieście. Uzupełnij galerię i&#160;opis, żeby wyróżnić się spośród innych miejsc.
    </p>
    <a href="${panelUrl}" style="display:inline-block;background-color:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:24px;">
      Przejdź do&#160;panelu →
    </a>
    <p style="font-size:13px;color:#979797;margin:40px 0 0;line-height:1.6;">
      Masz pytania? Odpowiedz na&#160;tego maila - jesteśmy tu dla&#160;Ciebie.
    </p>
    <p style="font-size:13px;color:#979797;margin:24px 0 0;">
      <strong style="color:#0E0E0E;">Zespół Trasy</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0;line-height:1.5;">
        Dostałeś tego maila, ponieważ założyłeś konto firmowe na&#160;<a href="https://trasa.travel" style="color:#1d4ed8;text-decoration:none;">trasa.travel</a>.<br/>
        Kontakt: <a href="mailto:hello@trasa.travel" style="color:#1d4ed8;text-decoration:none;">hello@trasa.travel</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildBusinessWelcomeText({ businessName, panelUrl }: { businessName: string; panelUrl: string }): string {
  return `Witaj w Trasie dla firm

Twoja wizytówka ${businessName} jest aktywna.

Użytkownicy Trasy mogą już trafić na Twój lokal podczas planowania wyjazdów po mieście. Uzupełnij galerię i opis, żeby wyróżnić się spośród innych miejsc.

Przejdź do panelu: ${panelUrl}

Masz pytania? Odpowiedz na tego maila - jesteśmy tu dla Ciebie.

Zespół Trasy

---
Dostałeś tego maila, ponieważ założyłeś konto firmowe na trasa.travel.
Kontakt: hello@trasa.travel`;
}
