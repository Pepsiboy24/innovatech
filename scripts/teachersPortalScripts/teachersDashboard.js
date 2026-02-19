import { supabase } from '../config.js';

// Check if teacher is logged in
async function checkTeacherLogin() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();

        if (error || !user) {
            console.error('No user logged in:', error);
            alert('Please log in as a teacher to view this page.');
            window.location.href = '../../index.html'; // Assuming login page is at root
            return null;
        }

        // Verify this user is actually a teacher in the Teachers table
        const { data: teacherData, error: teacherError } = await supabase
            .from('Teachers')
            .select('*')
            .eq('teacher_id', user.id)
            .single();

        if (teacherError || !teacherData) {
            console.error('User is not authorized as a teacher:', teacherError);
            alert('You are not authorized as a teacher. Please log in with teacher credentials.');
            await supabase.auth.signOut();
            window.location.href = '../../index.html';
            return null;
        }

        return user.id;
    } catch (err) {
        console.error('Error checking teacher login:', err);
        alert('An error occurred while verifying your login. Please try logging in again.');
        window.location.href = '../../index.html';
        return null;
    }
}

// Fetch teacher's assigned classes
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

// Fetch total students count for teacher's classes
async function fetchTotalStudentsCount(teacherClasses) {
    try {
        // Extract just the class_id values into a simple array: [1, 2, 3]
        const classIds = teacherClasses.map(c => c.class_id);

        if (classIds.length === 0) return 0;

        const { count, error } = await supabase
            .from('Students')
            .select('*', { count: 'exact', head: true })
            .in('class_id', classIds);

        if (error) {
            console.error('Error fetching total students count:', error);
            return 0;
        }
        return count || 0;
    } catch (err) {
        console.error('Unexpected error fetching total students count:', err);
        return 0;
    }
}

// Fetch students from a specific class (limited to 5)
async function fetchStudentsFromClass(classId, limit = 5) {
    try {
        const { data, error } = await supabase
            .from('Students')
            .select('*')
            .eq('class_id', classId)
            .limit(limit);

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

// Render students in the table
function renderStudents(students, className) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) {
        console.error('Students table tbody not found');
        return;
    }

    tbody.innerHTML = ''; // Clear existing rows

    if (students.length === 0) {
        const noDataRow = `
            <tr>
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No students found in your class.
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', noDataRow);
        return;
    }

    students.forEach(student => {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);

        // Placeholder performance percentage (you might want to fetch actual performance data)
        const performancePercent = 85; // Default value

        const row = `
            <tr>
                <td>
                    <div class="student-name">
                        <div class="student-avatar">${initials}</div>
                        <span>${student.full_name || 'Unknown'}</span>
                    </div>
                </td>
                <td>${age}</td>
                <td>${className || 'N/A'}</td>
                <td>
                    <div style="display: flex; align-items: center;">
                        <div class="performance-bar">
                            <div class="performance-fill excellent" style="width: ${performancePercent}%;"></div>
                        </div>
                        <span class="performance-text">${performancePercent}%</span>
                    </div>
                </td>
                <td><a href="#" class="view-details">View Details</a></td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Main function to load students for the teacher
async function loadTeacherDashboard() {
    console.log('Loading teacher dashboard...');

    // Check if teacher is logged in
    const teacherId = await checkTeacherLogin();
    if (!teacherId) return;

    // Fetch teacher's assigned classes
    const teacherClasses = await fetchTeacherClasses(teacherId);

    // Update Active Courses Count
    const activeCoursesElement = document.getElementById('active_courses');
    if (activeCoursesElement) {
        activeCoursesElement.textContent = teacherClasses.length;
    }

    if (!teacherClasses || teacherClasses.length === 0) {
        console.error('No classes assigned to this teacher');
        // alert('No classes are assigned to your account. Please contact an administrator.'); 
        // Alert might be annoying if they just want to see the dashboard, even if empty.
        return;
    }

    console.log('Teacher classes:', teacherClasses);

    // Fetch total students count
    const totalStudentsCount = await fetchTotalStudentsCount(teacherClasses);
    console.log(`Total students count: ${totalStudentsCount}`);

    // Update the total students display
    const totalStudentsElement = document.getElementById('total_students');
    if (totalStudentsElement) {
        totalStudentsElement.textContent = totalStudentsCount;
    }

    // For displaying students, use the first class (or you could modify to show from all classes)
    const firstClass = teacherClasses[0];

    // Fetch students from the first class (limited to 5)
    const students = await fetchStudentsFromClass(firstClass.class_id, 5);
    console.log(`Fetched ${students.length} students from class ${firstClass.class_name} ${firstClass.section}`);

    // Render students in the table
    const classDisplayName = `${firstClass.class_name} ${firstClass.section}`;
    renderStudents(students, classDisplayName);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadTeacherDashboard();
});
