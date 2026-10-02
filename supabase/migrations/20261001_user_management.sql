-- ═══════════════════════════════════════════════════════════════════════
-- User management migration
-- Run in the Supabase SQL editor, top to bottom, ONE SECTION AT A TIME.
-- I could not see your live database, so check the table names first:
-- the app calls .from('Students'), .from('Schools') etc., which means the
-- tables must be created with those exact capitalised (quoted) names.
-- If yours are lower-case, remove the double quotes below.
-- ═══════════════════════════════════════════════════════════════════════


-- ── 1. New columns ──────────────────────────────────────────────────────
alter table public."Students" add column if not exists username text;
alter table public."Students" add column if not exists admission_number text;
alter table public."Schools"  add column if not exists login_code text;

-- A username is unique inside one school; a school code is unique everywhere.
create unique index if not exists students_school_username_uq
    on public."Students" (school_id, lower(username)) where username is not null;
create unique index if not exists students_school_admission_uq
    on public."Students" (school_id, lower(admission_number)) where admission_number is not null;
create unique index if not exists schools_login_code_uq
    on public."Schools" (lower(login_code)) where login_code is not null;


-- ── 2. Clear the "must change password" flag (called by /change-password) ─
-- app_metadata can't be edited by the user, so a SECURITY DEFINER function
-- clears the flag for the caller only (auth.uid()).
create or replace function public.complete_password_change()
returns void
language sql
security definer
set search_path = public, auth
as $$
    update auth.users
       set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) - 'must_change_password'
     where id = auth.uid();
$$;

revoke all on function public.complete_password_change() from public;
grant execute on function public.complete_password_change() to authenticated;


-- ── 3. BEFORE backfilling: look for users whose self-claimed school differs
--      from the school their profile row says. Fix or delete these first,
--      otherwise the backfill would copy a tampered value into the trusted place.
--      Every query below should return ZERO rows.
select 'student' as kind, u.id, u.raw_user_meta_data->>'school_id' as claimed, s.school_id::text as actual
  from auth.users u join public."Students" s on s.student_id = u.id
 where (u.raw_user_meta_data->>'school_id') is distinct from s.school_id::text
union all
select 'teacher', u.id, u.raw_user_meta_data->>'school_id', t.school_id::text
  from auth.users u join public."Teachers" t on t.teacher_id = u.id
 where (u.raw_user_meta_data->>'school_id') is distinct from t.school_id::text
union all
select 'parent', u.id, u.raw_user_meta_data->>'school_id', p.school_id::text
  from auth.users u join public."Parents" p on p.user_id = u.id
 where (u.raw_user_meta_data->>'school_id') is distinct from p.school_id::text
union all
select 'school_admin', u.id, u.raw_user_meta_data->>'school_id', a.school_id::text
  from auth.users u join public."School_Admin" a on a.admin_id = u.id
 where (u.raw_user_meta_data->>'school_id') is distinct from a.school_id::text;


-- ── 4. Backfill app_metadata for existing users ─────────────────────────
-- Takes school_id and user_type from the PROFILE TABLES (the trusted source),
-- not from user_metadata.
update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('school_id', s.school_id, 'user_type', 'student')
  from public."Students" s where s.student_id = u.id;

update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('school_id', t.school_id, 'user_type', 'teacher')
  from public."Teachers" t where t.teacher_id = u.id;

update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('school_id', p.school_id, 'user_type', 'parent')
  from public."Parents" p where p.user_id = u.id;

update auth.users u
   set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
       || jsonb_build_object('school_id', a.school_id, 'user_type', 'school_admin')
  from public."School_Admin" a where a.admin_id = u.id;

-- Users who signed in before this migration keep their old JWT until it
-- refreshes (about an hour) or they sign in again. That is fine.


-- ── 5. NOT DONE HERE: row-level security ────────────────────────────────
-- Your policies probably read  auth.jwt() -> 'user_metadata' ->> 'school_id'.
-- Change them to          auth.jwt() -> 'app_metadata'  ->> 'school_id'
-- (and the same for user_type), test with two different schools, and only then
-- set STRICT_APP_METADATA = true in core/config.js.
-- Find the policies with:
--   select schemaname, tablename, policyname, qual, with_check
--     from pg_policies where qual ilike '%user_metadata%' or with_check ilike '%user_metadata%';
