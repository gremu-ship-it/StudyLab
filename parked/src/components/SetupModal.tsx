import { useMemo, useState } from "react";
import { Building2, GraduationCap, Plus, Save } from "lucide-react";
import { useStore, store } from "../store";
import { Modal, toast } from "./ui";

export function SetupModal({ open, onClose, mode }: { open: boolean; onClose: () => void; mode: "setup" | "switch" }) {
  const db = useStore((d) => d);
  const existing = db.student_profiles[0];

  const [institutionId, setInstitutionId] = useState(existing?.institution_id ?? db.institutions[0]?.id ?? "");
  const [programmeId, setProgrammeId] = useState(existing?.programme_id ?? "");
  const [year, setYear] = useState(existing?.current_year ?? 1);
  const [semester, setSemester] = useState<1 | 2>((existing?.current_semester as 1 | 2) ?? 1);
  const [name, setName] = useState(existing?.full_name ?? "");
  const [showNewInst, setShowNewInst] = useState(false);
  const [showNewProg, setShowNewProg] = useState(false);
  const [newInst, setNewInst] = useState({ name: "", short: "", country: "Malawi" });
  const [newProg, setNewProg] = useState({ name: "", code: "", description: "", years: 4 });

  const programmes = useMemo(
    () => db.programmes.filter((p) => p.institution_id === institutionId),
    [db.programmes, institutionId]
  );

  function save() {
    if (mode === "setup") {
      if (!name.trim() || !institutionId || !programmeId) {
        toast("Please fill in your name, institution and programme", "info");
        return;
      }
      store.setupStudent(name.trim(), institutionId, programmeId, year, semester);
      toast(`Welcome to ${db.institutions.find((i) => i.id === institutionId)?.short_name ?? "StudyLab"}!`);
    } else {
      if (!programmeId) return;
      store.switchStudentProgramme(programmeId, year, semester);
      const prog = db.programmes.find((p) => p.id === programmeId);
      const inst = db.institutions.find((i) => i.id === prog?.institution_id);
      toast(`Switched to ${prog?.name} · ${inst?.short_name ?? ""}`);
    }
    onClose();
  }

  function createInstitution() {
    if (!newInst.name.trim()) return;
    const inst = store.addInstitution(newInst.name.trim(), newInst.short.trim(), newInst.country.trim());
    setInstitutionId(inst.id);
    setShowNewInst(false);
    setNewInst({ name: "", short: "", country: "Malawi" });
    toast("Institution added");
  }

  function createProgramme() {
    if (!newProg.name.trim()) return;
    const prog = store.addProgramme(institutionId, newProg.name.trim(), newProg.code.trim(), newProg.description.trim(), newProg.years);
    setProgrammeId(prog.id);
    setShowNewProg(false);
    setNewProg({ name: "", code: "", description: "", years: 4 });
    toast("Programme created");
  }

  return (
    <Modal open={open} onClose={onClose} size="lg" eyebrow={mode === "setup" ? "Welcome to StudyLab" : "Switch institution"} title={mode === "setup" ? "Set up your learning space" : "Change institution or programme"}>
      <p className="muted" style={{ marginBottom: 16 }}>
        StudyLab is multi-institution. Pick your university and programme — your courses, topics, mastery and plan are all scoped to that programme.
      </p>

      <div className="form-grid">
        {mode === "setup" && (
          <label style={{ gridColumn: "1 / -1" }}>Your full name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tiyamike Phiri" />
          </label>
        )}

        <label>Institution
          <select value={institutionId} onChange={(e) => { setInstitutionId(e.target.value); setProgrammeId(""); }}>
            {db.institutions.filter((i) => i.is_active).map((i) => (
              <option key={i.id} value={i.id}>{i.short_name ? `${i.short_name} — ` : ""}{i.name}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <button className="secondary" style={{ justifyContent: "center" }} onClick={() => setShowNewInst((v) => !v)}>
            <Plus size={15} /> {showNewInst ? "Cancel" : "Add institution"}
          </button>
        </label>
      </div>

      {showNewInst && (
        <div className="panel" style={{ margin: "12px 0", background: "var(--bg-2)" }}>
          <div className="row" style={{ alignItems: "flex-end" }}>
            <label style={{ flex: 2 }}>Institution name<input value={newInst.name} onChange={(e) => setNewInst({ ...newInst, name: e.target.value })} placeholder="e.g. Mzuzu University" /></label>
            <label style={{ flex: 1 }}>Short name<input value={newInst.short} onChange={(e) => setNewInst({ ...newInst, short: e.target.value })} placeholder="MZUNI" /></label>
            <label style={{ flex: 1 }}>Country<input value={newInst.country} onChange={(e) => setNewInst({ ...newInst, country: e.target.value })} /></label>
            <button className="primary small" onClick={createInstitution}><Save size={14} /> Save</button>
          </div>
        </div>
      )}

      <div className="form-grid" style={{ marginTop: 12 }}>
        <label>Programme
          <select value={programmeId} onChange={(e) => setProgrammeId(e.target.value)}>
            <option value="">Select a programme…</option>
            {programmes.map((p) => <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</option>)}
          </select>
        </label>
        <label style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <button className="secondary" style={{ justifyContent: "center" }} onClick={() => setShowNewProg((v) => !v)}>
            <Plus size={15} /> {showNewProg ? "Cancel" : "Add programme"}
          </button>
        </label>
      </div>

      {showNewProg && (
        <div className="panel" style={{ margin: "12px 0", background: "var(--bg-2)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div className="form-grid">
              <label>Programme name<input value={newProg.name} onChange={(e) => setNewProg({ ...newProg, name: e.target.value })} placeholder="e.g. BSc Computer Science" /></label>
              <label>Code<input value={newProg.code} onChange={(e) => setNewProg({ ...newProg, code: e.target.value })} placeholder="CS" /></label>
            </div>
            <label>Description<textarea value={newProg.description} onChange={(e) => setNewProg({ ...newProg, description: e.target.value })} /></label>
            <div className="row">
              <label style={{ width: 160 }}>Duration (years)<input type="number" min={1} max={8} value={newProg.years} onChange={(e) => setNewProg({ ...newProg, years: Number(e.target.value) })} /></label>
              <button className="primary small" style={{ marginLeft: "auto" }} onClick={createProgramme}><Save size={14} /> Create programme</button>
            </div>
          </div>
        </div>
      )}

      <div className="form-grid" style={{ marginTop: 12 }}>
        <label>Year of study<select value={year} onChange={(e) => setYear(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map((y) => <option key={y} value={y}>Year {y}</option>)}
        </select></label>
        <label>Semester<select value={semester} onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)}>
          <option value={1}>Semester 1</option><option value={2}>Semester 2</option>
        </select></label>
      </div>

      <div className="row" style={{ marginTop: 18, gap: 10 }}>
        {programmeId && (
          <span className="chip brand">
            <Building2 size={12} /> {db.institutions.find((i) => i.id === institutionId)?.short_name}
            <GraduationCap size={12} style={{ marginLeft: 6 }} /> {programmes.find((p) => p.id === programmeId)?.name}
          </span>
        )}
        <div style={{ flex: 1 }} />
        <button className="secondary" onClick={onClose}>Cancel</button>
        <button className="primary" onClick={save}><Save size={16} /> {mode === "setup" ? "Start learning" : "Switch"}</button>
      </div>
    </Modal>
  );
}
