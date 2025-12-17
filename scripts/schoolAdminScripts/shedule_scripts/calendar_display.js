import { supabase } from "../../config.js";

// --- State Management ---
let allEvents = [];          // Stores all raw events from DB
let uniqueSessions = [];     // Stores list of sessions e.g. ["2023/2024", "2024/2025"]
let currentSessionIndex = 0; // Tracks which session is currently displayed

// --- DOM Elements ---
const tableBody = document.getElementById('academicTableBody');
const monthYearSpan = document.getElementById('monthYear');
const searchInput = document.querySelector('.search-input'); // Header search bar

// --- 1. Fetching Data ---
async function fetchEvents() {
    try {
        // We select academic_session too so we can group them
        const { data, error } = await supabase
            .from('academic_events')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) throw error;

        allEvents = data;
        processSessions(data);
        renderCurrentSession();
    } catch (error) {
        console.error("Error fetching events from DB:", error);
    }
}

// --- 2. Data Processing ---
function processSessions(data) {
    // 1. Extract unique session names (e.g., "2023/2024", "2024/2025")
    const sessions = data.map(event => event.academic_session).filter(Boolean);
    uniqueSessions = [...new Set(sessions)].sort(); // Sort alphabetically/numerically

    // 2. Default to the last session (most recent) if we have data
    if (uniqueSessions.length > 0) {
        currentSessionIndex = uniqueSessions.length - 1;
    }
}

// --- 3. Rendering ---
function renderCurrentSession() {
    tableBody.innerHTML = '';
    
    // If no data exists at all
    if (uniqueSessions.length === 0) {
        monthYearSpan.textContent = "No Academic Sessions Found";
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No events found. Create a new calendar to start.</td></tr>';
        return;
    }

    // Get the name of the session we want to show
    const currentSessionName = uniqueSessions[currentSessionIndex];
    monthYearSpan.textContent = currentSessionName + " Academic Session";

    // Filter events for this specific session
    const sessionEvents = allEvents.filter(e => e.academic_session === currentSessionName);

    // Sort events by date within this session
    sessionEvents.sort((a, b) => new Date(a.start_date) - new Date(b.start_date));

    sessionEvents.forEach(event => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${event.term_period || '-'}</td>
            <td>${event.activity_event || '-'}</td>
            <td>${formatDateRange(event.start_date, event.end_date)}</td>
            <td>${event.duration || '-'}</td>
            <td>${event.remarks || '-'}</td>
        `;
        tableBody.appendChild(row);
    });
}

// Helper: Date Formatter
function formatDateRange(start, end) {
    if (!start) return '-';
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : null;
    const options = { month: 'short', day: 'numeric', year: 'numeric' };

    if (!endDate || start === end) {
        return startDate.toLocaleDateString('en-US', options);
    } else {
        return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
    }
}

// --- 4. Navigation Features (Next / Prev / Today) ---
document.getElementById('prevButton').addEventListener('click', () => {
    if (uniqueSessions.length === 0) return;
    
    if (currentSessionIndex > 0) {
        currentSessionIndex--;
        renderCurrentSession();
    } else {
        alert("This is the oldest session record.");
    }
});

document.getElementById('nextButton').addEventListener('click', () => {
    if (uniqueSessions.length === 0) return;

    if (currentSessionIndex < uniqueSessions.length - 1) {
        currentSessionIndex++;
        renderCurrentSession();
    } else {
        alert("This is the latest session record.");
    }
});

document.getElementById('todayButton').addEventListener('click', () => {
    // Logic: Find which session contains "Today"
    const today = new Date();
    
    // Find the session where today falls between the earliest start and latest end date
    const foundIndex = uniqueSessions.findIndex(sessionName => {
        const events = allEvents.filter(e => e.academic_session === sessionName);
        if (!events.length) return false;
        
        // simple check: does this session match the current year roughly?
        // A more robust check would be comparing dates, but matching string name is often safer if data is messy
        return sessionName.includes(today.getFullYear().toString());
    });

    if (foundIndex !== -1) {
        currentSessionIndex = foundIndex;
    } else {
        // If not found, just go to the last one (current)
        currentSessionIndex = uniqueSessions.length - 1;
    }
    renderCurrentSession();
});

// --- 5. Search Feature ---
if (searchInput) {
    // Update placeholder to reflect new functionality
    searchInput.placeholder = "Search Session (e.g. 2024)...";
    
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        
        // Find a session that matches the search term
        const matchIndex = uniqueSessions.findIndex(s => s.toLowerCase().includes(term.toLowerCase()));
        
        if (matchIndex !== -1) {
            currentSessionIndex = matchIndex;
            renderCurrentSession();
        }
    });
}

// --- 6. Create New Calendar Feature ---
const createBtn = document.querySelector('.create-btn');
const calNameInput = document.querySelector('.create-calendar input[placeholder*="Spring"]');
const calDescInput = document.querySelector('.create-calendar input[placeholder*="description"]');

if (createBtn) {
    createBtn.addEventListener('click', () => {
        const newSessionName = calNameInput.value.trim();
        if (!newSessionName) {
            alert("Please enter a Calendar/Session Name");
            return;
        }

        // Logic: Since we don't have a "Calendars" table, we simulate creating a new one
        // by switching the view to this new name and clearing the table.
        // The user must then add an event to "save" this session in the DB.
        
        // 1. Update title
        monthYearSpan.textContent = newSessionName;
        
        // 2. Clear table to show it's empty
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color: var(--primary);">New Session Created. Click "Add New Event" to start populating.</td></tr>';
        
        // 3. Update the global variable so "Add Event" modal knows what session to use
        // Note: You will need to update your add_single_event.js to read this value if possible,
        // or simply Autofill the modal input:
        const modalSessionInput = document.getElementById('academicSession');
        if (modalSessionInput) {
            modalSessionInput.value = newSessionName;
        }

        // Clear inputs
        calNameInput.value = '';
        if(calDescInput) calDescInput.value = '';
        
        alert(`Switched to new calendar: ${newSessionName}. \nPlease add an event to save this session to the database.`);
    });
}


// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    fetchEvents();
    
    // Expose refresh for other scripts (like add_single_event.js)
    window.refreshAcademicTable = async function() {
        await fetchEvents();
    };
});