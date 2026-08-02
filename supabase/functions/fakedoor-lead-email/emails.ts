// Szablony maili potwierdzajacych zapis z fake doora (Resend).
// Dwa rodzaje:
//   A) join   - podziekowanie za zapis (klik "stworz wlasna trase")
//   B) route  - podsumowanie wybranej trasy + podziekowanie (zapis trasy)

export function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type RoutePayload = {
  title: string;
  city?: string;
  author?: string;
  duration?: string;
  intro?: string;
  places?: { name: string; category: string; note?: string }[];
};

const shell = (inner: string) => `
<div style="background:#f4f4f5;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
    <div style="padding:22px 24px 6px;">
      <div style="font-size:20px;font-weight:800;color:#0E0E0E;letter-spacing:-0.02em;">trasa<span style="color:#D25014;">.</span></div>
    </div>
    <div style="padding:2px 24px 28px;">${inner}</div>
  </div>
  <p style="text-align:center;color:#b9b9bf;font-size:12px;margin:16px 0 0;">trasa.travel</p>
</div>`;

const places = (list: RoutePayload["places"] = []) =>
  list
    .map(
      (p, i) => `
    <div style="margin-bottom:14px;">
      <div style="font-weight:700;color:#0E0E0E;font-size:15px;">
        ${i + 1}. ${escapeHtml(p.name)}
        <span style="color:#D25014;font-size:12px;font-weight:600;">&nbsp;${escapeHtml(p.category)}</span>
      </div>
      ${p.note ? `<div style="color:#8a8a8a;font-size:14px;line-height:1.5;margin-top:2px;">${escapeHtml(p.note)}</div>` : ""}
    </div>`,
    )
    .join("");

// A) Podziekowanie za sam zapis (tworzenie tras)
export function joinHtml(): string {
  return shell(`
    <h1 style="font-size:22px;color:#0E0E0E;margin:8px 0 0;">Dzięki, że jesteś!</h1>
    <p style="color:#5a5a5a;line-height:1.6;margin:12px 0 0;">
      Cieszymy się, że chcesz tworzyć własne trasy. Właśnie dopinamy tę funkcję,
      a damy Ci znać na tego maila, gdy tylko ruszy. Będziesz wśród pierwszych.
    </p>
    <p style="color:#5a5a5a;line-height:1.6;margin:14px 0 0;">
      Do zobaczenia w mieście,<br>zespół Trasy
    </p>
  `);
}

// B) Podsumowanie wybranej trasy + podziekowanie
export function routeHtml(r: RoutePayload): string {
  const meta = [r.city, r.duration, `${r.places?.length ?? 0} miejsc`, r.author ? `autor ${r.author}` : null]
    .filter(Boolean)
    .map((x) => escapeHtml(String(x)))
    .join(" · ");

  return shell(`
    <p style="color:#D25014;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;margin:8px 0 0;">Twoja trasa</p>
    <h1 style="font-size:22px;color:#0E0E0E;margin:4px 0 0;">${escapeHtml(r.title)}</h1>
    <p style="color:#8a8a8a;font-size:14px;margin:6px 0 0;">${meta}</p>
    ${r.intro ? `<p style="color:#5a5a5a;line-height:1.6;margin:14px 0 0;">${escapeHtml(r.intro)}</p>` : ""}
    <div style="height:1px;background:#eee;margin:18px 0;"></div>
    <p style="font-weight:800;color:#0E0E0E;margin:0 0 12px;font-size:16px;">Plan trasy</p>
    ${places(r.places)}
    <div style="height:1px;background:#eee;margin:18px 0;"></div>
    <p style="color:#5a5a5a;line-height:1.6;margin:0;">
      Apka rusza lada chwila - wtedy odblokujesz tę trasę i ruszysz w miasto. Trzymaj tego maila!
    </p>
    <p style="color:#5a5a5a;line-height:1.6;margin:14px 0 0;">
      Do zobaczenia,<br>zespół Trasy
    </p>
  `);
}
