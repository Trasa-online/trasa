function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildActivationHtml({ businessName, activationUrl }: { businessName: string; activationUrl: string }): string {
  const name = escapeHtml(businessName);
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>Aktywuj konto biznesowe na Trasie</title>
</head>
<body style="margin:0;padding:0;background:#FEFEFE;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0E0E0E;">
  <div style="height:8px;background:#1d4ed8;line-height:8px;font-size:0;">&nbsp;</div>
  <div style="max-width:480px;margin:0 auto;padding:48px 32px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#60a5fa,#2563eb 60%,#1d4ed8);margin:0 auto 24px;"></div>
    <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;line-height:1.25;">
      Aktywuj konto biznesowe
    </h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 12px;">
      Zakładasz konto dla <strong style="color:#0E0E0E;">${name}</strong> na&#160;Trasie.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">
      Kliknij poniżej, żeby ustawić hasło i&#160;wejść do&#160;panelu biznesowego. Link jest ważny przez&#160;24&#160;godziny.
    </p>
    <a href="${activationUrl}" style="display:inline-block;background-color:#1d4ed8;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:24px;">
      Ustaw hasło i&#160;aktywuj konto →
    </a>
    <p style="font-size:13px;color:#979797;margin:40px 0 0;line-height:1.6;">
      Jeśli to nie&#160;Ty zakładałeś konto, zignoruj tego maila.
    </p>
    <p style="font-size:13px;color:#979797;margin:24px 0 0;">
      <strong style="color:#0E0E0E;">Zespół Trasy</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0;line-height:1.5;">
        Dostałeś tego maila, ponieważ rozpocząłeś rejestrację lokalu na&#160;<a href="https://trasa.travel" style="color:#1d4ed8;text-decoration:none;">trasa.travel</a>.<br/>
        Kontakt: <a href="mailto:hello@trasa.travel" style="color:#1d4ed8;text-decoration:none;">hello@trasa.travel</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildActivationText({ businessName, activationUrl }: { businessName: string; activationUrl: string }): string {
  return `Aktywuj konto biznesowe

Zakładasz konto dla ${businessName} na Trasie.

Kliknij poniższy link, żeby ustawić hasło i wejść do panelu biznesowego. Link jest ważny przez 24 godziny.

${activationUrl}

Jeśli to nie Ty zakładałeś konto, zignoruj tego maila.

Zespół Trasy

---
Dostałeś tego maila, ponieważ rozpocząłeś rejestrację lokalu na trasa.travel.
Kontakt: hello@trasa.travel`;
}
