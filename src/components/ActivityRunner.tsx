// Practical activity runner — renders a deterministic built-in activity
// (Phase 9): scenario → student answers → exact grading → worked solution.
// No AI, no fake grading: the registry in src/lib/practical-activities.ts
// does the checking.

import { useMemo, useRef, useState } from "react";
import { CheckCircle2, FlaskConical, RotateCcw, XCircle } from "lucide-react";
import {
  type ActivityDef,
  type ActivityResult,
  type Scenario,
  mulberry32,
} from "../lib/practical-activities";
import { Button, Card } from "./ui";

interface Props {
  activity: ActivityDef;
  onResult?: (result: ActivityResult, scenario: Scenario, answers: Record<string, string>, timeSeconds: number) => void;
}

export function ActivityRunner({ activity, onResult }: Props) {
  const [seed, setSeed] = useState(() => Date.now() % 1000000);
  const scenario: Scenario = useMemo(() => activity.makeScenario(mulberry32(seed)), [activity, seed]);
  const fields = useMemo(() => activity.fields(scenario), [activity, scenario]);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ActivityResult | null>(null);
  const [showSolution, setShowSolution] = useState(false);
  const startedAt = useRef(Date.now());

  function check() {
    const r = activity.check(scenario, answers);
    setResult(r);
    setShowSolution(false);
    const timeSeconds = Math.max(0, Math.round((Date.now() - startedAt.current) / 1000));
    onResult?.(r, scenario, answers, timeSeconds);
  }

  function newRound() {
    setSeed((s) => (s + 1) % 1000000);
    setAnswers({});
    setResult(null);
    setShowSolution(false);
  }

  return (
    <Card className="activity-card">
      <div className="step-head">
        <span className="step-icon"><FlaskConical size={15} /></span>
        <div>
          <span className="eyebrow">{activity.subject.toUpperCase()} · GUIDED ACTIVITY</span>
          <h2>{activity.title}</h2>
        </div>
      </div>
      <p className="muted act-blurb">{activity.blurb}</p>

      <div className="act-scenario">
        {renderScenario(activity.type, scenario)}
      </div>

      <div className="act-fields">
        {fields.map((f) => (
          <label key={f.key} className="field">
            <span>{f.label}</span>
            <input
              value={answers[f.key] ?? ""}
              placeholder={f.placeholder ?? ""}
              inputMode="decimal"
              onChange={(e) => setAnswers((a) => ({ ...a, [f.key]: e.target.value }))}
              aria-label={f.label}
            />
          </label>
        ))}
      </div>

      {result ? (
        <div className={`act-feedback ${result.correct ? "ok" : "no"}`}>
          {result.correct ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
          <div>
            <strong>Score {Math.round(result.score)} / 100</strong>
            <p>{result.feedback}</p>
            {result.solution && (
              showSolution ? (
                <pre className="act-solution">{result.solution}</pre>
              ) : (
                <button className="linklike" onClick={() => setShowSolution(true)}>
                  Show the worked solution
                </button>
              )
            )}
          </div>
        </div>
      ) : null}

      <div className="step-actions">
        <Button onClick={check} disabled={!Object.values(answers).some((v) => v.trim() !== "")}>
          Check my answer
        </Button>
        <Button variant="secondary" onClick={newRound}>
          <RotateCcw size={14} /> New round
        </Button>
      </div>
    </Card>
  );
}

function renderScenario(type: string, s: Scenario) {
  if (type === "equation_balance") {
    return (
      <div className="act-equation">
        <span className="mono">{String(s.lhs)}</span>
        <span className="act-arrow">→</span>
        <span className="mono">{String(s.rhs)}</span>
      </div>
    );
  }
  if (type === "break_even") {
    return (
      <ul className="act-facts">
        <li>Fixed costs: <strong>{s.fixed_cost}</strong> currency units</li>
        <li>Selling price: <strong>{s.price_per_unit}</strong> per unit</li>
        <li>Variable cost: <strong>{s.variable_cost}</strong> per unit</li>
      </ul>
    );
  }
  if (type === "unit_conversion") {
    return (
      <div className="act-scenario-line">
        Convert <strong className="mono">{s.value} {s.from}</strong> into <strong>{s.to}</strong>.
      </div>
    );
  }
  if (type === "linear_rate") {
    return (
      <ul className="act-facts">
        <li>Point 1: <strong className="mono">({s.x1}, {s.y1})</strong></li>
        <li>Point 2: <strong className="mono">({s.x2}, {s.y2})</strong></li>
        <li>The graph is a straight line through both points.</li>
      </ul>
    );
  }
  return null;
}

