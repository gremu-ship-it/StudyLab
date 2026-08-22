// Ledgr / StudyLab AI chat proxy.
// Keeps the LLM API key on the server and applies a system prompt grounded
// in the caller's live data / knowledge base.
//
// Deploy:
//   supabase functions deploy ai-chat
// Secrets (set via `supabase secrets set`):
//   AI_PROVIDER = gemini | groq | openrouter | anthropic
//   AI_API_KEY  = the provider key
//   AI_MODEL    = optional model override
//
// Client POST body:
//   { messages: [{role, content}], context: { companyName, data, knowledgeBase } }

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SYSTEM_PROMPT = `You are a concise, friendly assistant for an accounting/fintech platform called Ledgr.
- Answer in clear markdown.
- Base every number ONLY on the live data provided; never invent figures.
- For how-to questions, use the help articles provided.
- Flag anomalies and compliance issues when relevant.
- Keep responses under ~200 words unless asked to go deeper.`;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const provider = (Deno.env.get("AI_PROVIDER") || "groq").toLowerCase();
  const apiKey = Deno.env.get("AI_API_KEY");
  if (!apiKey) return json({ error: "AI_API_KEY not configured" }, 500);

  const { messages, context } = await req.json().catch(() => ({}));
  if (!Array.isArray(messages)) return json({ error: "messages[] required" }, 400);

  const ctx = context ?? {};
  const system = `${SYSTEM_PROMPT}\n\nCompany: ${ctx.companyName ?? "n/a"}\n` +
    (ctx.data ? `Live data:\n${JSON.stringify(ctx.data).slice(0, 12000)}\n\n` : "") +
    (ctx.knowledgeBase?.length ? `Help articles:\n${ctx.knowledgeBase.map((a: any) => `## ${a.topic}\n${a.body}`).join("\n\n").slice(0, 20000)}` : "");

  try {
    let content = "";
    if (provider === "gemini") {
      const model = Deno.env.get("AI_MODEL") || "gemini-1.5-flash";
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: system + "\n\n" + messages.map((m: any) => `${m.role}: ${m.content}`).join("\n") }] }] }),
      });
      const d = await r.json();
      content = d.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("\n") ?? "";
    } else {
      // OpenAI-compatible providers: groq, openrouter, together, etc.
      const url = provider === "anthropic"
        ? "https://api.anthropic.com/v1/messages"
        : provider === "openrouter"
        ? "https://openrouter.ai/api/v1/chat/completions"
        : "https://api.groq.com/openai/v1/chat/completions";
      const model = Deno.env.get("AI_MODEL") ||
        (provider === "anthropic" ? "claude-3-5-haiku-latest" : "llama-3.1-8b-instant");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider === "anthropic") { headers["x-api-key"] = apiKey; headers["anthropic-version"] = "2023-06-01"; }
      else headers["Authorization"] = `Bearer ${apiKey}`;
      const r = await fetch(url, {
        method: "POST", headers,
        body: JSON.stringify(provider === "anthropic"
          ? { model, max_tokens: 1024, system, messages }
          : { model, messages: [{ role: "system", content: system }, ...messages] }),
      });
      const d = await r.json();
      content = provider === "anthropic"
        ? d.content?.map((b: any) => b.text).join("\n") ?? ""
        : d.choices?.[0]?.message?.content ?? "";
    }
    return json({ content, provider });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
