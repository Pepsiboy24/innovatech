/**
 * timetable_entries.js — Weekly Grid Edition
 * Fixed: Dropdown population, Teacher mapping, and Save validation.
 */

import { supabase } from '../../config.js';

// ── State ────────────────────────────────────────────────────────────────────
let config = null;
let entries = [];
let classSubjects = [];   // [{ subject_id, teacher_id, Subjects: {...}, Teachers: {...} }]
let teachers = [];
let classId = null;
let schoolId = null;

// ── Bootstrap ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    init();
});

// =============================================================================
// 1. INIT — Load all data for the selected class
// =============================================================================
async function init() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('classId');
    if (!raw) return window.location.href = 'create_timetable_setup.html';

    classId = parseInt(raw, 10);

    // Get school_id for RLS compliance
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    schoolId = user?.user_metadata?.school_id;

    if (userError || !schoolId) {
        alert('Authentication error. Please log in again.');
        return;
    }

    const [configRes, entriesRes, teachersRes, classRes] = await Promise.all([
        supabase.from('schedule_configs').select('*').eq('class_id', classId).eq('school_id', schoolId).single(),
        supabase.from('timetable_entries').select('*').eq('class_id', classId).eq('school_id', schoolId),
        supabase.from('Teachers').select('teacher_id, first_name, last_name').eq('school_id', schoolId),
        supabase.from('Classes').select('class_name, section').eq('class_id', classId).eq('school_id', schoolId).single(),
    ]);

    config = configRes.data;
    entries = entriesRes.data || [];
    teachers = teachersRes.data || [];
    const classInfo = classRes.data;

    // ── Dynamic page header ───────────────────────────────────────────────────
    if (classInfo) {
        const label = [classInfo.class_name, classInfo.section].filter(Boolean).join(' — ');
        document.getElementById('pageTitle').textContent = `Timetable: ${label}`;
        document.getElementById('pageSubtitle').textContent = `Senior Secondary School · ${label}`;
    }

    // ── Load Subjects and Populate UI ─────────────────────────────────────────
    await populateDropdowns(); 
    updateScheduleInfo();
    renderWeeklyGrid();
    setupSaveButton();
}

// =============================================================================
// 2. DROPDOWNS — fetches subjects assigned to THIS class
// =============================================================================
async function populateDropdowns() {
    const select = document.getElementById('modalSubject');
    if (!select || !classId) return;

    select.innerHTML = '<option value="">Loading subjects...</option>';
    select.disabled = true;

    try {
        // 1. Fetch from Subject_Allocations (Matching your "Class Assignments" UI)
        // Note: If your table is actually named something else, change it here.
        const { data: allocations, error: allocError } = await supabase
            .from('Subject_Allocations') 
            .select('subject_id, teacher_id')
            .eq('class_id', classId)
            .eq('school_id', schoolId);

        if (allocError) throw allocError;

        if (!allocations || allocations.length === 0) {
            console.warn("No allocations found for classId:", classId);
            select.innerHTML = '<option value="">No subjects assigned to this class</option>';
            return;
        }

        const subjectIds = allocations.map(r => r.subject_id);

        // 2. Fetch the actual names from Subjects table
        const { data: subjectsData, error: subjError } = await supabase
            .from('Subjects')
            .select('subject_id, subject_name')
            .in('subject_id', subjectIds)
            .eq('school_id', schoolId);

        if (subjError) throw subjError;

        const subjectsMap = {};
        (subjectsData || []).forEach(s => { subjectsMap[s.subject_id] = s; });

        // 3. Update the global state for the grid display
        classSubjects = allocations.map(row => {
            const t = teachers.find(t => t.teacher_id === row.teacher_id);
            return {
                ...row,
                Subjects: subjectsMap[row.subject_id] || { subject_name: 'Unknown Subject' },
                Teachers: t ? { first_name: t.first_name, last_name: t.last_name } : null,
            };
        });

        // 4. Fill the dropdown
        select.innerHTML = '<option value="">-- Select Subject --</option>';
        (subjectsData || []).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.subject_id;
            opt.textContent = s.subject_name;
            select.appendChild(opt);
        });

    } catch (err) {
        console.error("Dropdown Error:", err);
        select.innerHTML = '<option value="">Error loading data</option>';
    } finally {
        select.disabled = false;
    }
}

// =============================================================================
// 3. GRID RENDERING & TIME UTILS
// =============================================================================
function addMinutes(time, mins) {
    const [h, m] = time.split(':').map(Number);
    const total = h * 60 + m + mins;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function generateMasterTimeline() {
    const timesSet = new Set();
    if (config) {
        let mins = 0;
        for (let i = 0; i < (config.periods_per_day || 8); i++) {
            const t = addMinutes(config.start_time, mins);
            timesSet.add(t.slice(0, 5));
            
            const isBreak = config.break_times?.find(b => (typeof b === 'object' ? b.start : b).startsWith(t.slice(0, 5)));
            mins += isBreak ? (parseInt(isBreak.duration) || 20) : (parseInt(config.period_duration) || 40);
        }
    }
    entries.forEach(e => { if (e.start_time) timesSet.add(e.start_time.slice(0, 5)); });
    return Array.from(timesSet).sort();
}

function renderWeeklyGrid() {
    const container = document.getElementById('gridContainer');
    if (!container || !config) return;
    container.innerHTML = '';

    const timeline = generateMasterTimeline();
    const days = config.active_days || [];

    const table = document.createElement('table');
    table.className = 'week-table';
    table.innerHTML = `<thead><tr><th class="time-col">Time</th>${days.map(d => `<th>${d}</th>`).join('')}</tr></thead>`;

    const tbody = document.createElement('tbody');
    timeline.forEach(timeSlot => {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="time-col">${timeSlot}</td>`;

        days.forEach(day => {
            const td = document.createElement('td');
            const isBreak = config.break_times?.some(b => (typeof b === 'object' ? b.start : b).startsWith(timeSlot));
            
            if (isBreak) {
                td.innerHTML = '<div class="break-cell">BREAK</div>';
            } else {
                const entry = entries.find(e => e.day_of_week?.substring(0,3) === day.substring(0,3) && e.start_time?.startsWith(timeSlot));
                td.appendChild(entry ? buildEntryCell(entry, day, timeSlot) : buildEmptyCell(day, timeSlot));
            }
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(table);
}

function buildEntryCell(entry, day, timeSlot) {
    const cs = classSubjects.find(c => c.subject_id == entry.subject_id);
    const name = cs?.Subjects?.subject_name || 'Unknown';
    const tName = cs?.Teachers ? `${cs.Teachers.first_name} ${cs.Teachers.last_name}` : '';
    const div = document.createElement('div');
    div.className = `entry-cell ${!entry.id ? 'unsaved' : ''}`;
    div.innerHTML = `
        <div class="entry-subject">${name}</div>
        <div class="entry-teacher">${tName}</div>
        <div class="cell-actions">
            <button class="cell-btn del" onclick="quickDelete('${entry.id || ''}','${day}','${timeSlot}')"><i class="fa-solid fa-xmark"></i></button>
        </div>`;
    div.onclick = (e) => { if(!e.target.closest('.cell-btn')) openModal(day, timeSlot, entry); };
    return div;
}

function buildEmptyCell(day, timeSlot) {
    const div = document.createElement('div');
    div.className = 'empty-cell';
    div.innerHTML = `<i class="fa-solid fa-plus"></i> Add`;
    div.onclick = () => openModal(day, timeSlot);
    return div;
}

// =============================================================================
// 4. MODAL & ACTIONS
// =============================================================================
window.openModal = (day, time, entryData) => {
    document.getElementById('modalDay').value = day;
    document.getElementById('modalTime').value = time;
    document.getElementById('modalEntryId').value = entryData?.id || '';
    document.getElementById('modalSubject').value = entryData?.subject_id || '';
    document.getElementById('modalDuration').value = entryData?.duration_minutes || config?.period_duration || 40;
    document.getElementById('modalDeleteBtn').style.display = entryData?.id ? 'inline-flex' : 'none';
    document.getElementById('entryModal').style.display = 'flex';
};

window.closeModal = () => document.getElementById('entryModal').style.display = 'none';

document.getElementById('entryForm').onsubmit = async (e) => {
    e.preventDefault();
    const entryId = document.getElementById('modalEntryId').value;
    const payload = {
        class_id: classId,
        day_of_week: document.getElementById('modalDay').value,
        start_time: document.getElementById('modalTime').value + ':00',
        subject_id: parseInt(document.getElementById('modalSubject').value),
        duration_minutes: parseInt(document.getElementById('modalDuration').value)
    };

    if (entryId) {
        await supabase.from('timetable_entries').update(payload).eq('id', entryId);
        location.reload();
    } else {
        entries.push({ ...payload, tempId: Date.now() });
        closeModal();
        renderWeeklyGrid();
        updateSaveButtonState();
    }
};

window.quickDelete = async (id, day, time) => {
    if (!confirm('Delete this entry?')) return;
    if (id) await supabase.from('timetable_entries').delete().eq('id', id);
    entries = entries.filter(e => !(e.day_of_week?.substring(0,3) === day.substring(0,3) && e.start_time?.startsWith(time)));
    renderWeeklyGrid();
    updateSaveButtonState();
};

// =============================================================================
// 5. BATCH SAVE
// =============================================================================
function updateSaveButtonState() {
    const unsavedCount = entries.filter(e => !e.id).length;
    const btn = document.getElementById('saveTimetableBtn');
    if (unsavedCount > 0) {
        btn.innerHTML = `<i class="fa-solid fa-save"></i> Save ${unsavedCount} Changes`;
        btn.classList.replace('btn-success', 'btn-warning');
    } else {
        btn.innerHTML = `<i class="fa-solid fa-save"></i> Save Timetable`;
        btn.classList.replace('btn-warning', 'btn-success');
    }
}

function setupSaveButton() {
    const btn = document.getElementById('saveTimetableBtn');
    btn.onclick = async () => {
        const unsaved = entries.filter(e => !e.id);
        if (!unsaved.length) return;

        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        const cleanData = unsaved.map(({ tempId, ...rest }) => ({ ...rest, school_id: schoolId }));
        const { error } = await supabase.from('timetable_entries').insert(cleanData);

        if (error) {
            alert('Error: ' + error.message);
            btn.disabled = false;
            updateSaveButtonState();
        } else {
            location.reload();
        }
    };
}

function updateScheduleInfo() {
    if (!config) return;
    document.getElementById('scheduleInfo').innerHTML = `
        <strong>Config:</strong> ${config.start_time} | ${config.period_duration}m periods | ${config.periods_per_day} daily | ${config.active_days.join(', ')}
    `;
}