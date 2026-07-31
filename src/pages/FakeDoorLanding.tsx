import { TrasaLogo } from "@/components/TrasaLogo";

/**
 * Fake door landing (web, branch `web`, domena trasatravel.com).
 *
 * Na razie: MINIMALNY placeholder do smoke-testu pipeline'u
 * (push web -> Vercel build -> VITE_FAKE_DOOR -> render). Docelowo wejdzie tu
 * pelny flow: szukanie tras -> lista -> detal -> CTA "Uzyj tej trasy" -> mail.
 *
 * Renderowany przez early-return w App.tsx gdy FAKE_DOOR === true, wiec dziala
 * BEZ routera i providerow apki (calkowicie odciety od reszty).
 */
export default function FakeDoorLanding() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#FEFEFE",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        textAlign: "center",
      }}
    >
      <TrasaLogo size={76} />

      <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: "#F9662B", letterSpacing: "0.01em" }}>
        speed dating z&nbsp;miastem
      </p>

      <h1
        style={{
          margin: 0,
          fontSize: "clamp(1.75rem, 6vw, 2.5rem)",
          fontWeight: 800,
          color: "#0E0E0E",
          letterSpacing: "-0.02em",
          lineHeight: 1.1,
          maxWidth: "16ch",
        }}
      >
        Odkrywaj gotowe trasy po&nbsp;mieście
      </h1>

      <p style={{ margin: 0, fontSize: "1rem", color: "#979797", lineHeight: 1.55, maxWidth: "32ch" }}>
        Sprawdzone plany od&nbsp;ludzi, którzy znają miasto. Wybierasz, ruszasz w&nbsp;drogę.
      </p>

      <span style={{ position: "fixed", bottom: 12, fontSize: 11, color: "#CFCFCF" }}>
        web · fake-door v0.1
      </span>
    </div>
  );
}
