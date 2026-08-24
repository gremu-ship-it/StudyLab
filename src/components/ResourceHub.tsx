// Resource Hub component for topics.
// Categorised into: Essential Reading, Textbooks, Academic Courses, Videos, External Libraries.
// Explains WHY each resource is recommended.

import { useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  GraduationCap,
  Library,
  Lightbulb,
  PlayCircle,
  Sparkles,
  Video,
} from "lucide-react";
import type { Resource, ResourceCategory, ResourcePurpose, SourceLevel } from "../types";
import { SourceBadge } from "./ui";

const PURPOSE_LABELS: Record<ResourcePurpose, { label: string; icon: React.ReactNode; color: string }> = {
  conceptual_understanding: { label: "Conceptual Understanding", icon: <Lightbulb size={13} />, color: "#2563eb" },
  visual_explanation: { label: "Visual Explanation", icon: <Video size={13} />, color: "#8b5cf6" },
  worked_examples: { label: "Worked Examples", icon: <BookOpen size={13} />, color: "#059669" },
  practice: { label: "Practice", icon: <CheckCircle2 size={13} />, color: "#d97706" },
  advanced_study: { label: "Advanced Study", icon: <GraduationCap size={13} />, color: "#475569" },
  exam_preparation: { label: "Exam Preparation", icon: <Library size={13} />, color: "#dc2626" },
  lab_practical: { label: "Lab Practical", icon: <PlayCircle size={13} />, color: "#0891b2" },
};

export function ResourceHub({
  resources,
}: {
  resources: Resource[];
}) {
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const categories = [
    { id: "all", label: "All Resources", count: resources.length },
    { id: "open_textbooks", label: "Textbooks (OpenStax)", count: resources.filter((r) => r.category === "open_textbooks" || r.resource_type === "textbook").length },
    { id: "videos", label: "Videos (3B1B / OCW)", count: resources.filter((r) => r.category === "videos" || r.resource_type === "youtube").length },
    { id: "academic_websites", label: "Academic Notes", count: resources.filter((r) => r.category === "academic_websites" || r.resource_type === "website").length },
    { id: "external_libraries", label: "WeLib & Libraries", count: resources.filter((r) => r.category === "external_libraries").length },
  ];

  const filtered = resources.filter((r) => {
    if (selectedCategory === "all") return true;
    if (selectedCategory === "open_textbooks") return r.category === "open_textbooks" || r.resource_type === "textbook";
    if (selectedCategory === "videos") return r.category === "videos" || r.resource_type === "youtube";
    if (selectedCategory === "academic_websites") return r.category === "academic_websites" || r.resource_type === "website";
    if (selectedCategory === "external_libraries") return r.category === "external_libraries";
    return true;
  });

  return (
    <div className="resource-hub-container">
      <div className="hub-header">
        <div>
          <span className="eyebrow">CURATED RESOURCE HUB</span>
          <h3>Authoritative Textbooks, Courses & Video Lessons</h3>
          <p className="mut small">
            Authoritative educational resources tagged with provenances, page citations, and rationales explaining why they help.
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="hub-category-tabs">
        {categories.map((c) => (
          <button
            key={c.id}
            className={`hub-tab-btn ${selectedCategory === c.id ? "active" : ""}`}
            onClick={() => setSelectedCategory(c.id)}
          >
            {c.label} ({c.count})
          </button>
        ))}
      </div>

      {/* Resource Cards Grid */}
      <div className="hub-cards-grid">
        {filtered.map((res) => {
          const purposeMeta = res.purpose ? PURPOSE_LABELS[res.purpose] : null;

          return (
            <div key={res.id} className="hub-resource-card">
              <div className="hub-card-top">
                <div className="hub-type-tag">
                  {res.resource_type === "youtube" ? (
                    <span className="type-pill video"><Video size={12} /> Video</span>
                  ) : res.resource_type === "textbook" ? (
                    <span className="type-pill textbook"><BookOpen size={12} /> Textbook</span>
                  ) : (
                    <span className="type-pill doc"><Library size={12} /> Academic Resource</span>
                  )}
                  {res.source_level && <SourceBadge level={res.source_level as SourceLevel} />}
                </div>

                {res.duration_seconds && (
                  <span className="hub-duration">
                    <Clock size={12} /> {Math.round(res.duration_seconds / 60)} min
                  </span>
                )}
              </div>

              <h4>{res.title}</h4>
              {res.description && <p className="hub-desc">{res.description}</p>}

              {/* Purpose & Rationale Callout */}
              <div className="hub-meta-box">
                {purposeMeta && (
                  <div className="hub-purpose-badge" style={{ color: purposeMeta.color }}>
                    {purposeMeta.icon}
                    <span>{purposeMeta.label}</span>
                  </div>
                )}

                {res.recommendation_reason && (
                  <div className="hub-why-box">
                    <Sparkles size={13} className="sparkle-icon" />
                    <span><strong>Why recommended:</strong> {res.recommendation_reason}</span>
                  </div>
                )}

                {res.page_reference && (
                  <div className="hub-page-ref">
                    <strong>Citation:</strong> {res.page_reference} ({res.provider ?? "Publisher"})
                  </div>
                )}
              </div>

              {/* Action */}
              <div className="hub-card-action">
                {res.url && (
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    className="primary small-btn open-link"
                  >
                    Open Resource <ExternalLink size={13} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
