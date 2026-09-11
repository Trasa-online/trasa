// Mail "aplikacja jest w App Store" do osob z waitlisty (2026-09-11, prosba Nat: "prosty,
// z informacja o mozliwosci sciagniecia aplikacji"). Dwa jezyki jak w mailu powitalnym -
// jezyk z waitlist.language (landing), nieznany = polski.
export type MailLang = "pl" | "en";

const COPY: Record<MailLang, {
  subject: string; title: string; lead: string; body: string; cta: string;
  ps: string; signoff: string; footer: (link: string) => string;
}> = {
  pl: {
    subject: "spontaway jest już w App Store 🧡",
    title: "spontaway jest już w App Store",
    lead: "Obiecaliśmy dać Ci znać jako jednej z pierwszych osób. Ten moment właśnie nadszedł.",
    body: 'Aplikacja <strong style="color:#0E0E0E;">spontaway</strong> jest już dostępna na iPhone\'a. Zapisuj miejsca, składaj z nich wyjazdy i podglądaj, gdzie jeżdżą Twoi znajomi.',
    cta: "Pobierz z App Store",
    ps: "Masz pomysł, sugestię albo coś nie działa? Odpowiedz na tego maila - czytamy każdą wiadomość.",
    signoff: "Do zobaczenia w spontaway,",
    footer: (link) => `Dostajesz tego maila, bo zapisałeś się na listę oczekujących na ${link}. To jedyna wiadomość o premierze - nie będzie kolejnych.`,
  },
  en: {
    subject: "spontaway is live on the App Store 🧡",
    title: "spontaway is live on the App Store",
    lead: "We promised you would be among the first to know. That moment is here.",
    body: '<strong style="color:#0E0E0E;">spontaway</strong> is now available for iPhone. Save places, turn them into trips and see where your friends are going.',
    cta: "Get it on the App Store",
    ps: "Got an idea, a suggestion, or something is not working? Just reply to this email - we read every message.",
    signoff: "See you in spontaway,",
    footer: (link) => `You are getting this email because you joined the waitlist at ${link}. This is the only launch email - there will be no more.`,
  },
};

export const launchSubject = (lang: MailLang = "pl") => COPY[lang].subject;

export function buildLaunchHtml(lang: MailLang, storeUrl: string): string {
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
    <h1 style="font-size:30px;font-weight:900;letter-spacing:-0.02em;line-height:1.15;margin:0 0 16px;color:#0E0E0E;">${c.title}</h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 12px;">${c.lead}</p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 28px;">${c.body}</p>
    <a href="${storeUrl}" style="display:inline-block;background:#EE5307;color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:16px;">${c.cta}</a>
    <p style="font-size:13px;color:#979797;margin:32px 0 24px;line-height:1.6;">${c.ps}</p>
    <p style="font-size:13px;color:#979797;margin:0;">
      ${c.signoff}<br/>
      <strong style="color:#0E0E0E;">Nat &amp; Bart</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0;line-height:1.6;">
        ${c.footer('<a href="https://spontaway.com" style="color:#F9662B;text-decoration:none;">spontaway.com</a>')}
      </p>
    </div>
  </div>
</body>
</html>`;
}
