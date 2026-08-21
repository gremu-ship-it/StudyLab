import { useMemo, useState } from "react";
import { BookOpen, Brain, CalendarDays, ChevronRight, ClipboardList, FlaskConical, GraduationCap, LayoutDashboard, Menu, PlayCircle, Plus, Search, Sparkles, Target, Upload, X } from "lucide-react";
import { courses, recommendations } from "./data";

type Page = "dashboard" | "courses" | "study" | "inbox";

export default function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [selectedCourse, setSelectedCourse] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAddTopic, setShowAddTopic] = useState(false);
  const [topicName, setTopicName] = useState("");

  const filteredCourses = useMemo(
    () => courses.filter(c => `${c.name} ${c.code} ${c.category}`.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const nav = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["courses", "My Courses", BookOpen],
    ["study", "Study Plan", CalendarDays],
    ["inbox", "Curriculum Inbox", ClipboardList],
  ] as const;

  function addTopic() {
    if (!topicName.trim()) return;
    setShowAddTopic(false);
    setTopicName("");
    alert(`"${topicName}" is ready to be added to the curriculum inbox.`);
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={22} /></div>
          <div><strong>StudyLab</strong><span>Learn • Practise • Master</span></div>
        </div>
        <nav>
          {nav.map(([id, label, Icon]) => (
            <button key={id} className={page === id ? "nav-item active" : "nav-item"} onClick={() => setPage(id)}>
              <Icon size={18} /> {label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-card">
            <Sparkles size={18} />
            <div><strong>AI Tutor</strong><span>Ask, practise or review</span></div>
          </div>
          <div className="student-mini"><div className="avatar">A</div><div><strong>Student</strong><span>BSc Natural & Applied Science</span></div></div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu"><Menu size={20} /></button>
          <div className="search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search courses, topics..." /></div>
          <button className="icon-btn"><Brain size={19} /></button>
        </header>

        {page === "dashboard" && (
          <Dashboard onNavigate={setPage} onAddTopic={() => setShowAddTopic(true)} />
        )}

        {page === "courses" && (
          <section className="page">
            <div className="page-heading"><div><span className="eyebrow">BSc Natural & Applied Science</span><h1>My Courses</h1><p>Year 2 • Semester 1 • Current curriculum</p></div><button className="primary" onClick={() => setShowAddTopic(true)}><Plus size={17}/> Add Topic</button></div>
            <div className="course-grid">
              {filteredCourses.map(course => (
                <CourseCard key={course.id} course={course} onClick={() => setSelectedCourse(course.id)} />
              ))}
            </div>
          </section>
        )}

        {page === "study" && <StudyPlan onStart={() => setPage("dashboard")} />}
        {page === "inbox" && <Inbox onAddTopic={() => setShowAddTopic(true)} />}

        {selectedCourse && <CourseModal course={courses.find(c => c.id === selectedCourse)!} onClose={() => setSelectedCourse(null)} onAddTopic={() => {setSelectedCourse(null); setShowAddTopic(true)}} />}
        {showAddTopic && <AddTopicModal topicName={topicName} setTopicName={setTopicName} onClose={() => setShowAddTopic(false)} onAdd={addTopic} />}
      </main>
    </div>
  );
}

function Dashboard({ onNavigate, onAddTopic }: { onNavigate: (p: Page) => void; onAddTopic: () => void }) {
  return (
    <section className="page">
      <div className="hero">
        <div>
          <span className="eyebrow">THURSDAY • 20 AUGUST 2026</span>
          <h1>Good afternoon 👋</h1>
          <p>Your learning engine is ready. Tell StudyLab what you are learning next.</p>
          <div className="hero-actions"><button className="primary" onClick={() => onNavigate("study")}><PlayCircle size={17}/> Start 45-min session</button><button className="secondary" onClick={onAddTopic}><Plus size={17}/> Add today's topic</button></div>
        </div>
        <div className="hero-orb"><Brain size={70} strokeWidth={1.2}/></div>
      </div>

      <div className="stats">
        <Stat icon={<Target />} label="Overall mastery" value="59%" note="Across active courses" />
        <Stat icon={<CalendarDays />} label="Study this week" value="2h 35m" note="Target: 5 hours" />
        <Stat icon={<ClipboardList />} label="Reviews due" value="6" note="Best done today" />
        <Stat icon={<Sparkles />} label="Topics added" value="0" note="Curriculum grows with you" />
      </div>

      <div className="section-head"><div><h2>Recommended next</h2><p>Based on the current learning model</p></div><button className="text-btn" onClick={() => onNavigate("study")}>View plan <ChevronRight size={16}/></button></div>
      <div className="recommend-grid">
        {recommendations.map(r => <RecommendationCard key={r.id} rec={r} />)}
      </div>

      <div className="section-head"><div><h2>Current courses</h2><p>The timetable is a starting point, not a finished syllabus.</p></div><button className="text-btn" onClick={() => onNavigate("courses")}>View all <ChevronRight size={16}/></button></div>
      <div className="course-grid compact">{courses.slice(0, 6).map(c => <CourseCard key={c.id} course={c} onClick={() => {}} />)}</div>
    </section>
  );
}

function Stat({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <div className="stat"><div className="stat-icon">{icon}</div><div><span>{label}</span><strong>{value}</strong><small>{note}</small></div></div>;
}

function CourseCard({ course, onClick }: { course: typeof courses[number]; onClick: () => void }) {
  return <button className="course-card" onClick={onClick}>
    <div className={`course-icon ${course.accent}`}><BookOpen size={19}/></div>
    <div className="course-main"><span>{course.code}</span><h3>{course.name}</h3><small>{course.category}</small></div>
    <ChevronRight size={18} className="arrow"/>
    <div className="progress-row"><span>Learning progress</span><strong>{course.progress}%</strong></div>
    <div className="progress"><i style={{width: `${course.progress}%`}}/></div>
    <div className="mastery"><span>Mastery</span><b>{course.mastery}%</b></div>
  </button>;
}

function RecommendationCard({ rec }: { rec: typeof recommendations[number] }) {
  return <div className="recommend-card"><div className="rec-top"><span className={`priority ${rec.priority.toLowerCase()}`}>{rec.priority}</span><span>{rec.minutes} min</span></div><span className="eyebrow">{rec.course}</span><h3>{rec.topic}</h3><p>{rec.reason}</p><button className="secondary full">Start <ChevronRight size={16}/></button></div>;
}

function StudyPlan({ onStart }: { onStart: () => void }) {
  return <section className="page"><div className="page-heading"><div><span className="eyebrow">PERSONALISED PLAN</span><h1>Today's Study Plan</h1><p>45 minutes • Adaptive learning</p></div><button className="primary" onClick={onStart}><PlayCircle size={17}/> Start session</button></div>
    <div className="timeline">
      {[["10 min","Calculus I","Add your current topic","Diagnostic + foundation"],["15 min","Mechanics I","Add your current topic","Guided practice"],["15 min","Agricultural Economics","Practice session","Applied scenario"],["5 min","Mixed review","6 questions","Spaced repetition"]].map((x,i)=><div className="timeline-item" key={i}><div className="time">{x[0]}</div><div className="dot">{i+1}</div><div className="timeline-content"><span>{x[1]}</span><h3>{x[2]}</h3><p>{x[3]}</p></div><ChevronRight size={18}/></div>)}
    </div>
  </section>;
}

function Inbox({ onAddTopic }: { onAddTopic: () => void }) {
  return <section className="page"><div className="page-heading"><div><span className="eyebrow">CURRICULUM INBOX</span><h1>What's new?</h1><p>New topics, notes and materials are reviewed before becoming part of the learning system.</p></div><button className="primary" onClick={onAddTopic}><Plus size={17}/> Add topic</button></div>
    <div className="empty-state"><ClipboardList size={36}/><h2>Your curriculum inbox is empty</h2><p>Add the topic your lecturer introduced today, or upload the lecture material. StudyLab will prepare it for review.</p><div className="hero-actions"><button className="primary" onClick={onAddTopic}><Plus size={17}/> Add topic</button><button className="secondary"><Upload size={17}/> Upload material</button></div></div>
  </section>;
}

function CourseModal({ course, onClose, onAddTopic }: { course: typeof courses[number]; onClose: () => void; onAddTopic: () => void }) {
  return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose}><X/></button><span className="eyebrow">{course.code} • {course.category}</span><h2>{course.name}</h2><p className="muted">This course is seeded from the current timetable. Topics remain open until the lecturer introduces them.</p><div className="notice"><Sparkles size={18}/><div><strong>No topics added yet</strong><p>Add today's topic to start a personalised learning pack.</p></div></div><button className="primary full" onClick={onAddTopic}><Plus size={17}/> Add first topic</button></div></div>;
}

function AddTopicModal({ topicName, setTopicName, onClose, onAdd }: { topicName: string; setTopicName: (v: string) => void; onClose: () => void; onAdd: () => void }) {
  return <div className="modal-backdrop"><div className="modal"><button className="close" onClick={onClose}><X/></button><span className="eyebrow">CURRICULUM INBOX</span><h2>Add a new topic</h2><p className="muted">This does not assume the topic is part of the official syllabus. It enters the inbox for review.</p><label>Topic name<input autoFocus value={topicName} onChange={e => setTopicName(e.target.value)} placeholder="e.g. Newton's Laws" /></label><div className="modal-actions"><button className="secondary" onClick={onClose}>Cancel</button><button className="primary" onClick={onAdd}><Plus size={17}/> Add to inbox</button></div></div></div>;
}