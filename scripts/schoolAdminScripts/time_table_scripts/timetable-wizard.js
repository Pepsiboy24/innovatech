import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', () => {
    console.log("Timetable Wizard Loaded");
    fetchClasses();
    setupEventListeners();
});

// 1. Populate Class Dropdown
async function fetchClasses() {
    const classSelect = document.getElementById('classSelect');
    try {
        const { data, error } = await supabase.from('Classes').select('class_id, class_name, section');
        if (error) throw error;
        
        data.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.class_id;
            option.textContent = `${cls.class_name} ${cls.section}`;
            classSelect.appendChild(option);
        });
    } catch (err) {
        console.error("Error fetching classes:", err);
    }
}

// 2. Setup Event Listeners
function setupEventListeners() {
    // Add Break Button
    document.getElementById('addBreakBtn').addEventListener('click', () => addBreakField());

    // Form Submission
    const form = document.getElementById('scheduleSetupForm');
    if (form) {
        form.addEventListener('submit', handleSaveConfig);
    }

    // 🟢 NEW: Listen for Class Selection changes
    document.getElementById('classSelect').addEventListener('change', (e) => {
        const classId = e.target.value;
        if (classId) {
            loadClassConfig(classId);
        } else {
            resetForm();
        }
    });
}

// 🟢 NEW: Function to Load Existing Config
async function loadClassConfig(classId) {
    console.log(`Checking config for class ${classId}...`);

    try {
        const { data, error } = await supabase
            .from('schedule_configs')
            .select('*')
            .eq('class_id', classId)
            .maybeSingle(); // Use maybeSingle to handle 0 or 1 result gracefully

        if (error) {
            console.error("Error fetching config:", error);
            return;
        }

        if (data) {
            // 🛑 STOP! Config exists.
            alert("A timetable already exists for this class.\n\nPlease go to the Dashboard to edit it, or select a different class to create a new one.");
            
            // 1. Clear the class selection so they can't proceed
            document.getElementById('classSelect').value = "";
            
            // 2. Reset the form to defaults
            resetForm();
            
            return;
        } 
        
        // If we get here, it's a NEW class.
        console.log("No existing config. Ready to create.");
        resetForm();

    } catch (err) {
        console.error("Load Config Error:", err);
    }
}

function resetForm() {
    document.getElementById('startTime').value = "08:00";
    document.getElementById('endTime').value = "16:00";
    document.getElementById('periodDuration').value = "40";

    // Check all days by default
    document.querySelectorAll('input[name="active_days"]').forEach(cb => cb.checked = true);

    // Reset breaks
    document.getElementById('breaksContainer').innerHTML = '';
    addBreakField("10:00", 20); // Add default break

    // Reset Button Text
    const submitBtn = document.querySelector('button[type="submit"]');
    submitBtn.innerHTML = `Next: Add Entries <i class="fa-solid fa-arrow-right"></i>`;
}

// 3. Add Dynamic Break Fields (Updated to accept values)
function addBreakField(startTime = '', duration = '20') {
    const container = document.getElementById('breaksContainer');
    const breakDiv = document.createElement('div');
    breakDiv.className = 'break-item';
    breakDiv.innerHTML = `
        <div class="form-row">
            <div class="form-group">
                <label>Break Start Time</label>
                <input type="time" name="break_start_time" value="${startTime}" required>
            </div>
            <div class="form-group">
                <label>Break Duration (minutes)</label>
                <input type="number" name="break_duration" value="${duration}" min="5" max="120" required>
            </div>
            <div class="form-group" style="display: flex; align-items: flex-end;">
                <button type="button" class="btn btn-sm btn-danger remove-break" onclick="this.closest('.break-item').remove()">
                    <i class="fa-solid fa-trash"></i> Remove
                </button>
            </div>
        </div>
    `;
    container.appendChild(breakDiv);
}


// Helper function to convert time string to minutes
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Helper function to convert minutes to time string
function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Calculate periods per day and validate break alignment
function calculatePeriodsAndValidate(startTime, endTime, periodDuration, breaks) {
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const periodDur = parseInt(periodDuration);
    
    let currentTime = startMinutes;
    let periodCount = 0;
    const periodEndTimes = [];
    
    // Calculate all period end times for validation
    while (currentTime < endMinutes) {
        const periodEnd = currentTime + periodDur;
        if (periodEnd > endMinutes) break;
        
        periodEndTimes.push(periodEnd);
        currentTime = periodEnd;
        periodCount++;
    }
    
    // Validate break alignment
    for (const breakItem of breaks) {
        const breakStart = timeToMinutes(breakItem.start);
        const breakDuration = parseInt(breakItem.duration);
        
        // Check if break start time aligns with any period end time
        const alignedBreak = periodEndTimes.find(endTime => endTime === breakStart);
        
        if (!alignedBreak) {
            // Break doesn't align with period end - find the closest aligned time
            let closestAlignedTime = null;
            let minDifference = Infinity;
            
            for (const periodEnd of periodEndTimes) {
                const difference = Math.abs(periodEnd - breakStart);
                if (difference < minDifference) {
                    minDifference = difference;
                    closestAlignedTime = periodEnd;
                }
            }
            
            const suggestedTime = closestAlignedTime ? minutesToTime(closestAlignedTime) : "period boundary";
            return {
                valid: false,
                error: `Invalid Break Time: The break at ${breakItem.start} interrupts a class period. Please adjust it to align with the schedule (e.g., try ${suggestedTime}).`,
                periodsPerDay: periodCount
            };
        }
    }
    
    return {
        valid: true,
        periodsPerDay: periodCount
    };
}

// 4. Handle Save
async function handleSaveConfig(e) {
    e.preventDefault();
    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.innerHTML;
    btn.textContent = "Saving...";
    btn.disabled = true;

    try {
        const classId = document.getElementById('classSelect').value;
        const startTime = document.getElementById('startTime').value;
        const endTime = document.getElementById('endTime').value;
        const periodDuration = document.getElementById('periodDuration').value;

        // Capture Active Days
        const activeDaysCheckboxes = document.querySelectorAll('input[name="active_days"]:checked');
        const activeDays = Array.from(activeDaysCheckboxes).map(cb => cb.value);

        if (activeDays.length === 0) {
            alert("Please select at least one active day.");
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        // Capture Breaks
        const breakItems = document.querySelectorAll('.break-item');
        const breaks = Array.from(breakItems).map(item => ({
            start: item.querySelector('input[name="break_start_time"]').value,
            duration: parseInt(item.querySelector('input[name="break_duration"]').value)
        })).filter(b => b.start);

        // Calculate periods per day and validate break alignment
        const calculationResult = calculatePeriodsAndValidate(startTime, endTime, periodDuration, breaks);
        
        if (!calculationResult.valid) {
            alert(calculationResult.error);
            btn.innerHTML = originalText;
            btn.disabled = false;
            return;
        }

        const configData = {
            class_id: classId,
            start_time: startTime,
            // end_time: endTime,
            period_duration: parseInt(periodDuration),
            periods_per_day: calculationResult.periodsPerDay,
            active_days: activeDays,
            break_times: breaks
        };

        // Check exists
        const { data: existing } = await supabase.from('schedule_configs').select('id').eq('class_id', classId).maybeSingle();
        
        let error;
        if (existing) {
             const { error: updateErr } = await supabase.from('schedule_configs').update(configData).eq('class_id', classId);
             error = updateErr;
        } else {
             const { error: insertErr } = await supabase.from('schedule_configs').insert(configData);
             error = insertErr;
        }

        if (error) throw error;

        window.location.href = `create_timetable_entries.html?classId=${classId}`;

    } catch (err) {
        console.error("Save Error:", err);
        alert("Error saving configuration: " + err.message);
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}
