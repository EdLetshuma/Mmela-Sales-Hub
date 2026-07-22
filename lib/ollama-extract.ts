// Calls a self-hosted Ollama server to pull structured fields out of a
// policy document's raw text. The model only ever sees the extracted text
// (never the file itself), and is asked to return strict JSON — no chained
// tool calls, no code execution, nothing that could act on the server.

export interface ExtractedPolicyData {
  client_name?: string;
  client_id_number?: string;
  client_email?: string;
  client_phone?: string;
  policy_number?: string;
  insurer?: string;
  product_name?: string;
  base_premium?: number;
  inception_date?: string;
}

const EXTRACTION_FIELDS = [
  "client_name", "client_id_number", "client_email", "client_phone",
  "policy_number", "insurer", "product_name", "base_premium", "inception_date",
] as const;

function buildPrompt(documentText: string): string {
  return `You extract structured data from South African insurance policy documents.
Read the document text below and return ONLY a JSON object with these exact keys
(use null for anything not present in the document — never guess or invent a value):

${EXTRACTION_FIELDS.map((f) => `- ${f}`).join("\n")}

Rules:
- base_premium must be a plain number (no currency symbol, no commas), or null.
- inception_date must be in YYYY-MM-DD format, or null.
- Return nothing except the JSON object — no markdown, no explanation.

DOCUMENT TEXT:
"""
${documentText}
"""`;
}

export async function extractPolicyDataFromText(documentText: string): Promise<ExtractedPolicyData> {
  const baseUrl = process.env.OLLAMA_API_URL;
  if (!baseUrl) {
    throw new Error("OLLAMA_API_URL is not configured on the server.");
  }

  const res = await fetch(`${baseUrl.replace(/\/$/, "")}/api/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.OLLAMA_API_KEY ? { Authorization: `Bearer ${process.env.OLLAMA_API_KEY}` } : {}),
    },
    body: JSON.stringify({
      model: process.env.OLLAMA_MODEL || "qwen2.5:7b",
      prompt: buildPrompt(documentText.slice(0, 4000)),
      format: "json",
      stream: false,
      options: { temperature: 0, num_predict: 300 },
    }),
    signal: AbortSignal.timeout(55_000),
  });

  if (!res.ok) {
    throw new Error(`Ollama server returned ${res.status}`);
  }

  const payload = await res.json();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(payload.response);
  } catch {
    throw new Error("Model did not return valid JSON.");
  }

  const result: ExtractedPolicyData = {};
  for (const field of EXTRACTION_FIELDS) {
    const value = parsed[field];
    if (value === null || value === undefined || value === "") continue;
    if (field === "base_premium") {
      const num = Number(value);
      if (!isNaN(num)) result.base_premium = num;
    } else {
      (result as Record<string, unknown>)[field] = String(value);
    }
  }
  return result;
}
