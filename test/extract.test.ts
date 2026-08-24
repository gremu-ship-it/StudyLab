import { describe, expect, it } from "vitest";
import { extractFromText, extractItems } from "../supabase/functions/process-material/parser";

const LECTURE = `# Differentiation

Differentiation is the process of finding the rate at which a function changes with respect to its variable.

The derivative of a function f is written as f'(x) or dy/dx.

dy/dx = lim h->0 [f(x+h) - f(x)] / h

The power rule states that if y = x^n then dy/dx = n x^(n-1).

## Worked examples

Worked Example 1. Differentiate y = 3x^2.

Solution: using the power rule, dy/dx = 6x.

1. Find the derivative of y = x^3.
2. Calculate the gradient of y = 2x + 1 at x = 4.
3. What is the derivative of a constant?

By the end of this topic you should be able to differentiate polynomial functions.

Activity: differentiate ten polynomial expressions and check your answers.

A limit is the value that a function approaches as the input approaches some value.
`;

describe("extractItems", () => {
  it("extracts markdown headings and tracks them as context", () => {
    const items = extractItems(LECTURE);
    const headings = items.filter((i) => i.item_type === "heading").map((i) => i.content);
    expect(headings).toContain("Differentiation");
    expect(headings).toContain("Worked examples");
    // later items carry the active heading
    const q = items.find((i) => i.item_type === "question" && i.content.includes("Find the derivative"));
    expect(q?.heading).toBe("Worked examples");
  });

  it("extracts definitions ('X is …')", () => {
    const items = extractItems(LECTURE);
    const defs = items.filter((i) => i.item_type === "definition").map((i) => i.content);
    expect(defs.some((d) => d.startsWith("Differentiation is"))).toBe(true);
    expect(defs.some((d) => d.startsWith("A limit is"))).toBe(true);
  });

  it("extracts formulas (math tokens, short lines)", () => {
    const items = extractItems(LECTURE);
    const formulas = items.filter((i) => i.item_type === "formula").map((i) => i.content);
    expect(formulas.some((f) => f.includes("lim h->0"))).toBe(true);
    expect(formulas.some((f) => f.includes("dy/dx = n x"))).toBe(true);
  });

  it("extracts numbered questions but not plain numbered notes", () => {
    const items = extractItems(LECTURE);
    const questions = items.filter((i) => i.item_type === "question").map((i) => i.content);
    expect(questions.some((q) => q.startsWith("1. Find the derivative"))).toBe(true);
    expect(questions.some((q) => q.startsWith("2. Calculate the gradient"))).toBe(true);
    expect(questions.some((q) => q.startsWith("3. What is the derivative of a constant"))).toBe(true);
    // "Worked Example 1." must NOT be captured as a question
    expect(questions.some((q) => q.includes("Differentiate y = 3x"))).toBe(false);
  });

  it("extracts objectives and activities", () => {
    const items = extractItems(LECTURE);
    expect(items.some((i) => i.item_type === "objective" && i.content.includes("By the end"))).toBe(true);
    expect(items.some((i) => i.item_type === "activity" && i.content.startsWith("Activity"))).toBe(true);
  });

  it("extracts examples", () => {
    const items = extractItems(LECTURE);
    expect(items.some((i) => i.item_type === "example")).toBe(true);
  });

  it("truncates long items and caps the item count", () => {
    const long = "# " + "Heading title ".repeat(100); // ~1.2KB heading line
    const items = extractItems(long);
    const h = items.find((i) => i.item_type === "heading");
    expect(h).toBeDefined();
    expect(h!.content.length).toBeLessThanOrEqual(500);

    const huge = Array.from({ length: 600 }, (_, i) => `1. Find the value of expression number ${i}.`).join("\n");
    const many = extractItems(huge);
    expect(many.length).toBeLessThanOrEqual(400);
  });

  it("assigns confidences within [0,1]", () => {
    const items = extractItems(LECTURE);
    expect(items.length).toBeGreaterThan(5);
    for (const i of items) {
      expect(i.confidence).toBeGreaterThanOrEqual(0);
      expect(i.confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("extractFromText (format gate)", () => {
  it("supports txt/md", () => {
    const r = extractFromText(LECTURE, "notes.txt", "text/plain");
    expect(r.supported).toBe(true);
    expect(r.result?.items.length).toBeGreaterThan(5);
  });

  it("reports PDF as honestly pending", () => {
    const r = extractFromText("%PDF-1.4 …", "lecture1.pdf", "application/pdf");
    expect(r.supported).toBe(false);
    expect(r.reason).toMatch(/pending/i);
    expect(r.result).toBeNull();
  });

  it("rejects empty documents", () => {
    const r = extractFromText("   ", "empty.md", "text/markdown");
    expect(r.supported).toBe(false);
    expect(r.reason).toMatch(/empty|short/i);
  });
});
