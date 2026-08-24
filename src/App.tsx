// App shell: sidebar + topbar + hash-routed pages, auth-gated.

import { useMemo } from "react";
import {
  BookOpen,
  Brain,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Menu,
  Network,
  Search,
} from "lucide-react";
import { AuthProvider, useAuth } from "./lib/auth";
import { Link, matchPath, useRoute } from "./router";
import { SetupPage } from "./pages/Setup";
import { AuthPage, OnboardingPage } from "./pages/Auth";
import { Dashboard } from "./pages/Dashboard";
import { CoursesPage } from "./pages/Courses";
import { CourseWorkspace } from "./pages/CourseWorkspace";
import { TopicDetail } from "./pages/TopicDetail";
import { SessionRunner } from "./pages/SessionRunner";
import { MaterialsPage } from "./pages/Materials";
import { KnowledgeMapPage } from "./pages/KnowledgeMap";
import { TutorPage } from "./pages/Tutor";
import * as api from "./lib/api";
import { Spinner } from "./components/ui";
import { useQuery } from "./lib/auth";

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

function Gate() {
  const { state } = useAuth();
  switch (state.status) {
    case "unconfigured":
      return <Shell>{<SetupPage />}</Shell>;
    case "loading":
      return (
        <div className="auth-wrap">
          <Spinner label="Loading StudyLab…" />
        </div>
      );
    case "signed_out":
      return <AuthPage />;
    case "onboarding":
      return <OnboardingPage />;
    case "ready":
      return (
        <Shell>
          <Routed />
        </Shell>
      );
  }
}

function Routed() {
  const route = useRoute();
  const { state } = useAuth();
  const profile = state.status === "ready" ? state.profile : null;

  const coursesQ = useQuery(
    () => (profile?.programme_id ? api.getCourses(profile.programme_id) : Promise.resolve([])),
    [profile?.programme_id],
  );

  const page = useMemo(() => {
    let m: Record<string, string> | null;

    if (route.path === "/" || route.path === "") return <Dashboard />;
    if (route.path === "/courses") return <CoursesPage />;
    if (route.path === "/materials") return <MaterialsPage />;
    if (route.path === "/map") return <KnowledgeMapPage />;
    if (route.path === "/tutor") return <TutorPage />;

    if ((m = matchPath("/courses/:id", route.path))) {
      const course = (coursesQ.data ?? []).find((c) => c.id === m!.id);
      if (course) return <CourseWorkspace course={course} />;
      return <CoursesPage />;
    }
    if ((m = matchPath("/topics/:id", route.path))) {
      return <TopicLoader topicId={m.id} />;
    }
    if ((m = matchPath("/session/:id", route.path))) {
      return <SessionRunner sessionId={m.id} />;
    }
    return <Dashboard />;
  }, [route.path, coursesQ.data]);

  return <>{page}</>;
}

function TopicLoader({ topicId }: { topicId: string }) {
  const topicQ = useQuery(() => api.getTopic(topicId), [topicId]);
  const { state } = useAuth();
  const profile = state.status === "ready" ? state.profile : null;
  const allCoursesQ = useQuery(
    () => (profile?.programme_id ? api.getCourses(profile.programme_id) : Promise.resolve([])),
    [profile?.programme_id],
  );
  if (topicQ.loading || allCoursesQ.loading)
    return (
      <div className="page">
        <Spinner label="Loading topic…" />
      </div>
    );
  const topic = topicQ.data;
  if (!topic)
    return (
      <div className="page">
        <p className="muted">Topic not found. It may have been archived.</p>
        <Link to="/courses" className="text-btn">
          Back to courses
        </Link>
      </div>
    );
  const course = (allCoursesQ.data ?? []).find((c) => c.id === topic.course_id);
  return <TopicDetail topic={topic} course={course} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  const { state, signOut } = useAuth();
  const route = useRoute();
  const profile = state.status === "ready" ? state.profile : null;
  const user = state.status === "ready" ? state.user : null;

  const nav = [
    ["/", "Dashboard", LayoutDashboard],
    ["/courses", "My Courses", BookOpen],
    ["/materials", "Course Material", ClipboardList],
    ["/map", "Knowledge Map", Network],
    ["/tutor", "AI Tutor", Brain],
  ] as const;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <GraduationCap size={22} />
          </div>
          <div>
            <strong>StudyLab</strong>
            <span>Learn • Practise • Master</span>
          </div>
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => {
            const active = to === "/" ? route.path === "/" : route.path.startsWith(to);
            return (
              <Link key={to} to={to} className={active ? "nav-item active" : "nav-item"}>
                <Icon size={18} /> {label}
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="mini-card">
            <Brain size={18} />
            <div>
              <strong>AI Tutor</strong>
              <span>Scaffolds, never spoils</span>
            </div>
          </div>
          {user && (
            <div className="student-mini">
              <div className="avatar">{(profile?.full_name ?? user.email)[0]?.toUpperCase()}</div>
              <div>
                <strong>{profile?.full_name ?? user.email}</strong>
                <span>BSc Natural & Applied Science</span>
              </div>
              <button className="signout" onClick={() => void signOut()} title="Sign out">
                <LogOut size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Menu">
            <Menu size={20} />
          </button>
          <div className="search">
            <Search size={17} />
            <input placeholder="Coming soon: search topics, questions and resources" disabled />
          </div>
          <Link to="/tutor" className="icon-btn" title="AI Tutor">
            <Brain size={19} />
          </Link>
        </header>
        {children}
      </main>
    </div>
  );
}
