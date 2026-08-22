// Pluggable AI provider. The app runs with NO API key using deterministic,
// data-grounded responses (rules + your database). Set one of these env vars
// to enable a real LLM for open-ended generation:
//   VITE_AI_PROVIDER = "gemini" | "groq" | "openrouter" | "anthropic"
//   VITE_AI_API_KEY  = your key  (only use a SERVER-side proxy in production —
//                                  see supabase/functions/ai-chat)
//
// For a fintech app you would replace the `context` payload with real company
// data (KPIs, overdue invoices, anomalies) so both the rule engine and any LLM
// are grounded in that data.

export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage { role: ChatRole; content: string; }

export interface DataContext {
  /** e.g. "Demo company Ltd" */
  companyName?: string;
  /** Arbitrary structured data the assistant can reason over (KPIs, invoices, anomalies…). */
  data?: Record<string, unknown>;
  /** Pre-retrieved help articles / FAQ entries for support questions. */
  knowledgeBase?: KnowledgeArticle[];
}

export interface KnowledgeArticle {
  id: string;
  topic: string;
  keywords: string[];
  body: string;
}

export interface AIAnswer {
  content: string;
  /** Which engine produced the answer (rules, gemini, groq, etc.). */
  provider: string;
  /** Optional structured cards/suggestions the UI can render. */
  suggestions?: string[];
}

export interface AIProvider {
  name: string;
  answer(messages: ChatMessage[], context: DataContext): Promise<AIAnswer>;
}

export function getProvider(): AIProvider {
  const requested = (import.meta.env.VITE_AI_PROVIDER as string | undefined)?.toLowerCase();
  const key = import.meta.env.VITE_AI_API_KEY as string | undefined;
  if (requested && key) {
    switch (requested) {
      case "gemini": return geminiProvider(key);
      case "groq": return groqProvider(key);
      case "openrouter": return openRouterProvider(key);
      case "anthropic": return anthropicProvider(key);
    }
  }
  return rulesProvider();
}

/* ----------------------------- Deterministic (free) ----------------------------- */

export function rulesProvider(): AIProvider {
  return {
    name: "rules",
    async answer(messages, ctx) {
      const q = lastUser(messages).toLowerCase();
      const now = new Date();

      // 1. Greetings
      if (/^(hi|hello|hey|good (morning|afternoon|evening)|howdy|good day)/.test(q)) {
        return {
          content: ctx.companyName
            ? `Hello! I'm your assistant for **${ctx.companyName}**. I can help with how features work, troubleshoot errors, compliance questions, and analysing your data. What would you like to do?`
            : "Hi! I can answer how-to questions, troubleshoot issues and analyse your data. How can I help?",
          provider: "rules",
          suggestions: defaultSuggestions(q, ctx),
        };
      }

      // 2. Knowledge-base / how-to / compliance lookup
      const article = matchArticle(q, ctx.knowledgeBase ?? []);
      if (article) {
        return {
          content: `${article.body}\n\nDoes that resolve it? If not, tell me what step you're stuck on.`,
          provider: "rules",
          suggestions: articleSuggestions(article, ctx),
        };
      }

      // 3. Data analysis intents — pull numbers from the context and answer.
      const dataAnswer = analyzeData(q, ctx);
      if (dataAnswer) return { provider: "rules", ...dataAnswer };

      // 4. Problem / error reporting
      if (/\b(error|bug|broken|doesn'?t work|not working|can'?t|stuck|failed|issue|crash)\b/.test(q)) {
        return {
          content: "I'm sorry you're hitting an issue. To help me pinpoint it, could you tell me:\n1. What you were trying to do?\n2. The exact error message (if any)?\n3. Which browser/device you're on?\n\nYou can also report it from **Settings → Report a problem** and our team will follow up by email.",
          provider: "rules",
          suggestions: ["I can't send an invoice", "A payment didn't sync", "My report is wrong"],
        };
      }

      // 5. Fallback
      return {
        content: ctx.companyName
          ? `I can help with features, troubleshooting, compliance and live data for **${ctx.companyName}**. Try one of the suggestions below or rephrase your question.`
          : "I can answer how-to and compliance questions, or analyse your data. Try one of the suggestions below.",
        provider: "rules",
        suggestions: defaultSuggestions(q, ctx),
      };
    },
  };
}

function analyzeData(q: string, ctx: DataContext): Omit<AIAnswer, "provider"> | null {
  const d = ctx.data ?? {};
  const company = ctx.companyName ? ` for **${ctx.companyName}**` : "";

  if (/how.*(business|perform|doing)|overview|summary|this month/.test(q)) {
    const k = d.kpis as Record<string, unknown> | undefined;
    if (k) {
      return {
        content: `Here's how things look${company}:\n\n` +
          Object.entries(k).map(([label, val]) => `• **${prettify(label)}:** ${formatValue(val)}`).join("\n"),
        suggestions: ["Which invoices are overdue?", "What are my biggest expenses?", "Who are my top customers?"],
      };
    }
  }

  if (/overdue|past due|unpaid invoice/.test(q)) {
    const overdue = (d.overdueInvoices as unknown[]) ?? [];
    const total = (d.overdueTotal as number) ?? overdue.reduce((s: number, x: any) => s + (x.amount ?? 0), 0);
    if (overdue.length === 0) return { content: `Good news — no overdue invoices${company}. 🎉`, suggestions: [] };
    return {
      content: `**${overdue.length} overdue invoice${overdue.length === 1 ? "" : "s"}** totalling **${formatValue(total)}**${company}:\n\n` +
        overdue.slice(0, 8).map((x: any) => `• ${x.customer ?? x.client ?? "—"} — ${formatValue(x.amount)} (due ${x.due_date ?? x.dueDate ?? "—"})`).join("\n"),
      suggestions: ["Send payment reminders", "Who owes me the most?"],
    };
  }

  if (/biggest expense|top expense|largest expense|spending/.test(q)) {
    const expenses = (d.topExpenses as unknown[]) ?? [];
    if (!expenses.length) return null;
    return {
      content: `Your biggest expenses${company} this period:\n\n` +
        expenses.slice(0, 6).map((x: any, i: number) => `${i + 1}. **${x.category ?? x.vendor ?? x.name}** — ${formatValue(x.amount)}`).join("\n"),
      suggestions: ["How can I reduce costs?", "Compare to last month"],
    };
  }

  if (/top customer|best customer|most revenue|highest paying/.test(q)) {
    const customers = (d.topCustomers as unknown[]) ?? [];
    if (!customers.length) return null;
    return {
      content: `Your top customers by revenue${company}:\n\n` +
        customers.slice(0, 6).map((x: any, i: number) => `${i + 1}. **${x.name ?? x.customer}** — ${formatValue(x.revenue ?? x.amount)}`).join("\n"),
      suggestions: ["What invoices are outstanding?", "Customer statement"],
    };
  }

  // Anomalies surfaced proactively
  if (/anomal|unusual|suspicious|fraud/.test(q)) {
    const anomalies = (d.anomalies as unknown[]) ?? [];
    if (!anomalies.length) return { content: "No unusual transactions detected in the current period." };
    return {
      content: `**${anomalies.length} potential anomal${anomalies.length === 1 ? "y" : "ies"} detected**${company}:\n\n` +
        anomalies.slice(0, 8).map((x: any) => `• ${x.description ?? x.reason} — ${formatValue(x.amount)} on ${x.date ?? "—"}`).join("\n"),
    };
  }

  return null;
}

function matchArticle(q: string, kb: KnowledgeArticle[]): KnowledgeArticle | undefined {
  const tokens = q.toLowerCase().split(/\W+/).filter(Boolean);
  let best: { a: KnowledgeArticle; score: number } | undefined;
  for (const a of kb) {
    let score = 0;
    const topic = a.topic.toLowerCase();
    if (q.includes(topic)) score += 5;
    for (const kw of a.keywords) if (tokens.includes(kw.toLowerCase()) || q.includes(kw.toLowerCase())) score += 2;
    if (!best || score > best.score) best = { a, score };
  }
  return best && best.score > 0 ? best.a : undefined;
}

function lastUser(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].content;
  return "";
}
function prettify(s: string) { return s.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()); }
function formatValue(v: unknown): string {
  if (typeof v === "number") {
    const cur = (import.meta.env.VITE_CURRENCY as string) || "MWK";
    return `${cur} ${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }
  return String(v ?? "—");
}
function defaultSuggestions(_q: string, ctx: DataContext): string[] {
  return ctx.data
    ? ["How is my business performing?", "Which invoices are overdue?", "What are my biggest expenses?"]
    : ["How do I create an invoice?", "How do I record an expense?", "How do I generate statements?"];
}
function articleSuggestions(article: KnowledgeArticle, ctx: DataContext): string[] {
  const related = (ctx.knowledgeBase ?? []).filter((a) => a.id !== article.id).slice(0, 2).map((a) => a.topic);
  return [...related, ...defaultSuggestions("", ctx)].slice(0, 4);
}

/* ----------------------------- LLM providers (optional) ----------------------------- */
// Each returns a plain completion. In production route these through a
// Supabase Edge Function so the API key never ships to the browser.

async function chatCompletion(url: string, headers: Record<string, string>, body: Record<string, unknown>, extract: (r: any) => string, provider: string): Promise<AIAnswer> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${provider} error: ${res.status}`);
  const data = await res.json();
  return { content: extract(data), provider };
}

function geminiProvider(key: string): AIProvider {
  return {
    name: "gemini",
    async answer(messages, ctx) {
      const sys = buildSystemPrompt(ctx);
      return chatCompletion(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
        {},
        { contents: [{ role: "user", parts: [{ text: sys + "\n\n" + messages.map((m) => `${m.role}: ${m.content}`).join("\n") }] }] },
        (d) => d.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ?? "(empty)",
        "gemini"
      );
    },
  };
}

function groqProvider(key: string): AIProvider {
  return {
    name: "groq",
    async answer(messages, ctx) {
      return chatCompletion(
        "https://api.groq.com/openai/v1/chat/completions",
        { Authorization: `Bearer ${key}` },
        { model: "llama-3.1-8b-instant", messages: [{ role: "system", content: buildSystemPrompt(ctx) }, ...messages] },
        (d) => d.choices?.[0]?.message?.content ?? "(empty)",
        "groq"
      );
    },
  };
}

function openRouterProvider(key: string): AIProvider {
  return {
    name: "openrouter",
    async answer(messages, ctx) {
      return chatCompletion(
        "https://openrouter.ai/api/v1/chat/completions",
        { Authorization: `Bearer ${key}` },
        { model: "meta-llama/llama-3.1-8b-instruct:free", messages: [{ role: "system", content: buildSystemPrompt(ctx) }, ...messages] },
        (d) => d.choices?.[0]?.message?.content ?? "(empty)",
        "openrouter"
      );
    },
  };
}

function anthropicProvider(key: string): AIProvider {
  return {
    name: "anthropic",
    async answer(messages, ctx) {
      return chatCompletion(
        "https://api.anthropic.com/v1/messages",
        { "x-api-key": key, "anthropic-version": "2023-06-01" },
        { model: "claude-3-5-haiku-latest", max_tokens: 1024, system: buildSystemPrompt(ctx), messages },
        (d) => d.content?.map((b: any) => b.text).join("\n") ?? "(empty)",
        "anthropic"
      );
    },
  };
}

function buildSystemPrompt(ctx: DataContext): string {
  const parts = [
    "You are a helpful, concise assistant for an accounting/fintech platform.",
    "Answer in clear, friendly language. Use markdown for structure.",
    "Base any numerical claims ONLY on the data provided; do not invent figures.",
  ];
  if (ctx.companyName) parts.push(`The user's company is ${ctx.companyName}.`);
  if (ctx.data) parts.push(`Current live data:\n${JSON.stringify(ctx.data, null, 2)}`);
  if (ctx.knowledgeBase?.length) parts.push(`Help articles:\n${ctx.knowledgeBase.map((a) => `## ${a.topic}\n${a.body}`).join("\n\n")}`);
  return parts.join("\n\n");
}
