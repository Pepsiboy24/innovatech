import { supabase } from '../../../core/config.js';

/**
 * Registers ONE student through the `manage-users` Edge Function.
 *
 * The server (not this browser) decides the school, makes a unique username,
 * generates a random one-time password, creates the login + Students row, and
 * creates/links the parent. If any step fails it rolls the login back.
 *
 * Returns { success: true, credentials } or { success: false, error }.
 *   credentials = { full_name, username, login, password, class_matched,
 *                   warnings: [], parent: { created, login?, password? } | null }
 */
export async function registerNewStudent({
  fullName, dateOfBirth, admissionDate, admissionNumber, classId, gender, parentInfo = null,
}) {
  try {
    const parent = parentInfo && parentInfo.parentFullName
      ? {
          full_name: parentInfo.parentFullName,
          email: parentInfo.parentEmail || '',
          phone: parentInfo.parentPhone || '',
          relationship: parentInfo.relationship || 'Guardian',
          address: parentInfo.parentAddress || '',
          occupation: parentInfo.parentOccupation || '',
        }
      : null;

    const { data, error } = await supabase.functions.invoke('manage-users', {
      body: {
        action: 'create_students',
        rows: [{
          full_name: fullName,
          gender,
          date_of_birth: dateOfBirth || null,
          admission_date: admissionDate || null,
          admission_number: admissionNumber || '',
          class_id: classId || null,
          parent,
        }],
      },
    });

    if (error) {
      let msg = error.message;
      try { const j = await error.context.json(); if (j?.error) msg = j.error; } catch (_) { /* keep default */ }
      return { success: false, error: msg };
    }
    if (!data?.ok) return { success: false, error: data?.error || 'The server rejected the request.' };

    const r = data.results?.[0];
    if (!r?.ok) return { success: false, error: r?.error || 'Could not create the student.' };

    // Ask the existing Monnify function for a payment account (best effort, never blocks)
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.functions.invoke('create-student-virtual-account', {
        body: {
          studentId: r.student_id,
          studentName: fullName,
          schoolId: user?.user_metadata?.school_id,
          parentEmail: parentInfo?.parentEmail || null,
        },
      });
    } catch (vErr) {
      console.warn('Virtual account request failed:', vErr.message);
    }

    return {
      success: true,
      credentials: {
        full_name: r.full_name || fullName,
        username: r.username,
        login: r.login,
        password: r.password,
        class_matched: r.class_matched,
        warnings: r.warnings || [],
        parent: r.parent || null,
        parent_name: parent?.full_name || '',
      },
    };
  } catch (err) {
    console.error('Registration failed:', err);
    return { success: false, error: err.message };
  }
}
