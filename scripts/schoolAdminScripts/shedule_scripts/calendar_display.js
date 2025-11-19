// Supabase setup
// const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
// const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
// const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import { supabase } from "../../config.js";

// Function to fetch events from Supabase
async function fetchEvents() {
    try {
        const { data, error } = await supabase
            .from('academic_events')
            .select('*')
            .order('start_date', { ascending: true });

        if (error) throw error;

        return data.map(event => ({
            term: event.term_period,
            activity: event.activity_event,
            start: event.start_date,
            end: event.end_date,
            duration: event.duration,
            remarks: event.remarks
        }));
    } catch (error) {
        console.error("Error fetching events from DB:", error);
        return [];
    }
}

document.addEventListener('DOMContentLoaded', async function () {
    const tableBody = document.getElementById('academicTableBody');
    const monthYearSpan = document.getElementById('monthYear');

    // Function to format date range
    function formatDateRange(start, end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const options = { month: 'short', day: 'numeric', year: 'numeric' };

        if (start === end) {
            return startDate.toLocaleDateString('en-US', options);
        } else {
            return `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;
        }
    }

    // Function to populate the table
    function populateTable(events) {
        tableBody.innerHTML = '';
        events.forEach(event => {
            const row = document.createElement('tr');
            row.innerHTML = `
                        <td>${event.term}</td>
                        <td>${event.activity}</td>
                        <td>${formatDateRange(event.start, event.end)}</td>
                        <td>${event.duration}</td>
                        <td>${event.remarks}</td>
                    `;
            tableBody.appendChild(row);
        });
    }

    // Initial population
    let academicEvents = await fetchEvents();
    populateTable(academicEvents);

    // Set initial month/year display
    monthYearSpan.textContent = '2024/2025 Academic Session';

    // Navigation buttons functionality (simplified for table view)
    document.getElementById('prevButton').addEventListener('click', function () {
        // For now, just scroll to top or implement filtering if needed
        tableBody.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('nextButton').addEventListener('click', function () {
        // For now, just scroll to bottom or implement filtering if needed
        tableBody.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    document.getElementById('todayButton').addEventListener('click', function () {
        // Reset to full view
        populateTable(academicEvents);
    });

    // --- Modal functionality ---
    const addEventBtn = document.querySelector('.add-event-btn');
    const modal = document.getElementById('addEventModal');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const addEventForm = document.getElementById('addEventForm');

    // Open modal
    addEventBtn.addEventListener('click', () => {
        modal.classList.add('show');
    });

    // Close modal functions
    const closeModalFunc = () => {
        modal.classList.remove('show');
        addEventForm.reset();
    };

    closeModal.addEventListener('click', closeModalFunc);
    cancelBtn.addEventListener('click', closeModalFunc);

    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModalFunc();
        }
    });

    // Form submission is now handled in add_single_event.js

    // --- Mobile menu toggle functionality ---
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.getElementById('overlay');

    menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });
});