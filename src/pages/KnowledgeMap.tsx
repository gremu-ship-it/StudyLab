// Knowledge map: Course → Topic → Concept, coloured by mastery state.
// GREEN mastered · AMBER developing · RED needs attention · GREY not studied.
// Explains *why* the system recommends things: weak nodes are visible.

import { useMemo, useState } from "react";
import { Network } from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { masteryMeta } from "../components/ui";
import { Spinner, Select } from "../components/ui";
import { navigate } from "../router";
import type { Concept, ConceptMastery, MasteryLevel, Topic, TopicMastery } from "../types";

const LEVEL_ORDER: Record<MasteryLevel, number> = {
  not_assessed: 0,
  weak: 1,
  developing: 2,
  strong: 3,
  mastered: 4,
};

export function KnowledgeMapPage() {
  const { state } = useAuth();
  const profile = state.status === "ready" ? state.profile : null;
  const user = state.status === "ready" ? state.user : null;

  const coursesQ = useQuery(() => (profile?.programme_id ? api.getCourses(profile.programme_id) : Promise.resolve([])), [profile?.programme_id]);
  const [courseId, setCourseId] = useState<string>("");
  const effectiveCourse = courseId || coursesQ.data?.[0]?.id || "";

  const topicsQ = useQuery(() => (effectiveCourse ? api.getTopics(effectiveCourse) : Promise.resolve([])), [effectiveCourse]);
  const conceptsQ = useQuery(async () => {
    const topics = topicsQ.data ?? [];
    return topics.length ? api.getConceptsForTopics(topics.map((t) => t.id)) : [];
  }, [(topicsQ.data ?? []).map((t) => t.id).join(",")]);
  const topicMasteryQ = useQuery(api.getTopicMastery, []);
  const conceptMasteryQ = useQuery(api.getConceptMastery, [user?.id]);

  const layout = useMemo(() => buildLayout(
    topicsQ.data ?? [],
    conceptsQ.data ?? [],
    topicMasteryQ.data ?? [],
    conceptMasteryQ.data ?? [],
  ), [topicsQ.data, conceptsQ.data, topicMasteryQ.data, conceptMasteryQ.data]);

  if (coursesQ.loading || topicsQ.loading || conceptsQ.loading)
    return (
      <div className="page">
        <Spinner label="Building the knowledge map…" />
      </div>
    );

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">KNOWLEDGE MAP</span>
          <h1>How this course fits together</h1>
          <p>
            Colour = mastery state. Weak or unassessed nodes explain why the plan recommends certain topics first.
          </p>
        </div>
        <Select
          value={effectiveCourse}
          onChange={setCourseId}
          options={(coursesQ.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
        />
      </div>

      <div className="legend">
        {(["mastered", "strong", "developing", "weak", "not_assessed"] as MasteryLevel[]).map((l) => (
          <span key={l} className="legend-item">
            <i style={{ background: masteryMeta(l).color }} /> {masteryMeta(l).label}
          </span>
        ))}
      </div>

      {layout.width === 0 ? (
        <p className="muted">Add topics (and optionally concepts) to this course to see the map.</p>
      ) : (
        <div className="map-scroll">
          <svg
            width={layout.width}
            height={layout.height}
            role="img"
            aria-label="Knowledge map of course topics and concepts"
          >
            {layout.links.map((l, i) => (
              <path key={i} d={l.d} className="map-link" stroke={l.color} />
            ))}
            {layout.topics.map((t) => (
              <g key={t.id} className="map-node" onClick={() => navigate(`/topics/${t.id}`)}>
                <circle cx={t.x} cy={t.y} r={13} fill={t.color} />
                <circle cx={t.x} cy={t.y} r={17} fill="none" stroke={t.color} strokeOpacity={0.35} />
                <text x={t.x} y={t.y - 22} className="map-topic-label">{t.name}</text>
                {t.score !== null && <text x={t.x} y={t.y + 30} className="map-score">{t.score}%</text>}
                <title>{`${t.name} — ${masteryMeta(t.level).label}${t.score !== null ? ` (${t.score}%)` : ""}`}</title>
              </g>
            ))}
            {layout.concepts.map((c) => (
              <g key={c.id} className="map-node" onClick={() => navigate(`/topics/${c.topic_id}`)}>
                <circle cx={c.x} cy={c.y} r={7} fill={c.color} />
                <text x={c.x + 12} y={c.y + 4} className="map-concept-label">{c.name}</text>
                <title>{`${c.name} — ${masteryMeta(c.level).label}`}</title>
              </g>
            ))}
          </svg>
        </div>
      )}

      <div className="map-weak">
        <Network size={16} />
        <div>
          <strong>Reading the map</strong>
          <p className="mut small">
            Topic nodes connect to the concepts you've defined for them. A grey topic with a strong prerequisite tells
            the recommendation engine to sequence you; a red application-heavy topic generates “practice over theory”
            recommendations.
          </p>
        </div>
      </div>
    </section>
  );
}

interface Layout {
  width: number;
  height: number;
  topics: { id: string; name: string; x: number; y: number; color: string; level: MasteryLevel; score: number | null }[];
  concepts: { id: string; name: string; topic_id: string; x: number; y: number; color: string; level: MasteryLevel }[];
  links: { d: string; color: string }[];
}

function buildLayout(
  topics: Topic[],
  concepts: Concept[],
  topicMastery: TopicMastery[],
  conceptMastery: ConceptMastery[],
): Layout {
  if (!topics.length) return { width: 0, height: 0, topics: [], concepts: [], links: [] };

  const TOPIC_X = 140;
  const CONCEPT_X = 430;
  const rowHeight = 92;
  const topPad = 60;

  // Order topics: unassessed last? No — keep curriculum sequence, but the
  // map's usefulness comes from colours, not reordering.
  const topicLevel = (id: string): { level: MasteryLevel; score: number | null } => {
    const m = topicMastery.find((x) => x.topic_id === id);
    if (!m || m.attempt_count === 0) return { level: "not_assessed", score: null };
    return { level: (m.mastery_level as MasteryLevel) ?? "not_assessed", score: m.mastery_score };
  };

  const conceptLevel = (id: string): MasteryLevel => {
    const m = conceptMastery.find((x) => x.concept_id === id);
    if (!m || m.attempt_count === 0) return "not_assessed";
    return (m.mastery_level as MasteryLevel) ?? "not_assessed";
  };

  // Assign y per topic; concepts fan out under their topic.
  let y = topPad;
  const topicNodes: Layout["topics"] = [];
  const conceptNodes: Layout["concepts"] = [];
  const links: Layout["links"] = [];

  for (const t of topics) {
    const { level, score } = topicLevel(t.id);
    const color = masteryMeta(level).color;
    const ty = y + 20;
    topicNodes.push({ id: t.id, name: t.name, x: TOPIC_X, y: ty, color, level, score });

    const tConcepts = concepts.filter((c) => c.topic_id === t.id);
    if (tConcepts.length) {
      const spacing = 34;
      const start = ty - ((tConcepts.length - 1) * spacing) / 2;
      tConcepts.forEach((c, i) => {
        const cy = start + i * spacing;
        const cLevel = conceptLevel(c.id);
        const cColor = masteryMeta(cLevel).color;
        conceptNodes.push({ id: c.id, name: c.name, topic_id: c.topic_id, x: CONCEPT_X, y: cy, color: cColor, level: cLevel });
        links.push({
          d: `M ${TOPIC_X + 17} ${ty} C ${(TOPIC_X + CONCEPT_X) / 2} ${ty}, ${(TOPIC_X + CONCEPT_X) / 2} ${cy}, ${CONCEPT_X - 10} ${cy}`,
          color: cColor,
        });
      });
      y += Math.max(rowHeight, tConcepts.length * spacing + 24);
    } else {
      y += rowHeight;
    }
  }

  return {
    width: 760,
    height: y + 40,
    topics: topicNodes,
    concepts: conceptNodes,
    links,
  };
}

// LEVEL_ORDER kept for future sorting by mastery.
void LEVEL_ORDER;
