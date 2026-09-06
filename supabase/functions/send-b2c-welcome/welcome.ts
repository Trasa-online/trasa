function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}


// Tresc maila powitalnego w dwoch jezykach (2026-09-06). Jezyk bierze sie z profiles.language -
// tej samej kolumny, ktora steruje pushami; mail idzie w jezyku, w ktorym user widzi apke.
// Nieznany jezyk = polski (tak samo jak w notify_push).
export type MailLang = "pl" | "en";

const COPY: Record<MailLang, {
  htmlLang: string; subject: string; greetingNamed: (n: string) => string; greeting: string;
  ready: string; canDo: string; cta: string; listTitle: string; list: string[];
  ideaTitle: string; ideaBody: string; signoff: string; tagline: string;
  footer: (link: string, contact: string) => string;
}> = {
  pl: {
    htmlLang: "pl",
    subject: "Witamy Cię w\u00a0spontaway",
    greetingNamed: (n) => `Cześć, ${n}!`,
    greeting: "Cześć!",
    ready: "Twoje konto w&#160;<strong style=\"color:#0E0E0E;\">spontaway</strong> jest gotowe.",
    canDo: "Możesz teraz zapisywać trasy, prowadzić dziennik i&#160;planować z&#160;przyjaciółmi.",
    cta: "Otwórz spontaway →",
    listTitle: "Co możesz zrobić w&#160;spontaway:",
    list: ["Przeglądać miejsca w&#160;swoim mieście", "Planować trasy solo albo z&#160;przyjaciółmi", "Prowadzić dziennik podróży"],
    ideaTitle: "Masz pomysł albo sugestię?",
    ideaBody: "Odpowiedz na&#160;tego maila - czytamy każdą wiadomość.",
    signoff: "Do zobaczenia w&#160;spontaway,",
    tagline: "speed dating z&#160;miastem",
    footer: (link, contact) => `Dostałeś tego maila, ponieważ założyłeś konto na&#160;${link}. Kontakt: ${contact}`,
  },
  en: {
    htmlLang: "en",
    subject: "Welcome to spontaway",
    greetingNamed: (n) => `Hi ${n}!`,
    greeting: "Hi!",
    ready: "Your <strong style=\"color:#0E0E0E;\">spontaway</strong> account is ready.",
    canDo: "You can now save trips, keep a travel journal and plan with friends.",
    cta: "Open spontaway →",
    listTitle: "What you can do in spontaway:",
    list: ["Browse places in your city", "Plan trips solo or with friends", "Keep a travel journal"],
    ideaTitle: "Got an idea or a suggestion?",
    ideaBody: "Just reply to this email - we read every message.",
    signoff: "See you in spontaway,",
    tagline: "speed dating with your city",
    footer: (link, contact) => `You got this email because you created an account at ${link}. Contact: ${contact}`,
  },
};

export const welcomeSubject = (lang: MailLang = "pl") => COPY[lang].subject;

export function buildB2cWelcomeHtml({ firstName, appUrl, lang = "pl" }: { firstName: string; appUrl: string; lang?: MailLang }): string {
  const c = COPY[lang] ?? COPY.pl;
  const greeting = firstName.trim() ? c.greetingNamed(escapeHtml(firstName.trim())) : c.greeting;
  return `<!DOCTYPE html>
<html lang="${c.htmlLang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="color-scheme" content="light" />
  <meta name="supported-color-schemes" content="light" />
  <title>${c.subject}</title>
</head>
<body style="margin:0;padding:0;background:#FEFEFE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;color:#0E0E0E;">
  <div style="max-width:480px;margin:0 auto;padding:48px 32px;text-align:center;">
    <div style="width:64px;height:64px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fb923c,#ea580c 60%,#c2410c);margin:0 auto 24px;"></div>
    <h1 style="font-size:32px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;line-height:1.2;">
      ${greeting}
    </h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 16px;">
      ${c.ready}
    </p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">
      ${c.canDo}
    </p>
    <a href="${appUrl}" style="display:inline-block;background-color:#F9662B;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:24px;margin:0 0 32px;">
      ${c.cta}
    </a>
    <div style="background:#FFF5EB;border:1px solid #FDE3CC;border-radius:16px;padding:20px;text-align:left;margin:0 0 32px;">
      <p style="font-size:14px;font-weight:700;color:#9A3412;margin:0 0 10px;">${c.listTitle}</p>
      <ul style="margin:0;padding-left:20px;font-size:13px;color:#525252;line-height:1.7;">
        ${c.list.map((i) => `<li>${i}</li>`).join("\n        ")}
      </ul>
    </div>
    <p style="font-size:13px;color:#979797;margin:0 0 24px;line-height:1.6;">
      ${c.ideaTitle}<br/>
      ${c.ideaBody}
    </p>
    <p style="font-size:13px;color:#979797;margin:0;">
      ${c.signoff}<br/>
      <strong style="color:#0E0E0E;">Nat &amp; Bart</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0 0 8px;font-style:italic;">${c.tagline}</p>
      <p style="font-size:11px;color:#979797;margin:0;line-height:1.5;">
        ${c.footer(`<a href="https://spontaway.com" style="color:#F9662B;text-decoration:none;">spontaway.com</a>`, `<a href="mailto:hello@spontaway.com" style="color:#F9662B;text-decoration:none;">hello@spontaway.com</a>`)}
      </p>
    </div>
  </div>
</body>
</html>`;
}

export function buildB2cWelcomeText({ firstName, appUrl, lang = "pl" }: { firstName: string; appUrl: string; lang?: MailLang }): string {
  const c = COPY[lang] ?? COPY.pl;
  // Wersja tekstowa: te same zdania bez znacznikow HTML i twardych spacji.
  const plain = (x: string) => x.replace(/&#160;/g, " ").replace(/\u00a0/g, " ").replace(/<[^>]+>/g, "");
  const greeting = firstName.trim() ? c.greetingNamed(firstName.trim()) : c.greeting;
  return `${greeting}

${plain(c.ready)}

${plain(c.canDo)}

${plain(c.cta).replace(/\s*\u2192$/, "")}: ${appUrl}

${plain(c.listTitle)}
${c.list.map((x) => `- ${plain(x)}`).join("\n")}

${plain(c.ideaTitle)} ${plain(c.ideaBody)}

${plain(c.signoff)}
Nat & Bart

---
${plain(c.tagline)}
${plain(c.footer("spontaway.com", "hello@spontaway.com"))}`;
}
