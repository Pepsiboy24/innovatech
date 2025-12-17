// Supabase setup (Use your imports if using modules, otherwise window)
// import { supabase } from "../../config.js"; 
// OR keep your existing setup if not using modules:
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

document.addEventListener('DOMContentLoaded', function () {
    const fileInput = document.getElementById('fileInput');
    const browseButton = document.getElementById('browseButton');
    const fileNameDisplay = document.getElementById('fileNameDisplay');
    const uploadZone = document.querySelector('.upload-zone');

    // Link the visible button to the hidden input
    browseButton.addEventListener('click', function () {
        fileInput.click();
    });

    // Display the selected file name and process upload
    fileInput.addEventListener('change', function () {
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            fileNameDisplay.textContent = `Selected: ${file.name}`;
            processFile(file);
        } else {
            fileNameDisplay.textContent = '';
        }
    });

    // Drag and drop functionality
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-active');
    });

    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('drag-active');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-active');
        fileInput.files = e.dataTransfer.files;
        fileInput.dispatchEvent(new Event('change'));
    });

    async function processFile(file) {
        const fileType = file.name.split('.').pop().toLowerCase();
        let events = [];

        // --- FIX STARTS HERE ---
        // 1. Get the current Session Name from the UI (e.g. "2025/2026")
        // We remove " Academic Session" text to get just the year part
        const sessionTitle = document.getElementById('monthYear').textContent;
        let currentSession = sessionTitle.replace(' Academic Session', '').trim();

        // Safety check: if the title is empty or generic, ask the user
        if (!currentSession || currentSession.includes('No Academic')) {
            currentSession = prompt("Please enter the Academic Session for these events (e.g., 2025/2026):");
            if (!currentSession) {
                alert("Upload cancelled. Session name is required.");
                return;
            }
        }
        // --- FIX ENDS HERE ---

        try {
            if (fileType === 'csv') {
                events = await parseCSV(file);
            } else if (fileType === 'xlsx') {
                events = await parseXLSX(file);
            } else if (fileType === 'ics') {
                events = await parseICS(file);
            } else {
                throw new Error('Unsupported file type. Please upload .csv, .xlsx, or .ics files.');
            }

            if (events.length === 0) {
                alert('No events found in the file.');
                return;
            }

            // 2. Inject the session name into every event
            const eventsWithSession = events.map(event => ({
                ...event,
                academic_session: currentSession // Force this session name
            }));

            // Insert events into Supabase
            const { data, error } = await supabase
                .from('academic_events')
                .insert(eventsWithSession); // Insert the modified array

            if (error) throw error;

            alert(`Successfully uploaded ${eventsWithSession.length} events to ${currentSession}!`);
            fileInput.value = '';
            fileNameDisplay.textContent = '';

            // Refresh the table
            if (window.refreshAcademicTable) {
                window.refreshAcademicTable();
            }

        } catch (error) {
            console.error('Error processing file:', error);
            alert('Failed to upload file: ' + error.message);
        }
    }

    async function parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const lines = text.split('\n');
                const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
                const events = [];

                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split(',');
                    // Basic check to ensure row isn't empty
                    if (values.length > 1) { 
                        const event = {};
                        headers.forEach((header, index) => {
                            // Handle potential undefined values
                            const value = values[index] ? values[index].trim() : null;
                            const field = mapHeaderToField(header);
                            
                            if (header.includes('date')) {
                                event[field] = value ? new Date(value).toISOString().split('T')[0] : null;
                            } else {
                                event[field] = value || null;
                            }
                        });
                        if (event.activity_event) events.push(event);
                    }
                }
                resolve(events);
            };
            reader.onerror = () => reject(new Error('Failed to read CSV file'));
            reader.readAsText(file);
        });
    }

    async function parseXLSX(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                    if (jsonData.length === 0) resolve([]);

                    const headers = jsonData[0].map(h => String(h).toLowerCase());
                    const events = [];

                    for (let i = 1; i < jsonData.length; i++) {
                        const row = jsonData[i];
                        const event = {};
                        headers.forEach((header, index) => {
                            const value = row[index];
                            const field = mapHeaderToField(header);

                            if (header.includes('date')) {
                                // Excel date handling could go here, but basic string parsing:
                                event[field] = value ? new Date(value).toISOString().split('T')[0] : null;
                            } else {
                                event[field] = value || null;
                            }
                        });
                        if (event.activity_event) events.push(event);
                    }
                    resolve(events);
                } catch (error) {
                    reject(new Error('Failed to parse XLSX file'));
                }
            };
            reader.onerror = () => reject(new Error('Failed to read XLSX file'));
            reader.readAsArrayBuffer(file);
        });
    }

    async function parseICS(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const text = e.target.result;
                const events = [];
                const eventBlocks = text.split('BEGIN:VEVENT');

                for (let i = 1; i < eventBlocks.length; i++) {
                    const block = eventBlocks[i];
                    const event = {};
                    const lines = block.split('\n');

                    lines.forEach(line => {
                        if (line.startsWith('SUMMARY:')) {
                            event.activity_event = line.substring(8).trim();
                        } else if (line.startsWith('DTSTART:')) {
                            const dateStr = line.substring(8).trim();
                            event.start_date = parseICSDate(dateStr);
                        } else if (line.startsWith('DTEND:')) {
                            const dateStr = line.substring(6).trim();
                            event.end_date = parseICSDate(dateStr);
                        } else if (line.startsWith('DESCRIPTION:')) {
                            event.remarks = line.substring(12).trim();
                        }
                    });

                    // Removed the hardcoded session here because we inject it in processFile now
                    if (event.activity_event && event.start_date) {
                        event.term_period = 'Holiday'; 
                        events.push(event);
                    }
                }
                resolve(events);
            };
            reader.onerror = () => reject(new Error('Failed to read ICS file'));
            reader.readAsText(file);
        });
    }

    function parseICSDate(dateStr) {
        const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})/);
        if (match) {
            return `${match[1]}-${match[2]}-${match[3]}`;
        }
        return null;
    }

    function mapHeaderToField(header) {
        const mapping = {
            'academic session': 'academic_session',
            'session': 'academic_session', // Added 'session'
            'term': 'term_period',
            'term_period': 'term_period',
            'period': 'term_period', // Added 'period'
            'activity': 'activity_event',
            'activity_event': 'activity_event',
            'event': 'activity_event',
            'start date': 'start_date',
            'start_date': 'start_date',
            'start': 'start_date', // Added 'start'
            'end date': 'end_date',
            'end_date': 'end_date',
            'end': 'end_date', // Added 'end'
            'duration': 'duration',
            'remarks': 'remarks',
            'note': 'remarks' // Added 'note'
        };
        // Check exact match first, then partial match
        if (mapping[header]) return mapping[header];
        
        // Fallback: Loop keys to find includes
        for (const key in mapping) {
            if (header.includes(key)) return mapping[key];
        }
        
        return header;
    }
});