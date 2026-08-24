// Minimal hash router — no external dependency.
// Routes look like: #/courses/:courseId?tab=topics

import { useEffect, useState, type ReactNode, type MouseEvent } from "react";

export interface Route {
  path: string; // e.g. "/courses/abc"
  params: Record<string, string>;
  query: Record<string, string>;
}

function parseHash(): Route {
  const raw = window.location.hash.replace(/^#/, "") || "/";
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const query: Record<string, string> = {};
  if (queryPart) {
    for (const pair of queryPart.split("&")) {
      const [k, v] = pair.split("=");
      if (k) query[decodeURIComponent(k)] = decodeURIComponent(v ?? "");
    }
  }
  return { path, params: {}, query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(parseHash);
  useEffect(() => {
    const onChange = () => setRoute(parseHash());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export function navigate(to: string) {
  window.location.hash = to.startsWith("/") ? to : `/${to}`;
}

/** Match a path like "/courses/:id" against a route path. */
export function matchPath(pattern: string, path: string): Record<string, string> | null {
  const p = pattern.split("/").filter(Boolean);
  const a = path.split("/").filter(Boolean);
  if (p.length !== a.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < p.length; i++) {
    if (p[i].startsWith(":")) params[p[i].slice(1)] = decodeURIComponent(a[i]);
    else if (p[i] !== a[i]) return null;
  }
  return params;
}

export function Link({
  to,
  className,
  children,
  onClick,
  title,
}: {
  to: string;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
  title?: string;
}) {
  function handle(e: MouseEvent) {
    e.preventDefault();
    onClick?.();
    navigate(to);
  }
  return (
    <a href={`#${to}`} className={className} onClick={handle} title={title}>
      {children}
    </a>
  );
}
