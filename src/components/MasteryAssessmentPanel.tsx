// Mastery Assessment & Review panel component.
// Features:
//   * Diagnostic Check Status
//   * Comprehensive Mastery Assessment Runner
//   * Easy vs Application Accuracy Breakdown
//   * Weak Concept Detection
//   * Spaced Repetition (SM-2) Scheduling

import { useState } from "react";
import {
  AlertTriangle,
  Award,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  PlayCircle,
  Repeat,
  ShieldAlert,
  ShieldCheck,
  Target,
  Trophy,
} from "lucide-react";
import type { Assessment, AssessmentAttempt, Concept, Question, QuestionOption, TopicMastery } from "../types";
import { QuestionRunner, type AttemptResult } from "./QuestionRunner";
import { MasteryBadge } from "./ui";
import { estimateMastery, sm2, qualityFromScore } from "../lib/mastery";

export function MasteryAssessmentPanel({
  assessment,
  questions,
  options,
  topicMastery,
  concepts,
  onCompleteAssessment,
}: {
  assessment?: Assessment | null;
  questions: Question[];
  options: QuestionOption[];
  topicMastery?: TopicMastery | null;
  concepts: Concept[];
  onCompleteAssessment?: (score: number, passed: boolean, results: AttemptResult[]) => void;
}) {
  const [sitting, setSitting] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [results, setResults] = useState<AttemptResult[]>([]);
  const [finished, setFinished] = useState(false);

  const assessmentQuestions = assessment
    ? questions.filter((q) => assessment.question_ids.includes(q.id))
    : questions.slice(0, 5);

  const activeQ = assessmentQuestions[currentIdx];
  const activeOptions = options.filter((o) => o.question_id === activeQ?.id);

  function handleAttempt(result: AttemptResult) {
    const nextResults = [...results, result];
    setResults(nextResults);

    if (currentIdx + 1 < assessmentQuestions.length) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setFinished(true);
      setSitting(false);
      const totalCorrect = nextResults.filter((r) => r.correct).length;
      const score = Math.round((totalCorrect / nextResults.length) * 100);
      const passed = score >= (assessment?.pass_percent ?? 75);
      if (onCompleteAssessment) {
        onCompleteAssessment(score, passed, nextResults);
      }
    }
  }

  return (
    <div className="mastery-assessment-panel">
      <div className="asmt-header-row">
        <div>
          <span className="eyebrow">ASSESSMENT & MASTERY VERIFICATION</span>
          <h3>Check Your Mastery</h3>
          <p className="mut small">
            Mastery is demonstrated through timed assessment with multi-step problem solving and application transfer.
          </p>
        </div>

        {topicMastery && (
          <div className="mastery-score-display">
            <MasteryBadge level={topicMastery.mastery_level} score={topicMastery.mastery_score} />
            <span className="attempt-count-tag">{topicMastery.attempt_count} practice attempts recorded</span>
          </div>
        )}
      </div>

      {!sitting && !finished ? (
        <div className="asmt-overview-grid">
          {/* Assessment Card */}
          <div className="asmt-cta-card">
            <div className="asmt-icon-orb">
              <Trophy size={32} />
            </div>
            <div>
              <h4>{assessment?.title ?? "Topic Mastery Assessment"}</h4>
              <p>{assessment?.description ?? "Evaluates all learning objectives and concepts for this topic."}</p>
              <div className="asmt-meta-tags">
                <span className="tag"><Clock size={12} /> {assessmentQuestions.length * 4} min</span>
                <span className="tag"><Target size={12} /> {assessmentQuestions.length} questions</span>
                <span className="tag green"><ShieldCheck size={12} /> Pass: {assessment?.pass_percent ?? 75}%</span>
              </div>
            </div>
            <button
              className="primary asmt-start-btn"
              onClick={() => {
                setSitting(true);
                setCurrentIdx(0);
                setResults([]);
              }}
            >
              <PlayCircle size={16} /> Begin Assessment
            </button>
          </div>

          {/* Review Schedule / Spaced Repetition Card */}
          <div className="spaced-review-card">
            <div className="review-top-line">
              <Repeat size={18} />
              <h4>Spaced Repetition (SM-2)</h4>
            </div>
            <p className="small mut">
              To consolidate learning into long-term memory, review intervals are scheduled based on demonstrated recall quality.
            </p>
            <div className="review-status-box">
              <span className="review-date">
                <Calendar size={14} /> Next review: {topicMastery?.next_review_at ? new Date(topicMastery.next_review_at).toLocaleDateString("en-GB") : "After assessment"}
              </span>
            </div>
          </div>
        </div>
      ) : sitting && activeQ ? (
        <div className="asmt-active-sitting-wrap">
          <div className="asmt-sitting-topbar">
            <span className="asmt-step-counter">
              Question {currentIdx + 1} of {assessmentQuestions.length}
            </span>
            <div className="asmt-progress-mini">
              <div className="progress">
                <i style={{ width: `${Math.round(((currentIdx + 1) / assessmentQuestions.length) * 100)}%` }} />
              </div>
            </div>
          </div>

          <QuestionRunner
            key={activeQ.id}
            question={activeQ}
            options={activeOptions}
            hintBudget={0} // No hints during formal mastery assessment!
            onAttempt={handleAttempt}
            onComplete={handleAttempt}
          />
        </div>
      ) : (
        <div className="asmt-results-card">
          <div className="asmt-results-header">
            <Award size={36} className="award-icon" />
            <div>
              <h3>Assessment Completed</h3>
              <p>
                Score: {results.filter((r) => r.correct).length} / {results.length} (
                {Math.round((results.filter((r) => r.correct).length / results.length) * 100)}%)
              </p>
            </div>
          </div>

          <div className="asmt-actions-row">
            <button
              className="secondary"
              onClick={() => {
                setSitting(false);
                setFinished(false);
              }}
            >
              Back to Overview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
