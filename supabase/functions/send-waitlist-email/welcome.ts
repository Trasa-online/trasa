// Mail powitalny waitlisty w dwoch jezykach (2026-09-06). Jezyk bierze sie z landingu
// (waitlist.language) - user, ktory widzial strone po angielsku, dostaje angielskiego maila.
// Nieznany jezyk = polski, tak samo jak w notify_push i mailu powitalnym B2C.
export type MailLang = "pl" | "en";

const COPY: Record<MailLang, {
  subject: string; title: string; greeting: string; thanks: string; soon: string;
  ideaTitle: string; ideaBody: string; signoff: string; footer: (link: string) => string;
}> = {
  pl: {
    subject: "Cześć! Dzięki, że dołączasz do spontaway 🧡",
    title: "Cześć! Dzięki, że dołączasz do spontaway",
    greeting: "Cześć!",
    thanks: 'Dzięki, że dołączasz do <strong style="color:#0E0E0E;">spontaway</strong>.',
    soon: "Już niedługo aplikacja będzie dostępna na iOS i Androida. Damy Ci znać jako jedna z pierwszych osób, gdy nadejdzie ten moment.",
    ideaTitle: "Masz pomysł, sugestię albo chcesz pomóc?",
    ideaBody: "Odpowiedz na tego maila - czytamy każdą wiadomość.",
    signoff: "Do zobaczenia w spontaway,",
    footer: (link) => `Dostałeś tego maila ponieważ zapisałeś się na waitlistę na ${link}.`,
  },
  en: {
    subject: "Hi! Thanks for joining spontaway 🧡",
    title: "Hi! Thanks for joining spontaway",
    greeting: "Hi!",
    thanks: 'Thanks for joining <strong style="color:#0E0E0E;">spontaway</strong>.',
    soon: "The app is landing on iOS and Android soon. You will be among the first to hear when it does.",
    ideaTitle: "Got an idea, a suggestion, or want to help?",
    ideaBody: "Just reply to this email - we read every message.",
    signoff: "See you in spontaway,",
    footer: (link) => `You got this email because you joined the waitlist at ${link}.`,
  },
};

export const waitlistSubject = (lang: MailLang = "pl") => COPY[lang].subject;

export function buildWaitlistWelcomeHtml(lang: MailLang = "pl"): string {
  const c = COPY[lang] ?? COPY.pl;
  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${c.title}</title>
  <style>
    @media (prefers-color-scheme: dark) {
      .logo-light { display: none !important; }
      .logo-dark  { display: inline-block !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#FEFEFE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0E0E0E;">
  <div style="max-width:480px;margin:0 auto;padding:48px 32px;text-align:center;">
    <img class="logo-light" src="https://spontaway.com/email-logo.png" alt="spontaway" width="200" height="36" style="display:block;width:200px;height:auto;margin:0 auto 28px;" />
    <img class="logo-dark" src="https://spontaway.com/email-logo-dark.png" alt="spontaway" width="200" height="36" style="display:none;width:200px;height:auto;margin:0 auto 28px;" />
    <h1 style="font-size:32px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;">${c.greeting}</h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 12px;">
      ${c.thanks}
    </p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">
      ${c.soon}
    </p>

    <p style="font-size:13px;color:#979797;margin:0 0 24px;line-height:1.6;">
      ${c.ideaTitle}<br/>
      ${c.ideaBody}
    </p>
    <p style="font-size:13px;color:#979797;margin:0;">
      ${c.signoff}<br/>
      <strong style="color:#0E0E0E;">Nat &amp; Bart</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0;">
        ${c.footer('<a href="https://spontaway.com" style="color:#F9662B;text-decoration:none;">spontaway.com</a>')}
      </p>
    </div>
  </div>
</body>
</html>`;
}
