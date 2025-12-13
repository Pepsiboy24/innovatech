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
            infoText.textContent = "Error: Could not load schedule configuration. Did you complete Step 1?";
            infoText.style.color = "var(--danger)";
            return;
        }

        // DEBUG: See what the DB actually returned
        console.log("Config Data:", configRes.data);
        console.log("Entries Data:", entriesRes.data);

        config = configRes.data;
        
        // Safety checks
        config.active_days = config.active_days || [];
        config.break_times = config.break_times || [];

        // Check if Active Days is empty (Common Issue)
        if (config.active_days.length === 0) {
            infoText.textContent = "Warning: No active days found in configuration. Please go back to Setup.";
            infoText.style.color = "var(--warning)";
        } else {
            infoText.textContent = `Schedule: ${config.start_time} start, ${config.period_duration}min periods`;
        }

        entries = entriesRes.data || [];
        subjects = subjectsRes.data || [];
        teachers = teachersRes.data || [];

        populateDropdowns();
        renderKanban();

    } catch (error) {
        console.error('CRITICAL ERROR:', error);
        infoText.textContent = "System Error: Check console for details.";
    }
}

function populateDropdowns() {
    const subjectSelect = document.getElementById('modalSubject');
    const teacherSelect = document.getElementById('modalTeacher');

    // Clear existing options first (except the placeholder)
    subjectSelect.innerHTML = '<option value="">-- Select Subject --</option>';
    teacherSelect.innerHTML = '<option value="">-- Select Teacher --</option>';

    subjects.forEach(subject => {
        const option = document.createElement('option');
        // Check your DB column names here (subject_id vs id)
        option.value = subject.subject_id; 
        option.textContent = subject.subject_name || subject.name;
        subjectSelect.appendChild(option);
    });

    teachers.forEach(teacher => {
        const option = document.createElement('option');
        option.value = teacher.teacher_id;
        option.textContent = `${teacher.first_name} ${teacher.last_name}`;
        teacherSelect.appendChild(option);
    });
}

function renderKanban() {
    const container = document.getElementById('kanbanContainer');
    container.innerHTML = '';

    if (!config || !config.active_days.length) {
        container.innerHTML = '<div style="padding: 20px; color: gray;">No days to display.</div>';
        return;
    }

    config.active_days.forEach(day => {
        const column = document.createElement('div');
        column.className = 'kanban-column';
        column.style.cssText = 'min-width: 300px; background: var(--bg-light); border-radius: 8px; padding: 16px; flex-shrink: 0;';

        const header = document.createElement('h3');
        header.textContent = day;
        header.style.cssText = 'margin-bottom: 16px; font-weight: 600; text-transform: uppercase; color: var(--text-gray); font-size: 14px; letter-spacing: 0.5px;';
        column.appendChild(header);

        for (let i = 0; i < config.periods_per_day; i++) {
            // Calculate time for this slot
            const slotTime = addMinutes(config.start_time, i * config.period_duration);

            // 1. CHECK FOR BREAK
            // We use .some() to see if ANY break matches this time
            const isBreak = config.break_times && config.break_times.some(b => {
                // Handle both object format {start: "10:00"} and string format "10:00"
                const breakStart = typeof b === 'object' ? b.start : b;
                // Compare only HH:MM (slice first 5 chars) to avoid second mismatches
                return breakStart.slice(0, 5) === slotTime.slice(0, 5);
            });

            if (isBreak) {
                const breakDiv = document.createElement('div');
                breakDiv.textContent = 'BREAK';
                breakDiv.style.cssText = 'background: #f1f5f9; color: #94a3b8; padding: 8px; margin-bottom: 8px; border-radius: 4px; text-align: center; font-size: 12px; font-weight: 600; letter-spacing: 1px;';
                column.appendChild(breakDiv);
                // Depending on logic, you might want to 'continue' here to skip adding a button
                // OR render the button anyway if breaks don't consume a 'period slot'.
                // For now, let's assume breaks take up a slot:
                continue; 
            }

            // 2. CHECK FOR ENTRY
            const existingEntry = entries.find(entry => 
                entry.day_of_week === day && 
                entry.start_time.slice(0, 5) === slotTime.slice(0, 5)
            );

            // 3. CREATE BUTTON
            const pill = document.createElement('button');
            
            if (existingEntry) {
                // Purple Filled Pill
                const subject = subjects.find(s => s.subject_id === existingEntry.subject_id);
                const subjectName = subject ? (subject.subject_code || subject.subject_name) : 'Unknown';
                
                pill.innerHTML = `
                    <div style="font-weight: 600; font-size: 14px;">${subjectName}</div>
                    <div style="font-size: 12px; opacity: 0.9;">${existingEntry.room_number || 'No Room'}</div>
                `;
                pill.style.cssText = 'width: 100%; padding: 12px; margin-bottom: 8px; border: none; border-radius: 8px; background: var(--primary); color: white; cursor: pointer; text-align: left; box-shadow: 0 2px 4px rgba(98, 0, 234, 0.2); transition: transform 0.2s;';
                pill.onmouseover = () => pill.style.transform = 'translateY(-2px)';
                pill.onmouseout = () => pill.style.transform = 'translateY(0)';
                pill.onclick = () => openModal(day, slotTime, existingEntry);
            } else {
                // Gray Dashed Pill
                pill.innerHTML = `
                    <span style="font-weight: 600;">${slotTime}</span> 
                    <span style="font-size: 12px;">+ Add</span>
                `;
                pill.style.cssText = 'width: 100%; padding: 12px; margin-bottom: 8px; border: 2px dashed var(--border); border-radius: 8px; background: white; color: var(--text-gray); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;';
                pill.onmouseover = () => { pill.style.borderColor = 'var(--primary)'; pill.style.color = 'var(--primary)'; };
                pill.onmouseout = () => { pill.style.borderColor = 'var(--border)'; pill.style.color = 'var(--text-gray)'; };
                pill.onclick = () => openModal(day, slotTime);
            }

            column.appendChild(pill);
        }

        container.appendChild(column);
    });
}

function addMinutes(time, minutesToAdd) {
    if (!time) return "00:00";
    // Ensure we handle "08:00:00" and "08:00"
    const [hours, mins] = time.split(':').map(Number);
    
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(mins + minutesToAdd);
    
    // Return HH:MM format
    return date.toTimeString().slice(0, 5);
}

function openModal(day, time, entryData = null) {
    const modal = document.getElementById('entryModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('entryForm');

    title.textContent = entryData ? 'Edit Entry' : `Add Entry - ${day} @ ${time}`;

    document.getElementById('modalDay').value = day;
    document.getElementById('modalTime').value = time;
    document.getElementById('modalEntryId').value = entryData ? entryData.id : ''; // Check if column is 'id' or 'entry_id'

    if (entryData) {
        document.getElementById('modalSubject').value = entryData.subject_id;
        document.getElementById('modalTeacher').value = entryData.teacher_id;
        document.getElementById('modalRoom').value = entryData.room_number;
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
            teacher_id: document.getElementById('modalTeacher').value,
            room_number: document.getElementById('modalRoom').value,
            duration_minutes: parseInt(document.getElementById('modalDuration').value)
        };

        const entryId = document.getElementById('modalEntryId').value;
        if (entryId) {
            data.id = entryId; // Check DB primary key name
        }

        try {
            const { error } = await supabase
                .from('timetable_entries')
                .upsert(data);

            if (error) throw error;

            // Refresh
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