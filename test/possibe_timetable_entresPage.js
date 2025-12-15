// Supabase client is loaded globally from the HTML script tag
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase configuration
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let config = null;
let entries = [];
let subjects = [];
let teachers = [];

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing timetable_entries.js');
    init();
});

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    const infoText = document.getElementById('scheduleInfo');

    if (!classId) {
        alert('Class ID not found. Redirecting to setup.');
        window.location.href = 'create_timetable_setup.html';
        return;
    }

    try {
        console.log(`Fetching data for Class ID: ${classId}...`);
        
        const [configRes, entriesRes, subjectsRes, teachersRes] = await Promise.all([
            supabase.from('schedule_configs').select('*').eq('class_id', classId).single(),
            supabase.from('timetable_entries').select('*').eq('class_id', classId),
            supabase.from('Subjects').select('*'),
            supabase.from('Teachers').select('*')
        ]);

        if (configRes.error) {
            console.error("Config Error:", configRes.error);
            infoText.textContent = "Error: Could not load schedule configuration.";
            infoText.style.color = "var(--danger)";
            return;
        }

        config = configRes.data;
        config.active_days = config.active_days || [];
        config.break_times = config.break_times || [];

        if (config.active_days.length === 0) {
            infoText.textContent = "Warning: No active days found.";
            infoText.style.color = "var(--warning)";
        } else {
            infoText.textContent = `Schedule: ${config.start_time} start, ${config.period_duration}min periods`;
        }

        entries = entriesRes.data || [];
        subjects = subjectsRes.data || [];
        teachers = teachersRes.data || [];

        populateDropdowns();
        renderScheduleTable(); // <--- UPDATED FUNCTION CALL

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        infoText.textContent = "System Error: Check console for details.";
    }
}

function populateDropdowns() {
    const subjectSelect = document.getElementById('modalSubject');
    // const teacherSelect = document.getElementById('modalTeacher'); // Uncomment if needed

    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';

    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.subject_id; 
        option.textContent = subject.subject_name || subject.name;
        subjectSelect.appendChild(option);
    });
}

// ==========================================
//  NEW: RENDER AS TABLE (GRID) INSTEAD OF KANBAN
// ==========================================
function renderScheduleTable() {
    const container = document.getElementById('kanbanContainer');
    container.innerHTML = '';

    if (!config || !config.active_days.length) {
        container.innerHTML = '<div style="padding: 20px; color: gray;">No days to display.</div>';
        return;
    }

    // 1. Create Table Structure
    const table = document.createElement('table');
    table.className = 'schedule-table'; // Uses the CSS already in your HTML
    table.style.background = 'white';

    // 2. Create Header Row (Time + Days)
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Time Column Header
    const thTime = document.createElement('th');
    thTime.textContent = 'Time';
    headerRow.appendChild(thTime);

    // Day Columns Headers
    config.active_days.forEach(day => {
        const th = document.createElement('th');
        th.textContent = day;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // 3. Create Body Rows (Periods)
    const tbody = document.createElement('tbody');
    let currentMinutes = 0; // Relative to start time

    for (let i = 0; i < config.periods_per_day; i++) {
        const slotTime = addMinutes(config.start_time, i * config.period_duration);
        const tr = document.createElement('tr');

        // Check for Break
        const isBreak = config.break_times && config.break_times.some(b => {
            const breakStart = typeof b === 'object' ? b.start : b;
            return breakStart.slice(0, 5) === slotTime.slice(0, 5);
        });

        if (isBreak) {
            // Render Break Row
            tr.innerHTML = `
                <td style="font-weight:bold; color:#64748b;">${slotTime}</td>
                <td colspan="${config.active_days.length}" style="background:#f1f5f9; color:#94a3b8; font-weight:600; letter-spacing:1px; text-align:center;">
                    BREAK
                </td>
            `;
            tbody.appendChild(tr);
            continue;
        }

        // Render Time Cell
        const tdTime = document.createElement('td');
        tdTime.textContent = slotTime;
        tdTime.style.fontWeight = '500';
        tr.appendChild(tdTime);

        // Render Day Cells
        config.active_days.forEach(day => {
            const td = document.createElement('td');
            
            // Find Entry
            const entry = entries.find(e => 
                e.day_of_week === day && 
                e.start_time.slice(0, 5) === slotTime.slice(0, 5)
            );

            if (entry) {
                // FILLED SLOT
                const subject = subjects.find(s => s.subject_id === entry.subject_id);
                // Use Code if available, else first 3 letters of name
                const subjectName = subject ? (subject.subject_code || subject.subject_name.substring(0,3).toUpperCase()) : 'UNK';
                
                td.innerHTML = `<div class="subject-block" style="background:var(--primary-light); color:var(--primary); padding:4px 8px; border-radius:4px; display:inline-block; font-weight:600; font-size:12px;">
                    ${subjectName}
                </div>`;
                td.style.cursor = 'pointer';
                td.onclick = () => openModal(day, slotTime, entry);
            } else {
                // EMPTY SLOT
                td.innerHTML = `<span style="color:#cbd5e1; font-size:18px;">+</span>`;
                td.style.cursor = 'pointer';
                td.onclick = () => openModal(day, slotTime);
            }

            // Hover effect via JS since it's dynamic
            td.onmouseover = () => { if(!entry) td.style.background = '#f8fafc'; };
            td.onmouseout = () => { if(!entry) td.style.background = 'transparent'; };

            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    container.appendChild(table);
}

function addMinutes(time, minutesToAdd) {
    if (!time) return "00:00";
    const [hours, mins] = time.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(mins + minutesToAdd);
    return date.toTimeString().slice(0, 5);
}

function openModal(day, time, entryData = null) {
    const modal = document.getElementById('entryModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('entryForm');

    title.textContent = entryData ? 'Edit Entry' : `Add Entry - ${day} @ ${time}`;

    document.getElementById('modalDay').value = day;
    document.getElementById('modalTime').value = time;
    document.getElementById('modalEntryId').value = entryData ? entryData.id : '';

    if (entryData) {
        document.getElementById('modalSubject').value = entryData.subject_id;
        document.getElementById('modalDuration').value = entryData.duration_minutes;
    } else {
        form.reset();
        document.getElementById('modalDuration').value = config.period_duration;
    }

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('entryModal').style.display = 'none';
}

// Attach Form Listener safely
const form = document.getElementById('entryForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const urlParams = new URLSearchParams(window.location.search);
        const classId = urlParams.get('classId');

        const data = {
            class_id: classId,
            day_of_week: document.getElementById('modalDay').value,
            start_time: document.getElementById('modalTime').value,
            subject_id: document.getElementById('modalSubject').value,
            duration_minutes: parseInt(document.getElementById('modalDuration').value)
        };

        const entryId = document.getElementById('modalEntryId').value;
        if (entryId) {
            data.id = entryId; 
        }

        try {
            const { error } = await supabase.from('timetable_entries').upsert(data);
            if (error) throw error;
            init(); 
            closeModal();
        } catch (error) {
            console.error('Error saving entry:', error);
            alert('Error saving entry: ' + error.message);
        }
    });
}

// Make functions global for onclick events
window.closeModal = closeModal;