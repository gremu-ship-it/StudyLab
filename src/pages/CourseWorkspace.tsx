// Course workspace: Overview · Topics · Resources · Practice ·
// Assessments · Practicals (Mastery summary + Knowledge map are global).

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  Plus,
  Target,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Field,
  MasteryBadge,
  Modal,
  Select,
  SectionHead,
  SourceBadge,
  Spinner,
  Tabs,
} from "../components/ui";
import { Link } from "../router";
import { AssessmentsTab, PracticeTab, PracticalsTab } from "./CourseWorkspaceTabs";
import type { Course, Resource, Topic } from "../types";

type TabId = "overview" | "topics" | "resources" | "practice" | "assessments" | "practicals";

export function CourseWorkspace({ course }: { course: Course }) {
  const [tab, setTab] = useState<TabId>("overview");
  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "topics", label: "Topics" },
    { id: "resources", label: "Resources" },
    { id: "practice", label: "Practice" },
    { id: "assessments", label: "Assessments" },
    { id: "practicals", label: "Practicals" },
  ];
  return (
    <section className="page">
      <Link to="/courses" className="back-link">
        ← All courses
      </Link>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {course.code} · {course.category ?? "course"}
          </span>
          <h1>{course.name}</h1>
          <p>{course.description ?? "A course workspace: topics, resources, practice and mastery live here."}</p>
        </div>
      </div>
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      <div className="tab-body">
        {tab === "overview" && <OverviewTab course={course} onGoTopics={() => setTab("topics")} />}
        {tab === "topics" && <TopicsTab course={course} />}
        {tab === "resources" && <ResourcesTab course={course} />}
        {tab === "practice" && <PracticeTab course={course} />}
        {tab === "assessments" && <AssessmentsTab course={course} />}
        {tab === "practicals" && <PracticalsTab course={course} />}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function OverviewTab({ course, onGoTopics }: { course: Course; onGoTopics: () => void }) {
  const topicsQ = useQuery(() => api.getTopics(course.id), [course.id]);
  const unitsQ = useQuery(async () => {
    const topics = topicsQ.data ?? [];
    if (!topics.length) return [];
    const all = await Promise.all(topics.map((t) => api.getUnits(t.id)));
    return all.flat();
  }, [(topicsQ.data ?? []).map((t) => t.id).join(",")]);
  const masteryQ = useQuery(api.getTopicMastery, []);

  const topics = topicsQ.data ?? [];
  const units = unitsQ.data ?? [];
  const withMastery = topics.filter((t) => masteryQ.data?.some((m) => m.topic_id === t.id));
  const avg = withMastery.length
    ? Math.round(withMastery.reduce((s, t) => s + (masteryQ.data!.find((m) => m.topic_id === t.id)?.mastery_score ?? 0), 0) / withMastery.length)
    : null;

  if (topicsQ.loading || unitsQ.loading)
    return (
      <Spinner label="Loading course overview…" />
    );

  return (
    <div>
      <div className="stats">
        <div className="stat">
          <div className="stat-icon"><BookOpen size={17} /></div>
          <div><span>Topics</span><strong>{topics.length}</strong><small>in this course</small></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Target size={17} /></div>
          <div><span>Learning units</span><strong>{units.length}</strong><small>explanations, examples, practice</small></div>
        </div>
        <div className="stat">
          <div className="stat-icon"><Target size={17} /></div>
          <div>
            <span>Average mastery</span>
            <strong>{avg === null ? "—" : `${avg}%`}</strong>
            <small>{withMastery.length ? `across ${withMastery.length} started topics` : "not assessed yet"}</small>
          </div>
        </div>
        <div className="stat">
          <div className="stat-icon"><BookOpen size={17} /></div>
          <div><span>Status</span><strong>{course.status.replace("_", " ")}</strong><small>{course.source_type ?? "curriculum"}</small></div>
        </div>
      </div>

      <SectionHead
        title="Where to start"
        sub="Pick a topic to launch a structured learning session"
        action={
          <Link to={`/courses/${course.id}`} className="text-btn">
            All topics <ChevronRight size={16} />
          </Link>
        }
      />
      {topics.length === 0 ? (
        <Empty
          icon={<BookOpen size={36} />}
          title="No topics yet"
          body="Add the topic your lecturer introduced, or upload lecture material — StudyLab turns it into a learning session."
          actions={<Button onClick={onGoTopics}><Plus size={16} /> Add first topic</Button>}
        />
      ) : (
        <div className="weak-list">
          {topics.slice(0, 6).map((t) => {
            const m = masteryQ.data?.find((r) => r.topic_id === t.id);
            return (
              <Card key={t.id} className="weak-card">
                <div>
                  <span>topic</span>
                  <h3>{t.name}</h3>
                </div>
                {m ? <MasteryBadge level={m.mastery_level} score={m.mastery_score} /> : <MasteryBadge level="not_assessed" />}
                <Link to={`/topics/${t.id}`} className="text-btn">
                  Open <ChevronRight size={14} />
                </Link>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function TopicsTab({ course }: { course: Course }) {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [minutes, setMinutes] = useState("30");
  const [error, setError] = useState<string | null>(null);

  const topicsQ = useQuery(() => api.getTopics(course.id), [course.id]);
  const masteryQ = useQuery(api.getTopicMastery, []);
  const unitsQ = useQuery(async () => {
    const topics = topicsQ.data ?? [];
    if (!topics.length) return new Map<string, number>();
    const all = await Promise.all(topics.map((t) => api.getUnits(t.id).then((u) => [t.id, u.length] as const)));
    return new Map(all);
  }, [(topicsQ.data ?? []).map((t) => t.id).join(",")]);
  const prereqsQ = useQuery(async () => {
    const topics = topicsQ.data ?? [];
    const all: { from_topic_id: string; to_topic_id: string }[] = [];
    for (const t of topics) {
      try {
        const rows = await api.getTopicPrerequisites(t.id);
        for (const r of rows) all.push(r);
      } catch {
        /* non-fatal */
      }
    }
    return all;
  }, [(topicsQ.data ?? []).map((t) => t.id).join(",")]);

  if (topicsQ.loading) return <Spinner label="Loading topics…" />;
  if (topicsQ.error) return <ErrorNote message={topicsQ.error} onRetry={topicsQ.refresh} />;

  async function addTopic() {
    if (!user) return;
    setError(null);
    if (!name.trim()) return;
    try {
      const existing = topicsQ.data ?? [];
      await api.addTopic({
        course_id: course.id,
        name: name.trim(),
        description: desc.trim() || null,
        estimated_minutes: minutes ? parseInt(minutes, 10) : null,
        created_by: user.id,
        sequence_number: existing.length ? Math.max(...existing.map((t) => t.sequence_number ?? 0)) + 1 : 1,
      });
      setName("");
      setDesc("");
      setShowAdd(false);
      topicsQ.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const topics = topicsQ.data ?? [];
  const topicName = (id: string) => topics.find((t) => t.id === id)?.name ?? "?";

  return (
    <div>
      <SectionHead
        title="Topics"
        sub="Each topic can become a structured learning session"
        action={
          <Button onClick={() => setShowAdd(true)}>
            <Plus size={15} /> Add topic
          </Button>
        }
      />
      {topics.length === 0 ? (
        <Empty
          icon={<BookOpen size={36} />}
          title="This course has no topics yet"
          body="Add the topic your lecturer introduced today. It enters the course immediately as a student-added topic."
          actions={<Button onClick={() => setShowAdd(true)}><Plus size={15} /> Add topic</Button>}
        />
      ) : (
        <div className="topic-list">
          {topics.map((t, i) => {
            const m = masteryQ.data?.find((r) => r.topic_id === t.id);
            const units = unitsQ.data?.get(t.id) ?? 0;
            const prereqs = (prereqsQ.data ?? []).filter((r) => r.to_topic_id === t.id).map((r) => topicName(r.from_topic_id));
            const next = prereqsQ.data?.find((r) => r.from_topic_id === t.id)?.to_topic_id;
            return (
              <Link key={t.id} to={`/topics/${t.id}`} className="topic-row">
                <div className="topic-seq">{i + 1}</div>
                <div className="topic-main">
                  <div className="topic-title-line">
                    <h3>{t.name}</h3>
                    {t.status === "student_added" && <span className="tag">student added</span>}
                    {t.description && <span className="mut small">{t.description}</span>}
                  </div>
                  <div className="topic-meta">
                    <span>{units} unit{units === 1 ? "" : "s"}</span>
                    {t.estimated_minutes ? <span>~{t.estimated_minutes} min</span> : null}
                    {prereqs.length > 0 && <span>needs: {prereqs.join(", ")}</span>}
                    {next && <span>enables: {topicName(next)}</span>}
                  </div>
                </div>
                {m ? <MasteryBadge level={m.mastery_level} score={m.mastery_score} /> : <MasteryBadge level="not_assessed" />}
                <ChevronRight size={17} className="arrow" />
              </Link>
            );
          })}
        </div>
      )}

      {showAdd && (
        <Modal title="Add a topic" eyebrow="CURRICULUM GROWS WITH YOU" onClose={() => setShowAdd(false)}>
          <p className="muted">The topic is added to this course as a student topic and can immediately hold material, units and questions.</p>
          <Field label="Topic name" value={name} onChange={setName} placeholder="e.g. Newton's Laws of Motion" />
          <Field label="Description (optional)" value={desc} onChange={setDesc} placeholder="What does the lecturer expect here?" rows={2} />
          <Field label="Estimated minutes (optional)" value={minutes} onChange={setMinutes} type="number" />
          {error && <ErrorNote message={error} />}
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={addTopic}><Plus size={15} /> Add topic</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ResourcesTab({ course }: { course: Course }) {
  const [showAdd, setShowAdd] = useState(false);
  const topicsQ = useQuery(() => api.getTopics(course.id), [course.id]);
  const resourcesQ = useQuery(async () => {
    const topics = topicsQ.data ?? [];
    if (!topics.length) return { resources: [] as Resource[], links: [] as { topic_id: string; resource_id: string; sequence_number: number | null }[] };
    return api.getResourcesForTopics(topics.map((t) => t.id));
  }, [(topicsQ.data ?? []).map((t) => t.id).join(",")]);

  if (resourcesQ.loading) return <Spinner label="Loading resources…" />;
  const { resources, links } = resourcesQ.data ?? { resources: [], links: [] };
  const topics = topicsQ.data ?? [];

  return (
    <div>
      <SectionHead
        title="Resources"
        sub="Videos, articles and academic sources linked to this course's topics"
        action={<Button onClick={() => setShowAdd(true)}><Plus size={15} /> Add resource</Button>}
      />
      {resources.length === 0 ? (
        <Empty
          icon={<ExternalLink size={36} />}
          title="No resources yet"
          body="Link academic pages, OpenStax chapters, OpenCourseWare lectures or curated videos. Every resource keeps its source and provenance."
          actions={<Button onClick={() => setShowAdd(true)}><Plus size={15} /> Add first resource</Button>}
        />
      ) : (
        <div className="resource-list">
          {resources.map((r) => {
            const linked = links.filter((l) => l.resource_id === r.id).map((l) => topics.find((t) => t.id === l.topic_id)?.name).filter(Boolean);
            return (
              <Card key={r.id} className="resource-card">
                <div className="resource-main">
                  <div className="resource-title-line">
                    <h3>{r.title}</h3>
                    <SourceBadge level={r.source_level} />
                  </div>
                  {r.description && <p className="mut small">{r.description}</p>}
                  <div className="topic-meta">
                    <span>{r.resource_type}</span>
                    {r.provider && <span>{r.provider}</span>}
                    {r.duration_seconds ? <span>{Math.round(r.duration_seconds / 60)} min</span> : null}
                    {linked.length > 0 && <span>topics: {linked.join(", ")}</span>}
                  </div>
                </div>
                {r.url && (
                  <a className="text-btn" href={r.url} target="_blank" rel="noreferrer">
                    Open <ExternalLink size={13} />
                  </a>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {showAdd && <AddResourceModal topics={topics} onClose={() => setShowAdd(false)} onSaved={resourcesQ.refresh} />}
    </div>
  );
}

function AddResourceModal({ topics, onClose, onSaved }: { topics: Topic[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<Resource["resource_type"]>("website");
  const [level, setLevel] = useState<"1" | "2" | "3" | "4">("3");
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!title.trim()) return;
    try {
      await api.addResource({
        title: title.trim(),
        url: url.trim() || null,
        description: desc.trim() || null,
        resource_type: type,
        source_level: Number(level) as 1 | 2 | 3 | 4,
        topic_ids: topicIds,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <Modal title="Add a resource" eyebrow="PROVENANCE MATTERS" onClose={onClose} wide>
      <p className="muted">
        Level 1 = your course material · Level 2 = authoritative academic · Level 3 = curated external · Level 4 = AI-generated.
        Linking academic OERs (OpenStax, MIT OCW, university repositories) is encouraged; avoid copying copyrighted text.
      </p>
      <Field label="Title" value={title} onChange={setTitle} placeholder="e.g. OpenStax — Calculus Ch. 3: Derivatives" />
      <Field label="URL (optional)" value={url} onChange={setUrl} placeholder="https://…" />
      <Field label="Description (optional)" value={desc} onChange={setDesc} rows={2} />
      <div className="field-row">
        <Select
          label="Type"
          value={type}
          onChange={(v) => setType(v as Resource["resource_type"])}
          options={[
            { value: "website", label: "Webpage / article" },
            { value: "youtube", label: "Video (YouTube)" },
            { value: "document", label: "Document / PDF" },
            { value: "textbook", label: "Textbook / OER" },
            { value: "simulation", label: "Simulation" },
            { value: "other", label: "Other" },
          ]}
        />
        <Select
          label="Source level"
          value={level}
          onChange={(v) => setLevel(v as "1" | "2" | "3" | "4")}
          options={[
            { value: "1", label: "L1 — course material" },
            { value: "2", label: "L2 — academic source" },
            { value: "3", label: "L3 — curated external" },
            { value: "4", label: "L4 — AI-generated" },
          ]}
        />
      </div>
      {topics.length > 0 && (
        <div className="field">
          <span>Link to topics</span>
          <div className="topic-picks">
            {topics.map((t) => (
              <label key={t.id} className="pick">
                <input
                  type="checkbox"
                  checked={topicIds.includes(t.id)}
                  onChange={(e) =>
                    setTopicIds((ids) => (e.target.checked ? [...ids, t.id] : ids.filter((x) => x !== t.id)))
                  }
                />
                {t.name}
              </label>
            ))}
          </div>
        </div>
      )}
      {error && <ErrorNote message={error} />}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button onClick={save}>Add resource</Button>
      </div>
    </Modal>
  );
}
