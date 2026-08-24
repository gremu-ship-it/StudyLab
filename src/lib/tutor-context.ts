// AI Tutor context builder: retrieves relevant source material for tutoring.
// Priority: 1 (student/lecturer material) > 2 (academic) > 3 (external) > 4 (AI)
// If sources conflict, both are preserved and flagged.

import type { SourceLevel } from "../types";

export interface SourceExcerpt {
  level: SourceLevel;
  title: string;
  excerpt: string | null;
  provenance?: string;
}

export interface ConflictFlag {
  sources: string[];
  reason: string;
}

export function selectTutorSources(
  allSources: SourceExcerpt[],
  conceptName?: string,
  maxPerLevel = 3,
): SourceExcerpt[] {
  const sorted = [...allSources].sort((a, b) => (a.level - b.level));
  const selected: SourceExcerpt[] = [];
  const counts = new Map<SourceLevel, number>();
  for (const s of sorted) {
    const c = counts.get(s.level) ?? 0;
    if (c < maxPerLevel) {
      selected.push(s);
      counts.set(s.level, c + 1);
    }
  }
  return selected;
}

export function detectSourceConflict(sources: SourceExcerpt[]): ConflictFlag | null {
  const levels = new Set(sources.map((s) => s.level));
  if (levels.size > 1) {
    return { sources: sources.map((s) => s.title), reason: "Multiple source levels present — review for consistency." };
  }
  return null;
}
