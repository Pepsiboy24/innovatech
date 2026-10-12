-- Term & session management.
-- Run in the Supabase SQL editor. Safe to re-run.

-- 1. Remember which class each student was in during each term
alter table public."Termly_Enrollment" add column if not exists class_id int4 references public."Classes"(class_id);

-- one row per student per term
create unique index if not exists termly_enrollment_student_term_uq
  on public."Termly_Enrollment" (student_id, academic_session, term);

-- 2. Start a term (or a new session). The school is taken from the logged-in admin,
--    never from a parameter.
create or replace function public.start_term(p_session text, p_term text, p_next_start date default null)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_school uuid;
  v_count int;
begin
  if p_term not in ('First Term', 'Second Term', 'Third Term') then
    raise exception 'Term must be First Term, Second Term or Third Term.';
  end if;
  if p_session !~ '^\d{4}/\d{4}$' then
    raise exception 'Session must look like 2026/2027.';
  end if;

  -- caller must be a school admin (matched by login id, or by email for older rows)
  select school_id into v_school
    from public."School_Admin"
   where admin_id = auth.uid() or lower(email) = lower(auth.jwt() ->> 'email')
   limit 1;
  if v_school is null then
    raise exception 'Only school admins can change the term.';
  end if;

  update public."Schools"
     set current_session = p_session,
         current_term = p_term,
         next_term_start_date = p_next_start
   where school_id = v_school;

  -- snapshot every active student's class for this term (re-running updates it)
  insert into public."Termly_Enrollment" (student_id, school_id, academic_session, term, is_active, class_id)
  select s.student_id, v_school, p_session, p_term, true, s.class_id
    from public."Students" s
   where s.school_id = v_school
     and coalesce(s.enrollment_status, 'active') = 'active'
  on conflict (student_id, academic_session, term)
  do update set class_id = excluded.class_id, is_active = true;

  get diagnostics v_count = row_count;
  return jsonb_build_object('session', p_session, 'term', p_term, 'students_enrolled', v_count);
end;
$$;

revoke all on function public.start_term(text, text, date) from public;
grant execute on function public.start_term(text, text, date) to authenticated;
