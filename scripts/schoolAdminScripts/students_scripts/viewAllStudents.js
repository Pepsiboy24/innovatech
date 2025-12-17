// viewStudents.js

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- 1. Fetch Students ---
async function fetchStudents() {
    try {
        const { data, error } = await supabaseClient
            .from('Students')
            .select('*') // Get the student's data (including class_id)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching students:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        console.error('Unexpected error:', err);
        return [];
    }
}

// --- 2. Fetch Classes (To match the ID) ---
async function fetchClasses() {
    try {
        const { data, error } = await supabaseClient
            .from('Classes')
            .select('class_id, class_name, section');

        if (error) {
            console.error('Error fetching classes:', error);
            return [];
        }
        return data || [];
    } catch (err) {
        return [];
    }
}

// --- Helper Functions ---

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

function getInitials(fullName) {
    if (!fullName) return '??';
    return fullName.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
}

// --- 3. Render Logic ---

async function renderStudents() {
    console.log('Loading data...');
    
    // 1. Get BOTH lists (Students and Classes)
    const students = await fetchStudents();
    const classes = await fetchClasses();

    // 2. Create a "Lookup Map" for classes
    // This turns the list into an easy object: { 45: "JSS 1 A", 46: "SS 2 B" }
    const classMap = {};
    classes.forEach(cls => {
        classMap[cls.class_id] = `${cls.class_name} ${cls.section}`;
    });

    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (students.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:2rem;">No students found.</td></tr>`;
        return;
    }

    students.forEach(student => {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);
        
        // >>> THE FIX: Look up the Class ID in our Map <<<
        // If student.class_id is 45, it finds "JSS 1 A" in the map.
        // If not found (or null), it shows "Not Assigned".
        const classDisplayText = classMap[student.class_id] || "Not Assigned";
        
        const attendancePercent = 85; // Placeholder

        const row = `
            <tr class="student-row">
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-details">
                            <h4>${student.full_name || 'Unknown'}</h4>
                            <p>ID: #${student.student_id ? student.student_id.substr(0,8) : 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td>${age}</td>
                <td>
                    <div class="class-badge">${classDisplayText}</div>
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
                    <a href="#" class="action-btn" data-student-id="${student.student_id}">View</a>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderStudents();
});