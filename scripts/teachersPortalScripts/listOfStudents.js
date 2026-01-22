// listOfStudents.js - Handles fetching and displaying all students for the logged-in teacher

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
            window.location.href = '../../index.html';
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

// Fetch teacher's assigned classes
async function fetchTeacherClasses(teacherId) {
    try {
        const { data, error } = await supabaseClient
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

// Fetch all students from teacher's classes
async function fetchAllStudentsFromTeacherClasses(teacherId) {
    try {
        // First, get all class_ids for this teacher
        const { data: classes, error: classesError } = await supabaseClient
            .from('Classes')
            .select('class_id')
            .eq('teacher_id', teacherId);

        if (classesError) {
            console.error('Error fetching teacher classes:', classesError);
            return [];
        }

        if (!classes || classes.length === 0) {
            console.log('No classes found for this teacher');
            return [];
        }

        // Extract class_ids into an array
        const classIds = classes.map(cls => cls.class_id);

        // Now fetch students from these classes
        const { data, error } = await supabaseClient
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

// Calculate attendance percentage (placeholder - you might want to fetch actual attendance data)
async function getAttendancePercentage(studentId) {
    // Placeholder implementation - replace with actual attendance calculation
    // For now, return a random percentage between 70-100
    return Math.floor(Math.random() * 31) + 70;
}

// Render students in the table
async function renderStudents(students) {
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
                    No students found in your classes.
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', noDataRow);
        return;
    }

    for (const student of students) {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);
        const attendancePercent = await getAttendancePercentage(student.student_id);
        const classDisplay = `${student.Classes.class_name} ${student.Classes.section}`;

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
                            <div class="performance-fill" style="width: ${attendancePercent}%;"></div>
                        </div>
                        <span class="performance-text">${attendancePercent}%</span>
                    </div>
                </td>
                <td>
                    <a href="#" class="view-all-btn">View All</a>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    }
}

// Main function to load all students for the teacher
async function loadAllTeacherStudents() {
    console.log('Loading all students for teacher...');

    // Check if teacher is logged in
    const teacherId = await checkTeacherLogin();
    if (!teacherId) return;

    // Fetch all students from teacher's classes
    const students = await fetchAllStudentsFromTeacherClasses(teacherId);
    console.log(`Fetched ${students.length} students from teacher's classes`);

    // Render students in the table
    await renderStudents(students);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    loadAllTeacherStudents();
});
