import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, Brain, Building2, CalendarDays, ChevronRight, ClipboardList, FlaskConical,
  GraduationCap, LayoutDashboard, Menu, MessageSquare, Microscope, Repeat, Search, Sparkles,
  Target, Upload, UserCircle, X, BarChart3, Library,
} from "lucide-react";
import { useStore, store } from "./store";
import { useStudent } from "./student";
import { ToastHost, initials, toast } from "./components/ui";
import { SetupModal } from "./components/SetupModal";
import { AuthScreen } from "./components/Auth";
import { ModeBadge } from "./components/ModeBadge";
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import { hydrateFromSupabase, onAuthChange, signOut, upsertRow, deleteRow, uploadFile } from "./lib/live";
import { Dashboard } from "./pages/Dashboard";
import { CoursesPage } from "./pages/Courses";
import { CoursePage } from "./pages/CoursePage";
import { StudyPlanPage } from "./pages/StudyPlan";
import { InboxPage } from "./pages/Inbox";
import { PracticePage } from "./pages/Practice";
import { PracticalListPage } from "./pages/Practicals";
import { ReviewPage } from "./pages/Review";
import { MasteryPage } from "./pages/Mastery";
import { MaterialsPage } from "./pages/Materials";
import { AITutorPage } from "./pages/AITutor";
import { ProfilePage } from "./pages/Profile";
import { DataExplorerPage } from "./pages/DataExplorer";

export type Route =
  | { name: "dashboard" }
  | { name: "courses" }
  | { name: "course"; courseId: string }
  | { name: "study" }
  | { name: "inbox" }
  | { name: "practice"; topicId?: string }
  | { name: "practicals" }
  | { name: "review" }
  | { name: "mastery" }
  | { name: "materials" }
  | { name: "ai"; conversationId?: string; topicId?: string; courseId?: string }
  | { name: "profile" }
  | { name: "explorer" };

export type NavFn = (r: Route) => void;

export default function App() {
  const [route, setRoute] = useState<Route>({ name: "dashboard" });
  const [search, setSearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const student = useStore((db) => db.student_profiles[0]);
  const [setupOpen, setSetupOpen] = useState<"setup" | "switch" | null>(null);
  const ctx = useStudent();

  // ----- Auth / live-data bootstrap -----
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [bootstrapped, setBootstrapped] = useState(!isSupabaseConfigured);
  const [hydrating, setHydrating] = useState(false);
  const [wantDemo, setWantDemo] = useState(false);

  useEffect(() => {
    if (!isSupabaseConfigured) { setBootstrapped(true); return; }
    let cancelled = false;
    const unsub = onAuthChange(async (uid) => {
      if (cancelled) return;
      setAuthUserId(uid);
      if (!uid) {
        store.reset();
        setBootstrapped(true);
        return;
      }
      store.setStudentId(uid);
      store.setRemote({
        upsert: (table, row) => upsertRow(table as never, row),
        remove: (table, id) => deleteRow(table as never, id),
        uploadFile: (userId, file) => uploadFile(userId, file),
        onError: (msg) => toast(msg, "info"),
      });
      setHydrating(true);
      try {
        const db = await hydrateFromSupabase();
        const hasStudent = db.student_profiles.some((p) => p.id === uid);
        store.replace(db, "live");
        store.setStudentId(uid);
        if (!hasStudent) {
          // First sign-in: look up the real LUANAR NAS programme from the DB
          // (never use the local seed IDs in live mode — they are not UUIDs).
          const inst = db.institutions.find((i) => i.short_name === "LUANAR") ?? db.institutions[0];
          const prog = db.programmes.find((p) => p.name === "BSc in Natural & Applied Science")
            ?? db.programmes.find((p) => p.institution_id === inst?.id)
            ?? db.programmes[0];
          if (inst && prog) {
            const { data: sess } = await supabase!.auth.getSession();
            store.setupStudent(
              (sess.session?.user.user_metadata?.full_name as string) || "Student",
              inst.id, prog.id, prog ? (db.academic_periods.find((a) => a.programme_id === prog.id && a.status === "active")?.year_level ?? 2) : 2,
              1
            );
          }
        }
      } catch (e) {
        console.error(e);
        toast(`Could not load cloud data: ${(e as Error).message}`, "info");
      } finally {
        setHydrating(false);
        setBootstrapped(true);
      }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  const signedIn = Boolean(authUserId);
  const showAuthGate = isSupabaseConfigured && bootstrapped && !signedIn && !wantDemo;

  const nav: NavFn = (r) => {
    setRoute(r);
    setSidebarOpen(false);
    window.scrollTo({ top: 0 });
  };

  const counts = useCounts();

  const navItems: [string, string, typeof LayoutDashboard, number?][] = [
    ["dashboard", "Dashboard", LayoutDashboard],
    ["courses", "My Courses", BookOpen, counts.courses],
    ["study", "Study Plan", CalendarDays],
    ["inbox", "Curriculum Inbox", ClipboardList, counts.inbox || undefined],
    ["practice", "Practice", Target],
    ["practicals", "Practicals", FlaskConical],
    ["review", "Review", Repeat, counts.reviewsDue || undefined],
    ["mastery", "Mastery", BarChart3],
    ["materials", "Materials", Upload],
    ["ai", "AI Tutor", MessageSquare],
    ["explorer", "Data Explorer", Library],
  ];

  const pageTitle = useMemo(() => {
    const found = navItems.find((n) => n[0] === route.name);
    return found ? found[1] : "StudyLab";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.name]);

  useEffect(() => { document.title = `StudyLab · ${pageTitle}`; }, [pageTitle]);

  if (!bootstrapped || hydrating) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div className="brand-mark" style={{ margin: "0 auto 14px", width: 48, height: 48, borderRadius: 14 }}><GraduationCap size={24} /></div>
          <p className="muted">{hydrating ? "Syncing your workspace…" : "Loading StudyLab…"}</p>
        </div>
        <ToastHost />
      </div>
    );
  }

  if (showAuthGate) {
    return (
      <>
        <AuthScreen onContinueDemo={() => setWantDemo(true)} />
        <ToastHost />
      </>
    );
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><GraduationCap size={22} /></div>
          <div><strong>StudyLab</strong><span>Learn • Practise • Master</span></div>
          <button className="icon-btn" style={{ marginLeft: "auto", display: "none" }} onClick={() => setSidebarOpen(false)}><X size={18} /></button>
        </div>
        <nav>
          <div className="nav-label">Learning</div>
          {navItems.map(([id, label, Icon, badge]) => (
            <button
              key={id}
              className={route.name === id ? "nav-item active" : "nav-item"}
              onClick={() => nav({ name: id } as Route)}
            >
              <Icon size={18} /> {label}
              {badge ? <span className="nav-badge">{badge}</span> : null}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="mini-card" onClick={() => setSetupOpen("switch")} style={{ textAlign: "left", cursor: "pointer" }}>
            <Building2 size={18} />
            <div style={{ minWidth: 0 }}>
              <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ctx.institution?.short_name ?? "Institution"}</strong>
              <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>{ctx.programme?.name ?? "No programme"}</span>
            </div>
            <ChevronRight size={15} style={{ marginLeft: "auto", color: "var(--text-mute)" }} />
          </button>
          <button className="mini-card" onClick={() => nav({ name: "ai" })} style={{ textAlign: "left", cursor: "pointer" }}>
            <Sparkles size={18} />
            <div><strong>AI Tutor</strong><span>Explain • Practise • Review</span></div>
          </button>
          <button className="student-mini" onClick={() => nav({ name: "profile" })} style={{ cursor: "pointer" }}>
            <div className="avatar">{initials(student?.full_name ?? "Student")}</div>
            <div style={{ minWidth: 0 }}>
              <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{student?.full_name ?? "Student"}</strong>
              <span>Year {student?.current_year} · Semester {student?.current_semester}</span>
            </div>
          </button>
        </div>
      </aside>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 19 }} />}

      <main className="main">
        <header className="topbar">
          <button className="icon-btn mobile-menu" onClick={() => setSidebarOpen(true)}><Menu size={20} /></button>
          <div className="search">
            <Search size={17} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.trim()) nav({ name: "courses" });
              }}
              placeholder="Search courses, topics..."
            />
          </div>
          <button className="icon-btn" onClick={() => nav({ name: "mastery" })} title="Mastery"><Brain size={19} /></button>
          <button className="icon-btn" onClick={() => nav({ name: "practicals" })} title="Practicals"><Microscope size={19} /></button>
          <ModeBadge onSignOut={signedIn ? () => signOut() : undefined} />
          <button className="icon-btn" onClick={() => nav({ name: "profile" })} title="Profile"><UserCircle size={20} /></button>
        </header>

        <div className="fade-in" key={route.name + JSON.stringify(route).slice(0, 40)}>
          {route.name === "dashboard" && <Dashboard nav={nav} />}
          {route.name === "courses" && <CoursesPage nav={nav} search={search} />}
          {route.name === "course" && <CoursePage courseId={route.courseId} nav={nav} />}
          {route.name === "study" && <StudyPlanPage nav={nav} />}
          {route.name === "inbox" && <InboxPage nav={nav} />}
          {route.name === "practice" && <PracticePage nav={nav} initialTopicId={route.topicId} />}
          {route.name === "practicals" && <PracticalListPage nav={nav} />}
          {route.name === "review" && <ReviewPage nav={nav} />}
          {route.name === "mastery" && <MasteryPage nav={nav} />}
          {route.name === "materials" && <MaterialsPage nav={nav} />}
          {route.name === "ai" && <AITutorPage nav={nav} conversationId={route.conversationId} topicId={route.topicId} courseId={route.courseId} />}
          {route.name === "profile" && <ProfilePage nav={nav} />}
          {route.name === "explorer" && <DataExplorerPage />}
        </div>
      </main>
      <ToastHost />
      <SetupModal open={!!setupOpen} mode={setupOpen ?? "setup"} onClose={() => setSetupOpen(null)} />
    </div>
  );
}

function useCounts() {
  return useStore((db) => {
    const sid = store.studentId;
    const now = Date.now();
    return {
      courses: db.courses.length,
      inbox: db.topics.filter((t) => t.status === "student_added").length,
      reviewsDue: db.review_schedule.filter(
        (r) => r.student_id === sid && r.status === "scheduled" && new Date(r.scheduled_for).getTime() <= now + 86400000
      ).length,
    };
  });
}
