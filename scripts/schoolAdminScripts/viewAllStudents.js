const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Function to fetch all students from Supabase
async function fetchStudents() {
    try {
        const { data, error } = await supabaseClient
            .from('Students')
            .select('*')
            .order('created_at', { ascending: false }); // Order by creation date, newest first

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

// Function to calculate age from date of birth
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

// Function to get class display text
function getClassText(classNum) {
    const classMap = {
        1: 'PRY 1',
        2: 'PRY 2',
        3: 'PRY 3',
        4: 'PRY 4',
        5: 'PRY 5',
        6: 'PRY 6',
        7: 'JSS 1',
        8: 'JSS 2',
        9: 'JSS 3',
        10: 'SSS 1',
        11: 'SSS 2',
        12: 'SSS 3'
    };

    return classMap[classNum] || `Class ${classNum}`;
}

// Function to get initials for avatar
function getInitials(fullName) {
    if (!fullName) return '??';

    return fullName
        .split(' ')
        .map(name => name.charAt(0).toUpperCase())
        .slice(0, 2)
        .join('');
}

// Function to render students in the table
function renderStudents(students) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) {
        console.error('Students table tbody not found');
        return;
    }

    tbody.innerHTML = ''; // Clear existing rows

    if (students.length === 0) {
        const noDataRow = `
            <tr class="student-row">
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No students found. Add some students to get started.
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', noDataRow);
        return;
    }

    students.forEach(student => {
        const age = calculateAge(student.date_of_birth);
        const classText = getClassText(student.class);
        const initials = getInitials(student.full_name);

        // For now, using a default attendance percentage since it's not in the students table
        // In a real implementation, you might fetch this from an attendance table
        const attendancePercent = 85; // Default value

        const row = `
            <tr class="student-row">
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-details">
                            <h4>${student.full_name || 'Unknown'}</h4>
                            <p>Student ID: #${student.id || 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td>${age}</td>
                <td>
                    <div class="class-badge">${classText}</div>
                </td>
                <td>
                    <div class="attendance-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${attendancePercent}%;"></div>
                        </div>
                        <span class="attendance-percent">${attendancePercent}%</span>
                    </div>
                </td>
                <td>
                    <a href="#" class="action-btn" data-student-id="${student.id}">View Details</a>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading students...');
    const students = await fetchStudents();
    renderStudents(students);
    console.log(`Loaded ${students.length} students`);
});

// Export functions for potential use in other modules
export { fetchStudents, renderStudents, calculateAge, getClassText, getInitials };
