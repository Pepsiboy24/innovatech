// listOfStudents.js — Fetches and displays all students for the logged-in teacher.
// Attendance percentages come from the real Attendance table.

import { supabase } from '../config.js';
import { checkTeacherLogin } from '../teacherUtils.js';

// Fetch teacher's assigned class IDs + details
async function fetchTeacherClasses(teacherId) {
    try {
        const { data, error } = await supabase
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('teacher_id', teacherId);

        if (error) {
            console.error('Error fetching teacher classes:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching teacher classes:', err);
        return [];
    }
}

// Fetch all students from teacher's classes (with inner-joined class info)
async function fetchAllStudentsFromTeacherClasses(teacherId) {
    try {
        const classes = await fetchTeacherClasses(teacherId);

        if (!classes || classes.length === 0) {
            console.log('No classes found for this teacher');
            return [];
        }

        const classIds = classes.map(cls => cls.class_id);

        const { data, error } = await supabase
            .from('Students')
            .select(`
                student_id,
                full_name,
                date_of_birth,
                gender,
                admission_date,
                profile_picture,
                class_id,
                Classes!inner(class_name, section)
            `)
            .in('class_id', classIds)
            .order('full_name', { ascending: true });

        if (error) {
            console.error('Error fetching students:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching students:', err);
        return [];
    }
}

// Calculate age from date of birth
function calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 'N/A';
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

// Get initials for avatar
function getInitials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
}

/**
 * Calculate real attendance percentage for a student from the Attendance table.
 * Returns the percentage (0–100) or 'N/A' if no records exist.
 */
async function getAttendancePercentage(studentId) {
    try {
        const { data, error } = await supabase
            .from('Attendance')
            .select('attendance_status')
            .eq('student_id', studentId);

        if (error || !data || data.length === 0) return 'N/A';

        const total = data.length;
        const presentCount = data.filter(r =>
            r.attendance_status && r.attendance_status.toLowerCase() === 'present'
        ).length;

        return Math.round((presentCount / total) * 100);
    } catch (err) {
        console.error('Error fetching attendance for student', studentId, err);
        return 'N/A';
    }
}

// Render students in the table
async function renderStudents(students) {
    const tbody = document.querySelector('.tp-table tbody');
    if (!tbody) {
        console.error('Students table tbody not found');
        return;
    }

    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No students found in your classes.
                </td>
            </tr>
        `;
        return;
    }

    for (const student of students) {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);
        const attendancePercent = await getAttendancePercentage(student.student_id);
        const attendanceDisplay = attendancePercent === 'N/A' ? 'N/A' : `${attendancePercent}%`;
        const barWidth = attendancePercent === 'N/A' ? 0 : attendancePercent;

        const row = `
            <tr>
                <td>
                    <div class="student-name">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-info">
                            <p>${student.full_name || 'Unknown'}</p>
                        </div>
                    </div>
                </td>
                <td>${age}</td>
                <td>
                    <span class="class-badge">${student.Classes.class_name} <span class="highlight">${student.Classes.section}</span></span>
                </td>
                <td>
                    <div class="performance-container">
                        <div class="performance-bar">
                            <div class="performance-fill" style="width: ${barWidth}%;"></div>
                        </div>
                        <span class="performance-text">${attendanceDisplay}</span>
                    </div>
                </td>
                <td>
                    <a href="./student_details.html?id=${student.student_id}" class="view-all-btn">View Details</a>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    }
}

// Show empty-state message if teacher has no classes
function showNoClassesState() {
    const tbody = document.querySelector('.tp-table tbody');
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No classes assigned yet. Contact Admin.
                </td>
            </tr>
        `;
    }
}

// Main function
async function loadAllTeacherStudents() {
    console.log('Loading all students for teacher...');

    const authResult = await checkTeacherLogin();
    if (!authResult) return;

    const { teacherId } = authResult;

    const students = await fetchAllStudentsFromTeacherClasses(teacherId);

    if (students.length === 0) {
        showNoClassesState();
        return;
    }

    console.log(`Fetched ${students.length} students from teacher's classes`);
    await renderStudents(students);
}

document.addEventListener('DOMContentLoaded', () => {
    loadAllTeacherStudents();
});
