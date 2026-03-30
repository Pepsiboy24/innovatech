// academic_manager.js
// Unified Academic Manager for School Admin Portal
import { supabase } from '/scripts/config.js';

// ─── State ────────────────────────────────────────────────────────────────────
let allSubjects = [];
let selectedSubject = null;
let pendingDeleteSubject = null;
let pendingDeleteTopic = null;
let editingTopicId = null;
let currentTab = 'curriculum';
let allAllocations = [];

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    setupSidebar();
    setupModalListeners();
    loadSubjects();

    document.getElementById('subjectSearch').addEventListener('input', (e) => {
        renderSubjectList(e.target.value.trim().toLowerCase());
    });

    document.getElementById('allocationForm').addEventListener('submit', handleAllocationSubmit);
});

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
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) return;

        const schoolId = user?.user_metadata?.school_id;
        const { data, error } = await supabase
            .from('Subjects')
            .select('subject_id, subject_name, is_core')
            .eq('school_id', schoolId)
            .order('subject_name');

        if (error) throw error;

        allSubjects = data || [];
        document.getElementById('subjectCount').textContent = allSubjects.length;
        renderSubjectList('');
    } catch (err) {
        console.error('Error in loadSubjects:', err);
    }
}

function renderSubjectList(filter = '') {
    const container = document.getElementById('subjectsList');
    const filtered = filter
        ? allSubjects.filter(s => s.subject_name.toLowerCase().includes(filter))
        : allSubjects;

    if (filtered.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-gray)"><p>No subjects found</p></div>`;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const initials = s.subject_name.substring(0, 2).toUpperCase();
        const isActive = selectedSubject && selectedSubject.subject_id === s.subject_id;
        return `
            <div class="subject-item ${isActive ? 'active' : ''}" onclick="selectSubject('${s.subject_id}')">
                <div class="si-left">
                    <div class="si-icon">${initials}</div>
                    <span class="si-name">${s.subject_name}</span>
                </div>
                <div class="si-right">
                    <span class="si-badge ${s.is_core ? 'core' : ''}">${s.is_core ? 'Core' : 'Elective'}</span>
                    <button class="si-action" onclick="event.stopPropagation(); openEditSubjectModal('${s.subject_id}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="si-action delete" onclick="event.stopPropagation(); confirmDeleteSubject('${s.subject_id}')"><i class="fa-solid fa-trash"></i></button>
                </div>
            </div>`;
    }).join('');
}

window.selectSubject = function (id) {
    const subject = allSubjects.find(s => s.subject_id === id);
    if (!subject) return;
    selectedSubject = subject;
    renderSubjectList(document.getElementById('subjectSearch').value.trim().toLowerCase());

    // Refresh active tab content
    if (currentTab === 'curriculum') loadCurriculum(subject);
    else loadAssignments(subject);
};

// ─── Assignments Functions (FIXED FETCHING) ───────────────────────────────────
async function loadAssignments(subject) {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        const content = document.getElementById('cpContent');
        content.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;

        // JOIN: Fetching related names from Subjects, Classes, and Teachers
        const { data: allocations, error } = await supabase
            .from('Subject_Allocations')
            .select(`
                *,
                Subjects(subject_name),
                Classes(class_name, section),
                Teachers(first_name, last_name)
            `)
            .eq('subject_id', subject.subject_id)
            .eq('school_id', schoolId)
            .order('created_at', { ascending: false });

        if (error) throw error;
        renderAssignmentsTable(allocations || []);
    } catch (err) {
        console.error('Error loading assignments:', err);
        document.getElementById('cpContent').innerHTML = `<div class="cp-error">Failed to load assignments.</div>`;
    }
}

function renderAssignmentsTable(allocations) {
    const content = document.getElementById('cpContent');
    if (allocations.length === 0) {
        content.innerHTML = `<div class="cp-no-topics"><p>No assignments found.</p><button class="btn-primary" onclick="openAllocationModal()">Assign to Class</button></div>`;
        return;
    }

    content.innerHTML = `
        <div class="assignments-header">
            <h3>Class Assignments</h3>
            <button class="btn-primary" onclick="openAllocationModal()">+ Assign to Class</button>
        </div>
        <div class="assignments-table">
            <table>
                <thead>
                    <tr>
                        <th>Subject</th>
                        <th>Class</th>
                        <th>Teacher</th>
                        <th>Year</th>
                        <th>Term</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${allocations.map(a => `
                        <tr>
                            <td style="font-weight:600">${a.Subjects?.subject_name || 'N/A'}</td>
                            <td>${a.Classes?.class_name || ''} ${a.Classes?.section || ''}</td>
                            <td>${a.Teachers?.first_name || ''} ${a.Teachers?.last_name || ''}</td>
                            <td>${a.academic_year || 'N/A'}</td>
                            <td>${a.term || 'N/A'}</td>
                            <td><button class="btn-danger btn-sm" onclick="removeAllocation('${a.allocation_id}')"><i class="fa-solid fa-trash"></i></button></td>
                        </tr>`).join('')}
                </tbody>
            </table>
        </div>`;
}

// ─── Population Logic (FIXED SESSIONS) ────────────────────────────────────────

async function populateAllocationDropdowns() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const schoolId = user?.user_metadata?.school_id;

        const [classesRes, teachersRes, sessionsRes] = await Promise.all([
            supabase.from('Classes').select('class_id, class_name, section').eq('school_id', schoolId).order('class_name'),
            supabase.from('Teachers').select('teacher_id, first_name, last_name').eq('school_id', schoolId).eq('employment_status', 'active').order('first_name'),
            supabase.from('Academic_Sessions').select('*').eq('school_id', schoolId).order('created_at', { ascending: false })
        ]);

        // Classes
        document.getElementById('allocationClass').innerHTML = '<option value="">Select a class...</option>' +
            (classesRes.data || []).map(cls => `<option value="${cls.class_id}">${cls.class_name} ${cls.section || ''}</option>`).join('');

        // Teachers
        document.getElementById('allocationTeacher').innerHTML = '<option value="">Select a teacher...</option>' +
            (teachersRes.data || []).map(t => `<option value="${t.teacher_id}">${t.first_name} ${t.last_name}</option>`).join('');

        // Academic Sessions
        const yearSelect = document.getElementById('allocationAcademicYear');
        const termSelect = document.getElementById('allocationTerm');

        if (sessionsRes.data?.length > 0) {
            const uniqueYears = [...new Set(sessionsRes.data.map(s => s.academic_year))];
            yearSelect.innerHTML = uniqueYears.map(y => `<option value="${y}">${y}</option>`).join('');

            const current = sessionsRes.data.find(s => s.is_current);
            if (current) {
                yearSelect.value = current.academic_year;
                termSelect.value = current.term;
            }
        }
    } catch (err) { console.error('Dropdown init failed:', err); }
}

// ─── Curriculum Management (Stays mostly the same) ────────────────────────────
async function loadCurriculum(subject) {
    document.getElementById('cpEmpty').style.display = 'none';
    document.getElementById('cpDetail').style.display = 'flex';
    document.getElementById('cpSubjectName').textContent = subject.subject_name;

    const content = document.getElementById('cpContent');
    content.innerHTML = `<div class="spinner-wrap"><div class="spinner"></div></div>`;

    try {
        const { data: { user } } = await supabase.auth.getUser();
        const { data, error } = await supabase
            .from('Curriculum')
            .select('*')
            .eq('subject_id', subject.subject_id)
            .eq('school_id', user.user_metadata.school_id)
            .order('week', { ascending: true });

        if (error) throw error;
        renderTopics(data || []);
    } catch (err) { content.innerHTML = `<div class="cp-error">Failed to load curriculum.</div>`; }
}

function renderTopics(topics) {
    const content = document.getElementById('cpContent');
    if (topics.length === 0) {
        content.innerHTML = `<div class="cp-no-topics"><p>No topics yet.</p></div>`;
        return;
    }
    content.innerHTML = `<div class="topics-list">${topics.map(t => renderTopicCard(t)).join('')}</div>`;
}

function renderTopicCard(t) {
    // Check if the property is 'topic' or 'topic_name' based on your DB schema
    const topicDisplay = t.topic || t.topic_name || "Untitled Topic";
    const statusClass = t.status === 'Completed' ? 'completed' : 'pending';

    return `
        <div class="topic-card">
            <div class="tc-week"><span>${t.week}</span>WK</div>
            <div class="tc-body">
                <div class="tc-name">${topicDisplay}</div>
                <span class="tc-status ${statusClass}">${t.status || 'Pending'}</span>
            </div>
            <div class="tc-actions">
                <button class="tc-btn" onclick="openEditTopicModal('${t.curriculum_id}', '${escHtml(topicDisplay)}', ${t.week}, '${escHtml(t.description || '')}', '${t.status}')"><i class="fa-solid fa-pen"></i></button>
                <button class="tc-btn delete" onclick="confirmDeleteTopic('${t.curriculum_id}', '${escHtml(topicDisplay)}')"><i class="fa-solid fa-trash"></i></button>
            </div>
        </div>`;
}

// ─── UI & Modals ─────────────────────────────────────────────────────────────
window.openAllocationModal = function () {
    if (!selectedSubject) return showToast('Select a subject first', 'warning');
    document.getElementById('allocationForm').reset();
    populateAllocationDropdowns();
    openModal('allocationModal');
};

async function handleAllocationSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('saveAllocationBtn');
    btn.disabled = true;
    try {
        const { data: { user } } = await supabase.auth.getUser();
        const payload = {
            subject_id: selectedSubject.subject_id,
            class_id: parseInt(document.getElementById('allocationClass').value),
            teacher_id: document.getElementById('allocationTeacher').value,
            academic_year: document.getElementById('allocationAcademicYear').value,
            term: document.getElementById('allocationTerm').value,
            school_id: user.user_metadata.school_id,
            created_by: user.email
        };

        const { error } = await supabase.from('Subject_Allocations').insert([payload]);
        if (error) throw error;

        showToast('Assignment saved!', 'success');
        closeModal('allocationModal');
        loadAssignments(selectedSubject);
    } catch (err) { showToast(err.message, 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Save Assignment'; }
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }
function escHtml(s) { return String(s).replace(/'/g, "\\'").replace(/"/g, '&quot;'); }
function setupModalListeners() {
    document.querySelectorAll('.modal-overlay').forEach(o => o.addEventListener('click', (e) => { if (e.target === o) closeModal(o.id); }));
}
window.closeModal = closeModal;
window.switchTab = function (tabName) {
    currentTab = tabName;
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.tab === tabName));
    if (selectedSubject) tabName === 'curriculum' ? loadCurriculum(selectedSubject) : loadAssignments(selectedSubject);
};