function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildB2cWelcomeHtml({ firstName, appUrl }: { firstName: string; appUrl: string }): string {
  const greeting = firstName.trim()
    ? `Cześć, ${escapeHtml(firstName.trim())}!`
    : "Cześć!";
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Witamy Cię w Trasie</title>
</head>
<body style="margin:0;padding:0;background:#FEFEFE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0E0E0E;">
  <div style="max-width:480px;margin:0 auto;padding:48px 32px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fb923c,#ea580c 60%,#c2410c);margin:0 auto 24px;"></div>
    <h1 style="font-size:32px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;line-height:1.2;">
      ${greeting}
    </h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 16px;">
      Twoje konto w&#160;<strong style="color:#0E0E0E;">Trasie</strong> jest gotowe.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">
      Możesz teraz zapisywać trasy, prowadzić dziennik i&#160;planować z&#160;przyjaciółmi.
    </p>
    <a href="${appUrl}" style="display:inline-block;background-color:#F9662B;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:24px;margin:0 0 32px;">
      Otwórz Trasę →
    </a>
    <div style="background:#FFF5EB;border:1px solid #FDE3CC;border-radius:16px;padding:20px;text-align:left;margin:0 0 32px;">
      <p style="font-size:14px;font-weight:700;color:#9A3412;margin:0 0 10px;">Co możesz zrobić w&#160;Trasie:</p>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#525252;line-height:1.7;">
        <li>Przeglądać miejsca w&#160;swoim mieście</li>
        <li>Planować trasy solo albo z&#160;przyjaciółmi</li>
        <li>Prowadzić dziennik podróży</li>
      </ul>
    </div>
    <p style="font-size:13px;color:#979797;margin:0 0 24px;line-height:1.6;">
      Masz pomysł albo sugestię?<br/>
      Odpowiedz na&#160;tego maila - czytamy każdą wiadomość.
    </p>
    <p style="font-size:13px;color:#979797;margin:0;">
      Do zobaczenia w&#160;Trasie,<br/>
      <strong style="color:#0E0E0E;">Nat &amp; Bart</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0 0 8px;font-style:italic;">speed dating z&#160;miastem</p>
      <p style="font-size:11px;color:#979797;margin:0;line-height:1.5;">
        Dostałeś tego maila, ponieważ założyłeś konto na&#160;<a href="https://trasa.travel" style="color:#F9662B;text-decoration:none;">trasa.travel</a>. Kontakt: <a href="mailto:hello@trasa.travel" style="color:#F9662B;text-decoration:none;">hello@trasa.travel</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildB2cWelcomeText({ firstName, appUrl }: { firstName: string; appUrl: string }): string {
  const greeting = firstName.trim() ? `Cześć, ${firstName.trim()}!` : "Cześć!";
  return `${greeting}

Twoje konto w Trasie jest gotowe.

Możesz teraz zapisywać trasy, prowadzić dziennik i planować z przyjaciółmi.

Otwórz Trasę: ${appUrl}

Co możesz zrobić w Trasie:
- Przeglądać miejsca w swoim mieście
- Planować trasy solo albo z przyjaciółmi
- Prowadzić dziennik podróży

Masz pomysł albo sugestię? Odpowiedz na tego maila - czytamy każdą wiadomość.

Do zobaczenia w Trasie,
Nat & Bart

---
speed dating z miastem
Dostałeś tego maila, ponieważ założyłeś konto na trasa.travel.
Kontakt: hello@trasa.travel`;
}
