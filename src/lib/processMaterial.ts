import type { ContentResource, LearningUnit, Question, QuestionOption, Subtopic, UUID } from "../types";

export interface ProcessedMaterial {
  title: string;
  summary: string;
  keyTerms: { term: string; definition: string }[];
  sections: { heading: string; body: string }[];
  questions: Question[];
  options: Record<string, QuestionOption[]>;
  units: LearningUnit[];
  subtopics: Subtopic[];
  resources: ContentResource[];
}

const STOPWORDS = new Set(
  "a an the and or but of to in on for with is are was were be been being this that these those it its as at by from into about over under their there they them we our you your can may might will would should could not no do does did have has had such which who whom whose how what when where why than then also more most each any all some many much".split(/\s+/)
);

function cleanText(t: string): string {
  return t
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/|•|◦|▪|/g, "•")
    .trim();
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"“])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 400 && /[a-zA-Z]/.test(s));
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 80);
}

function extractKeyTerms(text: string, max = 10): { term: string; definition: string }[] {
  const sentences = splitSentences(text);
  const found = new Map<string, string>();

  // 1. Strongest signal: explicit definitions — "X is/are/refers to/means ...".
  const defPatterns = [
    /\b([A-Z][A-Za-z-]*(?:\s[A-Z][A-Za-z-]*){0,3})\s+(?:is|are|refers to|means|describes)\b[^.!?]*[.!?]/g,
    /\b([A-Z][A-Za-z-]*(?:\s[A-Z][A-Za-z-]*){0,3})\s*\([^)]+\)\s+(?:is|are)/g,
  ];
  for (const re of defPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      let term = m[1].trim().replace(/^the\s+/i, "");
      // Strip a leading heading/line that got glued on ("Introduction\nPhotosynthesis").
      term = term.split(/\n/).pop()!.trim();
      if (term.length < 3 || term.length > 50 || !/^[A-Z][A-Za-z-]+/.test(term)) continue;
      if (/\b(Introduction|Summary|Overview|Conclusion|Section|Chapter|Figure|Table)\b/.test(term)) continue;
      // Build the definition from the actual matched text, dropping anything before the term.
      const matchStart = m.index + m[0].indexOf(term);
      const fromTerm = text.slice(matchStart, matchStart + m[0].length + 200);
      const sentence = splitSentences(fromTerm)[0] ?? fromTerm.split(/[.!?]/)[0];
      if (sentence && !found.has(term.toLowerCase())) found.set(term.toLowerCase(), sentence.trim());
    }
  }

  // 2. Bold / quoted terms in the text.
  const markup = /\*\*([^*]{3,40})\*\*|"([^"]{3,40})"/g;
  let mm: RegExpExecArray | null;
  while ((mm = markup.exec(text)) !== null) {
    const term = (mm[1] ?? mm[2] ?? "").trim();
    if (term && !found.has(term.toLowerCase())) {
      const def = sentences.find((s) => s.toLowerCase().includes(term.toLowerCase()));
      if (def) found.set(term.toLowerCase(), def);
    }
  }

  // 3. Fallback: capitalised multi-word phrases that appear in a defining sentence.
  if (found.size < max) {
    const phrase = /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})\b/g;
    let pm: RegExpExecArray | null;
    while ((pm = phrase.exec(text)) !== null) {
      const term = pm[1];
      if (found.has(term.toLowerCase())) continue;
      const def = sentences.find((s) => s.includes(term));
      if (def && !/^(The|This|These|It|We|In|At|On)\b/.test(term)) found.set(term.toLowerCase(), def);
      if (found.size >= max) break;
    }
  }

  return [...found.entries()].slice(0, max).map(([term, definition]) => ({ term: titleCase(term), definition }));
}

function splitSections(text: string): { heading: string; body: string }[] {
  // Prefer explicit headings (numbered, ALL CAPS, or Title Case short lines).
  const lines = text.split("\n");
  const sections: { heading: string; body: string }[] = [];
  let current: { heading: string; body: string } | null = null;

  const isHeading = (line: string) => {
    const t = line.trim();
    if (t.length < 3 || t.length > 90) return false;
    if (/^\d+(\.\d+)*[\s.)]/.test(t)) return true;
    if (t === t.toUpperCase() && /[A-Za-z]/.test(t) && t.split(" ").length <= 8) return true;
    if (/^[A-Z][A-Za-z &/-]{4,60}$/.test(t) && !t.endsWith(".")) return true;
    return false;
  };

  for (const line of lines) {
    if (isHeading(line)) {
      if (current && current.body.trim().length > 40) sections.push(current);
      current = { heading: line.trim().replace(/^\d+(\.\d+)*[\s.)]+/, ""), body: "" };
    } else if (current) {
      current.body += line + "\n";
    }
  }
  if (current && current.body.trim().length > 40) sections.push(current);

  if (sections.length >= 3) {
    return sections.map((s) => ({ heading: titleCase(s.heading), body: cleanText(s.body) }));
  }

  // Fall back to paragraph chunks.
  const paragraphs = text.split(/\n\s*\n/).map((p) => p.trim()).filter((p) => p.length > 200);
  const chunkSize = Math.ceil(paragraphs.length / 5) || 1;
  const chunks: { heading: string; body: string }[] = [];
  for (let i = 0; i < paragraphs.length; i += chunkSize) {
    chunks.push({
      heading: `Part ${chunks.length + 1}`,
      body: cleanText(paragraphs.slice(i, i + chunkSize).join("\n\n")),
    });
  }
  return chunks.slice(0, 6);
}

function makeSummary(text: string, sections: { heading: string; body: string }[]): string {
  const first = splitSentences(text).slice(0, 2).join(" ");
  const headings = sections.slice(0, 5).map((s) => s.heading).join("; ");
  return `${first}\n\nThis document covers: ${headings}.`.trim();
}

let counter = 0;
const id = (p: string) => `${p}-mat-${Date.now().toString(36)}-${(counter++).toString(36)}`;

function buildQuestions(text: string, keyTerms: { term: string; definition: string }[], sections: { heading: string; body: string }[]): { questions: Question[]; options: Record<string, QuestionOption[]> } {
  const questions: Question[] = [];
  const options: Record<string, QuestionOption[]> = {};
  const qid = id("q");

  // 1. Short-answer definitions for key terms (test recall, not guessing).
  keyTerms.slice(0, 4).forEach((kt, i) => {
    const idv = `${qid}-sa${i}`;
    questions.push({
      id: idv, topic_id: "", subtopic_id: null, question_type: "short_answer",
      difficulty: 2, question_text: `In your own words, explain: **${kt.term}**.`,
      explanation: `Model answer: ${kt.definition}`,
      hint_1: `Think about what "${kt.term}" means based on its role in the document.`,
      hint_2: null, correct_answer: { value: kt.definition }, estimated_seconds: 120,
      status: "approved", created_by: null,
    });
  });

  // 2. Comprehension questions from each section (short answer with model answer).
  const sectionQ = sections.slice(0, 3).map((s, i) => {
    const firstSentence = splitSentences(s.body)[0];
    const idv = `${qid}-sec${i}`;
    return {
      q: {
        id: idv, topic_id: "", subtopic_id: null, question_type: "short_answer" as const,
        difficulty: 2, question_text: `Summarise the key point of "${s.heading}" and why it matters.`,
        explanation: `Model answer: ${firstSentence ?? "Review the section and state the main idea in 1–2 sentences."}`,
        hint_1: `Identify the main claim of "${s.heading}" and one supporting detail.`,
        hint_2: null, correct_answer: { value: firstSentence ?? s.body.slice(0, 200) },
        estimated_seconds: 180, status: "approved" as const, created_by: null,
      },
    };
  });
  sectionQ.forEach((x) => questions.push(x.q));

  // 3. A worked/application question — open-ended, not multiple choice.
  if (sections.length > 0) {
    const idv = `${qid}-apply`;
    questions.push({
      id: idv, topic_id: "", subtopic_id: null, question_type: "short_answer",
      difficulty: 3, question_text: `Apply what you learned: using an example from this document, explain how the ideas in "${sections[0].heading}" would work in a real situation.`,
      explanation: "Strong answers connect a concept from the document to a concrete scenario, state assumptions, and explain the outcome. There is no single correct answer — compare your reasoning against the document.",
      hint_1: "Pick a specific concept and a realistic scenario.",
      hint_2: "Explain cause and effect rather than restating the definition.",
      correct_answer: { value: "Open response — self-assess against the document." }, estimated_seconds: 240,
      status: "approved", created_by: null,
    });
  }

  // 4. One MCQ as a quick knowledge check (kept deliberately small).
  if (keyTerms.length >= 4) {
    const correct = keyTerms[0];
    const distractors = keyTerms.slice(1, 4);
    const idv = `${qid}-mcq`;
    const opts: QuestionOption[] = [
      { id: `${idv}-a`, question_id: idv, option_key: "A", option_text: correct.definition, sequence_number: 1, created_by: null },
      ...distractors.map((d, i) => ({
        id: `${idv}-${String.fromCharCode(98 + i)}`, question_id: idv,
        option_key: String.fromCharCode(66 + i), option_text: d.definition, sequence_number: i + 2, created_by: null as UUID | null,
      })),
    ].sort(() => Math.random() - 0.5);
    opts.forEach((o, i) => { o.option_key = String.fromCharCode(65 + i); o.sequence_number = i + 1; });
    options[idv] = opts;
    questions.push({
      id: idv, topic_id: "", subtopic_id: null, question_type: "multiple_choice",
      difficulty: 2, question_text: `Which statement best describes "${correct.term}"?`,
      explanation: correct.definition, hint_1: `Recall the definition of ${correct.term}.`, hint_2: null,
      correct_answer: { key: opts.find((o) => o.option_text === correct.definition)!.option_key },
      estimated_seconds: 60, status: "approved", created_by: null,
    });
  }

  return { questions, options };
}

export function processDocument(fileName: string, rawText: string): ProcessedMaterial {
  const text = cleanText(rawText);
  const sections = splitSections(text);
  const keyTerms = extractKeyTerms(text, 10);
  const title = titleCase(fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " "));
  const summary = makeSummary(text, sections);

  // Build a subtopic per section, plus a units/question set.
  const subtopics: Subtopic[] = sections.slice(0, 6).map((s, i) => ({
    id: id("s"), topic_id: "", name: s.heading, description: s.body.slice(0, 160),
    sequence_number: i + 1, status: "active", created_by: null,
  }));

  const units: LearningUnit[] = [];
  sections.slice(0, 6).forEach((s, i) => {
    units.push({
      id: id("lu"), topic_id: "", subtopic_id: subtopics[i]?.id ?? null,
      title: s.heading, unit_type: "explanation", sequence_number: units.length + 1,
      description: s.body.slice(0, 140), body: s.body, estimated_minutes: Math.max(5, Math.round(s.body.split(/\s+/).length / 180)),
      difficulty: 2, status: "approved", created_by: null,
    });
  });
  units.push({
    id: id("lu"), topic_id: "", subtopic_id: null,
    title: "Key terms & definitions", unit_type: "review", sequence_number: units.length + 1,
    description: `Core vocabulary from ${title}`, body: keyTerms.map((k) => `**${k.term}** — ${k.definition}`).join("\n\n"),
    estimated_minutes: 6, difficulty: 1, status: "approved", created_by: null,
  });
  if (sections.length) {
    units.push({
      id: id("lu"), topic_id: "", subtopic_id: null,
      title: "Summary", unit_type: "explanation", sequence_number: units.length + 1,
      description: "Document overview", body: summary, estimated_minutes: 4, difficulty: 1,
      status: "approved", created_by: null,
    });
  }

  const { questions, options } = buildQuestions(text, keyTerms, sections);

  const resources: ContentResource[] = [];

  return { title, summary, keyTerms, sections, questions, options, units, subtopics, resources };
}
