// Deterministic structural extractor for uploaded study material.
// Runs server-side inside the `process-material` Edge Function (Deno).
// No AI is involved: this is a transparent, rule-based parse so students
// can trust what came "from their upload" (source level 1).
//
// The parser is pure (text in, items out) and unit-tested from the app
// workspace via test/extract.test.ts — the same file is bundled into the
// Edge Function, so tests and runtime never drift.

export type ExtractedItemType =
  | "heading"
  | "definition"
  | "formula"
  | "example"
  | "question"
  | "objective"
  | "activity"
  | "concept"
  | "relationship";

export interface ExtractedItemRow {
  item_type: ExtractedItemType;
  content: string;
  heading: string | null;
  source_page: number | null;
  confidence: number;
}

export interface ExtractionResult {
  items: ExtractedItemRow[];
  pageCount: number | null;
  textLength: number;
}

const MAX_ITEMS = 400;
const MAX_ITEM_CHARS = 500;

const trimItem = (s: string): string => s.replace(/\s+/g, " ").trim().slice(0, MAX_ITEM_CHARS);

const MARKDOWN_HEADING = /^\s{0,3}(#{1,6})\s+(.+)$/;
const ALL_CAPS_HEADING = /^([A-Z][A-Z0-9 ,&/()-]{2,59})$/;
// "Differentiation is the process of…" / "A limit refers to…"
const DEFINITION =
  /^(a|an|the|this|these|that)?\s*([A-Z][\w\s\-/(),.]{2,70}?)\s+(is|are|was|means|refers to|is defined as|denotes)\b\s+(.{15,})$/i;
const FORMULA_TOKEN = /[=±∂∇∫∑√≤≥≈×÷⁰¹²³⁴⁵⁶⁷⁸⁹]|\\frac|\\sqrt|\bsin\b|\bcos\b|\btan\b|\bln\b|\blog\b|\bexp\b/;
const QUESTION_VERB =
  /\b(find|calculate|compute|evaluate|solve|determine|what is|how do|why does|show that|prove)\b/i;
const QUESTION_NUMBERED = /^\s*(\d{1,3})[.)]\s+(.+)$/;
const OBJECTIVE_LEAD = /^(learning outcome|objective|by the end of|after this (topic|unit|lecture)|in this (topic|unit|lecture)\b)/i;
const ACTIVITY_LEAD = /^(activity|exercise|lab(ora)?|practical|work(shop)?|group task|self[- ]?check|check your understanding)\b/i;
const EXAMPLE_LEAD = /^(worked example|example\s*\d*|e\.g\.|for example)\b/i;
const RELATIONSHIP_LEAD = /\b(depends on|requires|prerequisite for|leads to|builds on|is a special case of)\b/i;

/**
 * Parse plain text (markdown or plain) into structured study items.
 * `page` is null for single-page formats (txt/md).
 */
export function extractItems(text: string, page: number | null = null): ExtractedItemRow[] {
  const items: ExtractedItemRow[] = [];
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  let currentHeading: string | null = null;
  let listContext: string | null = null; // last numbered item (for multi-line problems)

  const push = (item_type: ExtractedItemType, content: string, confidence: number) => {
    if (items.length >= MAX_ITEMS) return;
    const c = trimItem(content);
    if (c.length < 3) return;
    items.push({ item_type, content: c, heading: currentHeading, source_page: page, confidence });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      listContext = null;
      continue;
    }

    const mdHeading = line.match(MARKDOWN_HEADING);
    if (mdHeading) {
      currentHeading = trimItem(mdHeading[2]);
      push("heading", currentHeading, 0.9);
      continue;
    }
    if (ALL_CAPS_HEADING.test(line) && line.length <= 60 && !line.includes(".")) {
      currentHeading = trimItem(line);
      push("heading", currentHeading, 0.55);
      continue;
    }

    if (OBJECTIVE_LEAD.test(line)) {
      push("objective", line, 0.8);
      continue;
    }
    if (ACTIVITY_LEAD.test(line)) {
      push("activity", line, 0.7);
      continue;
    }
    if (EXAMPLE_LEAD.test(line)) {
      push("example", line, 0.65);
      continue;
    }

    // Numbered items: questions/problems vs plain lists.
    const numbered = line.match(QUESTION_NUMBERED);
    if (numbered) {
      const body = numbered[2];
      const isQuestion =
        body.endsWith("?") || QUESTION_VERB.test(body) || listContext === null && /\?\s*$/.test(line);
      if (isQuestion) {
        push("question", `${numbered[1]}. ${body}`, 0.6);
        listContext = `${numbered[1]}. ${body}`;
      } else {
        listContext = `${numbered[1]}. ${body}`;
        if (FORMULA_TOKEN.test(body)) push("formula", body, 0.5);
      }
      continue;
    }

    // Continuation of a multi-line problem: keep it attached to the last question.
    if (listContext && line.endsWith("?")) {
      push("question", `${listContext} ${line}`, 0.5);
      listContext = null;
      continue;
    }
    if (listContext && QUESTION_VERB.test(line)) {
      push("question", `${listContext} ${line}`, 0.5);
      listContext = null;
      continue;
    }

    // Definitions: "X is …" / "X means …"
    const def = line.match(DEFINITION);
    if (def && line.length <= 400) {
      push("definition", line, 0.6);
      continue;
    }

    // Formulas: math tokens, short line, or a "y = f(x)" style statement
    // (possibly wrapped in a short rule sentence like "…states that if
    // y = x^n then dy/dx = n x^(n-1).").
    const wordCount = line.split(/\s+/).length;
    const looksFormulaic =
      FORMULA_TOKEN.test(line) &&
      (wordCount <= 12 || /^[a-zA-Z0-9_.\s()*=+\-^~%°']+$/i.test(line) || (line.includes("=") && wordCount <= 16));
    if (looksFormulaic) {
      push("formula", line, wordCount <= 12 ? 0.7 : 0.5);
      continue;
    }

    // Relationship statements (used for prerequisite links later).
    if (RELATIONSHIP_LEAD.test(line) && line.length <= 300 && line.length > 15) {
      push("relationship", line, 0.45);
      continue;
    }

    // Concept candidates: standalone short proper-noun phrases in bold/italic.
    const emphasis = line.match(/^\*\*([^*]{3,80})\*\*$/);
    if (emphasis) {
      push("concept", emphasis[1], 0.4);
      continue;
    }
  }

  return items;
}

/**
 * Full extraction for a text payload. `fileName` decides whether the format
 * is even supported by this build (PDF/Office are honestly reported as
 * pending by the caller).
 */
export function extractFromText(
  text: string,
  fileName: string,
  mime: string | null,
): { supported: boolean; reason: string | null; result: ExtractionResult | null } {
  const name = fileName.toLowerCase();
  const isPdf =
    mime === "application/pdf" ||
    name.endsWith(".pdf") ||
    name.endsWith(".pptx") ||
    name.endsWith(".docx") ||
    name.endsWith(".ppt") ||
    name.endsWith(".doc");

  if (isPdf) {
    return {
      supported: false,
      reason:
        "Binary format (PDF/Office) — extraction for this format is pending in this build. Upload .txt or .md now.",
      result: null,
    };
  }

  if (!text || text.trim().length < 20) {
    return {
      supported: false,
      reason: "Document is empty or too short to extract from.",
      result: null,
    };
  }

  const items = extractItems(text);
  return {
    supported: true,
    reason: null,
    result: { items, pageCount: null, textLength: text.length },
  };
}
