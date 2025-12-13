import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Global variables
let allTimetables = [];
let allConfigs = [];
let allClasses = [];
let allSubjects = [];
let allTeachers = [];

document.addEventListener('DOMContentLoaded', () => {
    console.log("TimeTable Display Loaded");
    loadAllTimetableData();
    setupEventListeners();
});

// Setup event listeners
function setupEventListeners() {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.toolbar .btn:not([data-create_time_table])');
    filterButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to clicked button
            button.classList.add('active');
            
            // Filter timetables based on button text
            const filter = button.textContent.trim();
            filterTimetables(filter);
        });
    });
}

// Load all timetable data from database
async function loadAllTimetableData() {
    try {
        console.log("Loading timetable data...");
        
        // Load all timetable-related data
        const [configsRes, classesRes, subjectsRes, teachersRes] = await Promise.all([
            supabase.from('schedule_configs').select('*'),
            supabase.from('Classes').select('*'),
            supabase.from('Subjects').select('*'),
            supabase.from('Teachers').select('*')
        ]);

        if (configsRes.error) {
            console.error("Error loading configs:", configsRes.error);
        }
        if (classesRes.error) {
            console.error("Error loading classes:", classesRes.error);
        }
        if (subjectsRes.error) {
            console.error("Error loading subjects:", subjectsRes.error);
        }
        if (teachersRes.error) {
            console.error("Error loading teachers:", teachersRes.error);
        }

        allConfigs = configsRes.data || [];
        allClasses = classesRes.data || [];
        allSubjects = subjectsRes.data || [];
        allTeachers = teachersRes.data || [];

        console.log("Loaded data:", {
            configs: allConfigs.length,
            classes: allClasses.length,
            subjects: allSubjects.length,
            teachers: allTeachers.length
        });

        // Load timetable entries for each class
        await loadTimetableEntries();

    } catch (error) {
        console.error("Error loading timetable data:", error);
        showErrorMessage("Failed to load timetable data. Please refresh the page.");
    }
}

// Load timetable entries for all classes
async function loadTimetableEntries() {
    try {
        const { data: entries, error } = await supabase
            .from('timetable_entries')
            .select('*, Subjects(*), Teachers(*), Classes(*)');

        if (error) {
            console.error("Error loading entries:", error);
            return;
        }

        // Group entries by class_id
        allTimetables = allConfigs.map(config => {
            const classInfo = allClasses.find(c => c.class_id === config.class_id);
            const classEntries = (entries || []).filter(entry => entry.class_id === config.class_id);
            
            return {
                config: config,
                classInfo: classInfo,
                entries: classEntries
            };
        });

        renderTimetableCards();

    } catch (error) {
        console.error("Error loading timetable entries:", error);
        showErrorMessage("Failed to load timetable entries. Please refresh the page.");
    }
}

// Render timetable cards
function renderTimetableCards() {
    const container = document.getElementById('timetablesGrid');
    
    if (allTimetables.length === 0) {
        container.innerHTML = `
            <div class="no-timetables-message">
                <i class="fa-solid fa-calendar-times"></i>
                <h3>No Timetables Found</h3>
                <p>Create your first timetable to get started.</p>
                <button class="btn btn-primary" onclick="window.location.href='./create_timetable_setup.html'">
                    <i class="fa-solid fa-plus"></i>
                    Create Timetable
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = allTimetables.map(timetable => createTimetableCard(timetable)).join('');
}

// Create individual timetable card HTML
function createTimetableCard(timetable) {
    const { config, classInfo, entries } = timetable;
    const className = classInfo ? `${classInfo.class_name} ${classInfo.section}` : `Class ${config.class_id}`;
    
    // Generate time slots
    const timeSlots = generateTimeSlots(config);
    
    // Generate table rows for each time slot
    const tableRows = timeSlots.map(slot => generateTableRow(slot, entries, config)).join('');
    
    return `
        <div class="timetable-card" data-class-id="${config.class_id}">
            <div class="timetable-header">
                <div>
                    <h3 class="timetable-title">${className}</h3>
                    <p class="timetable-subtitle">${config.start_time} - ${config.end_time} | ${config.period_duration}min periods</p>
                </div>
                <div class="timetable-actions">
                    <button class="btn-icon" onclick="editTimetable('${config.class_id}')" title="Edit Timetable">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn-icon" onclick="deleteTimetable('${config.class_id}')" title="Delete Timetable">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>

            <div class="timetable-summary">
                <div class="summary-item">
                    <span class="summary-label">Active Days:</span>
                    <span class="summary-value">${config.active_days.join(', ')}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Periods/Day:</span>
                    <span class="summary-value">${config.periods_per_day}</span>
                </div>
                <div class="summary-item">
                    <span class="summary-label">Breaks:</span>
                    <span class="summary-value">${config.break_times.length}</span>
                </div>
            </div>

            <table class="schedule-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>Mon</th>
                        <th>Tue</th>
                        <th>Wed</th>
                        <th>Thu</th>
                        <th>Fri</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="card-footer">
                <button class="btn-view" onclick="viewFullTimetable('${config.class_id}')">
                    <i class="fa-solid fa-expand"></i>
                    View Full Timetable
                </button>
                <button class="btn-edit" onclick="editTimetable('${config.class_id}')">
                    <i class="fa-solid fa-pen"></i>
                    Edit Schedule
                </button>
            </div>
        </div>
    `;
}

// Generate time slots based on configuration
function generateTimeSlots(config) {
    const slots = [];
    let currentTime = timeToMinutes(config.start_time);
    const endTime = timeToMinutes(config.end_time);
    
    for (let i = 0; i < config.periods_per_day; i++) {
        const slotTime = minutesToTime(currentTime);
        
        // Check if this is a break time
        const isBreak = config.break_times && config.break_times.some(breakTime => {
            const breakStart = typeof breakTime === 'object' ? breakTime.start : breakTime;
            return breakStart === slotTime;
        });
        
        slots.push({
            time: slotTime,
            isBreak: isBreak,
            breakDuration: isBreak ? (config.break_times.find(bt => (typeof bt === 'object' ? bt.start : bt) === slotTime)?.duration || 30) : 0
        });
        
        // Move to next period
        currentTime += config.period_duration;
        
        // If this was a break, skip the break duration
        if (isBreak) {
            const breakObj = config.break_times.find(bt => (typeof bt === 'object' ? bt.start : bt) === slotTime);
            const breakDuration = breakObj ? (typeof breakObj === 'object' ? breakObj.duration : 30) : 30;
            currentTime += breakDuration;
        }
        
        if (currentTime >= endTime) break;
    }
    
    return slots;
}

// Generate table row for a time slot
function generateTableRow(slot, entries, config) {
    if (slot.isBreak) {
        return `
            <tr>
                <td>${slot.time}</td>
                <td colspan="5" class="break">Break (${slot.breakDuration}min)</td>
            </tr>
        `;
    }
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const cells = days.map(day => {
        const entry = entries.find(e => 
            e.day_of_week === day && 
            e.start_time.slice(0, 5) === slot.time
        );
        
        if (entry) {
            const subject = allSubjects.find(s => s.subject_id === entry.subject_id);
            const subjectCode = subject ? (subject.subject_code || subject.subject_name || 'SUB') : 'SUB';
            const roomNumber = entry.room_number || 'No Room';
            
            return `<td class="has-entry">
                <span class="subject-cell">${subjectCode}</span>
                <span class="room-cell">${roomNumber}</span>
            </td>`;
        } else {
            return '<td class="empty-slot">-</td>';
        }
    }).join('');
    
    return `
        <tr data-time="${slot.time}">
            <td>${slot.time}</td>
            ${cells}
        </tr>
    `;
}

// Helper functions
function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

// Filter timetables
function filterTimetables(filter) {
    const cards = document.querySelectorAll('.timetable-card');
    
    cards.forEach(card => {
        const title = card.querySelector('.timetable-title').textContent.toLowerCase();
        const subtitle = card.querySelector('.timetable-subtitle').textContent.toLowerCase();
        
        let shouldShow = true;
        
        switch(filter) {
            case 'All Timetables':
                shouldShow = true;
                break;
            case 'Current Week':
                // This would require checking if the timetable has current week data
                shouldShow = true;
                break;
            case 'Filter by Subject':
                // This would require a subject filter modal
                shouldShow = true;
                break;
        }
        
        card.style.display = shouldShow ? 'block' : 'none';
    });
}

// Action functions
function viewFullTimetable(classId) {
    // Navigate to detailed timetable view
    window.location.href = `create_timetable_entries.html?classId=${classId}`;
}

function editTimetable(classId) {
    // Navigate to setup page for editing
    window.location.href = `create_timetable_setup.html?classId=${classId}`;
}

async function deleteTimetable(classId) {
    if (!confirm('Are you sure you want to delete this timetable? This action cannot be undone.')) {
        return;
    }
    
    try {
        // Delete timetable entries first
        const { error: entriesError } = await supabase
            .from('timetable_entries')
            .delete()
            .eq('class_id', classId);
            
        if (entriesError) throw entriesError;
        
        // Delete schedule config
        const { error: configError } = await supabase
            .from('schedule_configs')
            .delete()
            .eq('class_id', classId);
            
        if (configError) throw configError;
        
        alert('Timetable deleted successfully!');
        loadAllTimetableData(); // Refresh the display
        
    } catch (error) {
        console.error('Error deleting timetable:', error);
        alert('Failed to delete timetable. Please try again.');
    }
}

// Show error message
function showErrorMessage(message) {
    const container = document.getElementById('timetablesGrid');
    container.innerHTML = `
        <div class="error-message">
            <i class="fa-solid fa-exclamation-triangle"></i>
            <h3>Error</h3>
            <p>${message}</p>
            <button class="btn btn-primary" onclick="location.reload()">
                <i class="fa-solid fa-refresh"></i>
                Refresh Page
            </button>
        </div>
    `;
}
