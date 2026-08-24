// Interactive visual Concept Map & Prerequisite DAG component.
// Color-coded by mastery:
//   GREEN = Mastered (>=85%) · AMBER = Developing (40–84%) · RED = Weak (<40%) · GREY = Not Assessed

import { useMemo, useState } from "react";
import { ArrowRight, BookOpen, Brain, CheckCircle2, ChevronRight, HelpCircle, Network, Target } from "lucide-react";
import type { Concept, ConceptMastery, ConceptPrerequisite, MasteryLevel } from "../types";
import { masteryMeta } from "./ui";

interface LayoutNode {
  id: string;
  concept: Concept;
  x: number;
  y: number;
  level: MasteryLevel;
  score: number | null;
  prereqIds: string[];
}

export function ConceptMap({
  concepts,
  prerequisites,
  masteryList,
  onPracticeConcept,
  onAskTutor,
}: {
  concepts: Concept[];
  prerequisites: ConceptPrerequisite[];
  masteryList: ConceptMastery[];
  onPracticeConcept?: (conceptId: string) => void;
  onAskTutor?: (concept: Concept) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(concepts[0]?.id ?? null);

  const masteryByConcept = useMemo(() => {
    const map = new Map<string, ConceptMastery>();
    for (const m of masteryList) map.set(m.concept_id, m);
    return map;
  }, [masteryList]);

  const prereqsByConcept = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const p of prerequisites) {
      const arr = map.get(p.concept_id) ?? [];
      arr.push(p.prerequisite_id);
      map.set(p.concept_id, arr);
    }
    return map;
  }, [prerequisites]);

  const { nodes, links, width, height } = useMemo(() => {
    if (!concepts.length) return { nodes: [], links: [], width: 700, height: 260 };

    // Layout in a topological / 3-column progression grid
    const cols = 3;
    const colWidth = 240;
    const rowHeight = 76;
    const padX = 60;
    const padY = 50;

    const layoutNodes: LayoutNode[] = concepts.map((c, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const m = masteryByConcept.get(c.id);
      const level: MasteryLevel = m ? (m.mastery_level as MasteryLevel) : "not_assessed";
      const score = m && m.attempt_count > 0 ? m.mastery_score : null;

      return {
        id: c.id,
        concept: c,
        x: padX + col * colWidth,
        y: padY + row * rowHeight,
        level,
        score,
        prereqIds: prereqsByConcept.get(c.id) ?? [],
      };
    });

    const nodeMap = new Map(layoutNodes.map((n) => [n.id, n]));
    const layoutLinks: { fromX: number; fromY: number; toX: number; toY: number; color: string }[] = [];

    for (const p of prerequisites) {
      const from = nodeMap.get(p.prerequisite_id);
      const to = nodeMap.get(p.concept_id);
      if (from && to) {
        layoutLinks.push({
          fromX: from.x + 85,
          fromY: from.y + 16,
          toX: to.x - 85,
          toY: to.y + 16,
          color: masteryMeta(to.level).color,
        });
      }
    }

    const totalHeight = padY + Math.ceil(concepts.length / cols) * rowHeight + 30;
    return {
      nodes: layoutNodes,
      links: layoutLinks,
      width: padX * 2 + cols * colWidth - 60,
      height: Math.max(300, totalHeight),
    };
  }, [concepts, prerequisites, masteryByConcept, prereqsByConcept]);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? nodes[0];
  const selectedConcept = selectedNode?.concept;
  const selectedPrereqs = (selectedNode?.prereqIds ?? [])
    .map((id) => concepts.find((c) => c.id === id)?.name)
    .filter(Boolean);

  return (
    <div className="concept-map-container">
      <div className="concept-map-header">
        <div>
          <span className="eyebrow">KNOWLEDGE HIERARCHY & DEPENDENCIES</span>
          <h3>Interactive Concept Map</h3>
          <p className="mut small">
            Click any concept node to inspect definitions, mathematical formulas, prerequisites, and mastery metrics.
          </p>
        </div>

        <div className="mastery-legend-chips">
          {(["mastered", "strong", "developing", "weak", "not_assessed"] as MasteryLevel[]).map((lvl) => (
            <span key={lvl} className="legend-chip">
              <i style={{ backgroundColor: masteryMeta(lvl).color }} />
              {masteryMeta(lvl).label}
            </span>
          ))}
        </div>
      </div>

      <div className="concept-map-body-grid">
        <div className="concept-svg-canvas">
          <svg width={width} height={height} className="concept-dag-svg">
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
              </marker>
            </defs>

            {/* Prerequisite Edges */}
            {links.map((l, idx) => (
              <path
                key={idx}
                d={`M ${l.fromX} ${l.fromY} C ${(l.fromX + l.toX) / 2} ${l.fromY}, ${(l.fromX + l.toX) / 2} ${l.toY}, ${l.toX} ${l.toY}`}
                className="dag-link"
                stroke={l.color}
                strokeWidth={1.8}
                strokeDasharray="4 2"
                markerEnd="url(#arrow)"
              />
            ))}

            {/* Nodes */}
            {nodes.map((n) => {
              const isSelected = n.id === selectedId;
              const meta = masteryMeta(n.level);

              return (
                <g
                  key={n.id}
                  className={`concept-node-group ${isSelected ? "selected" : ""}`}
                  transform={`translate(${n.x}, ${n.y})`}
                  onClick={() => setSelectedId(n.id)}
                >
                  <rect
                    x={-80}
                    y={-14}
                    width={160}
                    height={38}
                    rx={8}
                    className="concept-node-rect"
                    stroke={isSelected ? "#2563eb" : meta.color}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    fill={isSelected ? "rgba(37, 99, 235, 0.08)" : "var(--card-bg, #ffffff)"}
                  />
                  <circle cx={-66} cy={5} r={5} fill={meta.color} />
                  <text x={-54} y={9} className="concept-node-text">
                    {n.concept.name.length > 20 ? n.concept.name.slice(0, 18) + "…" : n.concept.name}
                  </text>
                  {n.score !== null && (
                    <text x={65} y={9} className="concept-score-text" fill={meta.color}>
                      {n.score}%
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>

        {/* Node Detail Inspector */}
        {selectedConcept && (
          <div className="concept-inspector-card">
            <div className="inspector-head">
              <span className="eyebrow">CONCEPT INSPECTOR</span>
              <h4>{selectedConcept.name}</h4>
              <div className="inspector-badge-row">
                <span className="tag" style={{ borderLeft: `3px solid ${masteryMeta(selectedNode.level).color}` }}>
                  {masteryMeta(selectedNode.level).label} {selectedNode.score !== null ? `(${selectedNode.score}%)` : ""}
                </span>
                <span className="tag">Difficulty: Level {selectedConcept.difficulty ?? 2}</span>
              </div>
            </div>

            <div className="inspector-body">
              {selectedConcept.definition && (
                <div className="inspector-field">
                  <strong>Formal Definition:</strong>
                  <p className="small">{selectedConcept.definition}</p>
                </div>
              )}

              {selectedConcept.formula && (
                <div className="inspector-field">
                  <strong>Key Equation / Formula:</strong>
                  <code className="formula-block">{selectedConcept.formula}</code>
                </div>
              )}

              {selectedPrereqs.length > 0 && (
                <div className="inspector-field">
                  <strong>Prerequisite Concepts:</strong>
                  <div className="prereq-pill-list">
                    {selectedPrereqs.map((name, i) => (
                      <span key={i} className="pill-prereq">
                        <ArrowRight size={11} /> {name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedConcept.description && selectedConcept.description !== selectedConcept.definition && (
                <div className="inspector-field">
                  <strong>Concept Role:</strong>
                  <p className="small mut">{selectedConcept.description}</p>
                </div>
              )}
            </div>

            <div className="inspector-actions">
              {onPracticeConcept && (
                <button className="secondary small-btn" onClick={() => onPracticeConcept(selectedConcept.id)}>
                  <Target size={13} /> Practice Concept
                </button>
              )}
              {onAskTutor && (
                <button className="primary small-btn" onClick={() => onAskTutor(selectedConcept)}>
                  <Brain size={13} /> Ask AI Tutor
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
