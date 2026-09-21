// teacherStudentRegController.js — Links an existing student (created by the school
// administrator) to one of the teacher's classes. Teachers cannot create accounts.

import { supabase } from '../../core/config.js';
import { waitForUser } from '/core/perf.js';

let currentSchoolId = null;

// ── Load the teacher's classes into the "Target Class" dropdown ────────────
async function loadTeacherClasses() {
    const classSelect = document.getElementById('class');
    if (!classSelect) return;

    const user = await waitForUser();
    if (!user?.user_metadata?.school_id) return;
    currentSchoolId = user.user_metadata.school_id;
    const teacherId = user.id;

    const [formRes, subjectRes] = await Promise.all([
        supabase
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('teacher_id', teacherId),
        supabase
            .from('Class_Subjects')
            .select('class_id, Classes!inner(class_name, section)')
            .eq('teacher_id', teacherId)
    ]);

    const uniqueClasses = [];
    const seen = new Set();

    (formRes.data || []).forEach(record => {
        if (!seen.has(record.class_id)) {
            seen.add(record.class_id);
            uniqueClasses.push(record);
        }
    });

    (subjectRes.data || []).forEach(record => {
        const cls = record.Classes;
        if (cls && !seen.has(record.class_id)) {
            seen.add(record.class_id);
            uniqueClasses.push(cls);
        }
    });

    classSelect.innerHTML = '<option value="">Select a class</option>';
    uniqueClasses.forEach(cls => {
        const opt = document.createElement('option');
        opt.value = String(cls.class_id);
        opt.textContent = `${cls.class_name || ''} ${cls.section || ''}`.trim();
        classSelect.appendChild(opt);
    });
}

// ── Load students NOT already in the selected class ────────────────────────
async function loadLinkableStudents() {
    const studentSelect = document.getElementById('studentSelect');
    const targetClassId = document.getElementById('class')?.value;
    if (!studentSelect || !targetClassId) return;

    studentSelect.innerHTML = '<option value="">Loading students...</option>';

    try {
        const { data, error } = await supabase
            .from('Students')
            .select('student_id, full_name')
            .eq('school_id', currentSchoolId)
            .eq('enrollment_status', 'active')
            .neq('class_id', parseInt(targetClassId, 10))
            .order('full_name');

        if (error) throw error;

        if (!data || data.length === 0) {
            studentSelect.innerHTML = '<option value="">No students available to add</option>';
            return;
        }

        studentSelect.innerHTML = '<option value="">Select a student</option>';
        data.forEach(student => {
            const opt = document.createElement('option');
            opt.value = student.student_id;
            opt.textContent = student.full_name || 'Unknown';
            studentSelect.appendChild(opt);
        });
    } catch (err) {
        console.error('Error loading linkable students:', err);
        studentSelect.innerHTML = '<option value="">Failed to load students</option>';
    }
}

// ── Events ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    loadTeacherClasses();

    const classSelect = document.getElementById('class');
    if (classSelect) {
        classSelect.addEventListener('change', () => {
            const studentSelect = document.getElementById('studentSelect');
            if (studentSelect) {
                studentSelect.innerHTML = '<option value="">Select a class first</option>';
            }
            if (classSelect.value) loadLinkableStudents();
        });
    }

    const cancelLinkBtn = document.getElementById('cancelLinkBtn');
    if (cancelLinkBtn) {
        cancelLinkBtn.addEventListener('click', () => {
            const popup = document.getElementById('registrationPopup');
            if (popup) popup.style.display = 'none';
        });
    }

    const linkStudentForm = document.getElementById('linkStudentForm');
    if (linkStudentForm) {
        linkStudentForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const selectedStudentId = document.getElementById('studentSelect')?.value;
            const targetClassId = document.getElementById('class')?.value;
            if (!selectedStudentId || !targetClassId) return;

            const submitBtn = document.getElementById('linkSubmitBtn');
            submitBtn.disabled = true;

            try {
                const { error } = await supabase
                    .from('Students')
                    .update({ class_id: parseInt(targetClassId, 10) })
                    .eq('student_id', selectedStudentId)
                    .eq('school_id', currentSchoolId);

                if (error) throw error;

                showToast('Student linked to class successfully', 'success');

                const popup = document.getElementById('registrationPopup');
                if (popup) popup.style.display = 'none';
                linkStudentForm.reset();
                document.getElementById('studentSelect').innerHTML = '<option value="">Select a class first</option>';

                if (typeof window.loadAllTeacherStudents === 'function') {
                    window.loadAllTeacherStudents();
                }
            } catch (err) {
                console.error('Error linking student:', err);
                showToast('Failed to link student: ' + (err.message || 'Unknown error'), 'error');
            } finally {
                submitBtn.disabled = false;
            }
        });
    }
});