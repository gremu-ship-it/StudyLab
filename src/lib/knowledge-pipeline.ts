// Active knowledge pipeline: uploaded document → structured knowledge
// This module makes extracted content available to the learning system.

import type { ExtractedItem, UploadedMaterial } from "../types";

export interface SourceProvenance {
  source_material_id: string;
  source_document_name: string;
  page_number: number | null;
  section_heading: string | null;
  source_type: string;
  extraction_method: string;
  confidence: number;
}

export interface KnowledgeItem extends SourceProvenance {
  item_type: string;
  content: string;
  concept_id?: string | null;
  question_id?: string | null;
}

export function mapExtractedToKnowledge(
  item: ExtractedItem,
  material: UploadedMaterial,
): KnowledgeItem {
  return {
    item_type: item.item_type,
    content: item.content,
    source_material_id: material.id,
    source_document_name: material.file_name,
    page_number: item.source_page,
    section_heading: item.heading,
    source_type: material.mime_type || "unknown",
    extraction_method: "rule_parser",
    confidence: item.confidence,
    concept_id: item.concept_id,
    question_id: item.question_id,
  };
}

export function buildKnowledgeGraph(items: ExtractedItem[], materials: UploadedMaterial[]): KnowledgeItem[] {
  const result: KnowledgeItem[] = [];
  const matMap = new Map(materials.map((m) => [m.id, m]));
  for (const it of items) {
    const mat = matMap.get(it.material_id);
    if (mat) result.push(mapExtractedToKnowledge(it, mat));
  }
  return result;
}
