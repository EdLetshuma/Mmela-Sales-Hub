export function normalisePhone(raw: string | null | undefined): string {
  if (!raw) return "";
  let p = raw.trim().replace(/^'/, "");
  p = p.replace(/[\s\-\.\(\)]/g, "");
  if (p.startsWith("+27")) p = "0" + p.slice(3);
  if (/^27[6-8][0-9]{8}$/.test(p)) p = "0" + p.slice(2);
  if (/^[6-8][0-9]{8}$/.test(p)) p = "0" + p;
  return p;
}
export function normaliseEmail(raw: string | null | undefined): string {
  if (!raw) return "";
  const e = raw.trim().toLowerCase();
  if (e.includes("@placeholder.com")) return "";
  return e;
}
export function normaliseName(raw: string | null | undefined): string {
  if (!raw) return "";
  let n = raw.trim().replace(/\s*\([^)]*\)\s*$/g, "").trim();
  if (!n) return raw.trim();
  if (n === n.toUpperCase() || n === n.toLowerCase()) {
    n = n.split(" ").filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }
  return n;
}
export function normaliseContact<T extends { name?: string; email?: string; phone?: string | null }>(data: T): T {
  return {
    ...data,
    name:  data.name  !== undefined ? normaliseName(data.name)   : data.name,
    email: data.email !== undefined ? normaliseEmail(data.email) : data.email,
    phone: data.phone !== undefined ? normalisePhone(data.phone) : data.phone,
  };
}
