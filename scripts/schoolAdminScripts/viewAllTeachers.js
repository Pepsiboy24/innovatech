const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Function to fetch all teachers from Supabase
async function fetchTeachers() {
    try {
        const { data, error } = await supabaseClient
            .from('Teachers')
            .select('*')
            .order('created_at', { ascending: false }); // Order by creation date, newest first

        if (error) {
            console.error('Error fetching teachers:', error);
            return [];
        }

        return data || [];
    } catch (err) {
        console.error('Unexpected error fetching teachers:', err);
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

// Function to get job title display text
function getJobTitleDisplay(jobTitle) {
    const titleMap = {
        'teacher': 'Teacher',
        'lead_teacher': 'Lead Teacher',
        'department_head': 'Department Head',
        'assistant_principal': 'Assistant Principal',
        'substitute': 'Substitute Teacher',
        'other': 'Other'
    };

    return titleMap[jobTitle] || jobTitle || 'Teacher';
}

// Function to get initials for avatar
function getInitials(firstName, lastName) {
    const firstInitial = firstName ? firstName.charAt(0).toUpperCase() : '?';
    const lastInitial = lastName ? lastName.charAt(0).toUpperCase() : '?';

    return firstInitial + lastInitial;
}

// Function to get full name
function getFullName(firstName, lastName, middleName) {
    const parts = [firstName, middleName, lastName].filter(Boolean);
    return parts.join(' ') || 'Unknown Teacher';
}

// Function to get primary subject for display
function getPrimarySubject(subjects) {
    if (!subjects) return 'General';

    // If subjects is an array, take the first one
    if (Array.isArray(subjects) && subjects.length > 0) {
        return subjects[0];
    }

    // If subjects is a string, try to parse or use as is
    if (typeof subjects === 'string') {
        // Check if it's comma-separated
        const subjectList = subjects.split(',').map(s => s.trim());
        return subjectList[0] || 'General';
    }

    return 'General';
}

// Function to render teachers in the table
function renderTeachers(teachers) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) {
        console.error('Teachers table tbody not found');
        return;
    }

    tbody.innerHTML = ''; // Clear existing rows

    if (teachers.length === 0) {
        const noDataRow = `
            <tr class="student-row">
                <td colspan="5" style="text-align: center; padding: 2rem; color: #6b7280;">
                    No teachers found. Add some teachers to get started.
                </td>
            </tr>
        `;
        tbody.insertAdjacentHTML('beforeend', noDataRow);
        return;
    }

    teachers.forEach(teacher => {
        const age = calculateAge(teacher.date_of_birth);
        const fullName = getFullName(teacher.first_name, teacher.last_name, teacher.middle_name);
        const initials = getInitials(teacher.first_name, teacher.last_name);
        const jobTitle = getJobTitleDisplay(teacher.job_title);
        const primarySubject = getPrimarySubject(teacher.subjects);

        // For now, using a default attendance percentage since it's not in the teachers table
        // In a real implementation, you might fetch this from an attendance table
        const attendancePercent = 90; // Default value for teachers

        const row = `
            <tr class="student-row">
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-details">
                            <h4>${fullName}</h4>
                            <p>Teacher ID: #T${teacher.id || 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td>${age}</td>
                <td>
                    <div class="class-badge">${jobTitle}</div>
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
                    <a href="#" class="action-btn" data-teacher-id="${teacher.id}">View Details</a>
                </td>
            </tr>
        `;

        tbody.insertAdjacentHTML('beforeend', row);
    });
}

// Function to filter teachers based on search term
function filterTeachers(teachers, searchTerm) {
    if (!searchTerm) return teachers;

    const term = searchTerm.toLowerCase();
    return teachers.filter(teacher => {
        const fullName = getFullName(teacher.first_name, teacher.last_name, teacher.middle_name).toLowerCase();
        const teacherId = `t${teacher.id || ''}`.toLowerCase();
        const email = (teacher.personal_email || '').toLowerCase();

        return fullName.includes(term) ||
               teacherId.includes(term) ||
               email.includes(term);
    });
}

// Function to filter teachers by grade level
function filterTeachersByGrade(teachers, gradeFilter) {
    if (gradeFilter === 'all') return teachers;

    return teachers.filter(teacher => {
        const gradeLevels = teacher.grade_levels;
        if (!gradeLevels) return false;

        let gradeArray = [];
        if (Array.isArray(gradeLevels)) {
            gradeArray = gradeLevels;
        } else if (typeof gradeLevels === 'string') {
            gradeArray = gradeLevels.split(',').map(g => g.trim().toLowerCase());
        }

        if (gradeFilter === 'primary') {
            return gradeArray.some(level => level.includes('elementary') || level.includes('primary'));
        } else if (gradeFilter === 'secondary') {
            return gradeArray.some(level => level.includes('middle') || level.includes('high') || level.includes('secondary'));
        }

        return false;
    });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading teachers...');
    let allTeachers = await fetchTeachers();
    let filteredTeachers = [...allTeachers];

    renderTeachers(filteredTeachers);
    console.log(`Loaded ${allTeachers.length} teachers`);

    // Set up search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            filteredTeachers = filterTeachers(allTeachers, searchTerm);
            renderTeachers(filteredTeachers);
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

                const filterType = this.textContent.toLowerCase();
                filteredTeachers = filterTeachersByGrade(allTeachers, filterType);
                renderTeachers(filteredTeachers);
            });
        });
    }
});

// Export functions for potential use in other modules
export { fetchTeachers, renderTeachers, calculateAge, getJobTitleDisplay, getInitials, getFullName, getPrimarySubject, filterTeachers, filterTeachersByGrade };
