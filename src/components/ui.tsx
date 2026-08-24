// Shared UI primitives — reuses the MVP visual language (styles.css).

import { X } from "lucide-react";
import type { ReactNode } from "react";
import type { MasteryLevel } from "../types";

export function Button({
  children,
  onClick,
  variant = "primary",
  disabled,
  full,
  type = "button",
  title,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  full?: boolean;
  type?: "button" | "submit";
  title?: string;
}) {
  return (
    <button
      type={type}
      className={`${variant === "primary" ? "primary" : variant} ${full ? "full" : ""} ${
        variant === "ghost" ? "ghost-btn" : ""
      } ${variant === "danger" ? "danger-btn" : ""}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  onClick,
  title,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  title?: string;
}) {
  if (onClick) {
    return (
      <div
        className={`card clickable ${className}`}
        onClick={onClick}
        role="button"
        tabIndex={0}
        title={title}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick();
          }
        }}
      >
        {children}
      </div>
    );
  }
  return (
    <div className={`card ${className}`} title={title}>
      {children}
    </div>
  );
}

export function SectionHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({
  title,
  eyebrow,
  onClose,
  children,
  wide,
}: {
  title: string;
  eyebrow?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${wide ? "modal-wide" : ""}`}>
        <button className="close" onClick={onClose} aria-label="Close">
          <X />
        </button>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  rows,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  rows?: number;
  hint?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {rows ? (
        <textarea rows={rows} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="field">
      {label && <span>{label}</span>}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Progress({ value, tone }: { value: number; tone?: "default" | "good" | "warn" }) {
  return (
    <div className="progress" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i className={tone ?? "default"} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function Empty({
  icon,
  title,
  body,
  actions,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  actions?: ReactNode;
}) {
  return (
    <div className="empty-state">
      {icon}
      <h2>{title}</h2>
      <p>{body}</p>
      {actions && <div className="hero-actions">{actions}</div>}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <div className="spinner" />
      <span>{label}</span>
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-note" role="alert">
      <strong>Something went wrong.</strong>
      <p>{message}</p>
      {onRetry && (
        <button className="text-btn" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

const LEVEL_META: Record<MasteryLevel, { label: string; cls: string; color: string }> = {
  not_assessed: { label: "Not assessed", cls: "grey", color: "#8a94a6" },
  weak: { label: "Needs attention", cls: "red", color: "#c2453d" },
  developing: { label: "Developing", cls: "amber", color: "#b07d1e" },
  strong: { label: "Strong", cls: "blue", color: "#2f6fb2" },
  mastered: { label: "Mastered", cls: "green", color: "#2e8b57" },
};

export function masteryMeta(level: MasteryLevel | string) {
  return LEVEL_META[(level as MasteryLevel) in LEVEL_META ? (level as MasteryLevel) : "not_assessed"];
}

export function MasteryBadge({ level, score }: { level: MasteryLevel | string; score?: number }) {
  const meta = masteryMeta(level);
  return (
    <span className={`mastery-badge ${meta.cls}`} title={`${meta.label}${score !== undefined ? ` — ${score}%` : ""}`}>
      <i style={{ background: meta.color }} />
      {meta.label}
      {score !== undefined && <b>{score}%</b>}
    </span>
  );
}

export function SourceBadge({ level }: { level: 1 | 2 | 3 | 4 | null | undefined }) {
  const labels = {
    1: "Course material",
    2: "Academic source",
    3: "External resource",
    4: "AI-generated",
  } as const;
  const lvl = level ?? 4;
  return <span className={`source-badge s${lvl}`}>{labels[lvl]}</span>;
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: { id: T; label: string }[];
  active: T;
  onChange: (t: T) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={active === t.id}
          className={active === t.id ? "tab active" : "tab"}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
