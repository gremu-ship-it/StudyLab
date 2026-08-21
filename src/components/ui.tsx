import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, X } from "lucide-react";

/* ---------------- Modal ---------------- */
export function Modal({
  open, onClose, title, eyebrow, children, footer, size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  eyebrow?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size === "lg" ? "lg" : ""}`}>
        <button className="close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        {title && <h2>{title}</h2>}
        <div style={{ marginTop: title || eyebrow ? 14 : 0 }}>{children}</div>
        {footer && <div className="modal-actions">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- Toast ---------------- */
type Toast = { id: number; text: string; kind: "good" | "info" };
let toastListeners: ((t: Toast) => void)[] = [];
export function toast(text: string, kind: Toast["kind"] = "good") {
  const t = { id: Date.now() + Math.random(), text, kind };
  toastListeners.forEach((l) => l(t));
}
export function ToastHost() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    const l = (t: Toast) => {
      setItems((prev) => [...prev, t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    toastListeners.push(l);
    return () => { toastListeners = toastListeners.filter((x) => x !== l); };
  }, []);
  return (
    <div className="toast-wrap">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <CheckCircle2 size={18} /> {t.text}
        </div>
      ))}
    </div>
  );
}

/* ---------------- Helpers ---------------- */
export const categoryAccent: Record<string, string> = {
  Mathematics: "math", "Physical Sciences": "physics", "Chemistry": "chem",
  Biology: "bio", "Agricultural Sciences": "soil", Technology: "tech",
  "Agricultural Economics": "econ",
};

export function initials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function fmtMin(seconds: number | null | undefined) {
  if (!seconds) return "—";
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function timeAgo(iso: string | null | undefined) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function dayLabel(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? "T00:00:00" : ""));
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

export const masteryColor = (score: number) =>
  score >= 75 ? "var(--good)" : score >= 55 ? "var(--brand)" : score >= 35 ? "var(--warn)" : "var(--bad)";

export const levelLabel: Record<string, string> = {
  not_started: "Not started", learning: "Learning", developing: "Developing",
  functional: "Functional", strong: "Strong", mastered: "Mastered",
};
