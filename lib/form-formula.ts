// A small, safe arithmetic formula evaluator for calculated form fields —
// deliberately not eval()/Function(), since formulas are authored by
// whoever builds the form and evaluated in the visitor's browser.
// Supports: + - * / ( ), numeric literals, {field_key} references, and a
// couple of date helper functions (AGE, YEARS_SINCE) for age/vehicle-age
// style calculations.

type FieldLookup = (key: string) => string | undefined;

function yearsSince(dateStr: string | undefined): number {
  if (!dateStr) return 0;
  const then = new Date(dateStr);
  if (isNaN(then.getTime())) return 0;
  const now = new Date();
  let years = now.getFullYear() - then.getFullYear();
  const monthDiff = now.getMonth() - then.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < then.getDate())) years--;
  return years;
}

class FormulaParser {
  private pos = 0;
  constructor(private tokens: string[], private lookup: FieldLookup) {}

  private peek() { return this.tokens[this.pos]; }
  private next() { return this.tokens[this.pos++]; }

  parseExpression(): number {
    let value = this.parseTerm();
    while (this.peek() === "+" || this.peek() === "-") {
      const op = this.next();
      const rhs = this.parseTerm();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  }

  private parseTerm(): number {
    let value = this.parseFactor();
    while (this.peek() === "*" || this.peek() === "/") {
      const op = this.next();
      const rhs = this.parseFactor();
      value = op === "*" ? value * rhs : (rhs === 0 ? 0 : value / rhs);
    }
    return value;
  }

  private parseFactor(): number {
    const tok = this.peek();
    if (tok === "(") {
      this.next();
      const value = this.parseExpression();
      if (this.peek() === ")") this.next();
      return value;
    }
    if (tok === "-") { this.next(); return -this.parseFactor(); }
    if (tok === "AGE" || tok === "YEARS_SINCE") {
      this.next();
      if (this.peek() === "(") this.next();
      const argTok = this.next(); // a {field_key} reference resolved to its raw string during tokenizing
      if (this.peek() === ")") this.next();
      return yearsSince(argTok);
    }
    const raw = this.next();
    const num = Number(raw);
    return isNaN(num) ? 0 : num;
  }
}

function tokenize(formula: string, lookup: FieldLookup): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < formula.length) {
    const ch = formula[i];
    if (/\s/.test(ch)) { i++; continue; }
    if ("+-*/()".includes(ch)) { tokens.push(ch); i++; continue; }
    if (ch === "{") {
      const end = formula.indexOf("}", i);
      if (end === -1) break;
      const fieldKey = formula.slice(i + 1, end).trim();
      const raw = lookup(fieldKey);
      // AGE()/YEARS_SINCE() need the raw date string, not a numeric coercion —
      // push it as-is; parseFactor's date functions consume it directly.
      tokens.push(raw ?? "0");
      i = end + 1;
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < formula.length && /[A-Za-z_]/.test(formula[j])) j++;
      tokens.push(formula.slice(i, j));
      i = j;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      let j = i;
      while (j < formula.length && /[0-9.]/.test(formula[j])) j++;
      tokens.push(formula.slice(i, j));
      i = j;
      continue;
    }
    i++; // skip unrecognised character
  }
  return tokens;
}

export function evaluateFormula(formula: string, lookup: FieldLookup): number | null {
  if (!formula.trim()) return null;
  try {
    const tokens = tokenize(formula, lookup);
    const parser = new FormulaParser(tokens, lookup);
    const result = parser.parseExpression();
    return isNaN(result) ? null : result;
  } catch {
    return null;
  }
}
