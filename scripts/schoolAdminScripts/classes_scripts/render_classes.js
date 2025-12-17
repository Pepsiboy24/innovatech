import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- Configuration ---
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State Management ---
let allClassesData = []; // Store fetched data here so we can filter it later without refetching

// --- DOM Elements ---
const template = document.querySelector("[data-template]");
const container = document.querySelector("[data-container]");
const searchInput = document.querySelector(".search-input"); // Based on your HTML class

// --- 1. Function to Render Cards ---
function renderClasses(dataToRender) {
    // Clear current grid
    container.innerHTML = "";

    if (dataToRender.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">No classes found.</p>';
        return;
    }

    dataToRender.forEach(elem => {
        // Clone the card from template
        const card = template.content.cloneNode(true).children[0];
        
        // Select elements within the card
        const classNameEl = card.querySelector("[data-class-name]");
        const classSectionEl = card.querySelector("[data-class-section]");
        const teacherNameEl = card.querySelector("[data-teacher-name]");
        const studentNoEl = card.querySelector("[data-student-no]");

        // Populate Data
        // Note: We handle cases where Teachers might be null (if left join finds no match)
        const teacherFirstName = elem.Teachers?.first_name || "Unassigned";
        const teacherLastName = elem.Teachers?.last_name || "";
        
        classNameEl.textContent = elem.class_name;
        // Use a default empty string if section is null
        classSectionEl.textContent = elem.section ? ` - ${elem.section}` : ""; 
        teacherNameEl.textContent = `${teacherFirstName} ${teacherLastName}`;
        // Assuming your DB has a count, otherwise hardcoding/placeholder
        studentNoEl.textContent = elem.no_of_students || "0"; 

        // Append to grid
        container.append(card);
    });
}

// --- 2. Function to Fetch Data ---
async function loadClasses() {
    try {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center;">Loading classes...</p>';
        
        const { data, error } = await supabase
            .from("Classes")
            .select("*, Teachers(first_name, last_name)");

        if (error) throw error;

        // Save data to global variable
        allClassesData = data || [];
        
        // Initial Render
        renderClasses(allClassesData);

    } catch (error) {
        console.error("Error loading classes from DB:", error);
        container.innerHTML = '<p style="color: red; grid-column: 1/-1; text-align: center;">Failed to load classes.</p>';
    }
}

// --- 3. Search Logic ---
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();

        // Filter the existing data
        const filteredClasses = allClassesData.filter(item => {
            const className = (item.class_name || "").toLowerCase();
            const section = (item.section || "").toLowerCase();
            
            // Create a combined string for searching "JSS 1 A"
            // This allows searching by name, section, or both combined
            const fullName = `${className} ${section}`;

            return fullName.includes(searchTerm);
        });

        // Re-render with filtered data
        renderClasses(filteredClasses);
    });
}

// --- Initialization ---
// Start the process
loadClasses();