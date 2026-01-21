// teachersDashboard.js - Handles teacher dashboard functionality including student fetching

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Check if teacher is logged in
async function checkTeacherLogin() {
    try {
        const { data: { user }, error } = await supabaseClient.auth.getUser();

        if (error || !user) {
            console.error('No user logged in:', error);
            alert('Please log in as a teacher to view this page.');
            window.location.href = '../../index.html'; // Assuming login page is at root
            return null;
        }

        // Verify this user is actually a teacher in the Teachers table
        const { data: teacherData, error: teacherError } = await supabaseClient
            .from('Teachers')
            .select('*')
            .eq('teacher_id', user.id)
            .single();

        if (teacherError || !teacherData) {
            console.error('User is not authorized as a teacher:', teacherError);
            alert('You are not authorized as a teacher. Please log in with teacher credentials.');
            await supabaseClient.auth.signOut();
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

// Fetch teacher's assigned class
async function fetchTeacherClass(teacherId) {
    try {
        const { data, error } = await supabaseClient
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('teacher_id', teacherId)
            .single();

        if (error) {
            console.error('Error fetching teacher class:', error);
            return null;
        }
        return data;
    } catch (err) {
        console.error('Unexpected error fetching teacher class:', err);
        return null;
    }
}

// Fetch students from a specific class (limited to 5)
async function fetchStudentsFromClass(classId, limit = 5) {
    try {
        const { data, error } = await supabaseClient
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
async function loadTeacherStudents() {
    console.log('Loading teacher students...');

    // Check if teacher is logged in
    const teacherId = await checkTeacherLogin();
    if (!teacherId) return;

    // Fetch teacher's assigned class
    const teacherClass = await fetchTeacherClass(teacherId);
    if (!teacherClass) {
        console.error('No class assigned to this teacher');
        alert('No class is assigned to your account. Please contact an administrator.');
        return;
    }

    console.log('Teacher class:', teacherClass);

    // Fetch students from the class (limited to 5)
    const students = await fetchStudentsFromClass(teacherClass.class_id, 5);
    console.log(`Fetched ${students.length} students from class ${teacherClass.class_name} ${teacherClass.section}`);

    // Render students in the table
    const classDisplayName = `${teacherClass.class_name} ${teacherClass.section}`;
    renderStudents(students, classDisplayName);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadTeacherStudents();
});
