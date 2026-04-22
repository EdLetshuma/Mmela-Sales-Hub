/**
 * Mmela Hub — Data Normalisation Utilities
 *
 * Mirrors the PostgreSQL normalise_* functions in the DB.
 * Call these before saving any user input so data is clean
 * both client-side and at the DB trigger level.
 */

// ── Phone ──────────────────────────────────────────────────────────
// Handles:
//   '0609807497  → 0609807497  (Excel apostrophe)
//   +27834601445 → 0834601445  (international)
//   27834601445  → 0834601445  (no + international)
//   823006290    → 0823006290  (9-digit missing leading 0)
//   082 043 4312 → 0820434312  (spaces)
//   082-043-4312 → 0820434312  (dashes)
export function normalisePhone(raw: string | null | undefined): string {
  if (!raw) return "";

  // Strip leading apostrophe (Excel CSV artifact)
  let p = raw.trim().replace(/^'/, "");

  // Remove spaces, dashes, dots, parentheses
  p = p.replace(/[\s\-\.\(\)]/g, "");

  // +27xx → 0xx
  if (p.startsWith("+27")) p = "0" + p.slice(3);

  // 27xxxxxxxxx (no +) → 0xx
  if (/^27[6-8][0-9]{8}$/.test(p)) p = "0" + p.slice(2);

  // 9-digit missing leading 0 (starts with 6/7/8)
  if (/^[6-8][0-9]{8}$/.test(p)) p = "0" + p;

  return p;
}

// ── Email ──────────────────────────────────────────────────────────
// Lowercases and trims. Returns empty string for placeholder emails.
export function normaliseEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const e = raw.trim().toLowerCase();
  if (e.includes("@placeholder.com")) return "";
  return e;
}

// ── Name ───────────────────────────────────────────────────────────
// Title-cases ALL CAPS or all-lower names.
// Strips bracketed notes like "(Lost Policy)".
export function normaliseName(raw: string | null | undefined): string {
  if (!raw) return "";

  // Remove bracketed suffixes
  let n = raw.trim().replace(/\s*\([^)]*\)\s*$/g, "").trim();
  if (!n) return raw.trim();

  // Title-case only if ALL CAPS or all lowercase
  if (n === n.toUpperCase() || n === n.toLowerCase()) {
    n = n
      .split(" ")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  return n;
}

// ── Master normalise — call this on any lead/client object ─────────
export function normaliseContact<T extends {
  name?: string;
  email?: string;
  phone?: string | null;
}>(data: T): T {
  return {
    ...data,
    name:  data.name  !== undefined ? normaliseName(data.name)   : data.name,
    email: data.email !== undefined ? normaliseEmail(data.email) : data.email,
    phone: data.phone !== undefined ? normalisePhone(data.phone) : data.phone,
  };
}
