import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// 1. SETUP
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
    // Only overwrite entries if we are NOT currently previewing data
    // (This safety check prevents accidental wipes if init is called wrongly)
    if (entries.length === 0 || entries.every(e => e.id)) {
        entries = entriesRes.data || [];
    }
    
    subjects = subjectsRes.data || [];

    // Defaults
    config.active_days = config.active_days || [];
    config.break_times = config.break_times || [];

    populateDropdowns();
    renderKanban();
}

// ==========================================
// 2. PREVIEW LOGIC
// ==========================================
window.previewUploadedData = function (newEntries) {
    console.log("Previewing:", newEntries.length, "entries");
    // Add new entries to the list
    entries = [...entries, ...newEntries]; 
    
    renderKanban(); 
    updateSaveButtonState();
};



function updateSaveButtonState() {
    const unsavedCount = entries.filter(e => !e.id).length;
    const saveBtn = document.getElementById('saveTimetableBtn');
    
    if (saveBtn && unsavedCount > 0) {
        saveBtn.innerHTML = `<i class="fa-solid fa-save"></i> Save ${unsavedCount} Changes`;
        saveBtn.classList.remove('btn-success');
        saveBtn.classList.add('btn-warning');
        saveBtn.style.backgroundColor = "#f59e0b";
        saveBtn.style.borderColor = "#f59e0b";
        saveBtn.style.color = "white";
    }
}

// ==========================================
// 3. HYBRID TIMELINE GENERATOR
// ==========================================
function generateMasterTimeline(config, entries) {
    const timesSet = new Set();
    
    // A. Add Times from DATA
    entries.forEach(e => {
        if(e.start_time) timesSet.add(e.start_time.slice(0, 5));
    });

    // B. Add Times from CONFIG
    let currentMinutes = 0;
    const limit = config.periods_per_day || 8; 
    let periodsCounted = 0;
    let safety = 0;

    while(periodsCounted < limit && safety < 50) {
        safety++;
        const t = addMinutes(config.start_time, currentMinutes);
        const timeStr = t.slice(0, 5);
        timesSet.add(timeStr);

        const breakObj = config.break_times.find(b => {
             const start = typeof b === 'object' ? b.start : b;
             return start.startsWith(timeStr);
        });

        if (breakObj) {
            const dur = typeof breakObj === 'object' ? parseInt(breakObj.duration, 10)||20 : 20;
            currentMinutes += dur;
        } else {
            const pDur = parseInt(config.period_duration, 10)||40;
            currentMinutes += pDur;
            periodsCounted++;
        }
    }

    // C. CRITICAL FIX: Explicitly Add ALL Break Times
    if (config.break_times && Array.isArray(config.break_times)) {
        config.break_times.forEach(b => {
            const start = typeof b === 'object' ? b.start : b;
            if (start) timesSet.add(start.slice(0, 5));
        });
    }

    return Array.from(timesSet).sort();
}
// ==========================================
// 4. RENDERER
// ==========================================
function renderKanban() {
    container.innerHTML = '';
    if (!config || !config.active_days.length) return;

    const masterTimeline = generateMasterTimeline(config, entries);

    config.active_days.forEach(day => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.style.cssText = 'min-width: 280px; background: var(--bg-light); border-radius: 8px; padding: 16px; flex-shrink: 0;';

        const header = document.createElement('h3');
        header.textContent = day;
        header.style.cssText = 'margin-bottom: 16px; font-weight: 700; text-transform: uppercase; border-bottom: 2px solid var(--primary); padding-bottom: 8px;';
        column.appendChild(header);

        masterTimeline.forEach(timeSlot => {
            const entry = entries.find(e => {
                if (!e.start_time || !e.day_of_week) return false;
                const dbDay = e.day_of_week.substring(0, 3);
                const currentDay = day.substring(0, 3);
                const dbTime = e.start_time.slice(0, 5);
                return dbDay === currentDay && dbTime === timeSlot;
            });

            const isBreak = config.break_times.some(b => {
                const start = typeof b === 'object' ? b.start : b;
                return start.startsWith(timeSlot);
            });

            if (isBreak) {
                console.log("active")
                const breakDiv = document.createElement('div');
                breakDiv.textContent = 'BREAK';
                breakDiv.style.cssText = 'background: #e2e8f0; color: #64748b; padding: 8px; margin-bottom: 12px; text-align: center; font-weight: 700; border-radius: 6px; font-size: 12px;';
                column.appendChild(breakDiv);
                if (!entry) return; 
            }

            const pill = document.createElement('div');

            if (entry) {
                const isUnsaved = !entry.id;
                const bgColor = isUnsaved ? '#f59e0b' : 'var(--primary)'; 
                const subject = subjects.find(s => s.subject_id === entry.subject_id);
                const subName = subject ? (subject.subject_code || subject.subject_name) : 'Unknown';

                pill.innerHTML = `
                    <div style="font-weight: 600; font-size: 15px;">
                        ${subName} ${isUnsaved ? '<i class="fa-solid fa-asterisk" style="font-size:10px;"></i>' : ''}
                    </div>
                    <div style="font-size: 12px; opacity: 0.8;">${timeSlot}</div>
                `;
                pill.style.cssText = `padding: 12px; margin-bottom: 12px; border-radius: 8px; background: ${bgColor}; color: white; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);`;
                
                // Pass a unique identifier (ID if exists, or random temp ID) to finding it later
                // We use the object reference directly in the onclick to save hassle
                pill.onclick = () => openModal(day, timeSlot, entry);
            } else {
                pill.innerHTML = `<span style="font-weight: 600;">${timeSlot}</span> <span style="font-size: 13px;">+ Add</span>`;
                pill.style.cssText = 'padding: 12px; margin-bottom: 12px; border: 2px dashed #cbd5e1; border-radius: 8px; color: #64748b; cursor: pointer; display: flex; justify-content: space-between;';
                pill.onclick = () => openModal(day, timeSlot);
            }
            column.appendChild(pill);
        });
        container.appendChild(column);
    });
}

function addMinutes(time, minutesToAdd) {
    if (!time) return "08:00";
    const [hours, mins] = time.split(':').map(Number);
    let totalMinutes = (hours * 60) + mins + minutesToAdd;
    const newHours = Math.floor(totalMinutes / 60);
    const newMins = totalMinutes % 60;
    return `${newHours.toString().padStart(2, '0')}:${newMins.toString().padStart(2, '0')}`;
}

function setupSaveButton() {
    const saveBtn = document.getElementById('saveTimetableBtn');
    if (!saveBtn) return;
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);

    newBtn.addEventListener('click', async () => {
        const unsavedEntries = entries.filter(e => !e.id);
        if (unsavedEntries.length === 0) return alert("No changes.");

        newBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        try {
            // Remove 'tempId' if we added it for local editing
            const cleanEntries = unsavedEntries.map(({tempId, ...rest}) => rest);
            
            const { error } = await supabase.from('timetable_entries').insert(cleanEntries);
            if (error) throw error;
            alert("Saved!");
            location.reload(); 
        } catch (err) {
            alert("Error: " + err.message);
            newBtn.innerHTML = 'Save Timetable';
        }
    });
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

// Globals
window.closeModal = () => document.getElementById('entryModal').style.display = 'none';

// Track which entry is being edited (if it's a new unsaved one)
let currentEditingEntry = null;

window.openModal = function(day, time, entryData) {
    const modal = document.getElementById('entryModal');
    document.getElementById('modalTitle').textContent = entryData ? 'Edit Entry' : `Add Entry - ${day} @ ${time}`;
    document.getElementById('modalDay').value = day;
    document.getElementById('modalTime').value = time;
    
    // Store reference to the object being edited
    currentEditingEntry = entryData || null;
    
    document.getElementById('modalEntryId').value = entryData ? (entryData.id || '') : '';
    
    if (entryData) {
        document.getElementById('modalSubject').value = entryData.subject_id;
        document.getElementById('modalDuration').value = entryData.duration_minutes;
    } else {
        document.getElementById('entryForm').reset();
        document.getElementById('modalDuration').value = config.period_duration;
    }
    modal.style.display = 'flex';
};

// ==========================================
// 5. THE FIX: SMART FORM HANDLER
// ==========================================
const form = document.getElementById('entryForm');
if (form) {
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const urlParams = new URLSearchParams(window.location.search);
        const classId = urlParams.get('classId');
        const entryId = document.getElementById('modalEntryId').value;
        
        const newData = {
            class_id: parseInt(classId), // ensure number
            day_of_week: document.getElementById('modalDay').value,
            start_time: document.getElementById('modalTime').value, // Assuming input is HH:MM, need to ensure DB match
            subject_id: document.getElementById('modalSubject').value,
            duration_minutes: parseInt(document.getElementById('modalDuration').value)
        };

        // Fix Time Format: Ensure it has :00 if DB requires it
        if(newData.start_time.length === 5) newData.start_time += ":00";

        // SCENARIO A: Editing an EXISTING SAVED entry (Has ID)
        if (entryId) {
            try {
                const { error } = await supabase.from('timetable_entries').update(newData).eq('id', entryId);
                if (error) throw error;
                
                // Refresh from DB because we committed a change
                window.location.reload(); 
            } catch (error) {
                alert('Error updating: ' + error.message);
            }
        } 
        // SCENARIO B: Editing an UNSAVED PREVIEW entry (No ID)
        else if (currentEditingEntry) {
            // Just update the object in memory!
            currentEditingEntry.subject_id = newData.subject_id;
            currentEditingEntry.duration_minutes = newData.duration_minutes;
            
            // Close modal and re-render board
            window.closeModal();
            renderKanban();
            // Don't reload! We want to keep the other yellow items.
        }
        // SCENARIO C: Creating a BRAND NEW entry from scratch
        else {
             // Add to local array as unsaved
             entries.push({
                 ...newData,
                 tempId: Date.now() // temporary marker
             });
             
             window.closeModal();
             renderKanban();
             updateSaveButtonState();
        }
    });
}