Table of contents
Schemas summary
Installed extensions
auth schema (tables & columns)
storage schema (tables & columns)
vault schema (tables & columns)
realtime schema (tables & columns)
public schema (tables & columns — prioritized list)
Foreign key relationships (summary)
Notes for AI consumption
Change log
1. Schemas summary
realtime — Supabase realtime internal objects and messaging tables.
pgbouncer — Connection pooling metadata.
extensions — metadata for installed extensions.
vault — Supabase vault (secrets) tables.
graphql_public / graphql — GraphQL service objects.
auth — Authentication tables (managed by Supabase).
storage — Buckets, objects, and vector/index tables.
public — Application tables (students, teachers, schools, etc.).
2. Installed extensions
vector (default_version 0.8.0)
moddatetime
postgis (3.3.7)
pg_stat_statements (installed)
postgis_tiger_geocoder
intagg
insert_username
pg_cron
bloom
uuid-ossp (installed)
dict_int
pgtap
postgis_topology
dict_xsyn
address_standardizer
pgroonga
pg_freespacemap
autoinc
pg_repack
hypopg
pgjwt
pg_hashids
pgstattuple
fuzzystrmatch
plpgsql_check
file_fdw
lo
unaccent
pageinspect
rum
pg_surgery
tsm_system_rows
pg_jsonschema
cube
dblink
sslinfo
http
pgmq
pg_trgm
earthdistance
pgcrypto (installed)
pg_stat_monitor
pg_tle
hstore
intarray
tsm_system_time
ltree
address_standardizer_data_us
citext (installed)
pg_buffercache
pgaudit
index_advisor
supabase_vault (installed in vault schema)
tablefunc
btree_gin
postgres_fdw
pgsodium
refint
btree_gist
pgrowlocks
postgis_raster
pgroonga_database
wrappers
isn
plpgsql (installed)
amcheck
seg
pg_net
pgrouting
pg_walinspect
pg_prewarm
pg_visibility
pg_graphql (installed in graphql schema)
postgis_sfcgal
tcn
xml2
3. auth schema — tables & columns (selected)
auth.users (rls_enabled: true) — rows: 97

instance_id: uuid
id: uuid (PK)
aud: varchar
role: varchar
email: varchar
encrypted_password: varchar
email_confirmed_at: timestamptz
invited_at: timestamptz
confirmation_token: varchar
confirmation_sent_at: timestamptz
recovery_token: varchar
recovery_sent_at: timestamptz
email_change_token_new: varchar
email_change: varchar
email_change_sent_at: timestamptz
last_sign_in_at: timestamptz
raw_app_meta_data: jsonb
raw_user_meta_data: jsonb
is_super_admin: boolean
created_at: timestamptz
updated_at: timestamptz
phone: text (unique)
phone_confirmed_at: timestamptz
phone_change: text (default '')
phone_change_token: varchar (default '')
phone_change_sent_at: timestamptz
confirmed_at: timestamptz (generated: LEAST(email_confirmed_at, phone_confirmed_at))
email_change_token_current: varchar (default '')
email_change_confirm_status: smallint (default 0, check 0..2)
banned_until: timestamptz
reauthentication_token: varchar (default '')
reauthentication_sent_at: timestamptz
is_sso_user: boolean (default false)
deleted_at: timestamptz
is_anonymous: boolean (default false)
auth.refresh_tokens (rls_enabled: true)

id: bigint (PK, seq)
token: varchar (unique)
user_id: varchar
revoked: boolean
created_at: timestamptz
updated_at: timestamptz
parent: varchar
session_id: uuid (FK -> auth.sessions.id)
auth.sessions (rls_enabled: true)

id: uuid (PK)
user_id: uuid (FK -> auth.users.id)
created_at/updated_at: timestamptz
factor_id: uuid
aal: aal_level enum (aal1, aal2, aal3)
not_after: timestamptz
refreshed_at: timestamp
user_agent: text
ip: inet
tag: text
oauth_client_id: uuid (FK -> auth.oauth_clients.id)
refresh_token_hmac_key: text
refresh_token_counter: bigint
scopes: text (check length <= 4096)
auth.identities (rls_enabled: true)

id: uuid (PK, default gen_random_uuid())
provider_id: text
user_id: uuid (FK -> auth.users.id)
identity_data: jsonb
provider: text
last_sign_in_at: timestamptz
created_at/updated_at: timestamptz
email: generated lower((identity_data ->> 'email'))
Other auth tables: instances, audit_log_entries, schema_migrations, mfa_factors, mfa_challenges, mfa_amr_claims, sso_providers, sso_domains, saml_providers, saml_relay_states, flow_state, one_time_tokens, oauth_clients, oauth_authorizations, oauth_consents, oauth_client_states, custom_oauth_providers.

4. storage schema — tables & columns (selected)
storage.buckets (rls_enabled: true) — rows: 1

id: text (PK)
name: text
owner: uuid (deprecated)
owner_id: text
created_at: timestamptz (default now())
updated_at: timestamptz (default now())
public: boolean (default false)
avif_autodetection: boolean (default false)
file_size_limit: bigint
allowed_mime_types: text[]
type: buckettype enum (STANDARD, ANALYTICS, VECTOR) default 'STANDARD'
storage.objects (rls_enabled: true) — rows: 5

id: uuid (PK, default gen_random_uuid())
bucket_id: text (FK -> storage.buckets.id)
name: text
owner: uuid (deprecated)
owner_id: text
created_at: timestamptz (default now())
updated_at: timestamptz (default now())
last_accessed_at: timestamptz (default now())
metadata: jsonb
path_tokens: text[] (generated string_to_array(name, '/'))
version: text
user_metadata: jsonb
storage.s3_multipart_uploads / storage.s3_multipart_uploads_parts

s3_multipart_uploads: id text (PK), in_progress_size bigint default 0, upload_signature text, bucket_id text (FK), key text, version text, owner_id text, created_at, user_metadata jsonb
s3_multipart_uploads_parts: id uuid PK, upload_id text (FK), size bigint default 0, part_number int, bucket_id text, key text, etag text, owner_id text, created_at
storage.buckets_vectors, storage.vector_indexes (vector support)

storage.buckets_vectors: id text PK, type buckettype enum ('VECTOR'), created_at, updated_at, name, deleted_at
storage.vector_indexes: id text, name text, bucket_id text (FK -> buckets_vectors.id), data_type text, dimension int, distance_metric text, metadata_configuration jsonb, created_at/updated_at
storage.migrations (metadata table for storage migrations)

5. vault schema — tables & columns
vault.secrets (rls_enabled: false)

id: uuid PK (default gen_random_uuid())
name: text
description: text (default '')
secret: text (encrypted on disk)
key_id: uuid
nonce: bytea (default vault._crypto_aead_det_noncegen())
created_at/updated_at: timestamptz (default CURRENT_TIMESTAMP)
Supabase vault extension installed: supabase_vault (schema vault)_

6. realtime schema — tables & columns (selected)
realtime.messages (rls_enabled: true) — rows: 0

topic: text
extension: text
payload: jsonb
event: text
private: boolean (default false)
inserted_at: timestamp (PK part)
updated_at: timestamp
id: uuid (default gen_random_uuid()) — PK part
realtime.subscription, realtime.schema_migrations (internal)

7. public schema — tables & columns (selected, prioritized for AI context)
Use these lines when building context or embeddings for your AI model.

public.Schools (rls_enabled: true)

school_id: uuid PK (default gen_random_uuid())
school_name: varchar
school_logo_url: text
bank_name: varchar
account_number: varchar
bank_code: varchar
sub_account_code: varchar
commission_rate: numeric (default 1.5)
is_active: boolean (default true)
created_at: timestamptz (default now())
public.Teachers

teacher_id: uuid PK (default gen_random_uuid())
created_at: timestamptz (default now())
first_name: varchar
last_name: varchar
email: varchar
phone_number: varchar
date_hired: date
date_of_birth: date
profile_picture: varchar
address: text
marital_status: varchar
trcn_reg_number: varchar
gender: varchar
school_id: uuid (FK -> public.Schools.school_id)
public.Students

student_id: uuid PK (default gen_random_uuid())
created_at: timestamptz (default now())
full_name: varchar
date_of_birth: date
gender: text
admission_date: date
profile_picture: varchar
total_points: integer
class_id: integer (FK -> public.Classes.class_id)
school_id: uuid (FK -> public.Schools.school_id)
public.Classes

class_id: integer PK (identity BY DEFAULT)
class_name: varchar
section: varchar
teacher_id: uuid (FK -> public.Teachers.teacher_id)
school_id: uuid (FK -> public.Schools.school_id)
created_at: timestamptz (default now())
public.Subjects

subject_id: uuid PK (default gen_random_uuid())
created_at: timestamptz (default now())
subject_name: varchar
is_core: boolean (default false)
teacher_id: uuid (FK -> public.Teachers.teacher_id)
public.Class_Subjects

class_subjects__id: uuid PK (default gen_random_uuid())
created_at: timestamptz (default now())
subject_id: uuid (FK -> public.Subjects.subject_id)
class_id: integer (FK -> public.Classes.class_id)
teacher_id: uuid (FK -> public.Teachers.teacher_id)
public.student_subject (rls_enabled: true)

student_subject_id: uuid PK (default gen_random_uuid())
created_at: timestamptz (default now())
subject_id: uuid (FK -> public.Subjects.subject_id)
student_id: uuid (FK -> public.Students.student_id)
public.Parents

parent_id: uuid PK (default gen_random_uuid())
full_name: varchar
email: varchar (unique)
phone_number: text (unique)
address: text
occupation: text
created_at: timestamptz (default now())
user_id: uuid (FK -> auth.users.id)
public.Parent_Student_Links

link_id: uuid PK (default gen_random_uuid())
parent_id: uuid (FK -> public.Parents.parent_id)
student_id: uuid (FK -> public.Students.student_id)
relationship: text
created_at: timestamptz (default now())
public.Attendance

id: bigint PK (identity BY DEFAULT)
student_id: uuid (FK -> public.Students.student_id)
record_at: timestamptz (default now())
date: date
attendance_status: text
notes: text
recorded_by_user_id: uuid (FK -> public.Teachers.teacher_id)
public.Grades

grade_id: uuid PK (default gen_random_uuid())
student_id: uuid (FK -> public.Students.student_id)
subject_id: uuid (FK -> public.Subjects.subject_id)
score: numeric
max_score: numeric (default 100)
term: text
academic_session: text
created_at: timestamptz (default now())
assessment_type: text
teacher_id: uuid (FK -> public.Teachers.teacher_id)
comment: text
class_id: integer (FK -> public.Classes.class_id)
public.Curriculum

id: uuid PK (default gen_random_uuid())
teacher_id: uuid (FK -> public.Teachers.teacher_id)
class_id: integer (FK -> public.Classes.class_id)
subject_id: uuid (FK -> public.Subjects.subject_id)
week: text
topic: text
sub_topic: text
status: text (default 'incomplete')
progress: smallint
academic_session: text
created_at: timestamptz (default now())
public.Lesson_Notes (rls_enabled: true)

note_id: uuid PK (default gen_random_uuid())
created_at: timestamptz (default now())
title: text
file_url: text
subject_id: uuid (FK -> public.Subjects.subject_id)
class_id: integer (FK -> public.Classes.class_id)
teacher_id: uuid (FK -> public.Teachers.teacher_id)
file_size_kb: numeric
public.study_materials

id: integer PK (nextval sequence)
title: varchar
subject: varchar
type: varchar
description: text
file_url: text
file_path: text
file_size: bigint
file_type: varchar
uploaded_by: varchar
uploaded_at: timestamptz (default now())
public.schedule_configs

id: uuid PK (default extensions.uuid_generate_v4())
class_id: integer (unique, FK -> public.Classes.class_id)
start_time: time
period_duration: integer
periods_per_day: integer
active_days: text[]
break_times: jsonb
created_at: timestamptz (default now())
public.timetable_entries

id: uuid PK (default extensions.uuid_generate_v4())
subject_id: uuid (FK -> public.Subjects.subject_id)
class_id: integer (FK -> public.Classes.class_id)
day_of_week: varchar
start_time: time
duration_minutes: integer (default 40)
created_at: timestamptz (default now())
public.School_Admin

admin_id: uuid PK (default gen_random_uuid())
created_at: timestamptz (default now())
email: varchar
role: text
permissions_json: jsonb
phone_number: text
last_login: timestamp
full_name: varchar
school_id: uuid (FK -> public.Schools.school_id)
public.Payment_Items, public.Student_Virtual_Accounts, public.Qualifications, public.work_experience, public.school_employment, public.Grading_Structure, public.academic_events and others — (columns included in full DB export; include as needed for AI context)

8. Foreign key relationships (summary)
auth.* -> auth.users.id (sessions, refresh_tokens, identities, one_time_tokens, oauth_authorizations, oauth_consents, mfa_factors, etc.)
public.profiles.id -> auth.users.id
public.Parents.user_id -> auth.users.id
storage.objects.bucket_id -> storage.buckets.id
storage.vector_indexes.bucket_id -> storage.buckets_vectors.id
public.School_Admin.school_id -> public.Schools.school_id
public.Teachers.school_id -> public.Schools.school_id
public.Students.school_id -> public.Schools.school_id
public.Classes.school_id -> public.Schools.school_id
public.Classes.teacher_id -> public.Teachers.teacher_id
public.Students.class_id -> public.Classes.class_id
public.Class_Subjects.class_id -> public.Classes.class_id
public.Class_Subjects.subject_id -> public.Subjects.subject_id
public.student_subject.student_id -> public.Students.student_id
public.student_subject.subject_id -> public.Subjects.subject_id
public.Parent_Student_Links.parent_id -> public.Parents.parent_id
public.Parent_Student_Links.student_id -> public.Students.student_id
public.Attendance.student_id -> public.Students.student_id
public.Attendance.recorded_by_user_id -> public.Teachers.teacher_id
public.Lesson_Notes.subject_id -> public.Subjects.subject_id
public.Lesson_Notes.class_id -> public.Classes.class_id
public.Lesson_Notes.teacher_id -> public.Teachers.teacher_id
public.Grades.student_id -> public.Students.student_id
public.Grades.subject_id -> public.Subjects.subject_id
public.Grades.teacher_id -> public.Teachers.teacher_id
public.Grades.class_id -> public.Classes.class_id*
9. Notes for AI consumption
Use the exact column names and types above when constructing SQL or building embeddings.
Primary keys: many tables use UUID primary keys (gen_random_uuid()); some use integer identity columns (Attendance.id, Classes.class_id).
RLS: Many auth and storage tables have RLS enabled. When querying as end-users via Supabase client, RLS will filter rows by JWT/auth context. For safe server-side access use the service_role key.
Enums and user-defined types: examples include aal_level, buckettype, oauth enums. If your AI performs type inference include enum values.
Extensions: postgis, vector, pg_trgm, pgcrypto, uuid-ossp — include these in context if you plan to use spatial, vector, fuzzy search, or cryptographic functions.
For building prompts, include a one-line summary for each key table (example below).
Example compact prompt snippets:

"Students(student_id: uuid PK, full_name: varchar, date_of_birth: date, class_id: int FK->Classes.class_id, school_id: uuid FK->Schools.school_id, created_at: timestamptz)"
"Teachers(teacher_id: uuid PK, first_name: varchar, last_name: varchar, email: varchar, school_id: uuid FK->Schools.school_id)"
"Classes(class_id: int PK, class_name: varchar, section: varchar, teacher_id: uuid FK->Teachers.teacher_id, school_id: uuid FK->Schools.school_id)"
"Subjects(subject_id: uuid PK, subject_name: varchar, is_core: boolean, teacher_id: uuid FK->Teachers.teacher_id)"
Include additional one-line entries for Grades, Attendance, Parents, Parent_Student_Links, Lesson_Notes, Study_materials, storage.objects, storage.buckets, auth.users as needed.

10. Change log
2026-03-12 — Generated schema file (initial auto-export of tables, columns, foreign keys, and installed extensions).
