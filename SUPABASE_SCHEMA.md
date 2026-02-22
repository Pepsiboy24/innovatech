Schemas
auth
storage
vault
realtime
public
extensions
graphql
graphql_public
pgbouncer
auth
users
RLS: enabled
Rows: 51
Primary key: id
Columns:
instance_id (uuid)
id (uuid)
aud (character varying)
role (character varying)
email (character varying)
encrypted_password (character varying)
invited_at (timestamptz)
confirmation_token (character varying)
confirmation_sent_at (timestamptz)
recovery_token (character varying)
recovery_sent_at (timestamptz)
email_change (character varying)
email_change_sent_at (timestamptz)
last_sign_in_at (timestamptz)
raw_app_meta_data (jsonb)
raw_user_meta_data (jsonb)
is_super_admin (boolean)
created_at (timestamptz)
updated_at (timestamptz)
email_change_token_new (character varying)
phone_confirmed_at (timestamptz)
phone_change_sent_at (timestamptz)
email_confirmed_at (timestamptz)
confirmed_at (timestamptz) — generated (LEAST(email_confirmed_at, phone_confirmed_at))
phone_change_token (character varying) — default ''::character varying
phone (text) — unique
phone_change (text) — default ''::character varying
email_change_token_current (character varying) — default ''::character varying
email_change_confirm_status (smallint) — default 0, check 0..2
banned_until (timestamptz)
reauthentication_token (character varying) — default ''::character varying
reauthentication_sent_at (timestamptz)
is_sso_user (boolean) — default false (comment: SSO accounts)
deleted_at (timestamptz)
is_anonymous (boolean) — default false
Foreign keys:
auth.identities.user_id → auth.users.id
auth.sessions.user_id → auth.users.id
auth.mfa_factors.user_id → auth.users.id
auth.one_time_tokens.user_id → auth.users.id
auth.oauth_authorizations.user_id → auth.users.id
auth.oauth_consents.user_id → auth.users.id
Comment: Auth: Stores user login data within a secure schema.
refresh_tokens
RLS: enabled
Rows: 122
Primary key: id
Columns: instance_id (uuid), token (varchar, unique), user_id (varchar), revoked (bool), created_at, updated_at, id (bigint, seq), parent (varchar), session_id (uuid)
Foreign keys:
auth.refresh_tokens.session_id → auth.sessions.id
Comment: Store of tokens used to refresh JWT tokens once they expire.
instances
RLS: enabled
Rows: 0
Primary key: id
Columns: id (uuid), uuid (uuid), raw_base_config (text), created_at, updated_at
Comment: Auth: Manages users across multiple sites.
audit_log_entries
RLS: enabled
Rows: 93
Primary key: id
Columns: instance_id (uuid), id (uuid), payload (json), created_at, ip_address (varchar default '')
Comment: Auth: Audit trail for user actions.
schema_migrations
RLS: enabled
Rows: 2
Primary key: version
Columns: version
Comment: Auth: Manages updates to the auth system.
identities
RLS: enabled
Rows: 7
Primary key: id
Columns: user_id (uuid), identity_data (jsonb), provider (text), last_sign_in_at (timestamptz), created_at, updated_at, provider_id (text), email (text, generated lower((identity_data ->> 'email'))), id (uuid)
Foreign keys:
auth.identities.user_id → auth.users.id
Comment: Auth: Stores identities associated to a user.
sessions
RLS: enabled
Rows: 71
Primary key: id
Columns include: id (uuid), user_id (uuid), created_at, updated_at, factor_id, aal (aal_level enum), not_after, refreshed_at, user_agent, ip (inet), tag, oauth_client_id (uuid), refresh_token_hmac_key, refresh_token_counter, scopes (text, check length <= 4096)
Foreign keys:
auth.sessions.user_id → auth.users.id
auth.sessions.oauth_client_id → auth.oauth_clients.id
auth.mfa_amr_claims.session_id → auth.sessions.id
auth.refresh_tokens.session_id → auth.refresh_tokens.session_id (note: refresh_tokens references sessions)
Comment: Auth: Stores session data associated to a user.
mfa_factors
RLS: enabled
Rows: 0
Primary key: id
Columns include id, user_id, friendly_name, factor_type (enum: totp, webauthn, phone), status (enum), created_at, updated_at, secret, phone, last_challenged_at (unique), web_authn_credential (jsonb), web_authn_aaguid (uuid), last_webauthn_challenge_data (jsonb)
Foreign keys:
auth.mfa_factors.user_id → auth.users.id
auth.mfa_challenges.factor_id → auth.mfa_factors.id
Comment: auth: stores metadata about factors
mfa_challenges
RLS: enabled
Rows: 0
Primary key: id
Columns: id, factor_id, created_at, verified_at, ip_address (inet), otp_code (text), web_authn_session_data (jsonb)
Foreign keys:
auth.mfa_challenges.factor_id → auth.mfa_factors.id
Comment: auth: stores metadata about challenge requests made
mfa_amr_claims
RLS: enabled
Rows: 23
Primary key: id
Columns: session_id (uuid), created_at, updated_at, authentication_method (text), id (uuid)
Foreign keys:
auth.mfa_amr_claims.session_id → auth.sessions.id
Comment: auth: stores authenticator method reference claims for multi factor authentication
sso_providers / sso_domains / saml_providers / saml_relay_states
RLS: enabled (where applicable), rows: 0
Manage SSO/SAML provider config and domain mappings.
Foreign keys connect sso_providers → sso_domains, saml_providers, saml_relay_states, etc.
flow_state
RLS: enabled
Rows: 0
Columns: code_challenge, id, user_id, provider_type, provider_access_token, provider_refresh_token, created_at, updated_at, authentication_method, auth_code_issued_at, invite_token, referrer, oauth_client_state_id, linking_target_id, email_optional (bool default false), code_challenge_method (enum), auth_code
Foreign keys:
saml_relay_states.flow_state_id → auth.flow_state.id
Comment: Stores metadata for OAuth/SSO login flows
one_time_tokens
RLS: enabled
Rows: 0
Primary key: id
Columns: id, user_id, token_type (enum), token_hash (text check length>0), relates_to (text), created_at (timestamp default now()), updated_at
Foreign keys:
auth.one_time_tokens.user_id → auth.users.id
oauth_clients / oauth_authorizations / oauth_consents / oauth_client_states
Manage OAuth clients, authorizations, consents, and client states.
oauth_clients primary key: id (uuid)
oauth_authorizations has client_id → oauth_clients.id and user_id → auth.users.id
oauth_consents has user_id → auth.users.id and client_id → oauth_clients.id
oauth_client_states
RLS: disabled
Rows: 0
Columns: id (uuid), provider_type, code_verifier, created_at
Comment: Stores OAuth states for third-party provider authentication flows where Supabase acts as the OAuth client.
storage
buckets
RLS: enabled
Rows: 0
Primary key: id (text)
Columns: id, name, owner (uuid) [deprecated, use owner_id], created_at (default now()), updated_at (default now()), type (enum buckettype: STANDARD, ANALYTICS, VECTOR), allowed_mime_types (text[]), public (bool default false), avif_autodetection (bool default false), file_size_limit (bigint), owner_id (text)
Foreign keys:
storage.s3_multipart_uploads_parts.bucket_id → storage.buckets.id
storage.objects.bucket_id → storage.buckets.id
storage.s3_multipart_uploads.bucket_id → storage.buckets.id
objects
RLS: enabled
Rows: 0
Primary key: id (uuid, default gen_random_uuid())
Columns: bucket_id (text), name (text), owner (uuid) [deprecated], created_at (timestamptz default now()), id (uuid), metadata (jsonb), updated_at (timestamptz default now()), last_accessed_at (timestamptz default now()), path_tokens (text[] generated string_to_array(name,'/')), version (text), owner_id (text), user_metadata (jsonb)
Foreign keys:
storage.objects.bucket_id → storage.buckets.id
migrations
RLS: enabled
Rows: 7
Primary key: id
Columns: id (int), name (varchar unique), hash (varchar), executed_at (timestamp default CURRENT_TIMESTAMP)
s3_multipart_uploads / s3_multipart_uploads_parts
RLS: enabled
Track multipart uploads, parts, sizes, etags.
Foreign keys to storage.buckets
buckets_analytics / buckets_vectors / vector_indexes
RLS: enabled
buckets_analytics rows: 0 columns include id (uuid gen_random_uuid), type (buckettype), format (text default 'ICEBERG'), created_at, updated_at, name, deleted_at
buckets_vectors rows: 0
vector_indexes: stores vector index config with id (text gen_random_uuid()), bucket_id → buckets_vectors.id
vault
secrets
RLS: disabled
Rows: 0
Primary key: id (uuid default gen_random_uuid())
Columns: name (text), secret (text), key_id (uuid), id (uuid), description (text default ''), nonce (bytea default vault._crypto_aead_det_noncegen()), created_at (timestamptz default CURRENT_TIMESTAMP), updated_at (timestamptz default CURRENT_TIMESTAMP)
Comment: Table with encrypted secret column for storing sensitive information on disk._
realtime
schema_migrations
RLS: disabled
Rows: 2
Primary key: version
Columns: version (bigint), inserted_at (timestamp)
subscription
RLS: disabled
Rows: 0
Primary key: id
Columns: action_filter (text default ''), id (bigint identity), entity (regclass), filters (user_defined_filter[] default '{}'), subscription_id (uuid), claims (jsonb), claims_role (regrole generated), created_at (timestamp default timezone('utc', now()))
messages
RLS: enabled
Rows: 0
Primary key: inserted_at, id
Columns: id (uuid default gen_random_uuid()), topic (text), extension (text), payload (jsonb), event (text), private (bool default false), updated_at (timestamp default now()), inserted_at (timestamp default now())
public
This schema contains your application tables (school management).

School_Admin
RLS: disabled
Rows: 0
Primary key: admin_id (uuid default gen_random_uuid())
Columns: admin_id, created_at (timestamptz default now()), email (varchar), role (text), permissions_json (jsonb), phone_number (text), last_login (timestamp), full_name (varchar)
Teachers
RLS: disabled
Rows: 0
Primary key: teacher_id (uuid default gen_random_uuid())
Columns include last_name, date_of_birth (date), teacher_id, address (text), created_at (timestamptz default now()), first_name, marital_status, trcn_reg_number, email, gender, phone_number, date_hired (date), profile_picture
Foreign keys (references from other tables listed below)
Classes
RLS: disabled
Rows: 3
Primary key: class_id (integer identity)
Columns: teacher_id (uuid default gen_random_uuid()), class_id, created_at (timestamptz default now()), class_name (varchar), section (varchar)
Foreign keys:
public.Classes.teacher_id → public.Teachers.teacher_id
public.Students.class_id → public.Classes.class_id
public.timetable_entries.class_id → public.Classes.class_id
public.schedule_configs.class_id → public.Classes.class_id
public.Curriculum.class_id → public.Classes.class_id
public.Class_Subjects.class_id → public.Classes.class_id
Subjects
RLS: disabled
Rows: 6
Primary key: subject_id (uuid default gen_random_uuid())
Columns: subject_id, created_at (timestamptz default now()), subject_name (varchar), is_core (bool default false), teacher_id (uuid)
Foreign keys:
public.Class_Subjects.subject_id → public.Subjects.subject_id
public.student_subject.subject_id → public.Subjects.subject_id
public.timetable_entries.subject_id → public.Subjects.subject_id
public.Subjects.teacher_id → public.Teachers.teacher_id
public.Grades.subject_id → public.Subjects.subject_id
public.Curriculum.subject_id → public.Subjects.subject_id
Students
RLS: disabled
Rows: 7
Primary key: student_id (uuid default gen_random_uuid())
Columns: admission_date (date), profile_picture (varchar), total_points (int), class_id (int), student_id, created_at (timestamptz default now()), full_name (varchar), date_of_birth (date), gender (text)
Foreign keys:
public.Students.class_id → public.Classes.class_id
public.Grades.student_id → public.Students.student_id
public.Attendance.student_id → public.Students.student_id
public.student_subject.student_id → public.Students.student_id
Class_Subjects
RLS: disabled
Rows: 2
Primary key: class_subjects__id (uuid default gen_random_uuid())
Columns: teacher_id (uuid), class_subjects__id, created_at (timestamptz default now()), class_id (int), subject_id (uuid default gen_random_uuid())
Foreign keys:
public.Class_Subjects.class_id → public.Classes.class_id
public.Class_Subjects.teacher_id → public.Teachers.teacher_id
public.Class_Subjects.subject_id → public.Subjects.subject_id
student_subject
RLS: enabled
Rows: 0
Primary key: student_subject_id (uuid default gen_random_uuid())
Columns: subject_id (uuid default gen_random_uuid()), student_id (uuid default gen_random_uuid()), student_subject_id (uuid default gen_random_uuid()), created_at (timestamptz default now())
Foreign keys:
public.student_subject.student_id → public.Students.student_id
public.student_subject.subject_id → public.Subjects.subject_id
emergency_contact
RLS: disabled
Rows: 0
Primary key: contact_id (bigint identity)
Columns: teacher_id (uuid default gen_random_uuid()), contact_id, created_at (timestamptz default now()), name (varchar), relationship (varchar), phone_number (varchar), address (text)
Foreign keys:
public.emergency_contact.teacher_id → public.Teachers.teacher_id
qualifications
RLS: disabled
Rows: 0
Primary key: qualification_id (bigint identity)
Columns: qualification_id, created_at (timestamptz default now()), teacher_id (uuid default gen_random_uuid()), school_name (varchar), certificate_name (varchar), feild_of_study (varchar), graduation_year (int)
work_experience
RLS: disabled
Rows: 0
Primary key: experience_id (bigint identity)
Columns: professional_development (text), position_held (varchar), duration (varchar), total_experience (varchar), experience_id, created_at (timestamptz default now()), teacher_id (uuid default gen_random_uuid()), school_name (varchar)
Foreign keys:
public.work_experience.teacher_id → public.Teachers.teacher_id
school_employment
RLS: disabled
Rows: 0
Primary key: employment_id (bigint identity)
Columns: employment_id, created_at (timestamptz default now()), teacher_id (uuid default gen_random_uuid()), start_date (date), job_title (varchar), contract_type (varchar), salary (numeric)
Foreign keys:
public.school_employment.teacher_id → public.Teachers.teacher_id
buckets_analytics (storage)
See storage section (analytics buckets)
study_materials
RLS: enabled
Rows: 0
Primary key: id (int seq)
Columns: title (varchar), subject (varchar), type (varchar), description (text), file_url (text), file_path (text), file_size (bigint), file_type (varchar), uploaded_by (varchar), id (int), uploaded_at (timestamptz default now())
academic_events
RLS: disabled
Rows: 0
Primary key: id (bigint identity)
Columns: id, created_at (timestamptz default now()), term_period (text), activity_event (text), start_date (date), end_date (date), duration (text), remarks (text), academic_session (text)
Attendance
RLS: disabled
Rows: 14
Primary key: id (bigint identity)
Columns: id, student_id (uuid default gen_random_uuid()), record_at (timestamptz default now()), date (date), attendance_status (text), notes (text), recorded_by_user_id (uuid default gen_random_uuid())
Foreign keys:
public.Attendance.recorded_by_user_id → public.Teachers.teacher_id
public.Attendance.student_id → public.Students.student_id
timetable_entries
RLS: disabled
Rows: 0
Primary key: id (uuid default extensions.uuid_generate_v4())
Columns: subject_id (uuid), class_id (int), day_of_week (varchar), start_time (time), id (uuid), duration_minutes (int default 40), created_at (timestamptz default now())
Foreign keys:
public.timetable_entries.subject_id → public.Subjects.subject_id
public.timetable_entries.class_id → public.Classes.class_id
schedule_configs
RLS: disabled
Rows: 2
Primary key: id (uuid default extensions.uuid_generate_v4())
Columns: class_id (int unique), start_time (time), period_duration (int), periods_per_day (int), active_days (text[]), break_times (jsonb), id (uuid), created_at (timestamptz default now())
Foreign keys:
public.schedule_configs.class_id → public.Classes.class_id
Grades
RLS: enabled
Rows: 0
Primary key: grade_id (uuid default gen_random_uuid())
Columns: student_id (uuid), subject_id (uuid), score (numeric), term (text), academic_session (text), grade_id (uuid), max_score (numeric default 100), created_at (timestamptz default now())
Foreign keys:
public.Grades.student_id → public.Students.student_id
public.Grades.subject_id → public.Subjects.subject_id
Curriculum
RLS: disabled
Rows: 10
Primary key: id (uuid default gen_random_uuid())
Columns: teacher_id (uuid), class_id (int), subject_id (uuid), week (text), topic (text), sub_topic (text), academic_session (text), id (uuid), status (text default 'incomplete'), created_at (timestamptz default now()), progress (smallint)
Foreign keys:
public.Curriculum.class_id → public.Classes.class_id
public.Curriculum.teacher_id → public.Teachers.teacher_id
public.Curriculum.subject_id → public.Subjects.subject_id


Grading_Structure
Schema: public
RLS: disabled (matches other public tables; enable if required)
Rows: 0 (new)
Primary key: id
Columns:
id (uuid) — default: gen_random_uuid(), PRIMARY KEY
assessment_name (text) — NOT NULL — e.g., '1st CA'
max_score (smallint / int2) — NOT NULL — e.g., 20
term (text) — NOT NULL — e.g., 'First Term'
academic_session (text) — NOT NULL
created_at (timestamptz) — default: now()

Lesson_Notes
Schema: public

RLS: enabled

Rows: (existing)

Primary key: (existing primary key)

Columns: (list columns here — copy from your current schema if you want exact names/types)

e.g., id (uuid)
e.g., lesson_id (uuid)
e.g., content (text)
created_at (timestamptz)
uploaded_by (uuid)
(adjust to match your actual columns)
Row-Level Security (policies)

"Enable read access for all users"
Operation: SELECT
Applies to: public (no role restriction)
USING clause: true
Effect: Any user (including unauthenticated/anon) can read Lesson_Notes rows.
"Teachers can insert notes"
Operation: INSERT
Applies to: authenticated
WITH CHECK clause: true
Effect: Only logged-in users (any authenticated user) can insert new Lesson_Notes rows.
(Note: this policy allows all authenticated users — if you want to restrict inserts to teachers/admins only, change the TO clause or WITH CHECK to validate a role claim, e.g.:
TO authenticated USING (...) AND (auth.jwt() ->> 'role') = 'teacher'
or WITH CHECK ((auth.jwt() ->> 'role') IN ('teacher','admin')))