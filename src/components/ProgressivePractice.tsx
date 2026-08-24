// Progressive Practice component (Levels 1 to 5).
// Level 1: Recognition · Level 2: Basic Application · Level 3: Multi-step · Level 4: Unfamiliar Problem · Level 5: Application/Transfer

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronRight,
  Filter,
  HelpCircle,
  Layers,
  Lightbulb,
  ShieldAlert,
  Target,
  Trophy,
} from "lucide-react";
import type { PracticeLevel, Question, QuestionOption } from "../types";
import { QuestionRunner, type AttemptResult } from "./QuestionRunner";

export const LEVEL_METADATA: Record<
  PracticeLevel,
  { label: string; name: string; description: string; badgeClass: string }
> = {
  1: {
    label: "Level 1",
    name: "Recognition & Recall",
    description: "Definitions, direct notation, formula identification, and basic terminology.",
    badgeClass: "level-1",
  },
  2: {
    label: "Level 2",
    name: "Basic Application",
    description: "Standard procedural steps and direct formula substitutions.",
    badgeClass: "level-2",
  },
  3: {
    label: "Level 3",
    name: "Multi-Step Problem Solving",
    description: "Combining multiple algebraic, graphical, or conceptual steps to solve.",
    badgeClass: "level-3",
  },
  4: {
    label: "Level 4",
    name: "Unfamiliar & Novel Problems",
    description: "Non-standard setups, parameter finding, and non-routine edge cases.",
    badgeClass: "level-4",
  },
  5: {
    label: "Level 5",
    name: "Application & Transfer",
    description: "Real-world domain models, experimental interpretation, and cross-disciplinary transfer.",
    badgeClass: "level-5",
  },
};

export function ProgressivePractice({
  questions,
  options,
  onAttempt,
}: {
  questions: Question[];
  options: QuestionOption[];
  onAttempt?: (question: Question, result: AttemptResult) => void;
}) {
  const [selectedLevel, setSelectedLevel] = useState<number | "all">("all");
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(questions[0]?.id ?? null);
  const [attemptHistory, setAttemptHistory] = useState<Record<string, AttemptResult>>({});

  const filteredQuestions = useMemo(() => {
    if (selectedLevel === "all") return questions;
    return questions.filter((q) => q.difficulty === selectedLevel);
  }, [questions, selectedLevel]);

  const activeQuestion = questions.find((q) => q.id === activeQuestionId) ?? filteredQuestions[0];
  const activeOptions = options.filter((o) => o.question_id === activeQuestion?.id);

  function handleAttempt(result: AttemptResult) {
    if (!activeQuestion) return;
    setAttemptHistory((prev) => ({ ...prev, [activeQuestion.id]: result }));
    if (onAttempt) onAttempt(activeQuestion, result);
  }

  // Count by level
  const countByLevel = useMemo(() => {
    const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const q of questions) {
      if (counts[q.difficulty] !== undefined) counts[q.difficulty]++;
    }
    return counts;
  }, [questions]);

  return (
    <div className="progressive-practice-panel">
      <div className="practice-header-row">
        <div>
          <span className="eyebrow">PROGRESSIVE PRACTICE BANK</span>
          <h3>Practise from Foundations to Mastery</h3>
          <p className="mut small">
            Mastery requires demonstrating competency on Multi-Step (Level 3) and Application (Levels 4–5) items.
          </p>
        </div>
      </div>

      {/* Level Selector Filter Tabs */}
      <div className="practice-level-tabs">
        <button
          className={`level-tab-btn ${selectedLevel === "all" ? "active" : ""}`}
          onClick={() => setSelectedLevel("all")}
        >
          <Layers size={14} /> All Levels ({questions.length})
        </button>

        {([1, 2, 3, 4, 5] as PracticeLevel[]).map((lvl) => (
          <button
            key={lvl}
            className={`level-tab-btn ${selectedLevel === lvl ? "active" : ""}`}
            onClick={() => {
              setSelectedLevel(lvl);
              const firstInLevel = questions.find((q) => q.difficulty === lvl);
              if (firstInLevel) setActiveQuestionId(firstInLevel.id);
            }}
          >
            <span className={`level-indicator-dot lvl-${lvl}`} />
            {LEVEL_METADATA[lvl].label} ({countByLevel[lvl] || 0})
          </button>
        ))}
      </div>

      {/* Level Summary Callout */}
      {selectedLevel !== "all" && (
        <div className="level-info-callout">
          <strong>
            {LEVEL_METADATA[selectedLevel as PracticeLevel].label}: {LEVEL_METADATA[selectedLevel as PracticeLevel].name}
          </strong>
          <span> — {LEVEL_METADATA[selectedLevel as PracticeLevel].description}</span>
        </div>
      )}

      {/* Question Grid + Active Runner Split */}
      <div className="practice-workspace-grid">
        {/* Question Selector List */}
        <div className="practice-question-list">
          <h4>
            Questions ({filteredQuestions.length})
          </h4>
          <div className="q-cards-scroll">
            {filteredQuestions.map((q, idx) => {
              const isSelected = q.id === activeQuestion?.id;
              const att = attemptHistory[q.id];
              const lvlMeta = LEVEL_METADATA[(q.difficulty as PracticeLevel) ?? 1];

              return (
                <div
                  key={q.id}
                  className={`practice-q-item ${isSelected ? "selected" : ""} ${att?.correct ? "solved" : att ? "wrong" : ""}`}
                  onClick={() => setActiveQuestionId(q.id)}
                >
                  <div className="q-item-top">
                    <span className={`level-pill lvl-${q.difficulty}`}>L{q.difficulty}</span>
                    <span className="q-type-label">{q.question_type.replace(/_/g, " ")}</span>
                    {att?.correct ? (
                      <span className="q-status-badge correct"><CheckCircle2 size={13} /> Solved</span>
                    ) : att ? (
                      <span className="q-status-badge retry">Retry</span>
                    ) : null}
                  </div>
                  <p className="q-snippet">{q.question_text}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Question Runner Workspace */}
        <div className="practice-active-runner-wrap">
          {activeQuestion ? (
            <div className="runner-container-card">
              <div className="runner-card-topbar">
                <span className="eyebrow">
                  {LEVEL_METADATA[(activeQuestion.difficulty as PracticeLevel) ?? 1]?.label} ·{" "}
                  {LEVEL_METADATA[(activeQuestion.difficulty as PracticeLevel) ?? 1]?.name}
                </span>
                {activeQuestion.is_diagnostic && <span className="tag blue">Diagnostic Item</span>}
              </div>

              <QuestionRunner
                key={activeQuestion.id}
                question={activeQuestion}
                options={activeOptions}
                hintBudget={3}
                onAttempt={handleAttempt}
                onComplete={handleAttempt}
              />
            </div>
          ) : (
            <div className="empty-runner-state">
              <HelpCircle size={32} />
              <p>Select a question from the left to start practicing.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
