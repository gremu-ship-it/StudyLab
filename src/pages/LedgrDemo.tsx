import { useMemo, useRef, useState } from "react";
import { AlertTriangle, Bot, LifeBuoy, Send, Sparkles } from "lucide-react";
import { getProvider, type ChatMessage, type DataContext } from "../lib/ai/provider";
import { getLedgrLiveData } from "../lib/ai/ledger-example";

type Mode = "support" | "ai";

export function LedgrDemo() {
  const [mode, setMode] = useState<Mode>("ai");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // In a real app, build this from the authenticated user's active company.
  const ctx: DataContext = useMemo(() => {
    const live = getLedgrLiveData();
    return mode === "support"
      ? { companyName: live.companyName, knowledgeBase: live.knowledgeBase }
      : live;
  }, [mode]);

  const suggestions = mode === "ai"
    ? ["How is my business performing this month?", "Which invoices are overdue?", "What are my biggest expenses this month?", "Who are my top customers by revenue?"]
    : ["How do I create and send an invoice?", "How do I record an expense?", "How do I generate financial statements?", "How do I set up my business?"];

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next = [...history, { role: "user" as const, content }];
    setHistory(next); setInput(""); setBusy(true);
    try {
      const ans = await getProvider().answer(next, ctx);
      setHistory([...next, { role: "assistant", content: ans.content }]);
    } catch (e) {
      setHistory([...next, { role: "assistant", content: `⚠️ ${(e as Error).message}` }]);
    } finally {
      setBusy(false);
      setTimeout(() => scrollRef.current?.scrollTo({ top: 9e9, behavior: "smooth" }), 50);
    }
  }

  const anomalies = (ctx.data?.anomalies as any[]) ?? [];

  return (
    <section className="page" style={{ maxWidth: 980 }}>
      <div className="page-heading">
        <div>
          <span className="eyebrow">Reusable AI layer · Ledgr example</span>
          <h1>Fintech assistant</h1>
          <p>One provider, two assistants: a free rule-based support bot and a data-grounded business AI. Drop <code>src/lib/ai/*</code> into your other app.</p>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${mode === "ai" ? "active" : ""}`} onClick={() => { setMode("ai"); setHistory([]); }}>
          <Bot size={14} /> Ledgr AI
        </button>
        <button className={`tab ${mode === "support" ? "active" : ""}`} onClick={() => { setMode("support"); setHistory([]); }}>
          <LifeBuoy size={14} /> Support Assistant
        </button>
      </div>

      <div className="panel" style={{ padding: 0, display: "flex", flexDirection: "column", height: "70vh" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-soft, #2a3566)", display: "flex", alignItems: "center", gap: 10 }}>
          <span className={`chip ${mode === "ai" ? "good" : "brand"}`}><Sparkles size={12} /> Connected</span>
          <span className="muted" style={{ fontSize: 12 }}>
            Live data from {ctx.companyName} · {mode === "ai" ? "Powered by rules (free)" : "Knowledge-base assistant"}
          </span>
        </div>

        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {history.length === 0 && (
            <div style={{ margin: "auto 0" }}>
              <p style={{ color: "var(--text-dim, #a7b3d8)" }}>
                {mode === "ai"
                  ? `Hello! I'm your Ledgr AI assistant for ${ctx.companyName}. I have access to your live financial data — invoices, expenses, payroll, and more. Ask me anything about your business, or try a suggestion.`
                  : `Hi! I'm the Ledgr Support Assistant. I can help with how features work, troubleshoot errors, and answer compliance questions. Pick a topic to get started.`}
              </p>
              {mode === "ai" && anomalies.length > 0 && (
                <div className="notice" style={{ marginTop: 16, background: "rgba(248,113,113,.08)", border: "1px solid rgba(248,113,113,.3)", borderRadius: 10, padding: 14 }}>
                  <strong style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--bad, #f87171)" }}>
                    <AlertTriangle size={16} /> {anomalies.length} Financial {anomalies.length === 1 ? "Anomaly" : "Anomalies"} Detected
                  </strong>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {anomalies.map((a, i) => <li key={i} style={{ color: "var(--text-dim, #a7b3d8)" }}>{a.description}: {formatMoney(a.amount)} on {a.date}</li>)}
                  </ul>
                </div>
              )}
              <div className="row" style={{ marginTop: 16, flexWrap: "wrap" }}>
                {suggestions.map((s) => <button key={s} className="secondary small" onClick={() => send(s)}>{s}</button>)}
              </div>
            </div>
          )}

          {history.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "80%", padding: "10px 14px", borderRadius: 12, background: m.role === "user" ? "linear-gradient(135deg,#6c7cff,#8b5cf6)" : "var(--bg-2,#0d1430)", border: m.role === "assistant" ? "1px solid var(--border-soft,#2a3566)" : "none", color: "#eaf0ff", whiteSpace: "pre-wrap", lineHeight: 1.5, fontSize: 14 }}>
              {renderMd(m.content)}
            </div>
          ))}
          {busy && <div className="muted" style={{ fontSize: 13 }}>Assistant is typing…</div>}
        </div>

        <div style={{ padding: 12, borderTop: "1px solid var(--border-soft, #2a3566)" }}>
          <div className="row" style={{ marginBottom: 8, flexWrap: "wrap" }}>
            {suggestions.slice(0, 3).map((s) => <button key={s} className="ghost small" onClick={() => send(s)}>{s}</button>)}
          </div>
          <div className="search" style={{ maxWidth: "none" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} placeholder={mode === "ai" ? "Ask about your business…" : "Ask a support question…"} />
            <button className="primary small" onClick={() => send()} disabled={!input.trim() || busy}><Send size={14} /> Send</button>
          </div>
          <p className="muted" style={{ fontSize: 11, marginTop: 6 }}>Press Enter to send · Shift+Enter for a new line</p>
        </div>
      </div>
    </section>
  );
}

function formatMoney(n: number) {
  return `MK ${n.toLocaleString()}`;
}

// Very small markdown renderer (bold + bullets) so we don't pull a dependency.
function renderMd(text: string) {
  return text.split("\n").map((line, i) => {
    if (/^\s*[•*-]\s/.test(line)) return <div key={i}>• {line.replace(/^\s*[•*-]\s/, "")}</div>;
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      /^\*\*[^*]+\*\*$/.test(p) ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>
    );
    return <div key={i}>{parts}</div>;
  });
}
