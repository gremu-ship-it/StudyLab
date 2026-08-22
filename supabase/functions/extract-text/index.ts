// StudyLab — document text extraction Edge Function.
//
// Accepts { storagePath: string } for a file already uploaded to the
// `student-materials` bucket, OR a multipart/form-data upload under `file`.
// It returns { text, title, sections, keyTerms } that the client uses to
// build study units and questions.
//
// Deploy:  supabase functions deploy extract-text
// Secrets: none required. Set PDFJS_VERSION optionally.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const PDFJS_VERSION = "4.4.168";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeUtf8(buf: ArrayBuffer): string {
  return new TextDecoder("utf-8", { fatal: false }).decode(buf);
}

function decodeLatin1(buf: ArrayBuffer): string {
  return new TextDecoder("iso-8859-1").decode(buf);
}

/** Extract readable text from a PDF using pdf.js running in Deno. */
async function extractPdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs: any = await import(
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.min.mjs`
  );
  // Worker must be set for the main module in some environments.
  try {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.mjs`;
  } catch {
    /* worker optional for getDocument in Deno */
  }
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const pdf = await loadingTask.promise;
  const out: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((it: any) => ("str" in it ? it.str : "")).join(" ");
    out.push(pageText.replace(/\s+/g, " ").trim());
  }
  return out.filter(Boolean).join("\n\n");
}

/** Very light .docx/.pptx extraction: pull text runs from the zipped XML. */
async function extractOfficeZip(buf: ArrayBuffer, xmlPaths: string[]): Promise<string> {
  // Minimal unzip: locate the central directory and extract stored/deflated members.
  const bytes = new Uint8Array(buf);
  const files = await unzip(bytes);
  for (const name of xmlPaths) {
    const match = [...files.keys()].find((k) => k.endsWith(name));
    if (!match) continue;
    const xml = new TextDecoder().decode(files.get(match)!);
    // Word/PPT text lives in <w:t>…</w:t> or <a:t>…</a:t>.
    const runs = [...xml.matchAll(/<(?:w|a):t[^>]*>([\s\S]*?)<\/(?:w|a):t>/g)].map((m) =>
      m[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    );
    if (runs.length) return runs.join("\n");
  }
  return "";
}

/** Minimal ZIP reader supporting stored (0) and deflated (8) entries. */
async function unzip(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  const result = new Map<string, Uint8Array>();
  // Find End of Central Directory record.
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) {
      eocd = i; break;
    }
  }
  if (eocd < 0) return result;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const cdOffset = view.getUint32(eocd + 16, true);
  const cdCount = view.getUint16(eocd + 10, true);
  let p = cdOffset;
  for (let n = 0; n < cdCount; n++) {
    if (bytes[p] !== 0x50 || bytes[p + 1] !== 0x4b || bytes[p + 2] !== 0x01 || bytes[p + 3] !== 0x02) break;
    const method = view.getUint16(p + 10, true);
    const compSize = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true);
    const extraLen = view.getUint16(p + 30, true);
    const commentLen = view.getUint16(p + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(p + 46, p + 46 + nameLen));
    const localHeaderOffset = view.getUint32(p + 42, true);
    // Read local header to find data start.
    const lhNameLen = view.getUint16(localHeaderOffset + 26, true);
    const lhExtraLen = view.getUint16(localHeaderOffset + 28, true);
    const dataStart = localHeaderOffset + 30 + lhNameLen + lhExtraLen;
    const compressed = bytes.subarray(dataStart, dataStart + compSize);
    let data: Uint8Array;
    if (method === 0) {
      data = compressed;
    } else {
      try {
        const stream = new Blob([compressed]).stream().pipeThrough(
          // deno-lint-ignore no-explicit-any
          new (globalThis as any).DecompressionStream("deflate-raw")
        );
        data = new Uint8Array(await new Response(stream).arrayBuffer());
      } catch {
        p += 46 + nameLen + extraLen + commentLen;
        continue;
      }
    }
    result.set(name, data);
    p += 46 + nameLen + extraLen + commentLen;
  }
  return result;
}

async function extractText(fileName: string, mime: string, buf: ArrayBuffer): Promise<string> {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf") || mime === "application/pdf") return extractPdf(buf);
  if (lower.endsWith(".docx")) return extractOfficeZip(buf, ["word/document.xml"]);
  if (lower.endsWith(".pptx")) return extractOfficeZip(buf, ["ppt/slides/slide1.xml"]);
  if (lower.endsWith(".xlsx")) {
    // Shared strings first, then sheet inline strings.
    const ss = await extractOfficeZip(buf, ["xl/sharedStrings.xml"]);
    return ss;
  }
  if (lower.match(/\.(txt|md|csv|json|html?|xml)$/) || mime.startsWith("text/")) {
    return decodeUtf8(buf);
  }
  // Fall back to latin-1; unlikely to be useful but prevents a hard failure.
  return decodeLatin1(buf).replace(/[^\x20-\x7E\n\r\t]/g, " ").slice(0, 20000);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);

  const auth = req.headers.get("Authorization");
  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  try {
    let fileName = "";
    let mime = "";
    let buf: ArrayBuffer | null = null;

    const ct = req.headers.get("content-type") ?? "";
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file") as File | null;
      if (!file) return json({ error: "missing file" }, 400);
      fileName = file.name;
      mime = file.type;
      buf = await file.arrayBuffer();
    } else {
      const body = await req.json().catch(() => ({}));
      const storagePath: string | undefined = body.storagePath;
      if (!storagePath) return json({ error: "storagePath required" }, 400);
      const { data, error } = await serviceClient.storage.from("student-materials").download(storagePath);
      if (error || !data) return json({ error: error?.message ?? "not found" }, 404);
      fileName = storagePath.split("/").pop() ?? "document";
      mime = data.type;
      buf = await data.arrayBuffer();
    }

    const text = (await extractText(fileName, mime, buf)).slice(0, 120_000);
    return json({ title: fileName.replace(/\.[^.]+$/, ""), text, length: text.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
