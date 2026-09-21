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
// ⛔ Te same maile trzymamy w JEDNYM stylu - zmieniasz tu, zmien tez w
//    `register-business/activation.ts`, `send-business-welcome/welcome.ts`
//    i `send-business-password-reset/index.ts` (skora jest SKOPIOWANA do kazdej funkcji,
//    bo funkcje brzegowe wdrazaja sie osobno).
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


// ── PRZYPOMNIENIA (business-nudges, 2026-09-21) ────────────────────────────────────────
// Trzy maile do lokali, ktore utknely w rejestracji. Copy po polsku (lokale sa polskie),
// zawsze z jednym CTA. Tresc ma byc naturalna: przy aktywacji zakladamy, ze stary link po
// prostu wygasl (wazny 24 h, przypomnienie idzie po 48 h), wiec dajemy NOWY i mowimy to wprost.

export type MissingField = "description" | "category" | "address" | "contact" | "hours" | "cover";

const MISSING_LABEL: Record<MissingField, string> = {
  description: "opis lokalu (min. 20 znaków)",
  category: "kategoria",
  address: "adres (ulica i miasto)",
  contact: "telefon albo strona www",
  hours: "godziny otwarcia",
  cover: "zdjęcie główne",
};

export function buildActivationReminderHtml({ businessName, activationUrl, last }: { businessName: string; activationUrl: string; last: boolean }): string {
  const name = escapeHtml(businessName);
  return bizEmailShell({
    title: last ? "Ostatnie przypomnienie: aktywuj konto w spontaway" : "Twoje konto w spontaway czeka na aktywację",
    heading: last ? "Ostatnie przypomnienie" : "Twoje konto czeka na&#160;aktywację",
    lead: last
      ? `Konto dla <strong style="color:#5B2C06;">${name}</strong> nadal nie&#160;jest aktywne. To ostatnie przypomnienie - poniżej nowy link, ważny przez&#160;24&#160;godziny. Jeśli nie&#160;chcesz zakładać konta, nic nie&#160;musisz robić.`
      : `Rozpocząłeś(-aś) rejestrację lokalu <strong style="color:#5B2C06;">${name}</strong>, ale link aktywacyjny nie&#160;został użyty - mógł już wygasnąć. Oto nowy, ważny przez&#160;24&#160;godziny.`,
    ctaUrl: activationUrl,
    ctaLabel: "Ustaw hasło i&#160;aktywuj konto →",
    after: "Po aktywacji wejdziesz do&#160;panelu, w&#160;którym uzupełnisz wizytówkę - potem pokażemy ją podróżnym w&#160;aplikacji.",
    footer: `Dostałeś tego maila, ponieważ rozpocząłeś rejestrację lokalu na&#160;<a href="https://spontaway.com" style="color:#EE5307;text-decoration:none;">spontaway.com</a>.`,
  });
}

export function buildActivationReminderText({ businessName, activationUrl, last }: { businessName: string; activationUrl: string; last: boolean }): string {
  return `${last ? "Ostatnie przypomnienie: aktywuj konto" : "Twoje konto czeka na aktywację"}

${last
  ? `Konto dla ${businessName} nadal nie jest aktywne. To ostatnie przypomnienie - poniżej nowy link, ważny przez 24 godziny. Jeśli nie chcesz zakładać konta, nic nie musisz robić.`
  : `Rozpocząłeś(-aś) rejestrację lokalu ${businessName}, ale link aktywacyjny nie został użyty - mógł już wygasnąć. Oto nowy, ważny przez 24 godziny.`}

${activationUrl}

Po aktywacji wejdziesz do panelu, w którym uzupełnisz wizytówkę - potem pokażemy ją podróżnym w aplikacji.

Zespół spontaway

---
Dostałeś tego maila, ponieważ rozpocząłeś rejestrację lokalu na spontaway.com.
`;
}

export function buildCompleteProfileHtml({ businessName, panelUrl, missing }: { businessName: string; panelUrl: string; missing: MissingField[] }): string {
  const name = escapeHtml(businessName);
  const items = missing.map((m) => `<li style="margin:0 0 6px;">${MISSING_LABEL[m]}</li>`).join("");
  return bizEmailShell({
    title: `Dokończ wizytówkę ${businessName}, żeby pojawić się w spontaway`,
    heading: "Dokończ swoją wizytówkę",
    lead: `Konto dla <strong style="color:#5B2C06;">${name}</strong> jest aktywne, ale wizytówka nie&#160;jest jeszcze gotowa - dopóki jej nie&#160;uzupełnisz, nie&#160;pokażemy jej podróżnym w&#160;aplikacji. Brakuje:<ul style="text-align:left;display:inline-block;margin:14px 0 0;padding-left:22px;color:#5B2C06;font-size:15px;line-height:1.5;">${items}</ul>`,
    ctaUrl: panelUrl,
    ctaLabel: "Uzupełnij wizytówkę →",
    after: "To kilka minut. Gdy skończysz, sprawdzimy wizytówkę i&#160;włączymy ją w&#160;aplikacji.",
    footer: `Dostałeś tego maila, ponieważ masz konto lokalu na&#160;<a href="https://spontaway.com" style="color:#EE5307;text-decoration:none;">spontaway.com</a>.`,
  });
}

export function buildCompleteProfileText({ businessName, panelUrl, missing }: { businessName: string; panelUrl: string; missing: MissingField[] }): string {
  return `Dokończ swoją wizytówkę

Konto dla ${businessName} jest aktywne, ale wizytówka nie jest jeszcze gotowa - dopóki jej nie uzupełnisz, nie pokażemy jej podróżnym w aplikacji.

Brakuje:
${missing.map((m) => `- ${MISSING_LABEL[m]}`).join("\n")}

Uzupełnij wizytówkę w panelu:
${panelUrl}

To kilka minut. Gdy skończysz, sprawdzimy wizytówkę i włączymy ją w aplikacji.

Zespół spontaway

---
Dostałeś tego maila, ponieważ masz konto lokalu na spontaway.com.
`;
}
