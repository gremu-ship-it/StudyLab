import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

/** Catches render errors so the app shows a message + reset instead of a blank page. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    console.error("StudyLab render error:", error, info);
  }

  reset = () => {
    // Clear cached demo DB, which is the most common cause of a crash after an update.
    try {
      Object.keys(localStorage).filter((k) => k.startsWith("studylab.db")).forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    this.setState({ error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "system-ui, sans-serif", background: "#0b1020", color: "#eaf0ff" }}>
        <div style={{ maxWidth: 560, background: "#151c3a", border: "1px solid #2a3566", borderRadius: 16, padding: 24 }}>
          <h1 style={{ fontSize: 20, marginTop: 0 }}>Something went wrong</h1>
          <p style={{ color: "#a7b3d8", lineHeight: 1.5 }}>StudyLab hit an error while starting. This is usually caused by outdated saved data in your browser from an earlier version.</p>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", background: "#0b1020", border: "1px solid #2a3566", borderRadius: 10, padding: 12, fontSize: 12, color: "#f87171", overflow: "auto", maxHeight: 200 }}>
            {this.state.error.message}
            {this.state.error.stack ? `\n\n${this.state.error.stack.split("\n").slice(1, 4).join("\n")}` : ""}
          </pre>
          <button onClick={this.reset} style={{ marginTop: 16, padding: "10px 16px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#6c7cff,#8b5cf6)", color: "white", fontWeight: 600, cursor: "pointer" }}>
            Reset saved data & reload
          </button>
        </div>
      </div>
    );
  }
}
