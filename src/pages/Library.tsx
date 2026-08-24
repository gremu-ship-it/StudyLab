// First-class Textbook & Resource Library page (/library).
// Categories:
//   * MY MATERIALS (uploaded notes, slides, past papers)
//   * OPEN TEXTBOOKS (OpenStax Calculus, Physics, Chemistry, Biology, Economics)
//   * UNIVERSITY COURSES (MIT OpenCourseWare, LUANAR repositories)
//   * ACADEMIC WEBSITES (LibreTexts, Paul's Online Math Notes, Khan Academy)
//   * VIDEOS (3Blue1Brown, Organic Chemistry Tutor, CrashCourse)
//   * EXTERNAL LIBRARIES (WeLib Digital Library metadata & destination portal)

import { useMemo, useState } from "react";
import {
  BookOpen,
  ChevronRight,
  ExternalLink,
  FileText,
  Filter,
  GraduationCap,
  Library as LibraryIcon,
  PlayCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import * as api from "../lib/api";
import { useAuth, useQuery } from "../lib/auth";
import { Card, Empty, SectionHead, SourceBadge, Spinner } from "../components/ui";
import { Link, navigate } from "../router";
import type { Resource, ResourceCategory, SourceLevel, UploadedMaterial } from "../types";
import { ALL_BLUEPRINTS } from "../lib/curriculum-data";

export function LibraryPage() {
  const { state } = useAuth();
  const user = state.status === "ready" ? state.user : null;

  const [activeTab, setActiveTab] = useState<ResourceCategory | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDiscipline, setSelectedDiscipline] = useState<string>("all");

  const materialsQ = useQuery(api.getMaterials, [user?.id]);
  const topicResourcesQ = useQuery(
    () => api.getResourcesForTopics(ALL_BLUEPRINTS.map((b) => b.topic.id)),
    [],
  );

  // Combine seeded blueprint library items with database items
  const allResources: Resource[] = useMemo(() => {
    const fromBlueprints = ALL_BLUEPRINTS.flatMap((b) => b.resources);
    const fromDb = topicResourcesQ.data?.resources ?? [];
    const map = new Map<string, Resource>();
    for (const r of [...fromBlueprints, ...fromDb]) {
      map.set(r.id, r);
    }
    return Array.from(map.values());
  }, [topicResourcesQ.data]);

  const materials = materialsQ.data ?? [];

  // Filter resources
  const filteredResources = useMemo(() => {
    return allResources.filter((r) => {
      if (activeTab !== "all" && r.category !== activeTab) {
        if (activeTab === "open_textbooks" && r.resource_type !== "textbook") return false;
        if (activeTab === "videos" && r.resource_type !== "youtube") return false;
        if (activeTab === "academic_websites" && r.resource_type !== "website") return false;
        if (activeTab !== "open_textbooks" && activeTab !== "videos" && activeTab !== "academic_websites") return false;
      }
      if (selectedDiscipline !== "all" && r.course_code && !r.course_code.toLowerCase().includes(selectedDiscipline.toLowerCase())) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          r.title.toLowerCase().includes(q) ||
          (r.description ?? "").toLowerCase().includes(q) ||
          (r.provider ?? "").toLowerCase().includes(q) ||
          (r.author ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [allResources, activeTab, selectedDiscipline, searchQuery]);

  return (
    <section className="page library-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">STUDYLAB ACADEMIC LIBRARY</span>
          <h1>Textbooks, Course Modules & Open Educational Resources</h1>
          <p>
            Curated, legally compliant academic textbooks, university course notes, videos, and external library catalog destinations.
          </p>
        </div>

        <div className="library-header-actions">
          <Link to="/materials" className="primary button-link">
            <Upload size={15} /> Upload My Material
          </Link>
        </div>
      </div>

      {/* Search and Category Filters */}
      <div className="library-filters-bar">
        <div className="search-box">
          <Search size={16} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search textbooks, open courses, video lectures..."
          />
        </div>

        <select
          value={selectedDiscipline}
          onChange={(e) => setSelectedDiscipline(e.target.value)}
          className="discipline-select"
        >
          <option value="all">All Subject Disciplines</option>
          <option value="NMAT">Calculus & Mathematics (NMAT)</option>
          <option value="NPHY">Physics & Mechanics (NPHY)</option>
          <option value="NCHE">Chemistry (NCHE)</option>
          <option value="NBIO">Biology (NBIO)</option>
          <option value="NNAS">Artificial Intelligence (NNAS)</option>
          <option value="NAAE">Agricultural Economics (NAAE)</option>
        </select>
      </div>

      {/* Category Tabs */}
      <div className="library-category-tabs">
        <button
          className={`lib-tab ${activeTab === "all" ? "active" : ""}`}
          onClick={() => setActiveTab("all")}
        >
          <LibraryIcon size={14} /> All Library Items
        </button>
        <button
          className={`lib-tab ${activeTab === "open_textbooks" ? "active" : ""}`}
          onClick={() => setActiveTab("open_textbooks")}
        >
          <BookOpen size={14} /> Open Textbooks (OpenStax)
        </button>
        <button
          className={`lib-tab ${activeTab === "university_courses" ? "active" : ""}`}
          onClick={() => setActiveTab("university_courses")}
        >
          <GraduationCap size={14} /> University Courses (MIT OCW)
        </button>
        <button
          className={`lib-tab ${activeTab === "academic_websites" ? "active" : ""}`}
          onClick={() => setActiveTab("academic_websites")}
        >
          <FileText size={14} /> Academic Notes (Paul's / LibreTexts)
        </button>
        <button
          className={`lib-tab ${activeTab === "videos" ? "active" : ""}`}
          onClick={() => setActiveTab("videos")}
        >
          <Video size={14} /> Video Lessons (3B1B / YouTube)
        </button>
        <button
          className={`lib-tab ${activeTab === "external_libraries" ? "active" : ""}`}
          onClick={() => setActiveTab("external_libraries")}
        >
          <Sparkles size={14} /> WeLib & External Libraries
        </button>
        <button
          className={`lib-tab ${activeTab === "my_materials" ? "active" : ""}`}
          onClick={() => setActiveTab("my_materials")}
        >
          <Upload size={14} /> My Materials ({materials.length})
        </button>
      </div>

      {/* My Materials Section when selected */}
      {activeTab === "my_materials" ? (
        <div className="my-materials-section">
          <SectionHead
            title="My Uploaded Materials (Source Level 1)"
            sub="Lecture notes, slides, assignments and past papers you uploaded."
          />
          {materials.length === 0 ? (
            <Empty
              icon={<Upload size={32} />}
              title="No materials uploaded yet"
              body="Upload your lecture notes, slides, and syllabus documents to ground the AI Tutor and lesson builder in your course material."
              actions={
                <Link to="/materials" className="primary button-link">
                  <Upload size={15} /> Upload First Document
                </Link>
              }
            />
          ) : (
            <div className="materials-cards-grid">
              {materials.map((m) => (
                <Card key={m.id} className="mat-card">
                  <div className="mat-top">
                    <FileText size={20} />
                    <span className={`status-pill ${m.processing_status}`}>{m.processing_status}</span>
                  </div>
                  <h3>{m.file_name}</h3>
                  <p className="mut small">Uploaded {new Date(m.created_at).toLocaleDateString("en-GB")}</p>
                  <Link to="/materials" className="text-btn">
                    Inspect Extraction <ChevronRight size={14} />
                  </Link>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Curated Library Grid */
        <div className="library-resource-grid">
          {filteredResources.map((res) => (
            <Card key={res.id} className="lib-resource-card">
              <div className="lib-card-topbar">
                <div className="lib-badge-group">
                  <span className="type-tag">{res.resource_type}</span>
                  {res.course_code && <span className="course-code-tag">{res.course_code}</span>}
                </div>
                {res.source_level && <SourceBadge level={res.source_level as SourceLevel} />}
              </div>

              <h3>{res.title}</h3>
              {res.description && <p className="lib-desc">{res.description}</p>}

              <div className="lib-meta-details">
                {res.author && (
                  <div className="meta-line">
                    <strong>Author:</strong> {res.author}
                  </div>
                )}
                {res.provider && (
                  <div className="meta-line">
                    <strong>Provider:</strong> {res.provider}
                  </div>
                )}
                {res.page_reference && (
                  <div className="meta-line">
                    <strong>Pages / Chapter:</strong> {res.page_reference}
                  </div>
                )}
                {res.recommendation_reason && (
                  <div className="lib-why-banner">
                    <Sparkles size={13} />
                    <span>{res.recommendation_reason}</span>
                  </div>
                )}
              </div>

              <div className="lib-card-action">
                {res.url ? (
                  <a
                    href={res.url}
                    target="_blank"
                    rel="noreferrer"
                    className="primary small-btn"
                  >
                    Open Legal Resource <ExternalLink size={13} />
                  </a>
                ) : (
                  <span className="mut small">Available in course syllabus</span>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Copyright & Legal Compliance Notice */}
      <div className="legal-compliance-banner">
        <ShieldCheck size={18} />
        <div>
          <strong>StudyLab Open Educational Resource & Library Compliance</strong>
          <p className="small mut">
            StudyLab indexes authoritative Open Educational Resources (OER under CC-BY / OpenStax), open university courseware (MIT OCW), and external academic libraries (WeLib). Copyrighted textbooks are referenced via metadata and official institutional portal links rather than mirrored content.
          </p>
        </div>
      </div>
    </section>
  );
}
