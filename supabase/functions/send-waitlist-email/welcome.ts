export const welcomeHtml = `<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Cześć! Dzięki, że dołączasz do spontaway</title>
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
    <h1 style="font-size:32px;font-weight:900;letter-spacing:-0.02em;margin:0 0 16px;color:#0E0E0E;">Cześć!</h1>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 12px;">
      Dzięki, że dołączasz do <strong style="color:#0E0E0E;">spontaway</strong>.
    </p>
    <p style="font-size:16px;line-height:1.6;color:#525252;margin:0 0 32px;">
      Już niedługo aplikacja będzie dostępna na iOS i Androida. Damy Ci znać jako jedna z pierwszych osób, gdy nadejdzie ten moment.
    </p>

    <p style="font-size:13px;color:#979797;margin:0 0 24px;line-height:1.6;">
      Masz pomysł, sugestię albo chcesz pomóc?<br/>
      Odpowiedz na tego maila - czytamy każdą wiadomość.
    </p>
    <p style="font-size:13px;color:#979797;margin:0;">
      Do zobaczenia w spontaway,<br/>
      <strong style="color:#0E0E0E;">Nat &amp; Bart</strong>
    </p>
    <div style="margin-top:48px;padding-top:24px;border-top:1px solid #E5E5E5;">
      <p style="font-size:11px;color:#979797;margin:0;">
        Dostałeś tego maila ponieważ zapisałeś się na waitlistę na <a href="https://spontaway.com" style="color:#F9662B;text-decoration:none;">spontaway.com</a>.
      </p>
    </div>
  </div>
</body>
</html>`;
