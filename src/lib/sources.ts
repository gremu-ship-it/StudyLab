// Source hierarchy & provenance labels (product rule: every learning item
// must show where it came from; AI text is never presented as authoritative).

import type { SourceLevel } from "../types";

export const SOURCE_LEVELS: Record<
  SourceLevel,
  { label: string; short: string; tone: "l1" | "l2" | "l3" | "l4" }
> = {
  1: {
    label: "Your course material",
    short: "Course material",
    tone: "l1",
  },
  2: {
    label: "Authoritative academic source",
    short: "Academic source",
    tone: "l2",
  },
  3: {
    label: "Curated external resource",
    short: "External resource",
    tone: "l3",
  },
  4: {
    label: "AI-generated explanation",
    short: "AI-generated",
    tone: "l4",
  },
};

export function sourceLabel(level: SourceLevel | null | undefined): string {
  if (!level) return SOURCE_LEVELS[4].label; // unlabelled generated content is treated as L4
  return SOURCE_LEVELS[level].label;
}

/** Banner copy used by the AI tutor and generated lessons. */
export function sourceBanner(level: SourceLevel | null | undefined): string {
  switch (level) {
    case 1:
      return "Based on your course material";
    case 2:
      return "Supplementary academic explanation";
    case 3:
      return "External resource";
    default:
      return "AI-generated explanation — verify against your course material";
  }
}

/**
 * Ordering used when the AI picks what to ground an answer in:
 * student/lecturer material first, then academic, then curated external,
 * and only then AI's own text.
 */
export function sourcePriority(level: SourceLevel | null | undefined): number {
  return level ?? 4;
}
