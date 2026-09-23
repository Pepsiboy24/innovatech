// viewStudents.js
import { supabaseClient } from './supabase_client.js';
import { waitForUser, renderToFragment, debounce } from '/core/perf.js';
import { showSkeleton, hideSkeleton } from '../../../assets/js-shared/ui-engine.js';

// --- Module-level migration state ---
let _migrationStudentId = null;
let _migrationCurrentClassId = null;
let _allClasses = []; // cached for migration dropdown
let _countMap = {};   // class_id → student count (for capacity warning)

// --- Status change state ---
let _statusChangeStudentId = null;

// --- 1. Fetch Students (filtered by enrollment_status) ---
// --- 1. Fetch Students (Updated with Parent/Guardian Join) ---
async function fetchStudents(enrollmentStatus = 'active') {
    try {
        const user = await waitForUser();
        const userSchoolId = user?.user_metadata?.school_id;

        if (!userSchoolId) {
            console.error('User missing school_id in metadata');
            return [];
        }

        // Updated Select: Pulls linked Parents data through the junction table
        const { data, error } = await supabaseClient
            .from('Students')
            .select(`
                *,
                Parent_Student_Links (
                    Parents (
                        full_name,
                        phone_number,
                        email,
                        address
                    )
                )
            `)
            .eq('school_id', userSchoolId)
            .eq('enrollment_status', enrollmentStatus)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('Error fetching students:', error);
            return [];
        }

        // Map the data: Extract parent info into flat "guardian" fields for the Details Modal
        return (data || []).map(student => {
            const parent = student.Parent_Student_Links?.[0]?.Parents;
            return {
                ...student,
                guardian_name: parent?.full_name || 'Not Assigned',
                guardian_phone: parent?.phone_number || 'N/A',
                guardian_email: parent?.email || 'N/A',
                guardian_address: parent?.address || student.address || 'N/A'
            };
        });

    } catch (err) {
        console.error('Unexpected error:', err);
        return [];
    }
}

// --- 2. Fetch Classes (To match ID) ---
async function fetchClasses() {
    try {
        const user = await waitForUser();
        const userSchoolId = user?.user_metadata?.school_id;

        if (!userSchoolId) {
            console.error('User missing school_id in metadata');
            return [];
        }

        const { data, error } = await supabaseClient
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('school_id', userSchoolId);

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

// --- Status badge helper ---
function getStatusBadge(status) {
    const map = {
        active: { label: 'Active', className: 'status-pill--active' },
        graduated: { label: 'Graduated', className: 'status-pill--graduated' },
        withdrawn: { label: 'Withdrawn', className: 'status-pill--withdrawn' },
        expelled: { label: 'Expelled', className: 'status-pill--expelled' },
    };
    const s = map[status] || { label: status || 'Unknown', className: 'status-pill--graduated' };
    return `<span class="status-pill ${s.className}">${s.label}</span>`;
}

// --- 3. Filter Functions ---

function filterStudents(students, searchTerm) {
    if (!searchTerm) return students;
    const term = searchTerm.toLowerCase();
    return students.filter(student => {
        const fullName = (student.full_name || '').toLowerCase();
        const studentId = (student.student_id || '').toLowerCase();
        const email = (student.email || '').toLowerCase();
        return fullName.includes(term) || studentId.includes(term) || email.includes(term);
    });
}

function filterStudentsByGrade(students, gradeFilter, classMap) {
    if (gradeFilter === 'all') return students;
    return students.filter(student => {
        const className = classMap[student.class_id] || '';
        const classNameLower = className.toLowerCase();
        if (gradeFilter === 'primary') return classNameLower.includes('primary');
        if (gradeFilter === 'secondary') return classNameLower.includes('jss') || classNameLower.includes('ss');
        return false;
    });
}

// --- 4. Render Logic ---

function renderStudents(students, classMap = {}) {
    const tbody = document.querySelector('.students-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (students.length === 0) {
        checkAndShowSetupWizard();
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:2rem;">
            <div style="max-width: 400px; margin: 0 auto;">
                <h3 style="color: #6b7280; margin-bottom: 1rem;">No students found</h3>
                <p style="color: #9ca3af; margin-bottom: 1rem;">No students match the current filter.</p>
            </div>
        </td></tr>`;
        return;
    }

    const _rows = [];
    students.forEach(student => {
        const age = calculateAge(student.date_of_birth);
        const initials = getInitials(student.full_name);
        const classDisplayText = classMap[student.class_id] || 'Not Assigned';
        const attendancePercent = 85; // Placeholder
        const safeName = (student.full_name || '').replace(/'/g, "\\'");

        const row = `
            <tr class="student-row">
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${initials}</div>
                        <div class="student-details">
                            <h4>${student.full_name || 'Unknown'}</h4>
                            <p>ID: #${student.student_id ? student.student_id.substr(0, 8) : 'N/A'}</p>
                        </div>
                    </div>
                </td>
                <td class="student-age">${age}</td>
                <td class="student-class">
                    <div class="class-badge">${classDisplayText}</div>
                </td>
                <td class="student-attendance">
                    <div class="attendance-progress">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${attendancePercent}%;"></div>
                        </div>
                        <span class="attendance-percent">${attendancePercent}%</span>
                    </div>
                </td>
                <td class="student-status">${getStatusBadge(student.enrollment_status)}</td>
                <td class="student-actions-cell">
                    <div class="student-action-stack">
                        <button class="view-btn" type="button" data-type="student" data-id="${student.student_id}">View</button>
                        <div class="student-menu">
                            <button class="student-menu-toggle" type="button" aria-label="Open student actions">⋮</button>
                            <div class="student-menu-dropdown">
                                <button
                                    class="menu-action-btn"
                                    type="button"
                                    onclick="window.openMigrationModal('${student.student_id}', ${student.class_id ?? 'null'}, '${safeName}')">
                                    Change Class
                                </button>
                                <button
                                    class="menu-action-btn"
                                    type="button"
                                    onclick="window.openStatusModal('${student.student_id}', '${student.enrollment_status || 'active'}')">
                                    Update Status
                                </button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
                _rows.push(row);
    });
    renderToFragment(tbody, _rows);
}

// --- 5. Migration Modal Logic ---

window.openMigrationModal = function (studentId, currentClassId, studentName) {
    _migrationStudentId = studentId;
    _migrationCurrentClassId = currentClassId;

    const nameEl = document.getElementById('migrationStudentName');
    const select = document.getElementById('migrationClassSelect');
    const warning = document.getElementById('migrationCapacityWarning');

    if (nameEl) nameEl.textContent = studentName || '';
    if (warning) warning.style.display = 'none';

    if (select) {
        select.innerHTML = '<option value="">Select a class...</option>';
        _allClasses.forEach(cls => {
            if (cls.class_id == currentClassId) return;
            const label = `${cls.class_name}${cls.section ? ' - ' + cls.section : ''}`;
            const opt = document.createElement('option');
            opt.value = cls.class_id;
            opt.textContent = label;
            select.appendChild(opt);
        });

        select.onchange = () => {
            const selectedId = parseInt(select.value);
            if (!selectedId || !warning) return;
            const count = _countMap[selectedId] ?? 0;
            warning.style.display = count >= 40 ? 'block' : 'none';
        };
    }

    document.getElementById('migrationModal').style.display = 'block';
    document.getElementById('migrationOverlay').style.display = 'block';
};

window.closeMigrationModal = function () {
    document.getElementById('migrationModal').style.display = 'none';
    document.getElementById('migrationOverlay').style.display = 'none';
    _migrationStudentId = null;
    _migrationCurrentClassId = null;
};

async function executeMigration() {
    const select = document.getElementById('migrationClassSelect');
    const targetClassId = select ? parseInt(select.value) : null;

    if (!targetClassId) {
        showToast('Please select a destination class.', 'warning');
        return;
    }
    if (!_migrationStudentId) return;

    const btn = document.getElementById('migrationConfirmBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Moving...'; }

    try {
        const { error } = await supabaseClient
            .from('Students')
            .update({ class_id: targetClassId })
            .eq('student_id', _migrationStudentId);

        if (error) throw error;

        window.closeMigrationModal();
        if (window.refreshStudentList) await window.refreshStudentList();

    } catch (err) {
        console.error('Migration error:', err);
        showToast('Failed to move student: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Move Student'; }
    }
}

// --- 6. Status Change Modal Logic ---

window.openStatusModal = function (studentId, currentStatus) {
    _statusChangeStudentId = studentId;

    const modal = document.getElementById('statusChangeModal');
    const overlay = document.getElementById('statusChangeOverlay');
    const statusSelect = document.getElementById('newStatusSelect');
    const reasonGroup = document.getElementById('statusReasonGroup');

    if (statusSelect) {
        statusSelect.value = currentStatus || 'active';
        // Show/hide reason based on initial value
        toggleReasonField(statusSelect.value);
    }

    const reasonInput = document.getElementById('statusReasonInput');
    if (reasonInput) reasonInput.value = '';

    if (reasonGroup) reasonGroup.style.display = 'none';
    if (modal) modal.style.display = 'block';
    if (overlay) overlay.style.display = 'block';
};

window.closeStatusModal = function () {
    const modal = document.getElementById('statusChangeModal');
    const overlay = document.getElementById('statusChangeOverlay');
    if (modal) modal.style.display = 'none';
    if (overlay) overlay.style.display = 'none';
    _statusChangeStudentId = null;
};

function toggleReasonField(status) {
    const reasonGroup = document.getElementById('statusReasonGroup');
    if (!reasonGroup) return;
    const requiresReason = status === 'withdrawn' || status === 'expelled';
    reasonGroup.style.display = requiresReason ? 'block' : 'none';

    const reasonInput = document.getElementById('statusReasonInput');
    if (reasonInput) reasonInput.required = requiresReason;
}

window.submitStatusChange = async function () {
    if (!_statusChangeStudentId) return;

    const statusSelect = document.getElementById('newStatusSelect');
    const reasonInput = document.getElementById('statusReasonInput');
    const submitBtn = document.getElementById('statusSubmitBtn');

    const selectedStatus = statusSelect?.value;
    const enteredReason = reasonInput?.value?.trim();

    if (!selectedStatus) {
        showToast('Please select a status.', 'warning');
        return;
    }

    const requiresReason = selectedStatus === 'withdrawn' || selectedStatus === 'expelled';
    if (requiresReason && !enteredReason) {
        showToast('A reason is required for withdrawn or expelled status.', 'warning');
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Saving...'; }

    try {
        const { error } = await supabaseClient
            .from('Students')
            .update({
                enrollment_status: selectedStatus,
                status_reason: enteredReason || null,
                status_changed_at: new Date().toISOString(),
            })
            .eq('student_id', _statusChangeStudentId);

        if (error) throw error;

        showToast(`Student status updated to "${selectedStatus}" successfully.`, 'success');
        window.closeStatusModal();
        if (window.refreshStudentList) await window.refreshStudentList();

    } catch (err) {
        console.error('Status update error:', err);
        showToast('Failed to update status: ' + err.message, 'error');
    } finally {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Save Changes'; }
    }
};

// --- Initialize ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Loading students...');

    const statusFilter = document.getElementById('statusFilter');
    let currentStatusFilter = statusFilter?.value || 'active';

    const tableBody = document.querySelector('.students-table tbody');

    if (tableBody) { showSkeleton(tableBody, 6, 'rows', 6); }
    let allStudents = await fetchStudents(currentStatusFilter);
    let classes = await fetchClasses();
    _allClasses = classes;

    let classMap = {};
    classes.forEach(cls => {
        classMap[cls.class_id] = `${cls.class_name} ${cls.section || ''}`.trim();
    });

    allStudents.forEach(s => {
        if (s.class_id != null) {
            _countMap[s.class_id] = (_countMap[s.class_id] || 0) + 1;
        }
    });

    let currentSearchTerm = '';
    let currentGradeFilter = 'all';

    function applyFilters() {
        let filtered = [...allStudents];
        if (currentSearchTerm) filtered = filterStudents(filtered, currentSearchTerm);
        if (currentGradeFilter !== 'all') filtered = filterStudentsByGrade(filtered, currentGradeFilter, classMap);
        renderStudents(filtered, classMap);
    }

    applyFilters();
    console.log(`Loaded ${allStudents.length} students with status: ${currentStatusFilter}`);
    if (tableBody) { hideSkeleton(tableBody); }

    // Status filter dropdown — re-fetch from DB on change
    if (statusFilter) {
        statusFilter.addEventListener('change', async function () {
            currentStatusFilter = this.value;
            const refreshBody = document.querySelector('.students-table tbody');
            if (refreshBody) { showSkeleton(refreshBody, 6, 'rows', 6); }
            try {
                allStudents = await fetchStudents(currentStatusFilter);
                _countMap = {};
                allStudents.forEach(s => {
                    if (s.class_id != null) _countMap[s.class_id] = (_countMap[s.class_id] || 0) + 1;
                });
                applyFilters();
            } finally {
                if (refreshBody) { hideSkeleton(refreshBody); }
            }
        });
    }

    document.addEventListener('click', function (event) {
        const menuToggle = event.target.closest('.student-menu-toggle');
        const menu = event.target.closest('.student-menu');

        if (menuToggle) {
            event.stopPropagation();
            const dropdown = menuToggle.parentElement.querySelector('.student-menu-dropdown');
            const isOpen = dropdown.classList.contains('show');

            document.querySelectorAll('.student-menu-dropdown').forEach(item => {
                item.classList.remove('show');
                const button = item.parentElement?.querySelector('.student-menu-toggle');
                if (button) button.setAttribute('aria-expanded', 'false');
            });

            if (!isOpen && dropdown) {
                dropdown.classList.add('show');
                menuToggle.setAttribute('aria-expanded', 'true');
            }
            return;
        }

        if (!menu) {
            document.querySelectorAll('.student-menu-dropdown').forEach(item => {
                item.classList.remove('show');
                const button = item.parentElement?.querySelector('.student-menu-toggle');
                if (button) button.setAttribute('aria-expanded', 'false');
            });
        }
    });

    // Search
    const searchInput = document.querySelector('.search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(function () {
            currentSearchTerm = this.value.trim();
            applyFilters();
        }, 300));
    }

    // Grade filter tabs
    const filterTabs = document.querySelectorAll('.filter-tab');
    filterTabs.forEach(tab => {
        tab.addEventListener('click', function () {
            filterTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentGradeFilter = this.textContent.toLowerCase();
            applyFilters();
        });
    });

    // Migration confirm button
    const confirmBtn = document.getElementById('migrationConfirmBtn');
    if (confirmBtn) confirmBtn.addEventListener('click', executeMigration);

    // Migration overlay click to close
    const migrationOverlay = document.getElementById('migrationOverlay');
    if (migrationOverlay) migrationOverlay.addEventListener('click', window.closeMigrationModal);

    // Status change modal — reason toggle
    const newStatusSelect = document.getElementById('newStatusSelect');
    if (newStatusSelect) {
        newStatusSelect.addEventListener('change', function () {
            toggleReasonField(this.value);
        });
    }

    // Status overlay click to close
    const statusOverlay = document.getElementById('statusChangeOverlay');
    if (statusOverlay) statusOverlay.addEventListener('click', window.closeStatusModal);

    // Global refresh — re-fetches with current status filter
    window.refreshStudentList = async () => {
        currentStatusFilter = document.getElementById('statusFilter')?.value || 'active';
        const refreshBody = document.querySelector('.students-table tbody');
        if (refreshBody) { showSkeleton(refreshBody, 6, 'rows', 6); }
        try {
            allStudents = await fetchStudents(currentStatusFilter);
            classes = await fetchClasses();
            _allClasses = classes;
            _countMap = {};
            allStudents.forEach(s => {
                if (s.class_id != null) _countMap[s.class_id] = (_countMap[s.class_id] || 0) + 1;
            });
            classes.forEach(cls => {
                classMap[cls.class_id] = `${cls.class_name} ${cls.section || ''}`.trim();
            });
            applyFilters();
        } finally {
            if (refreshBody) { hideSkeleton(refreshBody); }
        }
    };
});

export { fetchStudents };

// Helper functions for empty state handling
async function checkAndShowSetupWizard() {
    try {
        const user = await waitForUser();
        const userSchoolId = user?.user_metadata?.school_id;
        if (!userSchoolId) return;

        const { count: classCount } = await supabaseClient
            .from('Classes')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', userSchoolId);

        const { count: teacherCount } = await supabaseClient
            .from('Teachers')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', userSchoolId);

        if (classCount === 0 && teacherCount === 0) {
            console.log('New school detected - showing setup wizard');
            showSetupWizard();
        }
    } catch (err) {
        console.error('Error checking setup status:', err);
    }
}

function showSetupWizard() {
    const setupChecklist = document.getElementById('setupChecklist');
    const standardDashboard = document.getElementById('standardDashboard');
    if (setupChecklist && standardDashboard) {
        setupChecklist.style.display = 'block';
        standardDashboard.style.display = 'none';
        console.log('Setup wizard activated for new school');
    }
}

function showStudentRegistration() {
    console.log('Opening student registration...');
    alert('Student registration feature coming soon!');
}

window.checkAndShowSetupWizard = checkAndShowSetupWizard;
window.showSetupWizard = showSetupWizard;
window.showStudentRegistration = showStudentRegistration;
