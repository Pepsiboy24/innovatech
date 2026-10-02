import { supabase } from '../../../core/config.js';
import { lazyScript } from '/core/perf.js';

/**
 * Bulk student creation.
 *
 * The browser no longer creates logins itself. It reads the Excel file, turns
 * each row into a plain object and sends batches to the `manage-users` Edge
 * Function, which (on the server):
 *   - makes a unique username (amina.bello, amina.g.bello, amina.bello2 ...)
 *   - makes a random one-time password
 *   - creates the login, the Students row, the parent + link (if given)
 *   - rolls back if a step fails
 * Students then sign in as  username@schoolcode  and must pick their own password.
 */

const BATCH_SIZE = 25;

const pick = (row, keys) => {
  for (const k of keys) {
    const v = row[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
};

function formatExcelDate(dateVal) {
  if (!dateVal && dateVal !== 0) return null;
  if (typeof dateVal === 'string' && dateVal.includes('-')) return dateVal;
  if (!isNaN(dateVal)) {
    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  return String(dateVal);
}

/** Excel row -> object the Edge Function understands. */
export function excelRowToStudent(row) {
  const first = pick(row, ['First Name', 'first_name']);
  const last = pick(row, ['Surname', 'Last Name', 'last_name']);
  const middle = pick(row, ['Middle Name', 'middle_name']);
  const full = pick(row, ['Full Name', 'full_name', 'Name']) || [first, middle, last].filter(Boolean).join(' ');

  const parentName = pick(row, ['Parent Name', 'parent_name']);
  const parent = parentName
    ? {
        full_name: parentName,
        email: pick(row, ['Parent Email', 'parent_email']),
        phone: pick(row, ['Parent Phone', 'parent_phone']),
        relationship: pick(row, ['Relationship', 'relationship']) || 'Guardian',
        address: pick(row, ['Parent Address', 'parent_address']),
      }
    : null;

  return {
    full_name: full,
    first_name: first && last ? first : undefined,
    middle_name: first && last ? middle : undefined,
    last_name: first && last ? last : undefined,
    gender: pick(row, ['Gender', 'gender']),
    date_of_birth: formatExcelDate(row['Date of Birth'] ?? row['date_of_birth'] ?? row['DOB']),
    admission_date: formatExcelDate(row['Admission Date'] ?? row['admission_date']) || undefined,
    admission_number: pick(row, ['Admission Number', 'Admission No', 'admission_number']),
    class_input: pick(row, ['Classes', 'classes', 'Class', 'class']),
    parent,
  };
}

async function callManageUsers(payload) {
  const { data, error } = await supabase.functions.invoke('manage-users', { body: payload });
  if (error) {
    // supabase-js hides the server's message inside error.context
    let msg = error.message;
    try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (_) { /* keep default */ }
    throw new Error(msg);
  }
  if (!data?.ok) throw new Error(data?.error || 'The server rejected the request.');
  return data;
}

/** Ask the server what usernames WOULD be created (nothing is saved). */
export async function previewStudents(students, nameOrder = 'first_surname') {
  const planned = [];
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const chunk = students.slice(i, i + BATCH_SIZE);
    const res = await callManageUsers({ action: 'create_students', dry_run: true, name_order: nameOrder, rows: chunk });
    res.results.forEach((r, j) => planned.push({ ...r, index: i + j, school_code: res.school_code }));
  }
  return planned;
}

/**
 * Create the students. `students` is an array from excelRowToStudent().
 * onProgress(done, total) is called after every batch.
 * Returns one result per student: { success, error?, data, username, login, password, parent, warnings }
 */
export async function createStudents(students, { nameOrder = 'first_surname', onProgress } = {}) {
  const results = [];
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const chunk = students.slice(i, i + BATCH_SIZE);
    try {
      const res = await callManageUsers({ action: 'create_students', name_order: nameOrder, rows: chunk });
      res.results.forEach((r, j) => {
        results.push({
          success: !!r.ok,
          error: r.error,
          data: chunk[j],
          full_name: r.full_name || chunk[j].full_name,
          username: r.username,
          login: r.login,
          password: r.password,
          student_id: r.student_id,
          class_matched: r.class_matched,
          parent: r.parent || null,
          warnings: r.warnings || [],
        });
      });
    } catch (e) {
      chunk.forEach((s) => results.push({ success: false, error: e.message, data: s, full_name: s.full_name }));
    }
    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, students.length), students.length);
  }

  // Ask the existing Monnify function for each virtual account (best effort, never blocks the upload).
  const created = results.filter((r) => r.success && r.student_id);
  if (created.length) {
    const { data: { user } } = await supabase.auth.getUser();
    const schoolId = user?.user_metadata?.school_id;
    await Promise.allSettled(created.map((r) =>
      supabase.functions.invoke('create-student-virtual-account', {
        body: {
          studentId: r.student_id,
          studentName: r.full_name,
          schoolId,
          parentEmail: r.data?.parent?.email || null,
        },
      })
    ));
  }

  return results;
}

/** Build a CSV the admin can print as login cards. Passwords are shown ONCE, here. */
export function credentialsCsv(results) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [['Type', 'Name', 'Login', 'Temporary password', 'Class matched', 'Notes'].map(esc).join(',')];
  for (const r of results.filter((x) => x.success)) {
    lines.push(['Student', r.full_name, r.login, r.password, r.class_matched === false ? 'NO' : 'yes', (r.warnings || []).join(' | ')].map(esc).join(','));
    if (r.parent?.created) {
      lines.push(['Parent of ' + r.full_name, r.data?.parent?.full_name, r.parent.login, r.parent.password, '', ''].map(esc).join(','));
    }
  }
  return lines.join('\r\n');
}

export function downloadCredentials(results, filename = 'student_logins.csv') {
  const blob = new Blob(['\uFEFF' + credentialsCsv(results)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/**
 * Backwards-compatible entry point (used to be called with just the file).
 * Reads the Excel file and creates everyone in it.
 */
export async function uploadAndProcessExcel(file, options = {}) {
  await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data);
  const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: '' });
  const students = jsonData.map(excelRowToStudent).filter((s) => s.full_name);
  return createStudents(students, options);
}
