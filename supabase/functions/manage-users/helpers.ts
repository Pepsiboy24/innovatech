// Pure helpers for the manage-users Edge Function (no network, easy to test).

/** Lowercase, strip accents and anything that isn't a-z / 0-9. */
export function slug(s: string): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export type NameOrder = "first_surname" | "surname_first";

export interface NameParts {
  first: string;
  middle: string;
  last: string;
}

/**
 * Split a full name into parts.
 * first_surname : "Amina Grace Bello" -> first Amina, middle Grace, last Bello
 * surname_first : "Bello Amina Grace" -> first Amina, middle Grace, last Bello
 */
export function splitName(full: string, order: NameOrder = "first_surname"): NameParts {
  const tokens = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { first: "", middle: "", last: "" };
  if (tokens.length === 1) return { first: tokens[0], middle: "", last: "" };
  if (order === "surname_first") {
    return { last: tokens[0], first: tokens[1], middle: tokens.slice(2).join(" ") };
  }
  return { first: tokens[0], middle: tokens.slice(1, -1).join(" "), last: tokens[tokens.length - 1] };
}

/**
 * Candidate usernames in the order we try them:
 *   amina.bello  ->  amina.g.bello (middle initial)  ->  amina.bello2 ... amina.bello99
 */
export function usernameCandidates(p: NameParts): string[] {
  const f = slug(p.first);
  const l = slug(p.last);
  const m = slug(p.middle);
  const base = l ? `${f}.${l}` : f;
  if (!base) return [];
  const out = [base];
  if (m && l) out.push(`${f}.${m[0]}.${l}`);
  for (let n = 2; n <= 99; n++) out.push(`${base}${n}`);
  return out;
}

/** Pick the first candidate not in `taken`, and add it to `taken`. */
export function pickUsername(p: NameParts, taken: Set<string>): string | null {
  for (const c of usernameCandidates(p)) {
    if (!taken.has(c)) {
      taken.add(c);
      return c;
    }
  }
  return null;
}

/** Nigerian phone -> 234XXXXXXXXXX, or '' if it doesn't look like one. */
export function normalizePhone(raw: string | null | undefined): string {
  const d = String(raw ?? "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("234") && d.length === 13) return d;
  if (d.startsWith("0") && d.length === 11) return "234" + d.slice(1);
  if (d.length === 10) return "234" + d;
  return "";
}

// No 0/O, 1/l/I or other look-alikes: these get printed on cards and read by children.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function randomPassword(length = 8): string {
  const buf = new Uint8Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (const b of buf) out += ALPHABET[b % ALPHABET.length];
  return out;
}

/** "Primary 3 A", "primary3a" and "PRIMARY 3A" all match class_name "Primary 3" + section "A". */
export function matchClassId(
  input: string | null | undefined,
  classes: { class_id: string; class_name: string; section?: string | null }[],
): string | null {
  if (!input) return null;
  const clean = String(input).toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;
  const hit = classes.find((c) =>
    ((c.class_name ?? "") + (c.section ?? "")).toUpperCase().replace(/[^A-Z0-9]/g, "") === clean
  );
  return hit ? hit.class_id : null;
}

/** Build a short school login code from the school name, e.g. "Mando Model School" -> "mms". */
export function schoolCodeFrom(name: string): string {
  const words = (name ?? "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let code = words.length > 1 ? words.map((w) => w[0]).join("") : (words[0] ?? "sch");
  code = code.slice(0, 6);
  if (code.length < 3) code = (code + "sch").slice(0, 3);
  return code;
}
