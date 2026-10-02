// manage-users: creates and manages accounts on the SERVER, so that
//  - the school_id/user_type come from the database, never from the browser
//  - passwords are random (never "123456") and must be changed on first login
//  - the admin's own browser session is never touched
//  - a failed step rolls back, so no orphaned logins are left behind
//
// Actions (POST JSON; create_students: admin or teacher, the rest: admin only):
//   create_students  { rows[], name_order?, dry_run? }
//   create_staff     { type: 'teacher' | 'school_admin', email, profile, qualifications? }
//   reset_password   { user_id }
//
// Secrets to set (supabase secrets set ...):
//   LOGIN_EMAIL_DOMAIN   a domain you own, same value as core/loginIdentity.js
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { createClient } from "npm:@supabase/supabase-js@2";
import {
  matchClassId,
  type NameOrder,
  normalizePhone,
  pickUsername,
  randomPassword,
  schoolCodeFrom,
  splitName,
} from "./helpers.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOGIN_DOMAIN = (Deno.env.get("LOGIN_EMAIL_DOMAIN") ?? "").trim().toLowerCase();

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_ROWS = 50;

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

// ── Who is calling? Trust the database, not the token's metadata. ─────────
type Role = "school_admin" | "teacher";

async function getCaller(req: Request): Promise<{ userId: string; schoolId: string; role: Role }> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) throw new HttpError(401, "Not signed in.");
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, "Your session has expired. Sign in again.");
  const userId = data.user.id;

  const { data: adminRow, error: adminErr } = await admin
    .from("School_Admin").select("school_id").eq("admin_id", userId).maybeSingle();
  if (adminErr) throw new HttpError(500, "Could not verify your account: " + adminErr.message);
  if (adminRow?.school_id) return { userId, schoolId: adminRow.school_id as string, role: "school_admin" };

  const { data: teacherRow } = await admin
    .from("Teachers").select("school_id").eq("teacher_id", userId).maybeSingle();
  if (teacherRow?.school_id) return { userId, schoolId: teacherRow.school_id as string, role: "teacher" };

  throw new HttpError(403, "Only school staff can do this.");
}

function requireAdmin(role: Role) {
  if (role !== "school_admin") throw new HttpError(403, "Only school admins can do this.");
}

function requireDomain() {
  if (!LOGIN_DOMAIN || LOGIN_DOMAIN.startsWith("change-me")) {
    throw new HttpError(500, "LOGIN_EMAIL_DOMAIN secret is not set on this function.");
  }
}

// ── School code (the "@afm" part of a student's login) ────────────────────
async function ensureSchoolCode(schoolId: string): Promise<string> {
  const { data: school, error } = await admin
    .from("Schools")
    .select("school_name, login_code")
    .eq("school_id", schoolId)
    .single();
  if (error || !school) throw new HttpError(500, "School not found.");
  if (school.login_code) return String(school.login_code).toLowerCase();

  const base = schoolCodeFrom(school.school_name ?? "school");
  for (let i = 0; i < 25; i++) {
    const code = i === 0 ? base : base.slice(0, 6) + (10 + Math.floor(Math.random() * 90));
    const { count } = await admin
      .from("Schools")
      .select("school_id", { count: "exact", head: true })
      .ilike("login_code", code);
    if (!count) {
      const { error: upErr } = await admin.from("Schools").update({ login_code: code }).eq("school_id", schoolId);
      if (!upErr) return code;
    }
  }
  throw new HttpError(500, "Could not generate a school login code.");
}

async function existingUsernames(schoolId: string): Promise<Set<string>> {
  const taken = new Set<string>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from("Students")
      .select("username")
      .eq("school_id", schoolId)
      .not("username", "is", null)
      .range(from, from + 999);
    if (error) throw new HttpError(500, "Could not read existing usernames: " + error.message);
    for (const r of data ?? []) taken.add(String(r.username).toLowerCase());
    if (!data || data.length < 1000) break;
  }
  return taken;
}

async function deleteAuthUser(id: string | undefined) {
  if (id) await admin.auth.admin.deleteUser(id).catch(() => {});
}

// ── create_students ───────────────────────────────────────────────────────
interface ParentIn {
  full_name?: string;
  email?: string;
  phone?: string;
  relationship?: string;
  address?: string;
}
interface StudentIn {
  full_name?: string;
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  gender?: string;
  date_of_birth?: string | null;
  admission_date?: string | null;
  admission_number?: string;
  class_input?: string;
  class_id?: string;
  parent?: ParentIn | null;
}

// ilike treats _ and % as wildcards; emails often contain "_", so escape them.
const escapeLike = (v: string) => v.replace(/[\\%_]/g, "\\$&");

async function findParent(schoolId: string, email: string | null, phone: string) {
  if (email) {
    const { data } = await admin.from("Parents").select("parent_id").eq("school_id", schoolId).ilike("email", escapeLike(email)).limit(1);
    if (data?.length) return data[0].parent_id as string;
  }
  if (phone) {
    const last10 = phone.slice(-10);
    const { data } = await admin.from("Parents").select("parent_id, phone_number").eq("school_id", schoolId).ilike("phone_number", `%${last10}`).limit(1);
    if (data?.length) return data[0].parent_id as string;
  }
  return null;
}

async function createStudents(schoolId: string, body: { rows?: StudentIn[]; name_order?: NameOrder; dry_run?: boolean }) {
  requireDomain();
  const rows = body.rows ?? [];
  if (!Array.isArray(rows) || rows.length === 0) throw new HttpError(400, "No rows sent.");
  if (rows.length > MAX_ROWS) throw new HttpError(400, `Send at most ${MAX_ROWS} students per request.`);

  const order: NameOrder = body.name_order === "surname_first" ? "surname_first" : "first_surname";
  const dry = body.dry_run === true;
  const schoolCode = await ensureSchoolCode(schoolId);
  const taken = await existingUsernames(schoolId);

  const { data: classes } = await admin.from("Classes").select("class_id, class_name, section").eq("school_id", schoolId);

  const results: Record<string, unknown>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fullName = (r.full_name ?? `${r.first_name ?? ""} ${r.last_name ?? ""}`).trim();
    if (!fullName) {
      results.push({ index: i, ok: false, error: "Missing name." });
      continue;
    }

    const parts = r.first_name && r.last_name
      ? { first: r.first_name, middle: r.middle_name ?? "", last: r.last_name }
      : splitName(fullName, order);

    const username = pickUsername(parts, taken);
    if (!username) {
      results.push({ index: i, ok: false, full_name: fullName, error: "Could not make a unique username." });
      continue;
    }

    const classId = r.class_id ?? matchClassId(r.class_input, classes ?? []);
    const classMatched = !r.class_input && !r.class_id ? null : classId !== null;
    const loginName = `${username}@${schoolCode}`;
    const planned = { index: i, full_name: fullName, username, login: loginName, class_id: classId, class_matched: classMatched };

    if (dry) {
      results.push({ ...planned, ok: true, dry_run: true });
      continue;
    }

    const warnings: string[] = [];
    if (classMatched === false) warnings.push(`Class "${r.class_input}" not found, student left without a class.`);

    // 1. login
    const password = randomPassword(8);
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email: `${username}@${schoolCode}.${LOGIN_DOMAIN}`,
      password,
      email_confirm: true,
      app_metadata: { school_id: schoolId, user_type: "student", must_change_password: true },
      // user_metadata copy kept so existing rules/pages keep working until you switch them to app_metadata
      user_metadata: { full_name: fullName, school_id: schoolId, user_type: "student", username },
    });
    if (authErr || !created.user) {
      taken.delete(username);
      results.push({ ...planned, ok: false, error: authErr?.message ?? "Could not create login." });
      continue;
    }
    const studentId = created.user.id;

    // 2. profile (roll the login back if this fails)
    const { error: insErr } = await admin.from("Students").insert([{
      student_id: studentId,
      full_name: fullName,
      gender: r.gender || null,
      date_of_birth: r.date_of_birth || null,
      admission_date: r.admission_date || new Date().toISOString().split("T")[0],
      admission_number: r.admission_number?.toString().trim() || null,
      school_id: schoolId,
      class_id: classId,
      username,
      profile_picture: "https://placehold.co/150x150?text=Profile",
      enrollment_status: "active",
    }]);
    if (insErr) {
      await deleteAuthUser(studentId);
      taken.delete(username);
      results.push({ ...planned, ok: false, error: insErr.message });
      continue;
    }

    // 3. parent (a parent problem never undoes the student)
    let parentOut: Record<string, unknown> | null = null;
    const p = r.parent;
    const pEmail = p?.email?.trim().toLowerCase() || null;
    const pPhone = normalizePhone(p?.phone);
    if (p && p.full_name && (pEmail || pPhone)) {
      let parentAuthId: string | undefined;
      try {
        let parentId = await findParent(schoolId, pEmail, pPhone);
        let parentCreated = false;
        let parentPassword: string | undefined;
        let parentLogin = pEmail ?? p.phone ?? "";

        if (!parentId) {
          parentPassword = randomPassword(8);
          const parentLoginEmail = pEmail ?? `${pPhone}@parents.${LOGIN_DOMAIN}`;
          const { data: pAuth, error: pAuthErr } = await admin.auth.admin.createUser({
            email: parentLoginEmail,
            password: parentPassword,
            email_confirm: true,
            app_metadata: { school_id: schoolId, user_type: "parent", must_change_password: true },
            user_metadata: { full_name: p.full_name, school_id: schoolId, user_type: "parent" },
          });
          if (pAuthErr || !pAuth.user) {
            throw new Error(
              /already|registered|exists/i.test(pAuthErr?.message ?? "")
                ? "That parent email/phone already has a login that is not linked to this school."
                : (pAuthErr?.message ?? "Could not create parent login."),
            );
          }
          parentAuthId = pAuth.user.id;
          const { data: newParent, error: pInsErr } = await admin.from("Parents").insert([{
            user_id: parentAuthId,
            full_name: p.full_name,
            email: pEmail,
            phone_number: p.phone ?? null,
            address: p.address ?? null,
            school_id: schoolId,
          }]).select("parent_id").single();
          if (pInsErr) throw new Error(pInsErr.message);
          parentId = newParent.parent_id;
          parentCreated = true;
        }

        const { error: linkErr } = await admin.from("Parent_Student_Links").insert([{
          parent_id: parentId,
          student_id: studentId,
          relationship: p.relationship || "Guardian",
        }]);
        if (linkErr) throw new Error("Could not link parent: " + linkErr.message);

        parentOut = parentCreated
          ? { created: true, login: parentLogin, password: parentPassword }
          : { created: false, note: "Linked to an existing parent account." };
      } catch (e) {
        await deleteAuthUser(parentAuthId);
        warnings.push("Parent not created: " + (e as Error).message);
      }
    }

    results.push({ ...planned, ok: true, student_id: studentId, password, parent: parentOut, warnings });
  }

  return { ok: true, dry_run: dry, school_code: schoolCode, results };
}

// ── create_staff ──────────────────────────────────────────────────────────
async function createStaff(schoolId: string, body: {
  type?: string;
  email?: string;
  profile?: Record<string, unknown>;
  qualifications?: Record<string, unknown> | null;
}) {
  const type = body.type;
  if (type !== "teacher" && type !== "school_admin") throw new HttpError(400, "type must be 'teacher' or 'school_admin'.");
  const email = (body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "A valid email is required for staff.");
  const profile = body.profile ?? {};

  const password = randomPassword(10);
  const { data: created, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { school_id: schoolId, user_type: type, must_change_password: true },
    user_metadata: {
      full_name: (profile.full_name as string) ?? `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim(),
      school_id: schoolId,
      user_type: type,
    },
  });
  if (authErr || !created.user) {
    throw new HttpError(400, /already|registered|exists/i.test(authErr?.message ?? "")
      ? "That email already has an account."
      : (authErr?.message ?? "Could not create login."));
  }
  const id = created.user.id;

  if (type === "teacher") {
    const allowed = ["first_name", "last_name", "phone_number", "date_hired", "date_of_birth", "address", "trcn_reg_number", "gender"];
    const row: Record<string, unknown> = { teacher_id: id, email, school_id: schoolId };
    for (const k of allowed) if (profile[k] !== undefined) row[k] = profile[k];
    const { error } = await admin.from("Teachers").insert([row]);
    if (error) {
      await deleteAuthUser(id);
      throw new HttpError(400, error.message);
    }
    if (body.qualifications) {
      const { error: qErr } = await admin.from("qualifications").insert([{ ...body.qualifications, teacher_id: id }]);
      if (qErr) console.error("qualifications insert failed:", qErr.message);
    }
  } else {
    const row: Record<string, unknown> = { ...profile, admin_id: id, email, school_id: schoolId };
    const { error } = await admin.from("School_Admin").insert([row]);
    if (error) {
      await deleteAuthUser(id);
      throw new HttpError(400, error.message);
    }
  }

  return { ok: true, user_id: id, login: email, password };
}

// ── reset_password ────────────────────────────────────────────────────────
async function resetPassword(schoolId: string, body: { user_id?: string }) {
  const id = body.user_id;
  if (!id) throw new HttpError(400, "user_id is required.");

  // The target must belong to the caller's own school.
  const checks = [
    admin.from("Students").select("school_id").eq("student_id", id).maybeSingle(),
    admin.from("Teachers").select("school_id").eq("teacher_id", id).maybeSingle(),
    admin.from("Parents").select("school_id").eq("user_id", id).maybeSingle(),
    admin.from("School_Admin").select("school_id").eq("admin_id", id).maybeSingle(),
  ];
  const found = (await Promise.all(checks)).map((r) => r.data).find(Boolean);
  if (!found || found.school_id !== schoolId) throw new HttpError(404, "User not found in your school.");

  const { data: existing, error: getErr } = await admin.auth.admin.getUserById(id);
  if (getErr || !existing.user) throw new HttpError(404, "Login not found.");

  const password = randomPassword(8);
  const { error } = await admin.auth.admin.updateUserById(id, {
    password,
    app_metadata: { ...(existing.user.app_metadata ?? {}), must_change_password: true },
  });
  if (error) throw new HttpError(500, error.message);
  return { ok: true, user_id: id, password };
}

// ── router ────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    if (req.method !== "POST") throw new HttpError(405, "POST only.");
    const caller = await getCaller(req);
    const body = await req.json().catch(() => ({}));

    switch (body.action) {
      case "create_students": return json(await createStudents(caller.schoolId, body)); // admins and teachers
      case "create_staff": requireAdmin(caller.role); return json(await createStaff(caller.schoolId, body));
      case "reset_password": requireAdmin(caller.role); return json(await resetPassword(caller.schoolId, body));
      default: throw new HttpError(400, "Unknown action.");
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ ok: false, error: e.message }, e.status);
    console.error(e);
    return json({ ok: false, error: "Something went wrong on the server." }, 500);
  }
});
