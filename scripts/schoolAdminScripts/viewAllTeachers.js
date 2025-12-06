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

// Function to fetch all classes and create a map of teacher_id to class name
async function fetchTeacherClasses() {
    try {
        const { data, error } = await supabaseClient
            .from('Classes')
            .select('teacher_id, class_name, section');

        if (error) {
            console.error('Error fetching classes:', error);
            return {};
        }

        const classMap = {};
        data.forEach(cls => {
            classMap[cls.teacher_id] = `${cls.class_name} ${cls.section}`;
        });
        return classMap;
    } catch (err) {
        console.error('Unexpected error fetching classes:', err);
        return {};
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
function renderTeachers(teachers, classMap = {}) {
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

        // Get the class name from the classMap, fallback to job title if no class assigned
        const className = classMap[teacher.teacher_id] || jobTitle;

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
                    <div class="class-badge">${className}</div>
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
                    <a href="#" class="action-btn" data-teacher-id="${teacher.id}">View</a>
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
    let classMap = await fetchTeacherClasses();
    let filteredTeachers = [...allTeachers];

    renderTeachers(filteredTeachers, classMap);
    console.log(`Loaded ${allTeachers.length} teachers`);

    // Set up search functionality
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            filteredTeachers = filterTeachers(allTeachers, searchTerm);
            renderTeachers(filteredTeachers, classMap);
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
                renderTeachers(filteredTeachers, classMap);
            });
        });
    }
});

// Function to populate teacher details popup
function populateTeacherDetails(teacher, classMap = {}) {
    // Basic info
    const fullName = getFullName(teacher.first_name, teacher.last_name, teacher.middle_name);
    const initials = getInitials(teacher.first_name, teacher.last_name);
    const age = calculateAge(teacher.date_of_birth);
    const jobTitle = getJobTitleDisplay(teacher.job_title);
    const className = classMap[teacher.teacher_id] || jobTitle;

    document.getElementById('teacherAvatarLarge').textContent = initials;
    document.getElementById('teacherFullName').textContent = fullName;
    document.getElementById('teacherId').textContent = `Teacher ID: #T${teacher.id || 'N/A'}`;
    document.getElementById('teacherJobTitle').textContent = jobTitle;
    document.getElementById('teacherClass').textContent = className;

    // Personal Information
    document.getElementById('detailFirstName').textContent = teacher.first_name || 'N/A';
    document.getElementById('detailMiddleName').textContent = teacher.middle_name || 'N/A';
    document.getElementById('detailLastName').textContent = teacher.last_name || 'N/A';
    document.getElementById('detailDateOfBirth').textContent = teacher.date_of_birth ? new Date(teacher.date_of_birth).toLocaleDateString() : 'N/A';
    document.getElementById('detailAge').textContent = age;
    document.getElementById('detailGender').textContent = teacher.gender ? teacher.gender.charAt(0).toUpperCase() + teacher.gender.slice(1) : 'N/A';

    // Contact Information
    document.getElementById('detailAddress').textContent = teacher.address || 'N/A';
    document.getElementById('detailMobilePhone').textContent = teacher.mobile_phone || 'N/A';
    document.getElementById('detailHomePhone').textContent = teacher.home_phone || 'N/A';
    document.getElementById('detailPersonalEmail').textContent = teacher.personal_email || 'N/A';
    document.getElementById('detailEmergencyContact').textContent = teacher.emergency_contact_name || 'N/A';
    document.getElementById('detailEmergencyPhone').textContent = teacher.emergency_contact_phone || 'N/A';

    // Professional Qualifications
    document.getElementById('detailHighestDegree').textContent = teacher.highest_degree || 'N/A';
    document.getElementById('detailDegreeMajor').textContent = teacher.degree_major || 'N/A';
    document.getElementById('detailInstitution').textContent = teacher.institution || 'N/A';
    document.getElementById('detailGraduationYear').textContent = teacher.graduation_year || 'N/A';
    document.getElementById('detailTeachingLicense').textContent = teacher.teaching_license || 'N/A';
    document.getElementById('detailLicenseExpiry').textContent = teacher.license_expiry ? new Date(teacher.license_expiry).toLocaleDateString() : 'N/A';

    // Subjects
    const subjectsContainer = document.getElementById('detailSubjects');
    subjectsContainer.innerHTML = '';
    if (teacher.subjects && Array.isArray(teacher.subjects)) {
        teacher.subjects.forEach(subject => {
            const span = document.createElement('span');
            span.textContent = subject;
            subjectsContainer.appendChild(span);
        });
    } else {
        subjectsContainer.innerHTML = '<span>N/A</span>';
    }

    // Grade Levels
    const gradeLevelsContainer = document.getElementById('detailGradeLevels');
    gradeLevelsContainer.innerHTML = '';
    if (teacher.grade_levels && Array.isArray(teacher.grade_levels)) {
        teacher.grade_levels.forEach(level => {
            const span = document.createElement('span');
            span.textContent = level;
            gradeLevelsContainer.appendChild(span);
        });
    } else {
        gradeLevelsContainer.innerHTML = '<span>N/A</span>';
    }

    // Teaching Experience
    document.getElementById('detailTotalExperience').textContent = teacher.total_experience || 'N/A';
    document.getElementById('detailPreviousSchool').textContent = teacher.previous_school || 'N/A';
    document.getElementById('detailPreviousPosition').textContent = teacher.previous_position || 'N/A';
    document.getElementById('detailPreviousDuration').textContent = teacher.previous_duration || 'N/A';
    document.getElementById('detailProfessionalDevelopment').textContent = teacher.professional_development || 'N/A';

    // Employment Details
    document.getElementById('detailStartDate').textContent = teacher.start_date ? new Date(teacher.start_date).toLocaleDateString() : 'N/A';
    document.getElementById('detailJobTitle').textContent = jobTitle;
    document.getElementById('detailContractType').textContent = teacher.contract_type || 'N/A';
    document.getElementById('detailSalary').textContent = teacher.salary ? `$${teacher.salary.toLocaleString()}` : 'N/A';

    // Specialized Roles
    const rolesContainer = document.getElementById('detailSpecializedRoles');
    rolesContainer.innerHTML = '';
    if (teacher.specialized_roles && Array.isArray(teacher.specialized_roles)) {
        teacher.specialized_roles.forEach(role => {
            const span = document.createElement('span');
            span.textContent = role;
            rolesContainer.appendChild(span);
        });
    } else {
        rolesContainer.innerHTML = '<span>N/A</span>';
    }

    // Background & Medical Info
    document.getElementById('detailWorkAuthorization').textContent = teacher.work_authorization || 'N/A';
    document.getElementById('detailBackgroundCheck').textContent = teacher.background_check || 'N/A';
    document.getElementById('detailReferences').textContent = teacher.references || 'N/A';
    document.getElementById('detailAllergies').textContent = teacher.allergies || 'N/A';
    document.getElementById('detailMedicalConditions').textContent = teacher.medical_conditions || 'N/A';
    document.getElementById('detailMedications').textContent = teacher.medications || 'N/A';
}

// Function to show teacher details popup
function showTeacherDetailsPopup(teacher, classMap) {
    populateTeacherDetails(teacher, classMap);
    const popup = document.getElementById('teacherDetailsPopup');
    if (popup) {
        popup.style.display = 'flex';
    }
}

// Function to hide teacher details popup
function hideTeacherDetailsPopup() {
    const popup = document.getElementById('teacherDetailsPopup');
    if (popup) {
        popup.style.display = 'none';
    }
}

// Export functions for potential use in other modules
export { fetchTeachers, fetchTeacherClasses, renderTeachers, calculateAge, getJobTitleDisplay, getInitials, getFullName, getPrimarySubject, filterTeachers, filterTeachersByGrade, populateTeacherDetails, showTeacherDetailsPopup, hideTeacherDetailsPopup };
