import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// --- Configuration ---
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- State Management ---
window.allClassesData = []; // Changed to window property for global access

// --- DOM Elements ---
const template = document.querySelector("[data-template]");
const container = document.querySelector("[data-container]");
const searchInput = document.querySelector(".search-input");

// --- 1. Function to Render Cards ---
function renderClasses(dataToRender) {
    container.innerHTML = "";

    if (dataToRender.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666;">No classes found.</p>';
        return;
    }

    dataToRender.forEach(elem => {
        const card = template.content.cloneNode(true).children[0];
        
        const classNameEl = card.querySelector("[data-class-name]");
        const classSectionEl = card.querySelector("[data-class-section]");
        const teacherNameEl = card.querySelector("[data-teacher-name]");
        const studentNoEl = card.querySelector("[data-student-no]");

        const teacherFirstName = elem.Teachers?.first_name || "Unassigned";
        const teacherLastName = elem.Teachers?.last_name || "";
        
        classNameEl.textContent = elem.class_name;
        classSectionEl.textContent = elem.section ? ` - ${elem.section}` : ""; 
        teacherNameEl.textContent = `${teacherFirstName} ${teacherLastName}`;
        studentNoEl.textContent = elem.no_of_students || "0"; 

        // --- NEW: Attach Click Events ---
        const editBtn = card.querySelector(".editBtn");
        const viewBtn = card.querySelector(".viewBtn");

        // Pass the class_id to the window-scoped functions in classes.js
        if (editBtn) editBtn.onclick = () => window.openEditClassModal(elem.class_id);
        if (viewBtn) viewBtn.onclick = () => window.openViewClassModal(elem.class_id);

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

        window.allClassesData = data || []; // Save globally
        renderClasses(window.allClassesData);

    } catch (error) {
        console.error("Error loading classes:", error);
        container.innerHTML = '<p style="color: red; text-align: center;">Failed to load classes.</p>';
    }
}

// --- 3. Search Logic ---
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filteredClasses = window.allClassesData.filter(item => {
            const fullName = `${item.class_name || ""} ${item.section || ""}`.toLowerCase();
            return fullName.includes(searchTerm);
        });
        renderClasses(filteredClasses);
    });
}

loadClasses();