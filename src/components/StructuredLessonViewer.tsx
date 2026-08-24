// Structured Lesson & Learning Unit viewer component.
// Replaces shallow paragraphs with deep university-grade units:
//   * Intuition & Mental Model
//   * Formal Definition & Mathematical Notation
//   * Step-by-Step Worked Examples with reasoning
//   * Common Mistakes & Misconceptions
//   * Key Formulas & Visuals
//   * Source Provenance (Level 1-4 with exact citations)

import { useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  ExternalLink,
  HelpCircle,
  Lightbulb,
  ListOrdered,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { LearningUnit, SourceLevel } from "../types";
import { SourceBadge } from "./ui";
import { SOURCE_LEVELS } from "../lib/sources";

export function StructuredLessonViewer({
  units,
  activeUnitIndex = 0,
  onSelectUnit,
}: {
  units: LearningUnit[];
  activeUnitIndex?: number;
  onSelectUnit?: (index: number) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(activeUnitIndex);
  const [activeTab, setActiveTab] = useState<"intuition" | "definition" | "examples" | "mistakes" | "summary">("intuition");

  const effectiveIdx = onSelectUnit ? activeUnitIndex : selectedIdx;
  const currentUnit = units[effectiveIdx] ?? units[0];

  if (!currentUnit) {
    return (
      <div className="empty-lesson-card">
        <BookOpen size={32} />
        <h3>No lessons available yet</h3>
        <p className="mut small">Structured lessons will be generated from authoritative sources or uploaded material.</p>
      </div>
    );
  }

  const sections = currentUnit.sections;

  return (
    <div className="structured-lesson-viewer">
      {/* Unit Selector Strip (if multiple units) */}
      {units.length > 1 && (
        <div className="lesson-unit-tabs-strip">
          {units.map((u, i) => (
            <button
              key={u.id}
              className={`unit-tab-pill ${i === effectiveIdx ? "active" : ""}`}
              onClick={() => {
                setSelectedIdx(i);
                if (onSelectUnit) onSelectUnit(i);
              }}
            >
              <span className="unit-pill-num">{i + 1}</span>
              <span className="unit-pill-title">{u.title}</span>
              {u.estimated_minutes && (
                <span className="unit-pill-time">
                  <Clock size={11} /> {u.estimated_minutes}m
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Main Lesson Content Card */}
      <div className="lesson-main-card">
        <div className="lesson-card-header">
          <div>
            <div className="lesson-eyebrow-row">
              <span className="unit-type-pill">{currentUnit.unit_type.replace(/_/g, " ")}</span>
              {currentUnit.difficulty && (
                <span className="difficulty-pill">Difficulty: Level {currentUnit.difficulty}</span>
              )}
              {currentUnit.source_level && <SourceBadge level={currentUnit.source_level as SourceLevel} />}
            </div>
            <h2>{currentUnit.title}</h2>
            {currentUnit.description && <p className="lesson-desc-lead">{currentUnit.description}</p>}
          </div>

          {currentUnit.estimated_minutes && (
            <div className="lesson-time-chip">
              <Clock size={14} />
              <span>~{currentUnit.estimated_minutes} min study</span>
            </div>
          )}
        </div>

        {/* Section Navigation Tabs */}
        <div className="lesson-section-nav">
          <button
            className={`nav-tab-btn ${activeTab === "intuition" ? "active" : ""}`}
            onClick={() => setActiveTab("intuition")}
          >
            <Lightbulb size={15} /> Intuition & Concept
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "definition" ? "active" : ""}`}
            onClick={() => setActiveTab("definition")}
          >
            <PenLine size={15} /> Formal Definition & Notation
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "examples" ? "active" : ""}`}
            onClick={() => setActiveTab("examples")}
          >
            <ListOrdered size={15} /> Step-by-Step Worked Examples
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "mistakes" ? "active" : ""}`}
            onClick={() => setActiveTab("mistakes")}
          >
            <AlertTriangle size={15} /> Common Pitfalls
          </button>
          <button
            className={`nav-tab-btn ${activeTab === "summary" ? "active" : ""}`}
            onClick={() => setActiveTab("summary")}
          >
            <CheckCircle2 size={15} /> Key Takeaways
          </button>
        </div>

        {/* Tab Body */}
        <div className="lesson-tab-body">
          {activeTab === "intuition" && (
            <div className="lesson-pane intuition-pane">
              <div className="callout-box info">
                <Lightbulb size={20} />
                <div>
                  <h4>Intuitive Mental Model</h4>
                  <p>{sections?.intuition ?? currentUnit.body ?? "Core explanation of the concept."}</p>
                </div>
              </div>

              {currentUnit.formula && (
                <div className="formula-spotlight">
                  <span className="spotlight-tag">PRIMARY EQUATION</span>
                  <code className="formula-display">{currentUnit.formula}</code>
                </div>
              )}

              {currentUnit.body && currentUnit.body !== sections?.intuition && (
                <div className="lesson-body-prose">
                  <p>{currentUnit.body}</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "definition" && (
            <div className="lesson-pane definition-pane">
              <div className="callout-box definition">
                <PenLine size={20} />
                <div>
                  <h4>Rigorous Definition</h4>
                  <p>{sections?.formal_definition ?? currentUnit.body ?? "Formal scientific/mathematical definition."}</p>
                </div>
              </div>

              {sections?.notation && (
                <div className="notation-guide-box">
                  <strong>Notation & Terminology:</strong>
                  <p>{sections.notation}</p>
                </div>
              )}

              {currentUnit.formula && (
                <div className="formula-spotlight">
                  <span className="spotlight-tag">MATHEMATICAL FORMULATION</span>
                  <code className="formula-display">{currentUnit.formula}</code>
                </div>
              )}
            </div>
          )}

          {activeTab === "examples" && (
            <div className="lesson-pane examples-pane">
              <h4>Step-by-Step Worked Solutions</h4>
              {sections?.worked_examples && sections.worked_examples.length > 0 ? (
                <div className="worked-solution-timeline">
                  {sections.worked_examples.map((ex) => (
                    <div key={ex.step} className="worked-step-card">
                      <div className="step-badge">Step {ex.step}</div>
                      <div className="step-details">
                        <h5>{ex.instruction}</h5>
                        {ex.math && <code className="step-math-block">{ex.math}</code>}
                        <p className="step-explanation">{ex.explanation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mut">No worked examples defined for this unit yet.</p>
              )}
            </div>
          )}

          {activeTab === "mistakes" && (
            <div className="lesson-pane mistakes-pane">
              <h4>Common Misconceptions & What to Avoid</h4>
              {sections?.common_mistakes && sections.common_mistakes.length > 0 ? (
                <div className="mistakes-grid">
                  {sections.common_mistakes.map((m, i) => (
                    <div key={i} className="mistake-card">
                      <div className="mistake-row wrong">
                        <AlertTriangle size={16} />
                        <div>
                          <strong>Common Mistake:</strong>
                          <p>{m.mistake}</p>
                        </div>
                      </div>
                      <div className="mistake-row right">
                        <CheckCircle2 size={16} />
                        <div>
                          <strong>Correction:</strong>
                          <p>{m.correction}</p>
                        </div>
                      </div>
                      <div className="mistake-reason">
                        <small>Why this happens: {m.why}</small>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mut">No common pitfalls recorded for this unit yet.</p>
              )}
            </div>
          )}

          {activeTab === "summary" && (
            <div className="lesson-pane summary-pane">
              <h4>Key Takeaways for Mastery</h4>
              {sections?.key_takeaways && sections.key_takeaways.length > 0 ? (
                <ul className="takeaways-checklist">
                  {sections.key_takeaways.map((item, i) => (
                    <li key={i}>
                      <CheckCircle2 size={16} className="check-icon" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mut">Review the core definitions and worked examples above before proceeding to practice.</p>
              )}
            </div>
          )}
        </div>

        {/* Provenance & Citation Footer */}
        <div className="lesson-provenance-footer">
          <div className="prov-info">
            <ShieldCheck size={16} />
            <div>
              <strong>Source Provenance: {SOURCE_LEVELS[(currentUnit.source_level as SourceLevel) ?? 2]?.label}</strong>
              <span>
                {currentUnit.source_title ?? "Academic Textbook"} {currentUnit.page_reference ? `(${currentUnit.page_reference})` : ""}
              </span>
            </div>
          </div>

          {currentUnit.source_url && (
            <a href={currentUnit.source_url} target="_blank" rel="noreferrer" className="text-btn source-link">
              View Source Reference <ExternalLink size={13} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
