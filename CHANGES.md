# Patch notes: auth, usernames, clean URLs

This patch was made against the zip you uploaded on 1 Oct 2026. Nothing was run against your live
Supabase project or your host, so **treat all of it as untested until you work through the checklist below.**
JavaScript files were syntax-checked with Node, and the username/phone/password helpers have unit tests that passed.

## 1. Do these first (before deploying anything)

1. **Rotate your Supabase service-role key.** `.env.test` in the zip you shared contained one. It is not in this patch, but treat the old key as exposed.
2. **Pick a domain you own** for hidden login emails (for example `login.yourdomain.com`) and give it an MX record, because Supabase may reject emails on domains that can't receive mail. Nothing is ever sent to it.
3. Put that domain in **two places**, and they must match:
   - `core/loginIdentity.js` -> `LOGIN_EMAIL_DOMAIN`
   - the Edge Function secret: `supabase secrets set LOGIN_EMAIL_DOMAIN=login.yourdomain.com`

## 2. Deploy order

| Step | What | Where |
|---|---|---|
| 1 | Check table names. The SQL uses `"Students"`, `"Schools"`, `"Teachers"`, `"Parents"`, `"School_Admin"` (quoted, capitalised) because that's how the app calls them. | `supabase/migrations/20261001_user_management.sql` |
| 2 | Run SQL section 1 (columns and indexes) and section 2 (`complete_password_change` function). | Supabase SQL editor |
| 3 | Run the **check query** in section 3. It must return **zero rows**. Fix any rows it returns before step 4. | SQL editor |
| 4 | Run section 4 (backfills `app_metadata` from your profile tables). | SQL editor |
| 5 | `supabase functions deploy manage-users` | CLI |
| 6 | Deploy the site. If you host on Cloudflare Pages, delete `netlify.toml`, since Cloudflare ignores it. | Host |
| 7 | Later: switch your row-level security policies to read `app_metadata`, test with two schools, then set `STRICT_APP_METADATA = true` in `core/config.js`. | See OPENCODE_PROMPT.md |

## 3. What changed

### Clean URLs (the `/portals/admin/...` problem)
- `_redirects`, `netlify.toml`: rewrite targets no longer end in `.html`. Cloudflare Pages and Netlify redirect any `.html` URL to the extensionless one, so a rewrite to `...classes.html` was turning into a visible jump to `/portals/admin/classes`. This is my best explanation, so confirm with DevTools -> Network.
- New routes: `/change-password`, `/forgot-password`, `/reset-password`.
- 13 files: relative `.html` navigations replaced with clean routes (`/admin/...`, `/teacher/...`); `'../../index.html'` auth redirects replaced with `/login`.
- `core/authGuard.js`: it used to look for `/portals/admin/` in the URL, which stops matching once URLs are clean (the role and plan checks would have silently turned off). It now understands both forms, also guards student and parent areas, and sends anyone with a temporary password to `/change-password`.

### Trusted identity
- `core/config.js`: wraps `getUser`, `getSession`, `signInWithPassword` and `onAuthStateChange` so `app_metadata` (server-only) overrides `user_metadata` for `school_id`, `user_type`, `role`, `must_change_password`. All ~90 existing reads benefit without editing. `STRICT_APP_METADATA` is `false` for now (falls back to the old values for users who haven't been backfilled).

### Login, usernames, passwords
- `core/loginIdentity.js` (new): turns what someone types into the hidden login email.
  - real email -> used as is
  - `amina.bello@afm` -> student (`afm` is the school's login code)
  - `08012345678` -> parent without email
- `public/html/login.html`: accepts the three forms above, links to `/forgot-password`, and redirects to `/change-password` if the temporary-password flag is set.
- `public/html/change_password.html` (new), `public/html/forgot_password.html` (new), `public/reset_password.html` (rewritten to use Supabase's real recovery flow).
- **Deleted** `assets/js-shared/authRecovery.js`. It was an unused stub that logged reset tokens to the console and called an admin API from the browser.

### Account creation on the server
- `supabase/functions/manage-users/` (new): actions `create_students`, `create_staff`, `reset_password`.
  - Reads school and role from your database (`School_Admin` / `Teachers` tables), not from the token's metadata.
  - Random passwords from an alphabet without look-alike characters; `must_change_password` set on every new account.
  - Usernames: `amina.bello` -> `amina.g.bello` -> `amina.bello2` ...; unique per school.
  - Rolls back the login if the profile row fails; a parent failure never undoes the student.
  - Re-uses an existing parent (matched by email or phone) so siblings share one parent login.
  - `dry_run: true` returns the usernames that would be created without saving anything.
  - Max 50 students per request.
- `supabase/migrations/20261001_user_management.sql` (new): see deploy steps.

### Bulk student upload
- `students_upload_modal.js` and `multipleStudentReg.js` rewritten. No student email is needed. The preview shows each student's login, you choose whether names are "first name first" or "surname first", classes that don't match are flagged, and a logins CSV downloads when the upload finishes (passwords are shown only there).
- New optional Excel columns: `Admission Number`, `Parent Phone`, `Parent Email`. A parent login is created when `Parent Name` plus a phone or email is given.

### Small fixes
- `assets/js-shared/resultsEngine.js`: report cards print `admission_number` when set (falls back to the old id).
- `portals/teacher/teacher_results.js`, `gradeEntry.js`: unclosed `debounce(...)` calls made these files fail to load. Fixed.
- Deleted `single_subject_upload.js.backup`.

## 4. Test checklist

- [ ] Open `/admin`, `/admin/students`, `/teacher`: the address bar stays clean.
- [ ] Log in as a teacher and open `/admin/students`: Access Denied. Log in as a parent and open `/student`: Access Denied.
- [ ] Bulk upload 3 students (two with the same name): preview shows `amina.bello@code` and `amina.bello2@code`.
- [ ] Upload creates them; the CSV downloads; the Students table has `username` filled in.
- [ ] Log in as one using `username@code` and the CSV password: you land on `/change-password`, then your dashboard. Log out and in again with the new password.
- [ ] Upload a student with a parent phone only: parent logs in with the phone number.
- [ ] Forgot password with a real staff email: the reset link works.
- [ ] Run the SQL check in section 3 before the backfill.

## 5. Not done yet (still on the old behaviour)

- Single student form (`singleStudentRegScript.js`, `singleStudentRegForm.js`) and teacher-side student form (`teacherStudentRegForm.js`): still use the browser `signUp` and password `123456`.
- Single and bulk teacher and school-admin creation (`teachersFormDB.js`, `multipleTeacherReg.js`, `schooladminsFormDB.js`, `schooladmins_excel_upload.js`).
- School signup/onboarding (`signup_step3.html`, `public/scripts/onboarding.js`) writes `school_id` into `user_metadata` from the browser. This must move to the server before `STRICT_APP_METADATA` can be turned on safely. `public/scripts/login.js` also writes metadata (it appears to be unused; the live page is `public/html/login.html`).
- A "reset password" button in the admin lists (the server action exists).
- Row-level security policies still read `user_metadata`.
- Promotions automation and the class history tables.
- Plan/tier limits are not enforced inside `manage-users`.
- Still failing the syntax check in your original and in this patch: `assets/js-shared/globalUI.js` and `portals/admin/subjects_scripts/single_subject_upload.js`.

All of these are written up as tasks in `OPENCODE_PROMPT.md`.

## 6. Known risks

- **Email validation:** if `createUser` fails with an "invalid email" error, your login domain needs an MX record, or Supabase's email validation is rejecting it.
- **One account per phone:** a parent's phone-number login belongs to one school. A parent with children in two schools using this system would need an email.
- **Migration mode:** until you finish the row-level-security switch, `user_metadata` is still trusted by your database, so the original tampering risk remains.
