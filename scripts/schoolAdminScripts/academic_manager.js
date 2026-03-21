// academic_manager.js
// Unified Academic Manager for School Admin Portal
import { supabase } from '/scripts/config.js';

// ─── State ────────────────────────────────────────────────────────────────────
let allSubjects = [];
let selectedSubject = null; // { subject_id, subject_name, is_core }
let pendingDeleteSubject = null; // for confirmation dialog
let pendingDeleteTopic = null;   // for confirmation dialog
let editingTopicId = null;       // when editing an existing topic
let currentTab = 'curriculum';    // 'curriculum' or 'assignments'
let allAllocations = [];          // Store subject allocations

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupModalListeners();
    loadSubjects();

    // Subject search
    document.getElementById('subjectSearch').addEventListener('input', (e) => {
        renderSubjectList(e.target.value.trim().toLowerCase());
    });

    // Allocation form submission
    document.getElementById('allocationForm').addEventListener('submit', handleAllocationSubmit);
});

// ─── Sidebar toggle (mobile) ─────────────────────────────────────────────────
function setupSidebar() {
    const sidebar = document.querySelector('[data-sideBar]');
    const openBtn = document.querySelector('[data-sideBarOpen]');
    const closeBtn = document.querySelector('[data-sideBarClose]');
    if (openBtn && sidebar) openBtn.addEventListener('click', () => sidebar.classList.add('show'));
    if (closeBtn && sidebar) closeBtn.addEventListener('click', () => sidebar.classList.remove('show'));
}

// ─── Load all subjects ────────────────────────────────────────────────────────
async function loadSubjects() {
    try {
        // Ensure session is active
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error('No active session:', userError);
            showToast('Session expired. Please log in again.', 'error');
            return;
        }

        const schoolId = user?.user_metadata?.school_id;
        if (!schoolId) {
            console.error('School ID not found in user metadata');
            showToast('Authentication error. Please log in again.', 'error');
            return;
        }

        const { data, error } = await supabase
            .from('Subjects')
            .select('subject_id, subject_name, is_core')
            .eq('school_id', schoolId) // CRITICAL: Add school_id filter for RLS
            .order('subject_name');

        if (error) {
            console.error('Error loading subjects:', error);
            showToast('Failed to load subjects: ' + error.message, 'error');
            return;
        }

        allSubjects = data || [];
        document.getElementById('subjectCount').textContent = allSubjects.length;
        renderSubjectList('');
    } catch (err) {
        console.error('Unexpected error in loadSubjects:', err);
        showToast('Failed to load subjects. Please try again.', 'error');
    }
}

// ─── Render subject list ──────────────────────────────────────────────────────
function renderSubjectList(filter = '') {
    const container = document.getElementById('subjectsList');
    const filtered = filter
        ? allSubjects.filter(s => s.subject_name.toLowerCase().includes(filter))
        : allSubjects;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="text-align:center;padding:40px 20px;color:var(--text-gray)">
                <i class="fa-solid fa-search" style="font-size:28px;margin-bottom:10px;display:block;color:#cbd5e1"></i>
                <p style="font-size:13px">No subjects found</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const initials = s.subject_name.substring(0, 2).toUpperCase();
        const isActive = selectedSubject && selectedSubject.subject_id === s.subject_id;
        const typeLabel = s.is_core ? 'Core' : 'Elective';
        return `
            <div class="subject-item ${isActive ? 'active' : ''}"
                 data-id="${s.subject_id}"
                 onclick="selectSubject('${s.subject_id}')">
                <div class="si-left">
                    <div class="si-icon">${initials}</div>
                    <span class="si-name">${s.subject_name}</span>
                </div>
                <div class="si-right">
                    <span class="si-badge ${s.is_core ? 'core' : ''}">${typeLabel}</span>
                    <button class="si-action" title="Edit subject"
                            onclick="event.stopPropagation(); openEditSubjectModal('${s.subject_id}')">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="si-action delete" title="Delete subject"
                            onclick="event.stopPropagation(); confirmDeleteSubject('${s.subject_id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>`;
    }).join('');
}

// ─── Select a subject ─────────────────────────────────────────────────────────
window.selectSubject = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    selectedSubject = subject;
    renderSubjectList(document.getElementById('subjectSearch').value.trim().toLowerCase());
    loadCurriculum(subject);
};

// ─── Show empty state (no subject selected) ───────────────────────────────────
function showEmptyState() {
    document.getElementById('cpEmpty').style.display = 'flex';
    document.getElementById('cpDetail').style.display = 'none';
}

// ─── Load curriculum for selected subject ─────────────────────────────────────
async function loadCurriculum(subject) {
    document.getElementById('cpEmpty').style.display = 'none';
    document.getElementById('cpDetail').style.display = 'flex';

    // Update header
    document.getElementById('cpSubjectName').textContent = subject.subject_name;
    const badge = document.getElementById('cpTypeBadge');
    badge.textContent = subject.is_core ? 'Core' : 'Elective';
    badge.className = 'cp-type-badge ' + (subject.is_core ? 'core' : 'elective');

    // Show spinner
    const content = document.getElementById('cpContent');
    content.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;

    try {
        // Ensure session is active and get school_id
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
            console.error('No active session:', userError);
            showToast('Session expired. Please log in again.', 'error');
            content.innerHTML = `<div class="cp-error">Session expired. Please log in again.</div>`;
            return;
        }

        const schoolId = user?.user_metadata?.school_id;
        if (!schoolId) {
            console.error('School ID not found in user metadata');
            showToast('Authentication error. Please log in again.', 'error');
            content.innerHTML = `<div class="cp-error">Authentication error. Please log in again.</div>`;
            return;
        }

        const { data, error } = await supabase
            .from('Curriculum')
            .select('*')
            .eq('subject_id', subject.subject_id)
            .eq('school_id', schoolId) // CRITICAL: Add school_id filter for RLS
            .order('week', { ascending: true });

        if (error) {
            content.innerHTML = `
                <div class="cp-error">
                    <i class="fa-solid fa-circle-exclamation"></i>
                    Failed to load curriculum: ${error.message}
                </div>`;
            return;
        }

        const topics = data || [];
        document.getElementById('cpTopicCount').textContent =
            topics.length === 0 ? 'No topics yet' :
                topics.length === 1 ? '1 topic' : `${topics.length} topics`;

        // Render topics
        renderTopics(topics);

    } catch (err) {
        console.error('Unexpected error in loadCurriculum:', err);
        content.innerHTML = `<div class="cp-error">Failed to load curriculum. Please try again.</div>`;
    }
}

// ─── Render topics list ────────────────────────────────────────────────────────
function renderTopics(topics) {
    const content = document.getElementById('cpContent');
    
    if (topics.length === 0) {
        content.innerHTML = `
            <div class="cp-no-topics">
                <i class="fa-solid fa-clipboard-list"></i>
                <p>No topics yet for this subject.<br>Click <strong>+ Add Topic</strong> to get started.</p>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="topics-list">
            ${topics.map(t => renderTopicCard(t)).join('')}
        </div>
    `;
}

// ─── Render a single topic card ───────────────────────────────────────────────
function renderTopicCard(t) {
    const statusClass = t.status === 'Completed' ? 'completed' : 'pending';
    const statusLabel = t.status === 'Completed' ? 'Completed' : 'Pending';
    const description = t.description ? `<p class="tc-desc">${t.description}</p>` : '';
    return `
        <div class="topic-card" id="tc-${t.curriculum_id}">
            <div class="tc-week">
                <span>${t.week}</span>
                WK
            </div>
            <div class="tc-body">
                <div class="tc-name">${t.topic_name}</div>
                ${description}
                <span class="tc-status ${statusClass}">
                    <i class="fa-solid fa-${statusClass === 'completed' ? 'check-circle' : 'clock'}"></i>
                    ${statusLabel}
                </span>
            </div>
            <div class="tc-actions">
                <button class="tc-btn" title="Edit topic"
                        onclick="openEditTopicModal('${t.curriculum_id}', '${escHtml(t.topic_name)}', ${t.week}, '${escHtml(t.description || '')}', '${t.status}')">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="tc-btn delete" title="Delete topic"
                        onclick="confirmDeleteTopic('${t.curriculum_id}', '${escHtml(t.topic_name)}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        </div>`;
}

function escHtml(s) {
    return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

// ─── MODAL HELPERS ────────────────────────────────────────────────────────────
function openModal(id) {
    document.getElementById(id).classList.add('active');
}
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
// Close on backdrop click
function setupModalListeners() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) overlay.classList.remove('active');
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
        }
    });
}

// ─── ADD SUBJECT ──────────────────────────────────────────────────────────────
window.openAddSubjectModal = function () {
    document.getElementById('addSubjectForm').reset();
    openModal('addSubjectModal');
};

document.getElementById('addSubjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    // 1. Get Form Data (Using the IDs from your actual HTML)
    const name = document.getElementById('asName').value.trim();
    const isCore = document.querySelector('input[name="asType"]:checked')?.value === 'core';
    
    if (!name) {
        showToast('Please enter a subject name', 'warning');
        return;
    }

    const btn = document.getElementById('addSubjectBtn');
    btn.disabled = true; 
    btn.textContent = 'Saving...';

    try {
        // 2. Get School ID from Auth Metadata (Required for RLS)
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('School context not found. Please log in again.');
        }

        // 3. Insert into Supabase with school_id
        const { error: insertError } = await supabase.from('Subjects').insert([
            { 
                subject_name: name, 
                is_core: isCore,
                school_id: schoolId 
            }
        ]);

        if (insertError) throw insertError;

        // 4. Success Handlers
        showToast('Subject added successfully', 'success');
        closeModal('addSubjectModal');
        document.getElementById('addSubjectForm').reset();
        await loadSubjects(); // Refresh the list

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Add Subject';
    }
});

// ─── EDIT SUBJECT ─────────────────────────────────────────────────────────────
window.openEditSubjectModal = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    document.getElementById('esId').value = id;
    document.getElementById('esName').value = subject.subject_name;
    document.querySelector(`input[name="esType"][value="${subject.is_core ? 'core' : 'elective'}"]`).checked = true;
    openModal('editSubjectModal');
};

document.getElementById('editSubjectForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('esId').value;
    const name = document.getElementById('esName').value.trim();
    const isCore = document.querySelector('input[name="esType"]:checked')?.value === 'core';

    const btn = document.getElementById('editSubjectBtn');
    btn.disabled = true; btn.textContent = 'Saving…';

    const { error } = await supabase.from('Subjects').update({ subject_name: name, is_core: isCore }).eq('subject_id', id);
    btn.disabled = false; btn.textContent = 'Save Changes';

    if (error) { showToast('Error: ' + error.message, 'error'); return; }
    closeModal('editSubjectModal');
    await loadSubjects();
});

// ─── DELETE SUBJECT ───────────────────────────────────────────────────────────
window.confirmDeleteSubject = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    pendingDeleteSubject = subject;
    document.getElementById('dsSubjectName').textContent = subject.subject_name;
    openModal('deleteSubjectModal');
};

document.getElementById('confirmDeleteSubjectBtn').addEventListener('click', async () => {
    if (!pendingDeleteSubject) return;
    const btn = document.getElementById('confirmDeleteSubjectBtn');
    btn.disabled = true; btn.textContent = 'Deleting…';

    try {
        // Get school_id for RLS compliance
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('Authentication error. Please log in again.');
        }

        // Delete curriculum entries with school_id filter
        const { error: curriculumError } = await supabase
            .from('Curriculum')
            .delete()
            .eq('subject_id', pendingDeleteSubject.subject_id)
            .eq('school_id', schoolId); // CRITICAL: Add school_id filter for RLS

        if (curriculumError) {
            console.error('Error deleting curriculum:', curriculumError);
            // Continue with subject deletion even if curriculum deletion fails
        }

        const { error } = await supabase.from('Subjects').delete().eq('subject_id', pendingDeleteSubject.subject_id);

        if (error) { 
            showToast('Error: ' + error.message, 'error'); 
            return; 
        }

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
        return;
    }

    btn.disabled = false; 
    btn.textContent = 'Yes, Delete';

    if (selectedSubject && selectedSubject.subject_id === pendingDeleteSubject.subject_id) {
        selectedSubject = null;
        showEmptyState();
    }
    pendingDeleteSubject = null;
    closeModal('deleteSubjectModal');
    await loadSubjects();
});

// ─── ADD TOPIC ────────────────────────────────────────────────────────────────
window.openAddTopicModal = function () {
    if (!selectedSubject) return;
    editingTopicId = null;
    document.getElementById('topicModalTitle').textContent = 'Add Topic';
    document.getElementById('topicSaveBtn').textContent = 'Add Topic';
    document.getElementById('topicForm').reset();
    openModal('topicModal');
};

// ─── EDIT TOPIC ───────────────────────────────────────────────────────────────
window.openEditTopicModal = function (id, name, week, description, status) {
    editingTopicId = id;
    document.getElementById('topicModalTitle').textContent = 'Edit Topic';
    document.getElementById('topicSaveBtn').textContent = 'Save Changes';
    document.getElementById('tName').value = name;
    document.getElementById('tWeek').value = week;
    document.getElementById('tDescription').value = description;
    document.getElementById('tStatus').value = status || 'Pending';
    openModal('topicModal');
};

document.getElementById('topicForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!selectedSubject) return;

    const name = document.getElementById('tName').value.trim();
    const week = parseInt(document.getElementById('tWeek').value);
    const description = document.getElementById('tDescription').value.trim();
    const status = document.getElementById('tStatus').value;

    const btn = document.getElementById('topicSaveBtn');
    btn.disabled = true; btn.textContent = 'Saving…';

    try {
        // Get school_id for RLS compliance
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('Authentication error. Please log in again.');
        }

        let error;
        if (editingTopicId) {
            ({ error } = await supabase.from('Curriculum')
                .update({ topic_name: name, week, description, status })
                .eq('curriculum_id', editingTopicId)
                .eq('school_id', schoolId)); // CRITICAL: Add school_id filter for RLS
        } else {
            ({ error } = await supabase.from('Curriculum')
                .insert([{ 
                    subject_id: selectedSubject.subject_id, 
                    topic_name: name, 
                    week, 
                    description, 
                    status,
                    school_id: schoolId // CRITICAL: Add school_id for RLS
                }]));
        }

        if (error) throw error;

        // Success
        showToast(`Topic ${editingTopicId ? 'updated' : 'added'} successfully`, 'success');
        closeModal('topicModal');
        document.getElementById('topicForm').reset();
        editingTopicId = null;
        await loadCurriculum(selectedSubject);

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = editingTopicId ? 'Save Changes' : 'Add Topic';
    }
});

// ─── DELETE TOPIC ─────────────────────────────────────────────────────────────
window.confirmDeleteTopic = function (id, name) {
    pendingDeleteTopic = id;
    document.getElementById('dtTopicName').textContent = name;
    openModal('deleteTopicModal');
};

document.getElementById('confirmDeleteTopicBtn').addEventListener('click', async () => {
    if (!pendingDeleteTopic) return;
    const btn = document.getElementById('confirmDeleteTopicBtn');
    btn.disabled = true; btn.textContent = 'Deleting…';

    try {
        // Get school_id for RLS compliance
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('Authentication error. Please log in again.');
        }

        const { error } = await supabase.from('Curriculum')
            .delete()
            .eq('curriculum_id', pendingDeleteTopic)
            .eq('school_id', schoolId); // CRITICAL: Add school_id filter for RLS

        if (error) throw error;

        // Success
        showToast('Topic deleted successfully', 'success');
        pendingDeleteTopic = null;
        closeModal('deleteTopicModal');
        await loadCurriculum(selectedSubject);

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Yes, Delete';
    }
});

// ─── Tab Management ─────────────────────────────────────────────────────────
window.switchTab = function(tabName) {
    currentTab = tabName;
    
    // Update tab button states
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    
    // Load appropriate content
    if (selectedSubject) {
        if (tabName === 'curriculum') {
            loadCurriculum(selectedSubject);
        } else if (tabName === 'assignments') {
            loadAssignments(selectedSubject);
        }
    }
};

// ─── Assignment Functions ─────────────────────────────────────────────────────
async function loadAssignments(subject) {
    try {
        // Ensure session is active and get school_id
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('Authentication error. Please log in again.');
        }

        const content = document.getElementById('cpContent');
        content.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;

        const { data: allocations, error } = await supabase
            .from('Subject_Allocations')
            .select(`
                *,
                Classes(class_name, section),
                Teachers(first_name, last_name)
            `)
            .eq('subject_id', subject.subject_id)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        allAllocations = allocations || [];
        renderAssignmentsTable(allAllocations);

    } catch (err) {
        console.error('Error loading assignments:', err);
        const content = document.getElementById('cpContent');
        content.innerHTML = `<div class="cp-error">Failed to load assignments. Please try again.</div>`;
    }
}

function renderAssignmentsTable(allocations) {
    const content = document.getElementById('cpContent');
    
    if (allocations.length === 0) {
        content.innerHTML = `
            <div class="cp-no-topics">
                <i class="fa-solid fa-chalkboard-teacher"></i>
                <p>No class assignments yet for this subject.<br>Click <strong>Assign to Class</strong> to get started.</p>
                <button class="btn-primary" onclick="openAllocationModal()">
                    <i class="fa-solid fa-plus"></i> Assign to Class
                </button>
            </div>`;
        return;
    }

    content.innerHTML = `
        <div class="assignments-header">
            <h3>Class Assignments</h3>
            <button class="btn-primary" onclick="openAllocationModal()">
                <i class="fa-solid fa-plus"></i> Assign to Class
            </button>
        </div>
        <div class="assignments-table">
            <table>
                <thead>
                    <tr>
                        <th>Class</th>
                        <th>Teacher</th>
                        <th>Academic Year</th>
                        <th>Term</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allocations.map(allocation => `
                        <tr>
                            <td>${allocation.Classes?.class_name || 'N/A'} ${allocation.Classes?.section || ''}</td>
                            <td>${allocation.Teachers?.first_name || 'N/A'} ${allocation.Teachers?.last_name || ''}</td>
                            <td>${allocation.academic_year || 'N/A'}</td>
                            <td>${allocation.term || 'N/A'}</td>
                            <td>
                                <button class="btn-danger btn-sm" onclick="removeAllocation('${allocation.allocation_id}')">
                                    <i class="fa-solid fa-trash"></i> Remove
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

window.openAllocationModal = function() {
    if (!selectedSubject) {
        showToast('Please select a subject first', 'warning');
        return;
    }
    
    document.getElementById('allocationForm').reset();
    populateAllocationDropdowns();
    openModal('allocationModal');
};

async function populateAllocationDropdowns() {
    try {
        // Get school_id
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('Authentication error. Please log in again.');
        }

        // Populate classes dropdown
        const { data: classes, error: classesError } = await supabase
            .from('Classes')
            .select('class_id, class_name, section')
            .eq('school_id', schoolId)
            .order('class_name');

        if (classesError) throw classesError;

        const classSelect = document.getElementById('allocationClass');
        classSelect.innerHTML = '<option value="">Select a class...</option>' +
            (classes || []).map(cls => `
                <option value="${cls.class_id}">
                    ${cls.class_name} ${cls.section || ''}
                </option>
            `).join('');

        // Populate teachers dropdown
        const { data: teachers, error: teachersError } = await supabase
            .from('Teachers')
            .select('teacher_id, first_name, last_name')
            .eq('school_id', schoolId)
            .order('first_name');

        if (teachersError) throw teachersError;

        const teacherSelect = document.getElementById('allocationTeacher');
        teacherSelect.innerHTML = '<option value="">Select a teacher...</option>' +
            (teachers || []).map(teacher => `
                <option value="${teacher.teacher_id}">
                    ${teacher.first_name} ${teacher.last_name}
                </option>
            `).join('');

    } catch (err) {
        console.error('Error populating dropdowns:', err);
        showToast('Failed to load classes and teachers', 'error');
    }
}

async function handleAllocationSubmit(e) {
    e.preventDefault();
    
    const formData = {
        classId: parseInt(document.getElementById('allocationClass').value),
        teacherId: document.getElementById('allocationTeacher').value,
        academicYear: document.getElementById('allocationAcademicYear').value.trim(),
        term: document.getElementById('allocationTerm').value
    };

    // Validate form
    if (!formData.classId || !formData.teacherId) {
        showToast('Please select both class and teacher', 'error');
        return;
    }

    const btn = document.getElementById('saveAllocationBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    try {
        // Get school_id for RLS compliance
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('Authentication error. Please log in again.');
        }

        // Check if allocation already exists
        const { data: existing, error: checkError } = await supabase
            .from('Subject_Allocations')
            .select('allocation_id')
            .eq('subject_id', selectedSubject.subject_id)
            .eq('class_id', formData.classId)
            .eq('school_id', schoolId)
            .single();

        if (existing) {
            showToast('This subject is already assigned to this class', 'warning');
            return;
        }

        // Insert allocation
        const { error: insertError } = await supabase
            .from('Subject_Allocations')
            .insert([{
                subject_id: selectedSubject.subject_id,
                class_id: formData.classId,
                teacher_id: formData.teacherId,
                school_id: schoolId,
                academic_year: formData.academicYear,
                term: formData.term,
                created_by: user?.email || 'system'
            }]);

        if (insertError) throw insertError;

        // Success
        showToast('Assignment saved successfully', 'success');
        closeModal('allocationModal');
        await loadAssignments(selectedSubject);

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Assignment';
    }
}

window.removeAllocation = async function(allocationId) {
    if (!confirm('Are you sure you want to remove this assignment?')) {
        return;
    }

    try {
        // Get school_id for RLS compliance
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        if (userError || !schoolId) {
            throw new Error('Authentication error. Please log in again.');
        }

        const { error } = await supabase
            .from('Subject_Allocations')
            .delete()
            .eq('allocation_id', allocationId)
            .eq('school_id', schoolId);

        if (error) throw error;

        showToast('Assignment removed successfully', 'success');
        await loadAssignments(selectedSubject);

    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
};

// ─── Expose close helpers to HTML ─────────────────────────────────────────────
window.closeModal = closeModal;
