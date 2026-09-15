import { Component, type ReactNode } from "react";
// komponent KLASOWY - hooki tam nie dzialaja, wiec siegamy po i18n bezposrednio.
import i18n from "@/i18n";

interface Props {
  children: ReactNode;
}

// Rodzaj awarii decyduje o tym, CO user czyta i CO moze z tym zrobic. "Coś poszło nie tak"
// nie mowi mu nic: inaczej reaguje sie na brak zasiegu (poczekaj), inaczej na stara paczke
// po deployu (odswiez), a inaczej na blad w kodzie (to nie Twoja wina, nic nie zginelo).
type ErrorKind = "offline" | "server" | "update" | "technical";

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
  kind: ErrorKind;
  showDetails: boolean;
  copied: boolean;
}

const CHUNK_ERROR = /dynamically imported module|Importing a module script failed|Failed to fetch dynamically|error loading dynamically imported/i;
// Blad sieci widziany z poziomu JS. "Load failed" to wariant Safari/WKWebView.
const NETWORK_ERROR = /failed to fetch|networkerror|load failed|network request failed|err_network|err_internet|timeout|aborted/i;

function classify(error: Error | null): ErrorKind {
  const msg = String(error?.message ?? error ?? "");
  if (CHUNK_ERROR.test(msg)) return "update";
  // Kolejnosc ma znaczenie: bez sieci KAZDY fetch wyglada jak awaria serwera, a to nie ona.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  if (NETWORK_ERROR.test(msg)) return "server";
  return "technical";
}

const T = (key: string) => i18n.t(`error.${key}`, { ns: "common" });

// Ikony rysujemy sami (SVG), zamiast ciagnac biblioteke: ten ekran ma sie wyrenderowac takze
// wtedy, gdy poleglo ladowanie paczki z reszta aplikacji.
function KindIcon({ kind }: { kind: ErrorKind }) {
  const common = { width: 26, height: 26, viewBox: "0 0 24 24", fill: "none", stroke: "#C2410C", strokeWidth: 1.9, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (kind === "offline") {
    return (
      <svg {...common}>
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <path d="M12 20h.01" />
      </svg>
    );
  }
  if (kind === "server") {
    return (
      <svg {...common}>
        <rect x="2" y="2" width="20" height="8" rx="2" />
        <rect x="2" y="14" width="20" height="8" rx="2" />
        <path d="M6 6h.01M6 18h.01" />
      </svg>
    );
  }
  if (kind === "update") {
    return (
      <svg {...common}>
        <path d="M21 2v6h-6" />
        <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
        <path d="M3 22v-6h6" />
        <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    </svg>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null, kind: "technical", showDetails: false, copied: false };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, kind: classify(error) };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Backstop dla stale-chunk po nowym deployu (lazy importy spoza App.tsx):
    // "Failed to fetch dynamically imported module" -> przeladuj raz po swiezy manifest.
    // Ten sam guard czasowy co w App.tsx (klucz chunk_reload_at) -> brak petli reloadow.
    const msg = String(error?.message || error);
    if (CHUNK_ERROR.test(msg)) {
      const KEY = "chunk_reload_at";
      const last = Number(sessionStorage.getItem(KEY) || 0);
      if (Date.now() - last > 10000) {
        sessionStorage.setItem(KEY, String(Date.now()));
        window.location.reload();
        return;
      }
    }
    console.error("[ErrorBoundary] caught render error:", error);
    console.error("[ErrorBoundary] component stack:", info.componentStack);
    this.setState({ componentStack: info.componentStack });
  }

  // Tekst do wyslania nam - jeden blok, ktory user kopiuje jednym tapnieciem zamiast
  // przepisywac ze zrzutu ekranu.
  private detailsText() {
    return [
      `kind: ${this.state.kind}`,
      `time: ${new Date().toISOString()}`,
      `url: ${typeof window !== "undefined" ? window.location.href : "-"}`,
      `ua: ${typeof navigator !== "undefined" ? navigator.userAgent : "-"}`,
      "",
      String(this.state.error?.stack || this.state.error?.message || this.state.error),
      "",
      String(this.state.componentStack ?? ""),
    ].join("\n");
  }

  private copyDetails = async () => {
    try {
      await navigator.clipboard.writeText(this.detailsText());
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch { /* schowek zablokowany - zostaje zaznaczenie tekstu recznie */ }
  };

  // Odswiezenie w miejscu: przy braku sieci albo chwilowej awarii serwera nie ma powodu
  // wyrzucac usera z ekranu, na ktorym byl.
  private retry = () => window.location.reload();

  private goHome = () => { window.location.hash = "#/eksploruj"; window.location.reload(); };

  render() {
    if (!this.state.hasError) return this.props.children;
    const { kind, showDetails, copied } = this.state;

    const page: React.CSSProperties = {
      minHeight: "100dvh",
      background: "#FEFEFE",
      color: "#0E0E0E",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      padding: "24px max(20px, env(safe-area-inset-left)) calc(24px + env(safe-area-inset-bottom, 0px)) max(20px, env(safe-area-inset-right))",
    };
    const primary: React.CSSProperties = {
      width: "100%", padding: "15px 16px", borderRadius: 16, border: "none",
      background: "#EA580C", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer",
    };
    const secondary: React.CSSProperties = {
      ...primary, background: "#F1F1F1", color: "#0E0E0E", marginTop: 10,
    };

    return (
      <div style={page}>
        <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
          {/* Ikona + plakietka rodzaju: user od razu wie, czy to jego zasieg, czy nasz kod. */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <span style={{ height: 52, width: 52, borderRadius: 18, background: "#FCEDE3", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <KindIcon kind={kind} />
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", padding: "5px 11px", borderRadius: 999, background: "#F1F1F1", fontSize: 12, fontWeight: 700, color: "#4b5563" }}>
              {T(`kind.${kind}`)}
            </span>
          </div>

          <h1 style={{ fontSize: 25, lineHeight: 1.2, fontWeight: 900, margin: "0 0 10px" }}>{T(`headline.${kind}`)}</h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, color: "#6b7280", margin: "0 0 26px" }}>{T(`body.${kind}`)}</p>

          <button onClick={this.retry} style={primary}>
            {kind === "update" ? T("reload") : T("retry")}
          </button>
          <button onClick={this.goHome} style={secondary}>{T("back_home")}</button>

          {/* Szczegoly techniczne SCHOWANE: to material dla nas, nie tresc dla usera. Wczesniej
              caly stos lecial na ekran i wygladal jak awaria systemu. */}
          <div style={{ marginTop: 22 }}>
            <button
              onClick={() => this.setState({ showDetails: !showDetails })}
              style={{ background: "none", border: "none", padding: 0, fontSize: 13, fontWeight: 600, color: "#9ca3af", cursor: "pointer", textDecoration: "underline" }}
            >
              {showDetails ? T("details_hide") : T("details_show")}
            </button>
            {showDetails && (
              <>
                <pre style={{ marginTop: 10, fontSize: 11, lineHeight: 1.45, background: "#F6F6F7", color: "#4b5563", padding: 12, borderRadius: 12, overflow: "auto", maxHeight: 260, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {this.detailsText()}
                </pre>
                <button
                  onClick={this.copyDetails}
                  style={{ ...secondary, marginTop: 10, fontSize: 14, padding: "12px 16px" }}
                >
                  {copied ? T("copied") : T("copy")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }
}
