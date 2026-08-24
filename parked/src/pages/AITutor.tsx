import { useEffect, useRef, useState } from "react";
import { Plus, Send, Sparkles } from "lucide-react";
import { useStore, store } from "../store";
import type { NavFn } from "../App";
import type { AIMode } from "../types";
import { toast } from "../components/ui";

const MODES: { id: AIMode; label: string }[] = [
  { id: "tutor", label: "Tutor" },
  { id: "explain", label: "Explain" },
  { id: "practice", label: "Practice" },
  { id: "revision", label: "Revision" },
  { id: "exam_prep", label: "Exam prep" },
  { id: "material_analysis", label: "Material analysis" },
];

export function AITutorPage({ nav: _nav, conversationId, topicId, courseId }: { nav: NavFn; conversationId?: string; topicId?: string; courseId?: string }) {
  const db = useStore((d) => d);
  const sid = store.studentId;
  const [mode, setMode] = useState<AIMode>("tutor");
  const [activeId, setActiveId] = useState<string | null>(conversationId ?? null);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const conversations = db.ai_conversations.filter((c) => c.student_id === sid).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  const active = conversations.find((c) => c.id === activeId) ?? conversations[0] ?? null;
  const messages = active ? db.ai_messages.filter((m) => m.conversation_id === active.id).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) : [];

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, typing]);

  function newConversation() {
    const t = topicId ? db.topics.find((x) => x.id === topicId) : null;
    const c = courseId ? db.courses.find((x) => x.id === courseId) : null;
    const id = store.startConversation(courseId ?? null, topicId ?? null, mode, t ? t.name : c ? c.name : "New conversation");
    setActiveId(id);
    // seed an opening message
    setTimeout(() => {
      const greeting = t
        ? `Hi! I'm your StudyLab tutor. We're looking at **${t.name}**. Ask me to explain it, work an example, or quiz you.`
        : `Hi! I'm your StudyLab tutor (${MODES.find((m) => m.id === mode)?.label} mode). What would you like to work on?`;
      store.insert("ai_messages", { id: `msg-${Date.now()}`, conversation_id: id, role: "assistant", content: greeting, metadata: {}, created_at: new Date().toISOString() });
    }, 50);
  }

  function send(override?: string) {
    const text = (override ?? input).trim();
    if (!text) return;
    let convId = active?.id;
    if (!convId) {
      convId = store.startConversation(courseId ?? null, topicId ?? null, mode, "New conversation");
      setActiveId(convId);
    }
    setInput("");
    setTyping(true);
    // update conversation mode if changed
    if (active && active.mode !== mode) store.update("ai_conversations", active.id, { mode });
    setTimeout(() => {
      store.sendMessage(convId!, text);
      setTyping(false);
    }, 550 + Math.random() * 500);
  }

  return (
    <section className="page bleed" style={{ maxWidth: 1400 }}>
      <div className="page-heading" style={{ paddingLeft: 4, paddingRight: 4 }}>
        <div>
          <span className="eyebrow"><Sparkles size={13} style={{ display: "inline", verticalAlign: "-2px" }} /> AI Tutor</span>
          <h1>StudyLab Assistant</h1>
          <p>Explain concepts, generate practice questions, revise, or analyse your uploaded materials. Context-aware and grounded in your curriculum.</p>
        </div>
        <button className="primary" onClick={newConversation}><Plus size={16} /> New chat</button>
      </div>

      <div className="chat-layout">
        <div className="panel" style={{ padding: 10, display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div style={{ padding: "4px 6px 10px" }}><h3 style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-mute)" }}>Conversations</h3></div>
          <div className="conv-list" style={{ flex: 1 }}>
            {conversations.map((c) => (
              <button key={c.id} className={`conv-row ${active?.id === c.id ? "active" : ""}`} onClick={() => setActiveId(c.id)}>
                <strong>{c.title}</strong>
                <span>{c.mode.replace("_", " ")} · {new Date(c.updated_at).toLocaleDateString()}</span>
              </button>
            ))}
            {!conversations.length && <p className="muted" style={{ padding: 12, fontSize: 12 }}>No conversations yet. Start a new chat.</p>}
          </div>
          <div style={{ borderTop: "1px solid var(--border-soft)", paddingTop: 10, marginTop: 8 }}>
            <h3 style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 1, color: "var(--text-mute)", padding: "0 6px 6px" }}>Mode</h3>
            <div className="row" style={{ padding: "0 4px" }}>
              {MODES.map((m) => (
                <button key={m.id} className={`mode-chip ${mode === m.id ? "active" : ""}`} onClick={() => { setMode(m.id); if (active) store.update("ai_conversations", active.id, { mode: m.id }); }}>{m.label}</button>
              ))}
            </div>
          </div>
        </div>

        <div className="chat-window">
          <div className="chat-messages">
            {messages.length === 0 && (
              <div style={{ margin: "auto", textAlign: "center", maxWidth: 420 }}>
                <div className="hero-orb" style={{ margin: "0 auto 14px", width: 84, height: 84 }}><Sparkles size={38} /></div>
                <h2>Start a conversation</h2>
                <p style={{ margin: "8px 0 16px" }}>Try: "explain Newton's second law", "give me a practice question", or "summarise my uploaded notes".</p>
                <div className="row" style={{ justifyContent: "center" }}>
                  {["Explain derivatives", "Quiz me on cells", "Summarise my notes"].map((s) => (
                    <button key={s} className="secondary small" onClick={() => send(s)}>{s}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`msg ${m.role}`}>{m.content}</div>
            ))}
            {typing && <div className="msg assistant"><span className="typing">StudyLab is typing<span className="dots"><i>.</i><i>.</i><i>.</i></span></span></div>}
            <div ref={endRef} />
          </div>
          <div className="chat-input">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder={mode === "practice" ? "Ask for a question, or type your answer..." : "Ask your AI tutor anything..."}
            />
            <button className="primary" onClick={() => send()} disabled={!input.trim() || typing}><Send size={16} /> Send</button>
          </div>
        </div>
      </div>

      <style>{`
        .typing .dots i { animation: blink 1.2s infinite; display: inline-block; }
        .typing .dots i:nth-child(2) { animation-delay: .2s; }
        .typing .dots i:nth-child(3) { animation-delay: .4s; }
        @keyframes blink { 0%, 80%, 100% { opacity: .2; } 40% { opacity: 1; } }
      `}</style>
    </section>
  );
}
