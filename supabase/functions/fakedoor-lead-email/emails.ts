// Szablony maili potwierdzajacych zapis z fake doora (Resend).
// UI odwzorowuje jezyk apki (logo, awatar autora, peachy kafle miejsc, badge
// kategorii, guzik brandowy) - ale EMAIL-SAFE: same tabele + inline style +
// hostowane PNG (Gmail wycina SVG i data-URI, wiec zero SVG/data-uri).

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

const BRAND = "#D25014";
const PEACH = "#fcede3";
const LOGO = "https://www.trasatravel.com/icon-512.png";
const SITE = "https://www.trasatravel.com";

const placesLabel = (n: number) => `${n} ${n === 1 ? "miejsce" : n < 5 ? "miejsca" : "miejsc"}`;

// Kolorowe kolko z inicjalem - odwzorowanie awatara z apki (email-safe).
function avatar(name: string, size = 24): string {
  const initial = escapeHtml((name || "T").trim().charAt(0).toUpperCase());
  return `<span style="display:inline-block;width:${size}px;height:${size}px;border-radius:${size}px;background:${BRAND};color:#fff;font-size:${Math.round(
    size * 0.5,
  )}px;font-weight:700;text-align:center;line-height:${size}px;vertical-align:middle;">${initial}</span>`;
}

function pill(text: string, bg = "#f0f0f1", color = "#5a5a5a"): string {
  return `<span style="display:inline-block;background:${bg};color:${color};font-size:12px;font-weight:600;padding:3px 10px;border-radius:999px;vertical-align:middle;">${escapeHtml(
    text,
  )}</span>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;"><tr>
    <td style="background:${BRAND};border-radius:14px;">
      <a href="${href}" style="display:inline-block;padding:13px 22px;color:#fff;font-size:15px;font-weight:700;text-decoration:none;">${escapeHtml(
        label,
      )}</a>
    </td></tr></table>`;
}

function shell(inner: string): string {
  return `
<div style="background:#f4f4f5;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Arial,sans-serif;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.05);">
    <div style="padding:18px 24px;border-bottom:1px solid #f0f0f1;">
      <img src="${LOGO}" width="34" height="34" alt="trasa" style="border-radius:9px;vertical-align:middle;display:inline-block;" />
      <span style="font-size:19px;font-weight:800;color:#0E0E0E;letter-spacing:-0.02em;vertical-align:middle;margin-left:9px;">trasa</span>
    </div>
    <div style="padding:22px 24px 26px;">${inner}</div>
  </div>
  <p style="text-align:center;color:#b9b9bf;font-size:12px;margin:16px 0 0;">Dostajesz tego maila, bo zapisano ten adres na trasatravel.com</p>
</div>`;
}

function placeRow(i: number, name: string, category: string, note?: string): string {
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:10px;background:#f7f7f8;border-radius:14px;">
    <tr>
      <td width="72" valign="top" style="padding:12px 6px 12px 12px;">
        <table role="presentation" cellpadding="0" cellspacing="0"><tr>
          <td style="width:52px;height:52px;background:${PEACH};border-radius:13px;text-align:center;vertical-align:middle;color:${BRAND};font-weight:800;font-size:19px;">${i + 1}</td>
        </tr></table>
      </td>
      <td valign="top" style="padding:12px 14px 12px 2px;">
        <div style="font-weight:700;color:#0E0E0E;font-size:15px;line-height:1.3;">${escapeHtml(name)}</div>
        <div style="margin-top:5px;">${pill(category, PEACH, BRAND)}</div>
        ${note ? `<div style="color:#8a8a8a;font-size:13px;line-height:1.45;margin-top:7px;">${escapeHtml(note)}</div>` : ""}
      </td>
    </tr>
  </table>`;
}

// A) Podziekowanie za sam zapis (tworzenie tras)
export function joinHtml(): string {
  return shell(`
    <div style="margin-bottom:12px;">${pill("Tworzenie tras · wkrótce", PEACH, BRAND)}</div>
    <h1 style="font-size:22px;color:#0E0E0E;margin:0;">Dzięki, że jesteś!</h1>
    <p style="color:#5a5a5a;line-height:1.6;margin:12px 0 0;">
      Cieszymy się, że chcesz układać własne trasy. Właśnie dopinamy tę funkcję,
      a damy Ci znać na tego maila, gdy tylko ruszy. Będziesz wśród pierwszych.
    </p>
    ${button("Zobacz trasy na trasatravel.com", SITE)}
    <p style="color:#5a5a5a;line-height:1.6;margin:16px 0 0;">Do zobaczenia w mieście,<br>zespół Trasy</p>
  `);
}

// B) Podsumowanie wybranej trasy + podziekowanie
export function routeHtml(r: RoutePayload): string {
  const author = r.author || "Autor";
  const metaPills = [r.city ? pill(r.city) : "", r.duration ? pill(r.duration) : "", pill(placesLabel(r.places?.length ?? 0))]
    .filter(Boolean)
    .join(" ");

  return shell(`
    <div style="margin-bottom:8px;"><span style="color:${BRAND};font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;">Twoja trasa</span></div>
    <h1 style="font-size:22px;color:#0E0E0E;margin:0 0 12px;line-height:1.2;">${escapeHtml(r.title)}</h1>
    <div style="margin-bottom:8px;">
      ${avatar(author)} <span style="font-weight:700;color:#0E0E0E;font-size:14px;vertical-align:middle;margin-left:4px;">${escapeHtml(author)}</span>
    </div>
    <div style="line-height:2;">${metaPills}</div>
    ${r.intro ? `<p style="color:#5a5a5a;line-height:1.6;margin:14px 0 0;">${escapeHtml(r.intro)}</p>` : ""}
    <div style="height:1px;background:#eee;margin:20px 0 16px;"></div>
    <p style="font-weight:800;color:#0E0E0E;margin:0 0 12px;font-size:16px;">Plan trasy</p>
    ${(r.places ?? []).map((p, i) => placeRow(i, p.name, p.category, p.note)).join("")}
    <div style="height:1px;background:#eee;margin:16px 0;"></div>
    <p style="color:#5a5a5a;line-height:1.6;margin:0;">
      Apka rusza lada chwila - wtedy odblokujesz tę trasę i ruszysz w miasto. Trzymaj tego maila!
    </p>
    ${button("Otwórz na trasatravel.com", SITE)}
    <p style="color:#5a5a5a;line-height:1.6;margin:16px 0 0;">Do zobaczenia,<br>zespół Trasy</p>
  `);
}
