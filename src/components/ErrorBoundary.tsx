import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  componentStack: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Backstop dla stale-chunk po nowym deployu (lazy importy spoza App.tsx):
    // "Failed to fetch dynamically imported module" -> przeladuj raz po swiezy manifest.
    // Ten sam guard czasowy co w App.tsx (klucz chunk_reload_at) -> brak petli reloadow.
    const msg = String(error?.message || error);
    const isChunkError = /dynamically imported module|Importing a module script failed|Failed to fetch|error loading dynamically imported/i.test(msg);
    if (isChunkError) {
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

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div style={{ padding: 24, fontFamily: "-apple-system, sans-serif", background: "#FEFEFE", minHeight: "100dvh" }}>
        <h1 style={{ fontSize: 20, fontWeight: 900, color: "#0E0E0E", marginBottom: 12 }}>Coś poszło nie tak</h1>
        <p style={{ fontSize: 13, color: "#979797", marginBottom: 20 }}>
          Aplikacja napotkała błąd. Spróbuj wrócić do strony głównej.
        </p>
        <pre style={{ fontSize: 11, background: "#fef2f2", color: "#991b1b", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 200, marginBottom: 16 }}>
          {this.state.error?.message ?? String(this.state.error)}
        </pre>
        {this.state.componentStack && (
          <pre style={{ fontSize: 10, background: "#f1f5f9", color: "#475569", padding: 12, borderRadius: 8, overflow: "auto", maxHeight: 200, marginBottom: 16 }}>
            {this.state.componentStack}
          </pre>
        )}
        <button
          onClick={() => { window.location.hash = "#/home"; window.location.reload(); }}
          style={{ width: "100%", padding: "12px 14px", borderRadius: 14, border: "none", background: "linear-gradient(90deg,#F4A259,#F9662B)", color: "#fff", fontWeight: 700, fontSize: 14 }}
        >
          Wróć do głównej
        </button>
      </div>
    );
  }
}
