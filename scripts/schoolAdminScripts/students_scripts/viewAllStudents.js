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

// --- 3. Filter Functions ---

function filterStudents(students, searchTerm) {
    if (!searchTerm) return students;

    const term = searchTerm.toLowerCase();
    return students.filter(student => {
        const fullName = (student.full_name || '').toLowerCase();
        const studentId = (student.student_id || '').toLowerCase();
        const email = (student.email || '').toLowerCase();

        return fullName.includes(term) ||
               studentId.includes(term) ||
               email.includes(term);
    });
}

function filterStudentsByGrade(students, gradeFilter, classMap) {
    if (gradeFilter === 'all') return students;

    return students.filter(student => {
        const className = classMap[student.class_id] || '';
        const classNameLower = className.toLowerCase();

        if (gradeFilter === 'primary') {
            return classNameLower.includes('primary');
        } else if (gradeFilter === 'secondary') {
            return classNameLower.includes('jss') || classNameLower.includes('ss');
        }

        return false;
    });
}

// --- 4. Render Logic ---

function renderStudents(students, classMap = {}) {
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
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading students...');
    let allStudents = await fetchStudents();
    let classes = await fetchClasses();
    let classMap = {};
    classes.forEach(cls => {
        classMap[cls.class_id] = `${cls.class_name} ${cls.section}`;
    });
    let currentSearchTerm = '';
    let currentGradeFilter = 'all';

    function applyFilters() {
        let filtered = [...allStudents];
        if (currentSearchTerm) {
            filtered = filterStudents(filtered, currentSearchTerm);
        }
        if (currentGradeFilter !== 'all') {
            filtered = filterStudentsByGrade(filtered, currentGradeFilter, classMap);
        }
        renderStudents(filtered, classMap);
    }

    applyFilters();
    console.log(`Loaded ${allStudents.length} students`);

    // Set up search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            currentSearchTerm = this.value.trim();
            applyFilters();
        });
    }

    // Set up filter tabs functionality
    const filterTabs = document.querySelectorAll('.filter-tab');
    if (filterTabs.length > 0) {
        filterTabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remove active class from all tabs
                filterTabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                this.classList.add('active');

                currentGradeFilter = this.textContent.toLowerCase();
                applyFilters();
            });
        });
    }
});

window.refreshStudentList = async () => {
    const allStudents = await fetchStudents();
    const classes = await fetchClasses();
    const classMap = {};
    classes.forEach(cls => {
        classMap[cls.class_id] = `${cls.class_name} ${cls.section}`;
    });
    renderStudents(allStudents, classMap);
};
