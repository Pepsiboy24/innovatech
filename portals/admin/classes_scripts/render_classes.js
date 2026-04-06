import { supabase } from '../../../core/config.js';

/**
 * Helper: Smart Level Naming
 * Automatically translates "JSS1" to "Junior Secondary School 1"
 * optimized for Nigerian school naming conventions.
 */
function getFullLevelName(className) {
    if (!className) return "General Category";

    const name = className.toUpperCase().trim();

    if (name.startsWith('JSS')) {
        return name.replace('JSS', 'Junior Secondary School ');
    }
    if (name.startsWith('SS')) {
        return name.replace('SS', 'Senior Secondary School ');
    }
    if (name.startsWith('PRI')) {
        return name.replace('PRI', 'Primary School ');
    }
    if (name.startsWith('NUR')) {
        return name.replace('NUR', 'Nursery ');
    }
    if (name.startsWith('BASIC')) {
        return name.replace('BASIC', 'Basic Education ');
    }

    return "Secondary School Level"; // Default fallback
}

// --- State Management ---
window.allClassesData = [];

// --- DOM Elements ---
const template = document.querySelector("[data-template]");
const container = document.querySelector("[data-container]");
const searchInput = document.querySelector(".search-input");

// --- 1. Function to Render Cards ---
function renderClasses(dataToRender) {
    container.innerHTML = "";

    if (dataToRender.length === 0) {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: #666; padding: 40px;">No classes found.</p>';
        return;
    }

    dataToRender.forEach(elem => {
        const card = template.content.cloneNode(true).children[0];

        const classNameEl = card.querySelector("[data-class-name]");
        const classSectionEl = card.querySelector("[data-class-section]");
        const teacherNameEl = card.querySelector("[data-teacher-name]");
        const studentNoEl = card.querySelector("[data-student-no]");

        // Target the subtitle <p> tag. If you add data-level to your HTML, use that selector.
        const levelNameEl = card.querySelector("[data-level]") || card.querySelector("p");

        const teacherFirstName = elem.Teachers?.first_name || "Unassigned";
        const teacherLastName = elem.Teachers?.last_name || "";

        // Set dynamic content
        classNameEl.textContent = elem.class_name;
        classSectionEl.textContent = elem.section ? ` - ${elem.section}` : "";

        // Apply the Smart Parsing logic here
        if (levelNameEl) {
            levelNameEl.textContent = getFullLevelName(elem.class_name);
        }

        teacherNameEl.textContent = `${teacherFirstName} ${teacherLastName}`;
        studentNoEl.textContent = elem._studentCount ?? 0;

        // --- Attach Actions ---
        const editBtn = card.querySelector(".editBtn");
        const viewBtn = card.querySelector(".viewBtn");
        const deleteBtn = card.querySelector(".deleteBtn");

        if (viewBtn) viewBtn.setAttribute('data-id', elem.class_id);
        if (editBtn) editBtn.onclick = () => window.openEditClassModal(elem.class_id);

        if (deleteBtn) {
            deleteBtn.onclick = () => handleDeleteClass(elem);
            // Visual lock if students exist
            if ((elem._studentCount ?? 0) > 0) {
                deleteBtn.classList.add('deleteBtn--locked');
                deleteBtn.title = "Cannot delete class with active students";
            }
        }

        container.append(card);
    });
}

// --- 2. Smart Delete Handler ---
async function handleDeleteClass(elem) {
    const studentCount = elem._studentCount ?? 0;

    if (studentCount > 0) {
        showToast(`Cannot delete "${elem.class_name}". It has ${studentCount} active students.`, "warning");
        return;
    }

    const confirmed = await window.showConfirm(`Are you sure you want to delete "${elem.class_name}${elem.section ? ' - ' + elem.section : ''}"?`, "Delete Class");
    if (!confirmed) return;

    try {
        const { error } = await supabase
            .from("Classes")
            .delete()
            .eq("class_id", elem.class_id);

        if (error) throw error;
        await loadClasses(); // Refresh data

    } catch (error) {
        console.error("Delete error:", error);
        showToast("Failed to delete class: " + error.message, "error");
    }
}

// --- 3. Data Fetching ---
async function loadClasses() {
    try {
        container.innerHTML = '<p style="grid-column: 1/-1; text-align: center; padding: 20px;">Loading classes...</p>';

        // Get school_id from the logged-in admin's JWT metadata
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user?.user_metadata?.school_id) {
            container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Authentication error — could not determine your school.</p>';
            console.error('Missing school_id in user metadata:', userError);
            return;
        }
        const schoolId = user.user_metadata.school_id;

        const [classesResult, studentsResult] = await Promise.all([
            supabase.from("Classes")
                .select("*, Teachers(first_name, last_name)")
                .eq("school_id", schoolId),          // ← only this school's classes
            supabase.from("Students")
                .select("class_id")
                .eq("school_id", schoolId)            // ← only this school's students (for counts)
        ]);

        if (classesResult.error) throw classesResult.error;
        if (studentsResult.error) throw studentsResult.error;

        // Map students to classes for counts
        const countMap = {};
        (studentsResult.data || []).forEach(s => {
            if (s.class_id != null) {
                countMap[s.class_id] = (countMap[s.class_id] || 0) + 1;
            }
        });

        const classes = (classesResult.data || []).map(cls => ({
            ...cls,
            _studentCount: countMap[cls.class_id] ?? 0
        }));

        window.allClassesData = classes;
        renderClasses(window.allClassesData);

    } catch (error) {
        console.error("Load error:", error);
        container.innerHTML = '<p style="color: red; text-align: center; padding: 20px;">Failed to load classes.</p>';
    }
}

// --- 4. Search Implementation ---
if (searchInput) {
    searchInput.addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        const filtered = window.allClassesData.filter(item => {
            const matchString = `${item.class_name} ${item.section}`.toLowerCase();
            return matchString.includes(searchTerm);
        });
        renderClasses(filtered);
    });
}

// Initialize
loadClasses();