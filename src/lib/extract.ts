import { supabase } from "./supabase";

/**
 * Ask the deployed Edge Function to extract text from a stored document
 * (PDF/Word/PowerPoint/Excel). Returns null if the function isn't deployed
 * or extraction fails, so the UI can fall back gracefully.
 */
export async function extractRemoteText(storagePath: string): Promise<string | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.functions.invoke("extract-text", {
      body: { storagePath },
    });
    if (error || !data?.text) return null;
    return data.text as string;
  } catch {
    return null;
  }
}
