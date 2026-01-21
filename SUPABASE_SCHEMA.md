School_Admin
admin_id — uuid (default: gen_random_uuid()) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
email — character varying (varchar) — nullable
role — text — nullable
permissions_json — jsonb — nullable
phone_number — text — nullable
last_login — timestamp without time zone — nullable
full_name — character varying (varchar) — nullable
Teachers
last_name — character varying (varchar) — nullable
date_of_birth — date — nullable
teacher_id — uuid (default: gen_random_uuid()) — PRIMARY KEY
address — text — nullable
created_at — timestamp with time zone (timestamptz) (default: now())
first_name — character varying (varchar) — nullable
marital_status — character varying (varchar) — nullable
trcn_reg_number — character varying (varchar) — nullable
email — character varying (varchar) — nullable
gender — character varying (varchar) — nullable
phone_number — character varying (varchar) — nullable
date_hired — date — nullable
profile_picture — character varying (varchar) — nullable
Foreign keys referencing Teachers.teacher_id:

public.Classes.teacher_id
public.emergency_contact.teacher_id
public.work_experience.teacher_id
public.school_employment.teacher_id
public.Attendance.recorded_by_user_id
Classes
teacher_id — uuid — nullable
class_id — integer (identity BY DEFAULT) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
class_name — character varying (varchar) — nullable
section — character varying (varchar) — nullable
Foreign keys referencing Classes.class_id:

public.Class_Subjects.class_id
public.schedule_configs.class_id
public.timetable_entries.class_id
public.Students.class_id
Subjects
subject_id — uuid (default: gen_random_uuid()) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
subject_name — character varying (varchar) — nullable
is_core — boolean (default: false) — nullable
Foreign keys referencing Subjects.subject_id:

public.student_subject.subject_id
public.Class_Subjects.subject_id
public.timetable_entries.subject_id
Students
admission_date — date — nullable
profile_picture — character varying (varchar) — nullable
total_points — integer — nullable
class_id — integer — nullable — (FK → public.Classes.class_id)
student_id — uuid (default: gen_random_uuid()) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
full_name — character varying (varchar) — nullable
date_of_birth — date — nullable
gender — text — nullable
Foreign keys referencing Students.student_id:

public.student_subject.student_id
public.Attendance.student_id
Class_Subjects (RLS enabled)
class_subjects__id — uuid (default: gen_random_uuid()) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
class_id — integer — nullable — (FK → public.Classes.class_id)
subject_id — uuid (default: gen_random_uuid()) — nullable — (FK → public.Subjects.subject_id)
student_subject (RLS enabled)
subject_id — uuid (default: gen_random_uuid()) — nullable — (FK → public.Subjects.subject_id)
student_id — uuid (default: gen_random_uuid()) — nullable — (FK → public.Students.student_id)
student_subject_id — uuid (default: gen_random_uuid()) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
emergency_contact
teacher_id — uuid — nullable — (FK → public.Teachers.teacher_id)
contact_id — bigint (identity BY DEFAULT) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
name — character varying (varchar) — nullable
relationship — character varying (varchar) — nullable
phone_number — character varying (varchar) — nullable
address — text — nullable
qualifications
qualification_id — bigint (identity BY DEFAULT) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
teacher_id — uuid — nullable
school_name — character varying (varchar) — nullable
certificate_name — character varying (varchar) — nullable
feild_of_study — character varying (varchar) — nullable
graduation_year — integer — nullable
work_experience
professional_development — text — nullable
position_held — character varying (varchar) — nullable
duration — character varying (varchar) — nullable
total_experience — character varying (varchar) — nullable
experience_id — bigint (identity BY DEFAULT) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
teacher_id — uuid — nullable — (FK → public.Teachers.teacher_id)
school_name — character varying (varchar) — nullable
school_employment
employment_id — bigint (identity BY DEFAULT) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
teacher_id — uuid — nullable — (FK → public.Teachers.teacher_id)
start_date — date — nullable
job_title — character varying (varchar) — nullable
contract_type — character varying (varchar) — nullable
salary — numeric — nullable
study_materials (RLS enabled)
title — character varying (varchar)
subject — character varying (varchar)
type — character varying (varchar)
description — text — nullable
file_url — text
file_path — text
file_size — bigint
file_type — character varying (varchar)
uploaded_by — character varying (varchar)
id — integer (default: nextval('study_materials_id_seq'::regclass)) — PRIMARY KEY
uploaded_at — timestamp with time zone (timestamptz) (default: now()) — nullable
academic_events
id — bigint (identity BY DEFAULT) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now())
term_period — text — nullable
activity_event — text — nullable
start_date — date — nullable
end_date — date — nullable
duration — text — nullable
remarks — text — nullable
academic_session — text — nullable
Attendance (RLS enabled)
id — bigint (identity BY DEFAULT) — PRIMARY KEY
student_id — uuid — nullable — (FK → public.Students.student_id)
record_at — timestamp with time zone (timestamptz) (default: now())
date — date — nullable
attendance_status — text — nullable
notes — text — nullable
recorded_by_user_id — uuid — nullable — (FK → public.Teachers.teacher_id)
timetable_entries
subject_id — uuid — nullable — (FK → public.Subjects.subject_id)
class_id — integer — nullable — (FK → public.Classes.class_id)
day_of_week — character varying (varchar)
start_time — time without time zone
id — uuid (default: extensions.uuid_generate_v4()) — PRIMARY KEY
duration_minutes — integer (default: 40) — nullable
created_at — timestamp with time zone (timestamptz) (default: now()) — nullable
schedule_configs
class_id — integer — nullable — UNIQUE — (FK → public.Classes.class_id)
start_time — time without time zone
period_duration — integer
periods_per_day — integer
active_days — text[] (ARRAY) — nullable
break_times — jsonb — nullable
id — uuid (default: extensions.uuid_generate_v4()) — PRIMARY KEY
created_at — timestamp with time zone (timestamptz) (default: now()) — nullable