// StudyLab Edge Function: ai-tutor
// ------------------------------------------------------------------
// Server-side AI tutor + Feynman evaluator. API keys live only here —
// the browser never sees them (student token is verified instead).
//
// Contract (called from src/lib/api.ts → invokeAiTutor):
//   POST AiContextPayload & { conversation_id: string }
//   → AiReply = { content: string; source_level: 1|2|3|4;
//                 needs_more_info: boolean; missing_info?: string }
//
// Source policy (the 4-level hierarchy is enforced, not just suggested):
//   * the model must answer from the provided `sources` when they exist
//     (L1 course material > L2 academic > L3 curated external);
//   * if no sources are provided, the reply is forced to source_level 4
//     with needs_more_info = true ("AI-generated — verify against your
//     course material");
//   * the model may never present AI text as authoritative.
//
// Providers (server env, checked in order):
//   ANTHROPIC_API_KEY → Anthropic Messages API
//   OPENAI_API_KEY    → OpenAI Chat Completions
//   neither           → 503 { error_code: "ai_not_configured" }
//
// feynman_evaluate task: the reply content MUST contain "<score> / 100"
// (the client parses it) plus strengths/gaps/next-steps.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// --- Auth (same minimal HS256 check as process-material) ----------------

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function verifySupabaseJwt(token: string, secret: string): Promise<{ sub: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(new TextDecoder().decode(base64urlToBytes(headerB64)));
    if (header.alg !== "HS256") return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const okSig = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(sigB64),
      enc.encode(`${headerB64}.${payloadB64}`),
    );
    if (!okSig) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

// --- Prompting ----------------------------------------------------------

interface SourceRef {
  level: 1 | 2 | 3 | 4;
  title: string;
  excerpt: string | null;
}

function buildSystemPrompt(ctx: {
  programme: string | null;
  course: string | null;
  topic: string | null;
  task: string;
  sources: SourceRef[];
  weakConcepts: string[];
  mastery: { topic: string; level: string; score: number }[];
}): string {
  const sourceBlock = ctx.sources.length
    ? ctx.sources
        .map(
          (s) =>
            `[S${ctx.sources.indexOf(s) + 1}] (level ${s.level}) ${s.title}${
              s.excerpt ? ` — excerpt: "${s.excerpt.slice(0, 400)}"` : ""
            }`,
        )
        .join("\n")
    : "(none provided)";

  return `You are StudyLab's tutoring engine for a university student.
Student context: programme ${ctx.programme ?? "unknown"}, course ${ctx.course ?? "unknown"}, topic ${ctx.topic ?? "unknown"}.
Student mastery so far: ${ctx.mastery.length ? JSON.stringify(ctx.mastery) : "none recorded"}.
Weak concepts flagged: ${ctx.weakConcepts.length ? ctx.weakConcepts.join(", ") : "none"}.

TASK: ${ctx.task}

SOURCE POLICY — non-negotiable:
- You are given the student's actual sources below, numbered, with a level:
  1 = the student's own course material (lecture notes, lecture slides, university documents) — highest authority.
  2 = authoritative academic source. 3 = curated external resource. 4 = AI-generated.
- Answer primarily from the sources that match the task. Cite them like (S1), (S2)… in your answer.
- NEVER present AI-generated text as authoritative. If you go beyond the sources, say so explicitly.
- If the sources are insufficient to answer well, say exactly what is missing (e.g. "your notes for this topic do not cover the chain rule derivation") and give only a clearly-labelled AI-generated bridge.
- For the feynman_evaluate task: evaluate the student's explanation for correctness, completeness and clarity against the sources. You MUST include a line in the form "<integer> / 100" (e.g. "72 / 100") and then bullet points: what was strong, what is missing or wrong, and the single next step.

AVAILABLE SOURCES:
${sourceBlock}

TASK SPECIFICS:
- explain: a full, accurate explanation of the concept, citing sources.
- explain_simply: a plain-language version a confused first-year student can follow.
- analogy: one strong analogy + where the analogy breaks down.
- example: a concrete worked example (numbers, steps).
- math_reasoning: step-by-step mathematical reasoning; show every algebraic step.
- practical_example: tie the concept to a real experiment, measurement or professional task.
- quiz: pose 2-3 short questions the student should answer (do not answer them).
- hint: a hint that guides without giving the answer.
- why_wrong: explain why the student's last attempt was wrong (see messages), then the correct path.
- teach_from_beginning: start from prerequisites and build up.
- test_understanding: ask a discriminating question (easy + application), no answers.
- tutor: general tutoring turn in the conversation.

OUTPUT FORMAT — STRICT:
Respond with ONLY a JSON object, no markdown fences, no text outside the JSON:
{"content": "your full answer in markdown", "source_level": 1|2|3|4, "needs_more_info": true|false, "missing_info": "optional: what source material is missing"}
source_level = the highest-authority source you actually relied on (1 best). If you used no sources at all, source_level MUST be 4. needs_more_info MUST be true when the answer is weakened by missing course material.`;
}

// --- Providers -----------------------------------------------------------

async function callAnthropic(apiKey: string, system: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("ANTHROPIC_MODEL") ?? "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system,
      messages,
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { content: { type: string; text?: string }[] };
  return data.content.map((c) => c.text ?? "").join("");
}

async function callOpenAI(apiKey: string, system: string, messages: { role: string; content: string }[]): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL") ?? "gpt-4o-mini",
      max_tokens: 1500,
      messages: [{ role: "system", content: system }, ...messages],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? "";
}

// --- Reply normalisation --------------------------------------------------

function normaliseReply(raw: string, ctxSources: SourceRef[]): {
  content: string;
  source_level: 1 | 2 | 3 | 4;
  needs_more_info: boolean;
  missing_info?: string;
} {
  let parsed: {
    content?: string;
    source_level?: number;
    needs_more_info?: boolean;
    missing_info?: string;
  } | null = null;
  try {
    // Tolerate models that wrap JSON in fences or prose.
    const cleaned = raw.trim().replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    parsed = null;
  }

  const content = parsed?.content?.trim() || raw.trim() || "The AI did not return a usable answer.";
  let sourceLevel = parsed?.source_level;
  if (sourceLevel !== 1 && sourceLevel !== 2 && sourceLevel !== 3 && sourceLevel !== 4) {
    // Default to the most conservative (AI-generated) when in doubt.
    sourceLevel = ctxSources.some((s) => s.level === 1) ? 1 : 4;
  }

  // Enforce the "no sources ⇒ level 4 + needs_more_info" rule server-side.
  const needsMoreInfo =
    parsed?.needs_more_info === true || ctxSources.length === 0;
  const missingInfo =
    parsed?.missing_info ||
    (ctxSources.length === 0
      ? "No course material is linked to this topic yet — add your lecture notes in Materials."
      : undefined);

  return {
    content,
    source_level: sourceLevel as 1 | 2 | 3 | 4,
    needs_more_info: needsMoreInfo,
    missing_info: missingInfo,
  };
}

// --- Main ------------------------------------------------------------------

interface AiTutorBody {
  conversation_id?: string;
  task?: string;
  programme?: string | null;
  course?: string | null;
  topic?: string | null;
  mastery?: { topic: string; level: string; score: number }[];
  weak_concepts?: string[];
  sources?: SourceRef[];
  messages?: { role: "user" | "assistant"; content: string }[];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    return json({ error: "Server environment is misconfigured." }, 500);
  }
  if (!anthropicKey && !openaiKey) {
    return json(
      { error: "No AI provider configured.", error_code: "ai_not_configured" },
      503,
    );
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json({ error: "Missing authorization" }, 401);
  const user = await verifySupabaseJwt(token, jwtSecret);
  if (!user) return json({ error: "Invalid or expired token" }, 401);

  const body = (await req.json().catch(() => null)) as AiTutorBody | null;
  if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
    return json({ error: "messages[] is required" }, 400);
  }

  // Conversation must belong to the caller (service-role read; RLS would
  // also cover this, but we verify before spending an AI call).
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });
  if (body.conversation_id) {
    const { data: conv } = await admin
      .from("ai_conversations")
      .select("id, student_id")
      .eq("id", body.conversation_id)
      .maybeSingle();
    if (!conv || conv.student_id !== user.sub) {
      return json({ error: "Conversation not found" }, 404);
    }
  }

  const sources = (body.sources ?? []).filter((s) => s && (s.level === 1 || s.level === 2 || s.level === 3 || s.level === 4));
  const system = buildSystemPrompt({
    programme: body.programme ?? null,
    course: body.course ?? null,
    topic: body.topic ?? null,
    task: body.task ?? "tutor",
    sources,
    weakConcepts: body.weak_concepts ?? [],
    mastery: body.mastery ?? [],
  });
  const messages = body.messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-12)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));

  try {
    const raw = anthropicKey
      ? await callAnthropic(anthropicKey, system, messages)
      : await callOpenAI(openaiKey as string, system, messages);
    const reply = normaliseReply(raw, sources);

    // Persist the assistant turn (best effort — the client also stores it).
    if (body.conversation_id) {
      await admin.from("ai_messages").insert({
        conversation_id: body.conversation_id,
        role: "assistant",
        content: reply.content,
        metadata: {
          source_level: reply.source_level,
          needs_more_info: reply.needs_more_info,
          task: body.task ?? "tutor",
        },
      });
    }
    return json(reply);
  } catch (err) {
    return json(
      {
        error: `AI provider call failed: ${err instanceof Error ? err.message : String(err)}`,
        error_code: "ai_provider_error",
      },
      502,
    );
  }
});
