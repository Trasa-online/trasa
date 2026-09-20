function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── SKÓRA MAILI B2B (2026-09-15) ────────────────────────────────────────────────────────
// Branding maili dla lokali zszedl z niebieskiego razem z panelem i ekranem logowania
// (decyzja Nat 2026-09-14). Wczesniej: niebieski pasek u gory, niebieska orba i niebieski
// guzik - identyfikacja, ktorej nie ma juz nigdzie indziej w produkcie.
//
// Teraz uklad jest ten sam, co na `/auth?business=true`: biala belka ze znakiem i wordmarkiem
// "spontaway biznes", pod nia ZOLTE hero `#FDF184` z naglowkiem w brazie `#5B2C06`, nizej
// pomaranczowe CTA `#EE5307` w pigulce.
//
// ⛔ Sigmar (font marki) NIE dziala w mailu - Gmail i Outlook wycinaja @font-face. Naglowki
//    ida ciezkim stosem systemowym; charakter niesie kolor i uklad, nie krój.
// ⛔ Kolorow nie wpisujemy inline "na oko": pomarańcz na żółtym ma kontrast 3,08:1, wiec na
//    zoltym tle piszemy WYLACZNIE brazem (10:1). Pomaranczowy zostaje na guzik i znak.
// ⛔ Te same trzy maile trzymamy w JEDNYM stylu - zmieniasz tu, zmien tez w
//    `send-business-welcome/welcome.ts` i `send-business-password-reset/index.ts`.
const FONT = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
const MARK = "https://spontaway.com/spontaway-symbol.png";

export function bizEmailShell({ title, heading, lead, ctaUrl, ctaLabel, after, footer }: {
  title: string; heading: string; lead: string; ctaUrl: string; ctaLabel: string; after: string; footer: string;
}): string {
  return `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#FEFEFE;font-family:${FONT};color:#5B2C06;-webkit-font-smoothing:antialiased;">
  <!-- Belka marki - ta sama, co nad formularzem rejestracji lokalu -->
  <div style="background:#FEFEFE;padding:22px 24px 18px;text-align:center;border-bottom:1px solid #F0E6D2;">
    <img src="${MARK}" alt="" width="26" height="26" style="display:inline-block;width:26px;height:26px;vertical-align:middle;border:0;" />
    <span style="display:inline-block;vertical-align:middle;margin-left:8px;font-size:18px;font-weight:800;letter-spacing:-0.01em;color:#5B2C06;">spontaway <span style="color:#EE5307;">biznes</span></span>
  </div>

  <!-- Hero: zolte tlo marki, naglowek i lead w brazie -->
  <div style="background:#FDF184;padding:40px 28px 36px;text-align:center;">
    <div style="max-width:480px;margin:0 auto;">
      <h1 style="font-size:28px;font-weight:900;letter-spacing:-0.02em;margin:0 0 14px;color:#5B2C06;line-height:1.2;">${heading}</h1>
      <p style="font-size:16px;line-height:1.6;color:#6B3A0F;margin:0;">${lead}</p>
    </div>
  </div>

  <!-- Akcja -->
  <div style="max-width:480px;margin:0 auto;padding:32px 32px 44px;text-align:center;">
    <a href="${ctaUrl}" style="display:inline-block;background-color:#EE5307;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:15px 34px;border-radius:999px;">${ctaLabel}</a>
    <p style="font-size:13px;color:#8A7A6B;margin:32px 0 0;line-height:1.6;">${after}</p>
    <p style="font-size:13px;color:#8A7A6B;margin:22px 0 0;">
      <strong style="color:#5B2C06;">Zespół spontaway</strong>
    </p>
    <div style="margin-top:40px;padding-top:22px;border-top:1px solid #F0E6D2;">
      <p style="font-size:11px;color:#A0907F;margin:0;line-height:1.5;">
        ${footer}<br/>
        Kontakt: <a href="mailto:hello@spontaway.com" style="color:#EE5307;text-decoration:none;">hello@spontaway.com</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildActivationHtml({ businessName, activationUrl }: { businessName: string; activationUrl: string }): string {
  const name = escapeHtml(businessName);
  return bizEmailShell({
    title: "Aktywuj konto biznesowe w spontaway",
    heading: "Aktywuj konto biznesowe",
    lead: `Zakładasz konto dla <strong style="color:#5B2C06;">${name}</strong> na&#160;spontaway. Kliknij poniżej, żeby ustawić hasło i&#160;wejść do&#160;panelu. Link jest ważny przez&#160;24&#160;godziny.`,
    ctaUrl: activationUrl,
    ctaLabel: "Ustaw hasło i&#160;aktywuj konto →",
    after: "Jeśli to nie&#160;Ty zakładałeś konto, zignoruj tego maila.",
    footer: `Dostałeś tego maila, ponieważ rozpocząłeś rejestrację lokalu na&#160;<a href="https://spontaway.com" style="color:#EE5307;text-decoration:none;">spontaway.com</a>.`,
  });
}

export function buildActivationText({ businessName, activationUrl }: { businessName: string; activationUrl: string }): string {
  return `Aktywuj konto biznesowe

Zakładasz konto dla ${businessName} w spontaway.

Kliknij poniższy link, żeby ustawić hasło i wejść do panelu biznesowego. Link jest ważny przez 24 godziny.

${activationUrl}

Jeśli to nie Ty zakładałeś konto, zignoruj tego maila.

Zespół spontaway

---
Dostałeś tego maila, ponieważ rozpocząłeś rejestrację lokalu na spontaway.com.
Kontakt: hello@spontaway.com`;
}
