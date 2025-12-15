// Import Supabase client (ensure this path matches your project)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const container = document.getElementById('kanbanContainer');

let config = null;
let entries = [];
let subjects = [];

document.addEventListener('DOMContentLoaded', () => {
    init();
    setupSaveButton();
});

async function init() {
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    if (!classId) return window.location.href = 'create_timetable_setup.html';

    const [configRes, entriesRes, subjectsRes] = await Promise.all([
        supabase.from('schedule_configs').select('*').eq('class_id', classId).single(),
        supabase.from('timetable_entries').select('*').eq('class_id', classId),
        supabase.from('Subjects').select('*')
    ]);

    config = configRes.data;
    // Load EXISTING saved entries
    entries = entriesRes.data || [];
    subjects = subjectsRes.data || [];

    // Ensure config defaults
    config.active_days = config.active_days || [];
    config.break_times = config.break_times || [];

    populateDropdowns();
    renderKanban();
}

// ==========================================
// 1. PREVIEW DATA (Receives data from Excel)
// ==========================================
window.previewUploadedData = function (newEntries) {
    console.log("Previewing data:", newEntries);

    // Add the new entries (which have no IDs) to the main list
    entries = [...entries, ...newEntries];

    // Re-render the Kanban board immediately
    renderKanban();

    // Update the Save Button to show unsaved changes
    const saveBtn = document.getElementById('saveTimetableBtn');
    if (saveBtn) {
        saveBtn.innerHTML = `<i class="fa-solid fa-save"></i> Save ${newEntries.length} Changes`;
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-warning'); // Turn Yellow/Orange
        saveBtn.style.backgroundColor = "#f59e0b";
        saveBtn.style.color = "white";
    }
};

// ==========================================
// 2. SAVE BUTTON (Commits to DB)
// ==========================================
function setupSaveButton() {
    const saveBtn = document.getElementById('saveTimetableBtn');
    if (!saveBtn) return;

    // Clone to remove old event listeners
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.addEventListener('click', async () => {
        // Find entries that represent new uploads (they have no database ID)
        const unsavedEntries = entries.filter(e => !e.id);

        if (unsavedEntries.length === 0) {
            alert("No new changes to save.");
            return;
        }

        newBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';

        try {
            const { error } = await supabase.from('timetable_entries').insert(unsavedEntries);
            if (error) throw error;

            alert("Success! Timetable saved.");
            location.reload(); // Refresh to lock it in
        } catch (err) {
            console.error(err);
            alert("Error saving: " + err.message);
            newBtn.innerHTML = '<i class="fa-solid fa-save"></i> Save Timetable';
        }
    });
}

// ==========================================
// 3. KANBAN RENDERER
// ==========================================
function renderKanban() {
    container.innerHTML = '';

    if (!config || !config.active_days.length) return;

    config.active_days.forEach(day => {
        // console.log(day)
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.style.cssText = 'min-width: 280px; background: var(--bg-light); border-radius: 8px; padding: 16px; flex-shrink: 0;';

        const header = document.createElement('h3');
        header.textContent = day;
        column.appendChild(header);

        let currentMinutes = 0;

        for (let i = 0; i < config.periods_per_day; i++) {
            const slotTime = addMinutes(config.start_time, currentMinutes);

            // 2. Add ":00" to match Database format ("14:00:00")
            const normalizedSlot = slotTime.slice(0, 5);
            // console.log("time: " + normalizedSlot)

            // Break Logic
            const isBreak = config.break_times && config.break_times.some(b => {
                const start = typeof b === 'object' ? b.start : b;
                return start.startsWith(normalizedSlot);
            });

            if (isBreak) {
                // 1. Render the Break Bar
                const breakDiv = document.createElement('div');
                breakDiv.textContent = 'BREAK';
                breakDiv.style.cssText = 'background: #e2e8f0; color: #64748b; padding: 8px; margin-bottom: 12px; text-align: center; font-weight: 700; border-radius: 6px;';
                column.appendChild(breakDiv);

                // 2. Add Break Duration to Time
                const breakObj = config.break_times.find(b => (typeof b === 'object' ? b.start : b).startsWith(normalizedSlot));
                const duration = breakObj && typeof breakObj === 'object' ? breakObj.duration : 20;
                currentMinutes += duration;

                // 3. IMPORTANT: Skip the rest of this loop iteration!
                // This prevents the "Hi" / Empty Slot from appearing under the break.
                continue;
            }

            // Find Entry (Matches Day AND Time)
            const entry = entries.find(e => {
                if (!e.start_time || !e.day_of_week) return false;

                // 1. Normalize Time (Ignore seconds)
                const dbTime = e.start_time.slice(0, 5);

                // 2. Normalize Day (Compare first 3 letters only)
                // "Monday" -> "Mon"  ===  "Mon" -> "Mon"
                const dbDay = e.day_of_week.substring(0, 3);
                const currentDay = day.substring(0, 3);

                // 3. Compare
                return dbDay === currentDay && dbTime === normalizedSlot;
            });
            // console.log(entry)

            const pill = document.createElement('div');

            if (entry) {
                // --- FOUND (Display Subject) ---
                console.log(`[MATCH] Found ${day} @ ${normalizedSlot}`);

                const isUnsaved = !entry.id;
                const bgColor = isUnsaved ? '#f59e0b' : 'var(--primary)';

                const subject = subjects.find(s => s.subject_id === entry.subject_id);
                const subName = subject ? (subject.subject_code || subject.subject_name) : 'Unknown';

                pill.innerHTML = `
        <div style="font-weight: 600; font-size: 15px;">
            ${subName} ${isUnsaved ? '<i class="fa-solid fa-asterisk" style="margin-left:5px; font-size:12px;"></i>' : ''}
        </div>
        <div style="font-size: 12px; opacity: 0.8;">${normalizedSlot}</div>
    `;
                pill.style.cssText = `padding: 12px; margin-bottom: 12px; border-radius: 8px; background: ${bgColor}; color: white; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;
                pill.onclick = () => openModal(day, slotTime, entry);

            } else {
                // --- EMPTY (Display + Add) ---
                console.log(`[EMPTY] No class for ${day} @ ${normalizedSlot}`);

                pill.innerHTML = `<span style="font-weight: 600;">${normalizedSlot}</span> <span style="font-size: 13px;">+ Add</span>`;
                pill.style.cssText = 'padding: 12px; margin-bottom: 12px; border: 2px dashed #cbd5e1; border-radius: 8px; color: #64748b; cursor: pointer; display: flex; justify-content: space-between;';
                pill.onclick = () => openModal(day, slotTime);
            }

            column.appendChild(pill);

            // Advance time for the next period
            currentMinutes += config.period_duration
        }
        container.appendChild(column);
    });
}

function addMinutes(time, minutesToAdd) {
    if (!time) return "08:00";

    const [hours, mins] = time.split(':').map(Number);

    // Convert current time to total minutes
    let totalMinutes = (hours * 60) + mins + minutesToAdd;

    // Calculate new hours and minutes
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;

    // Force 2-digit format (08:00 instead of 8:0)
    const formattedHours = newHours.toString().padStart(2, '0');
    const formattedMins = newMins.toString().padStart(2, '0');

    return `${formattedHours}:${formattedMins}`;
}
function populateDropdowns() {
    const subjectSelect = document.getElementById('modalSubject');
    if (!subjectSelect) return;
    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
    subjects.forEach(subject => {
        const option = document.createElement('option');
        option.value = subject.subject_id;
        option.textContent = subject.subject_name || subject.name;
        subjectSelect.appendChild(option);
    });
}

// Modal functions omitted for brevity, ensure you keep them in the file!
// (openModal, closeModal, form listener)