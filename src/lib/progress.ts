// Progress recording: every answered question flows through here.
//   attempt → mastery re-estimation (topic + concept) → SM-2 review schedule.
//
// Kept in one place so session runner, practice tab and assessments all
// produce consistent mastery data.

import * as api from "./api";
import { estimateMastery, qualityFromScore, sm2, type AttemptRecord, type MasteryEstimate } from "./mastery";
import type { Question } from "../types";
import type { AttemptResult } from "../components/QuestionRunner";

export async function recordQuestionProgress(params: {
  userId: string;
  question: Question;
  sessionId: string | null;
  result: AttemptResult;
}): Promise<void> {
  const { userId, question, sessionId, result } = params;

  // 1. Record the attempt (attempt number within this session+question pair)
  const prior = await Promise.resolve(api.countAttempts(question.id, sessionId)).catch(() => 0);
  try {
    await api.recordQuestionAttempt({
      student_id: userId,
      question_id: question.id,
      learning_session_id: sessionId,
      answer: result.answer,
      is_correct: result.correct,
      score: result.score,
      time_seconds: result.timeSeconds,
      hints_used: result.hintsUsed,
      attempt_number: prior + 1,
    });
  } catch (e) {
    console.warn("failed to record attempt", e);
  }

  // 2. Re-estimate topic mastery and schedule review
  await updateTopicMastery(userId, question.topic_id).catch((e) => console.warn("mastery update failed", e));

  // 3. Concept mastery when the question is concept-linked
  if (question.concept_id) {
    await updateConceptMastery(userId, question.concept_id).catch((e) => console.warn("concept mastery failed", e));
  }
}

export async function topicMasteryFor(userId: string, topicId: string): Promise<MasteryEstimate | null> {
  const questions = await api.getQuestions(topicId, { includeOwnDrafts: true, userId });
  if (!questions.length) return null;
  const attempts = await api.getAttemptsForQuestions(questions.map((q) => q.id));
  const byId = new Map(questions.map((q) => [q.id, q]));
  const records: AttemptRecord[] = attempts
    .map((a) => {
      const q = byId.get(a.question_id);
      return q
        ? {
            difficulty: q.difficulty,
            correct: a.is_correct,
            hintsUsed: a.hints_used,
            at: a.attempted_at,
          }
        : null;
    })
    .filter((x): x is AttemptRecord => x !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
  return estimateMastery(records);
}

async function updateTopicMastery(userId: string, topicId: string): Promise<MasteryEstimate | null> {
  const estimate = await topicMasteryFor(userId, topicId);
  if (!estimate || estimate.attempts === 0) return null;
  await api.upsertTopicMastery({
    student_id: userId,
    topic_id: topicId,
    mastery_score: estimate.score,
    mastery_level: estimate.level,
    confidence_score: estimate.confidence,
    attempt_count: estimate.attempts,
    last_practiced_at: new Date().toISOString(),
    last_assessed_at: new Date().toISOString(),
  });

  // SM-2 review scheduling: one pending review per topic.
  const reviews = await api.getReviews();
  const existing = reviews.find((r) => r.topic_id === topicId);
  const state = existing
    ? { intervalDays: Number(existing.interval_days), easeFactor: Number(existing.ease_factor) }
    : { intervalDays: 0, easeFactor: 2.5 };
  const next = sm2(state, qualityFromScore(estimate.score));
  const scheduledFor = new Date(Date.now() + next.intervalDays * 86_400_000).toISOString();
  await api.upsertReview({
    student_id: userId,
    topic_id: topicId,
    scheduled_for: scheduledFor,
    interval_days: next.intervalDays,
    ease_factor: next.easeFactor,
  });
  if (existing) {
    await api.upsertTopicMastery({
      student_id: userId,
      topic_id: topicId,
      mastery_score: estimate.score,
      mastery_level: estimate.level,
      confidence_score: estimate.confidence,
      attempt_count: estimate.attempts,
      last_practiced_at: new Date().toISOString(),
      last_assessed_at: new Date().toISOString(),
      next_review_at: scheduledFor,
    });
  }
  return estimate;
}

async function updateConceptMastery(userId: string, conceptId: string): Promise<void> {
  const questions = await api.getQuestionsForConcept(conceptId);
  if (!questions.length) return;
  const attempts = await api.getAttemptsForQuestions(questions.map((q) => q.id));
  const byId = new Map(questions.map((q) => [q.id, q]));
  const records: AttemptRecord[] = attempts
    .map((a) => {
      const q = byId.get(a.question_id);
      return q
        ? { difficulty: q.difficulty, correct: a.is_correct, hintsUsed: a.hints_used, at: a.attempted_at }
        : null;
    })
    .filter((x): x is AttemptRecord => x !== null)
    .sort((a, b) => a.at.localeCompare(b.at));
  const estimate = estimateMastery(records);
  if (estimate.attempts === 0) return;
  await api.upsertConceptMastery({
    student_id: userId,
    concept_id: conceptId,
    mastery_score: estimate.score,
    mastery_level: estimate.level,
    confidence_score: estimate.confidence,
    attempt_count: estimate.attempts,
    last_assessed_at: new Date().toISOString(),
  });
}
