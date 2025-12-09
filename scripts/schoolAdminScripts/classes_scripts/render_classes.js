import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


let currentFilter = "all";
const template = document.querySelector("[data-template]")
const container = document.querySelector("[data-container]")

async function loadClasses() {
    try {
        // Note: The select("*") must match the columns available in the table.
        const { data, error } = await supabase
            .from("Classes")
            .select("*, Teachers(first_name, last_name)");

        if (error) throw error;

        return data || [];
    } catch (error) {
        console.error("Error loading classes from DB:", error);
        return [];
    }
}

loadClasses()
    .then((data) => {
        data.forEach(elem => {
            const card = template.content.cloneNode(true).children[0]
            const class_name = card.querySelector("[data-class-name]")
            const class_section = card.querySelector("[data-class-section]")
            const teacher_name = card.querySelector("[data-teacher-name]")
            const no_of_students = card.querySelector("[data-student-no]")
            container.append(card)
            class_name.textContent = elem.class_name
            class_section.textContent = elem.section
            teacher_name.textContent = `${elem.Teachers.first_name} ${elem.Teachers.last_name}`
            class_name.textContent = elem.class_name


            console.log(elem)
            console.log(elem.class_name)
        });
        console.log(data)
    })
    .catch(error => {
    // This catches errors that might not be handled inside loadClasses()
    console.error("Failed to load and log classes:", error);
  });
// /**
//  * Creates a single class card element from data.
//  * @param {HTMLElement} template - The template card element.
//  * @param {Object} classData - The class data object.
//  * @returns {HTMLElement | null} The cloned and populated card element.
//  */
// function createClassCard(template, classData) {
//   // Clone the template and remove the 'display: none' styling if applied
//   const card = template.cloneNode(true);
//   card.style.display = 'block'; // Make sure the cloned card is visible

//   // Populate the card with data
//   const titleElement = card.querySelector('header h2');
//   const subjectElement = card.querySelector('header p');
//   const teacherElement = card.querySelector('.body p:first-child span');
//   const studentsElement = card.querySelector('.body p:last-child span');

//   // Use optional chaining or simple checks to prevent errors
//   if (titleElement) titleElement.textContent = classData.title || classData.class_name;
//   if (subjectElement) subjectElement.textContent = classData.subject_level || classData.section; // Assuming subject_level might be section
//   if (teacherElement) teacherElement.textContent = classData.teacher_name || 'N/A';
//   if (studentsElement) studentsElement.textContent = classData.students_count || 0;

//   return card;
// }

/**
 * Fetches data, filters it, and renders the class cards to the grid.
 */
// async function renderClasses() {
//   const classesGrid = document.getElementById("classesGrid");
//   classesGrid.innerHTML = '<p class="loading-message">Loading classes...</p>';

//   const classes = await loadClasses();

//   const filteredClasses = currentFilter === "all" ? classes : classes.filter(c => c.status && c.status.toLowerCase() === currentFilter);

//   // Get the template element
//   const templateElement = document.querySelector('template[data-template]');
//   if (!templateElement) {
//     console.error('Template not found in HTML.');
//     classesGrid.innerHTML = '<p class="error-message">Error: Template not found.</p>';
//     return;
//   }

//   // Get the card template from inside the template element
//   const template = templateElement.content.querySelector('.card');
//   if (!template) {
//     console.error('Template card not found in HTML.');
//     classesGrid.innerHTML = '<p class="error-message">Error: Template card not found.</p>';
//     return;
//   }

//   classesGrid.innerHTML = "";

//   if (filteredClasses.length === 0) {
//     classesGrid.innerHTML = '<p class="no-data-message">No classes found.</p>';
//     return;
//   }

//   // Append the new cards
//   filteredClasses.forEach((classData) => {
//     const card = createClassCard(template, classData);
//     if (card) classesGrid.appendChild(card);
//   });
// }
