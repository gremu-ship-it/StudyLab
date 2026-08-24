// Scaffolded problem-solving loop — the active-learning core.
//
// The runner never reveals the answer first. Sequence after a wrong answer:
//   hint 1 → guiding question → partial help → full reveal (+ why it works)
// Once solved, it shows why the solution works. Hints are budgeted by the
// session's diagnostic result (1-3).
//
// Every submission is reported via onAttempt; completion via onComplete.

import { useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, MessageCircleQuestion, Sparkles, CheckCircle2, RotateCcw } from "lucide-react";
import { checkAnswer, type CheckResult } from "../lib/answer";
import { Button } from "./ui";
import type { Question, QuestionOption } from "../types";

export interface AttemptResult {
  correct: boolean | null;
  score: number;
  hintsUsed: number;
  timeSeconds: number;
  answer: unknown;
}

type Phase = "attempt" | "hint1" | "guiding" | "partial" | "reveal" | "solved";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function QuestionRunner({
  question,
  options = [],
  hintBudget = 2,
  onAttempt,
  onComplete,
  disableHints = false,
}: {
  question: Question;
  options?: QuestionOption[];
  hintBudget?: number;
  onAttempt?: (r: AttemptResult) => void;
  onComplete: (r: AttemptResult) => void;
  disableHints?: boolean;
}) {
  const [phase, setPhase] = useState<Phase>("attempt");
  const [hintsUsed, setHintsUsed] = useState(0);
  const [lastResult, setLastResult] = useState<CheckResult | null>(null);
  const [lastAnswer, setLastAnswer] = useState<unknown>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const startRef = useRef<number>(Date.now());

  // --- controlled answer state per question type ---
  const [choice, setChoice] = useState<string | null>(null);
  const [boolAnswer, setBoolAnswer] = useState<boolean | null>(null);
  const [numericText, setNumericText] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [orderList, setOrderList] = useState<string[]>([]);

  const pairs = useMemo(
    () => ((question.correct_answer as { pairs?: { left: string; right: string }[] })?.pairs ?? []),
    [question],
  );
  const correctOrder = useMemo(
    () => ((question.correct_answer as { order?: string[] })?.order ?? []),
    [question],
  );
  const matchOptions = useMemo(() => shuffle(pairs.map((p) => p.right)), [pairs]);

  useEffect(() => {
    if (question.question_type === "ordering") setOrderList(shuffle(correctOrder));
  }, [question.id, correctOrder.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const optionsSorted = useMemo(
    () => [...options].sort((a, b) => a.sequence_number - b.sequence_number),
    [options],
  );

  const elapsedSeconds = () => Math.max(1, Math.round((Date.now() - startRef.current) / 1000));
  const s = question.scaffolding ?? {};

  function answerValue(): unknown {
    switch (question.question_type) {
      case "multiple_choice":
        return choice;
      case "true_false":
        return boolAnswer;
      case "numeric":
        return numericText.trim() || null;
      case "short_answer":
      case "scenario":
        return textAnswer.trim() || null;
      case "matching":
        return matches;
      case "ordering":
        return orderList;
      default:
        return null;
    }
  }

  function submit() {
    const answer = answerValue();
    if (answer === null || (typeof answer === "string" && !answer.trim())) {
      setLastResult({ correct: null, score: 0, feedback: "Give your answer first.", needsReview: false });
      return;
    }
    if (question.question_type === "matching" && Object.values(matches).some((v) => !v)) {
      setLastResult({ correct: null, score: 0, feedback: "Complete all matches before checking.", needsReview: false });
      return;
    }
    const result = checkAnswer(question, answer);
    setLastAnswer(answer);
    setLastResult(result);
    setAttemptCount((a) => a + 1);
    onAttempt?.({ correct: result.correct, score: result.score, hintsUsed, timeSeconds: elapsedSeconds(), answer });

    if (result.correct === true) {
      setPhase("solved");
      return;
    }
    // Wrong (or ungradable): step through the scaffolding, budget permitting.
    if (disableHints || hintsUsed >= hintBudget) {
      setPhase("reveal");
      return;
    }
    if (hintsUsed === 0) setPhase("hint1");
    else if (hintsUsed === 1 && s.guiding_question) setPhase("guiding");
    else setPhase("partial");
  }

  function advance() {
    const next = hintsUsed + 1;
    setHintsUsed(next);
    if (next >= hintBudget) setPhase("reveal");
    else setPhase("attempt");
  }

  function finish() {
    onComplete({
      correct: lastResult?.correct ?? null,
      score: lastResult?.score ?? 0,
      hintsUsed,
      timeSeconds: elapsedSeconds(),
      answer: lastAnswer,
    });
  }

  const answering = phase === "attempt" || phase === "hint1" || phase === "guiding" || phase === "partial";

  return (
    <div className="qrunner">
      <span className="eyebrow">
        {question.question_type.replace(/_/g, " ")} · difficulty {question.difficulty}/5
        {question.is_diagnostic ? " · diagnostic" : ""}
      </span>
      <p className="qtext">{question.question_text}</p>

      {answering && (
        <div className="qanswer">
          {question.question_type === "multiple_choice" &&
            optionsSorted.map((o) => (
              <label key={o.id} className={choice === o.option_key ? "opt active" : "opt"}>
                <input
                  type="radio"
                  name={`q-${question.id}`}
                  checked={choice === o.option_key}
                  onChange={() => setChoice(o.option_key)}
                />
                <span>
                  <b>{o.option_key}.</b> {o.option_text}
                </span>
              </label>
            ))}

          {question.question_type === "true_false" && (
            <div className="tf-row">
              {[true, false].map((v) => (
                <button key={String(v)} type="button" className={boolAnswer === v ? "tf active" : "tf"} onClick={() => setBoolAnswer(v)}>
                  {v ? "True" : "False"}
                </button>
              ))}
            </div>
          )}

          {question.question_type === "numeric" && (
            <input
              className="qinput"
              inputMode="decimal"
              value={numericText}
              onChange={(e) => setNumericText(e.target.value)}
              placeholder="Enter a number (units allowed)"
              aria-label="Numeric answer"
            />
          )}

          {(question.question_type === "short_answer" || question.question_type === "scenario") && (
            <textarea
              className="qinput"
              rows={question.question_type === "scenario" ? 5 : 3}
              value={textAnswer}
              onChange={(e) => setTextAnswer(e.target.value)}
              placeholder="Write your answer in your own words"
              aria-label="Written answer"
            />
          )}

          {question.question_type === "matching" && (
            <div className="match-grid">
              {pairs.map((p) => (
                <div className="match-row" key={p.left}>
                  <span className="match-left">{p.left}</span>
                  <select
                    value={matches[p.left] ?? ""}
                    onChange={(e) => setMatches((m) => ({ ...m, [p.left]: e.target.value }))}
                    aria-label={`Match for ${p.left}`}
                  >
                    <option value="" disabled>
                      choose…
                    </option>
                    {matchOptions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}

          {question.question_type === "ordering" && (
            <div className="order-list">
              {orderList.map((item, i) => (
                <div className="order-item" key={`${item}-${i}`}>
                  <span className="order-pos">{i + 1}</span>
                  <span className="order-text">{item}</span>
                  <span className="order-btns">
                    <button
                      type="button"
                      disabled={i === 0}
                      onClick={() => setOrderList((l) => swap(l, i, i - 1))}
                      aria-label={`Move ${item} up`}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={i === orderList.length - 1}
                      onClick={() => setOrderList((l) => swap(l, i, i + 1))}
                      aria-label={`Move ${item} down`}
                    >
                      ↓
                    </button>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Scaffolding panels */}
      {phase === "hint1" && question.hint_1 && (
        <Scaffold icon={<Lightbulb size={16} />} tone="hint" title="Hint">
          {question.hint_1}
        </Scaffold>
      )}
      {phase === "guiding" && s.guiding_question && (
        <Scaffold icon={<MessageCircleQuestion size={16} />} tone="guiding" title="Before the next hint — think about this">
          {s.guiding_question}
        </Scaffold>
      )}
      {phase === "partial" && (
        <Scaffold
          icon={<Sparkles size={16} />}
          tone="partial"
          title="Partial help"
        >
          {s.partial_help ??
            question.hint_2 ??
            "Re-check the worked example: which step are you stuck on? Try isolating just that step."}
        </Scaffold>
      )}
      {(phase === "reveal" || phase === "solved") && (
        <Scaffold icon={<CheckCircle2 size={16} />} tone={phase === "solved" ? "solved" : "reveal"} title={phase === "solved" ? "Solution" : "Full solution"}>
          {s.solution_walkthrough ?? solutionText(question, optionsSorted)}
          {(s.why_it_works ?? question.explanation) && (
            <div className="why">
              <strong>Why this works</strong>
              <p>{s.why_it_works ?? question.explanation}</p>
            </div>
          )}
        </Scaffold>
      )}

      {lastResult && (answering || phase === "solved") && (
        <p className={`qfeedback ${lastResult.correct === true ? "good" : lastResult.correct === false ? "bad" : "neutral"}`}>
          {lastResult.feedback}
        </p>
      )}

      <div className="qrunner-actions">
        {answering && (
          <>
            <Button onClick={submit}>Check answer</Button>
            {attemptCount > 0 && (
              <span className="mut small">
                Attempt {attemptCount + 1} · {hintsUsed} hint{hintsUsed === 1 ? "" : "s"} used
              </span>
            )}
          </>
        )}
        {(phase === "hint1" || phase === "guiding" || phase === "partial") && (
          <Button variant="secondary" onClick={advance}>
            {hintsUsed + 1 >= hintBudget ? "Show the full solution" : "Try again"}
          </Button>
        )}
        {phase === "reveal" && (
          <>
            <Button variant="secondary" onClick={() => setPhase("attempt")}>
              <RotateCcw size={14} /> Try again yourself
            </Button>
            <Button onClick={finish}>Continue</Button>
          </>
        )}
        {phase === "solved" && <Button onClick={finish}>Continue</Button>}
      </div>
    </div>
  );
}

function swap<T>(list: T[], i: number, j: number): T[] {
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function Scaffold({
  icon,
  tone,
  title,
  children,
}: {
  icon: React.ReactNode;
  tone: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`scaffold ${tone}`}>
      {icon}
      <div>
        <strong>{title}</strong>
        <p>{children}</p>
      </div>
    </div>
  );
}

function solutionText(question: Question, options: QuestionOption[]): string {
  const ca = question.correct_answer as Record<string, unknown>;
  switch (question.question_type) {
    case "multiple_choice": {
      const key = String(ca.option_key ?? "");
      const opt = options.find((o) => o.option_key === key);
      return `The correct answer is ${key}${opt ? ` — ${opt.option_text}` : ""}.`;
    }
    case "true_false":
      return `The correct statement is ${ca.value ? "True" : "False"}.`;
    case "numeric": {
      const c = ca as { value?: number; unit?: string };
      return `The correct value is ${c.value}${c.unit ? ` ${c.unit}` : ""}.`;
    }
    case "short_answer": {
      const c = ca as { keywords?: string[] };
      return c.keywords?.length ? `Key ideas: ${c.keywords.join(", ")}.` : question.explanation ?? "See the explanation.";
    }
    case "matching": {
      const c = ca as { pairs?: { left: string; right: string }[] };
      return (c.pairs ?? []).map((p) => `${p.left} → ${p.right}`).join("; ");
    }
    case "ordering": {
      const c = ca as { order?: string[] };
      return `Correct order: ${(c.order ?? []).join(" → ")}.`;
    }
    default:
      return question.explanation ?? "See the explanation below.";
  }
}
