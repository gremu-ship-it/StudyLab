// StudyLab Edge Function: process-material
// ------------------------------------------------------------------
// Server-side document ingestion for a student's uploaded material.
//
// Contract (called from src/lib/api.ts → requestMaterialProcessing):
//   POST { material_id: string }
//   → { ok: boolean; message: string }
//
// Security model:
//   * caller must be an authenticated student (JWT verified against
//     SUPABASE_JWT_SECRET);
//   * the material must belong to that student (checked with the
//     service-role client);
//   * the original file is read but NEVER modified;
//   * extraction results are derived rows (extracted_content) with
//     page/confidence provenance — the source document stays untouched.
//
// This build extracts .txt / .md deterministically (parser.ts).
// PDF/Office formats are honestly reported as pending.

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractFromText } from "./parser.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Minimal HS256 JWT verification with WebCrypto (no external deps). */
async function verifySupabaseJwt(token: string, secret: string): Promise<{ sub: string } | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const header = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(headerB64)),
    );
    if (header.alg !== "HS256") return null;

    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const okSig = await crypto.subtle.verify(
      "HMAC",
      key,
      base64urlToBytes(sigB64),
      enc.encode(`${headerB64}.${payloadB64}`),
    );
    if (!okSig) return null;

    const payload = JSON.parse(
      new TextDecoder().decode(base64urlToBytes(payloadB64)),
    );
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    if (typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

function base64urlToBytes(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(pad);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ ok: false, message: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const jwtSecret = Deno.env.get("SUPABASE_JWT_SECRET");
  if (!supabaseUrl || !serviceRoleKey || !jwtSecret) {
    return json(
      { ok: false, message: "Server environment is missing Supabase configuration." },
      500,
    );
  }

  // --- Auth -----------------------------------------------------------
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return json({ ok: false, message: "Missing authorization" }, 401);
  const user = await verifySupabaseJwt(token, jwtSecret);
  if (!user) return json({ ok: false, message: "Invalid or expired token" }, 401);

  const body = (await req.json().catch(() => null)) as {
    material_id?: string;
  } | null;
  const materialId = body?.material_id;
  if (!materialId) return json({ ok: false, message: "material_id is required" }, 400);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  // --- Ownership --------------------------------------------------------
  const { data: material, error: matErr } = await admin
    .from("uploaded_materials")
    .select("id, student_id, file_name, storage_path, mime_type, processing_status")
    .eq("id", materialId)
    .maybeSingle();
  if (matErr || !material) {
    return json({ ok: false, message: "Material not found." }, 404);
  }
  if (material.student_id !== user.sub) {
    return json({ ok: false, message: "You can only process your own materials." }, 403);
  }

  // --- Read the original (read-only; never modified) --------------------
  const { data: file, error: dlErr } = await admin.storage
    .from("student-materials")
    .download(material.storage_path);
  if (dlErr || !file) {
    const msg = `Could not read the uploaded file (${dlErr?.message ?? "unknown"}).`;
    await admin
      .from("uploaded_materials")
      .update({ processing_status: "failed", processing_error: msg })
      .eq("id", materialId);
    return json({ ok: false, message: msg }, 502);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  const text = new TextDecoder().decode(buffer);

  // --- Extract ----------------------------------------------------------
  const extracted = extractFromText(
    text,
    material.file_name ?? "upload",
    material.mime_type,
  );

  if (!extracted.supported || !extracted.result) {
    // Honest pending state — leave status 'pending', record the reason.
    const reason = extracted.reason ?? "Unsupported format.";
    await admin
      .from("uploaded_materials")
      .update({ processing_status: "pending", processing_error: reason })
      .eq("id", materialId);
    return json({ ok: false, message: reason }, 200);
  }

  const { result } = extracted;
  const rows = result.items.map((it) => ({
    material_id: materialId,
    item_type: it.item_type,
    content: it.content,
    heading: it.heading,
    source_page: it.source_page,
    confidence: it.confidence,
  }));

  // Replace previous extraction for this material (idempotent re-runs).
  await admin.from("extracted_content").delete().eq("material_id", materialId);
  if (rows.length) {
    const { error: insErr } = await admin.from("extracted_content").insert(rows);
    if (insErr) {
      const msg = `Extraction stored ${rows.length} items but some rows failed: ${insErr.message}`;
      await admin
        .from("uploaded_materials")
        .update({ processing_status: "failed", processing_error: msg })
        .eq("id", materialId);
      return json({ ok: false, message: msg }, 500);
    }
  }

  await admin
    .from("uploaded_materials")
    .update({
      processing_status: "ready",
      processing_error: null,
      extracted_text: text.slice(0, 200_000), // cap stored text
      page_count: result.pageCount,
    })
    .eq("id", materialId);

  return json({
    ok: true,
    message: `Extracted ${rows.length} items from your document.`,
  });
});
