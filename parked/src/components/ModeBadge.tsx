import { Cloud, CloudOff } from "lucide-react";
import { isSupabaseConfigured } from "../lib/supabase";
import { store, useStore } from "../store";

/** Shows whether the app is running against Supabase (Live) or the in-browser demo dataset. */
export function ModeBadge({ onSignOut }: { onSignOut?: () => void }) {
  const mode = useStore(() => store.getMode());
  const configured = isSupabaseConfigured;

  if (mode === "live") {
    return (
      <button
        className="chip good"
        onClick={onSignOut}
        title="Signed in and syncing to Supabase. Click to sign out."
        style={{ cursor: onSignOut ? "pointer" : "default", border: "none" }}
      >
        <Cloud size={12} /> Live · synced
      </button>
    );
  }
  return (
    <span className={`chip ${configured ? "warn" : "muted"}`} title={configured ? "Supabase configured but not signed in." : "Running on local demo data."}>
      <CloudOff size={12} /> {configured ? "Demo · sign in to sync" : "Demo mode"}
    </span>
  );
}
