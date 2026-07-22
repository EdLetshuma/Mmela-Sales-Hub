/**
 * POST /api/extract-policy
 * Accepts an uploaded policy document (PDF), extracts its text, and asks a
 * self-hosted Ollama model to pull out structured client/policy fields for
 * the Add Policy form to pre-fill. Requires a logged-in user — this calls
 * out to a CPU-hosted model, so it must not be reachable anonymously.
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { PDFParse } from "pdf-parse";
import { extractPolicyDataFromText } from "@/lib/ollama-extract";

export const runtime = "nodejs";
export const maxDuration = 120;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json({ error: "Only PDF files are supported" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string;
  try {
    const parser = new PDFParse({ data: buffer });
    const result = await parser.getText();
    text = result.text;
  } catch {
    return NextResponse.json({ error: "Could not read this PDF" }, { status: 422 });
  }

  if (!text.trim()) {
    return NextResponse.json(
      { error: "No text found in this PDF — it may be a scanned image rather than a text document" },
      { status: 422 }
    );
  }

  try {
    const extracted = await extractPolicyDataFromText(text);
    return NextResponse.json(extracted);
  } catch (err) {
    console.error("Policy extraction failed:", err);
    return NextResponse.json(
      { error: "Extraction failed — check the Ollama server is reachable" },
      { status: 502 }
    );
  }
}
