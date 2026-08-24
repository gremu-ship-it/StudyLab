// Visual Learning Path component for topics.
// Renders the structured progression:
//   01 Foundations → 02 Intuition → 03 Graphs & Tables → 04 One-sided limits
//   → 05 Limit laws → 06 Algebraic limits → 07 Continuity → 08 Discontinuities
//   → 09 Applications → 10 Mastery assessment.

import { CheckCircle2, Circle, Clock, Lock, PlayCircle, Sparkles } from "lucide-react";
import type { LearningSession, SessionStep } from "../types";

export interface PathNode {
  number: number;
  title: string;
  stepType: string;
  status: "completed" | "current" | "unlocked" | "locked" | "fast_tracked";
  estimatedMinutes?: number;
  description?: string;
}

export function LearningPath({
  nodes,
  currentStepIndex,
  onSelectStep,
  onStartSession,
  activeSession,
  progressPercent,
  estimatedRemainingMinutes,
}: {
  nodes: PathNode[];
  currentStepIndex?: number;
  onSelectStep?: (index: number) => void;
  onStartSession?: () => void;
  activeSession?: LearningSession | null;
  progressPercent: number;
  estimatedRemainingMinutes: number;
}) {
  const completedCount = nodes.filter((n) => n.status === "completed" || n.status === "fast_tracked").length;

  return (
    <div className="learning-path-panel">
      <div className="path-header-row">
        <div>
          <span className="eyebrow">YOUR GUIDED PROGRESSION</span>
          <h2>Your Learning Path</h2>
          <p className="mut small">
            Mastery is built sequentially from foundations to real-world application and assessment.
          </p>
        </div>
        <div className="path-meta-box">
          <div className="progress-ring-label">
            <span className="stat-num">{progressPercent}%</span>
            <span className="stat-sub">Mastery Progress</span>
          </div>
          <div className="time-remaining-tag">
            <Clock size={14} /> ~{Math.floor(estimatedRemainingMinutes / 60)}h {estimatedRemainingMinutes % 60}m remaining
          </div>
          {onStartSession && (
            <button className="primary path-cta" onClick={onStartSession}>
              <PlayCircle size={16} />
              {activeSession ? "Continue Learning" : "Start Guided Path"}
            </button>
          )}
        </div>
      </div>

      <div className="progress-bar-wrap">
        <div className="progress">
          <i style={{ width: `${progressPercent}%` }} />
        </div>
        <div className="progress-step-legend">
          <span>{completedCount} of {nodes.length} steps completed</span>
          <span>{nodes.length - completedCount} steps remaining</span>
        </div>
      </div>

      <div className="learning-path-timeline">
        {nodes.map((node, i) => {
          const isCurrent = i === currentStepIndex || node.status === "current";
          const isCompleted = node.status === "completed";
          const isFastTrack = node.status === "fast_tracked";
          const isLocked = node.status === "locked";

          return (
            <div
              key={i}
              className={`path-step-card ${isCurrent ? "current" : ""} ${isCompleted ? "completed" : ""} ${isLocked ? "locked" : ""}`}
              onClick={() => {
                if (!isLocked && onSelectStep) onSelectStep(i);
              }}
              role="button"
              tabIndex={isLocked ? -1 : 0}
            >
              <div className="step-indicator">
                {isCompleted ? (
                  <span className="icon-completed" title="Completed">
                    <CheckCircle2 size={20} />
                  </span>
                ) : isFastTrack ? (
                  <span className="icon-fast-track" title="Fast-tracked by diagnostic">
                    <Sparkles size={20} />
                  </span>
                ) : isCurrent ? (
                  <span className="icon-current" title="Current Step">
                    <span className="current-dot" />
                  </span>
                ) : isLocked ? (
                  <span className="icon-locked" title="Locked">
                    <Lock size={16} />
                  </span>
                ) : (
                  <span className="icon-unlocked">
                    <Circle size={18} />
                  </span>
                )}
                <span className="step-num-badge">{String(node.number).padStart(2, "0")}</span>
              </div>

              <div className="step-content">
                <div className="step-top-line">
                  <span className="step-type-tag">{node.stepType.replace(/_/g, " ")}</span>
                  {node.estimatedMinutes && (
                    <span className="step-time">
                      <Clock size={11} /> {node.estimatedMinutes}m
                    </span>
                  )}
                  {isCurrent && <span className="status-chip active">CURRENT</span>}
                  {isCompleted && <span className="status-chip done">DONE</span>}
                  {isLocked && <span className="status-chip locked">LOCKED</span>}
                </div>
                <h3>{node.title}</h3>
                {node.description && <p className="step-desc">{node.description}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
