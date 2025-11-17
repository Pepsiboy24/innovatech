// --- Supabase Client Initialization ---

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentFilter = "all";

// --- 📚 Class Data Functions ---

/**
 * Fetches all class data from the Supabase 'Classes' table.
 * @returns {Array} List of classes or an empty array on error.
 */
async function loadClasses() {
  try {
    // Note: The select("*") must match the columns available in the table.
    const { data, error } = await supabase
      .from("Classes")
      .select("*");

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error loading classes from DB:", error);
    return [];
  }
}

/**
 * Creates a single class card element from data.
 * @param {HTMLElement} template - The template card element.
 * @param {Object} classData - The class data object.
 * @returns {HTMLElement | null} The cloned and populated card element.
 */
function createClassCard(template, classData) {
  // Clone the template and remove the 'display: none' styling if applied
  const card = template.cloneNode(true);
  card.style.display = 'block'; // Make sure the cloned card is visible

  // Populate the card with data
  const titleElement = card.querySelector('header h2');
  const subjectElement = card.querySelector('header p');
  const teacherElement = card.querySelector('.body p:first-child span');
  const studentsElement = card.querySelector('.body p:last-child span');

  // Use optional chaining or simple checks to prevent errors
  if (titleElement) titleElement.textContent = classData.title || classData.class_name;
  if (subjectElement) subjectElement.textContent = classData.subject_level || classData.section; // Assuming subject_level might be section
  if (teacherElement) teacherElement.textContent = classData.teacher_name || 'N/A';
  if (studentsElement) studentsElement.textContent = classData.students_count || 0;

  return card;
}

/**
 * Fetches data, filters it, and renders the class cards to the grid.
 */
async function renderClasses() {
  const classesGrid = document.getElementById("classesGrid");
  classesGrid.innerHTML = '<p class="loading-message">Loading classes...</p>';

  const classes = await loadClasses();

  const filteredClasses = currentFilter === "all" ? classes : classes.filter(c => c.status && c.status.toLowerCase() === currentFilter);

  // Get the template element
  const templateElement = document.querySelector('template[data-template]');
  if (!templateElement) {
    console.error('Template not found in HTML.');
    classesGrid.innerHTML = '<p class="error-message">Error: Template not found.</p>';
    return;
  }

  // Get the card template from inside the template element
  const template = templateElement.content.querySelector('.card');
  if (!template) {
    console.error('Template card not found in HTML.');
    classesGrid.innerHTML = '<p class="error-message">Error: Template card not found.</p>';
    return;
  }

  classesGrid.innerHTML = "";

  if (filteredClasses.length === 0) {
    classesGrid.innerHTML = '<p class="no-data-message">No classes found.</p>';
    return;
  }

  // Append the new cards
  filteredClasses.forEach((classData) => {
    const card = createClassCard(template, classData);
    if (card) classesGrid.appendChild(card);
  });
}

// --- 🧑‍🏫 Teacher Data Function (Needed by searchableDropdown.js) ---

/**
 * Loads teacher data for the modal form.
 * @returns {Array} List of teachers.
 */
async function loadTeachers() {
  try {
    const { data, error } = await supabase
      .from("Teachers")
      .select("teacher_id, first_name, last_name")
      .order("first_name", { ascending: true });

    if (error) throw error;

    return data || [];
  } catch (error) {
    console.error("Error loading teachers:", error);
    return [];
  }
}

// --- 🗄️ Modal and Form Functions ---

function openModal() {
  const modal = document.getElementById("createClassModal");
  const overlay = document.getElementById("overlay");
  modal.classList.add("active");
  overlay.classList.add("active");
}

function closeModal() {
  const modal = document.getElementById("createClassModal");
  const overlay = document.getElementById("overlay");
  modal.classList.remove("active");
  overlay.classList.remove("active");
  document.getElementById("createClassForm").reset();
}

/**
 * Initializes data when the modal is about to open.
 * NOTE: Since teacher population is handled by a separate script,
 * this function currently only ensures data is loaded (if needed).
 */
async function initializeModalData() {
  // Await the teachers data if needed by the searchable dropdown script,
  // otherwise this function just ensures the modal state is reset/ready.
  const teachers = await loadTeachers();
  // We can pass the teachers array to the searchableDropdown.js script here
  // if it exposes a function to populate its options.
  console.log('Teachers data loaded for modal:', teachers.length);
}

/**
 * Handles the form submission to create a new class entry.
 */
async function handleCreateClass(e) {
  e.preventDefault();

  const className = document.getElementById("className").value;
  const section = document.getElementById("section").value;
  // Assuming the searchableDropdown.js or your logic stores the teacher ID
  // or full name in the input. We'll use the existing logic for now.
  const teacherName = document.getElementById("teacherSearchInput").value.trim();
  const studentsCount = document.getElementById("studentsCount").value; // Added missing student count input
  const classIcon = document.getElementById("classIcon").value; // Added missing icon input

  if (!teacherName) {
    alert("Please select a teacher.");
    return;
  }

  // --- 1. Fetch teacher_id ---
  let teacherId = null;
  try {
    const { data: teachers, error } = await supabase
      .from("Teachers")
      // Assuming 'first_name' is sufficient for a lookup, but this is brittle.
      // Ideally, the searchable dropdown would store the teacher_id directly.
      .select("teacher_id")
      .ilike("first_name", teacherName)
      .limit(1);

    if (error) throw error;

    if (teachers && teachers.length > 0) {
      teacherId = teachers[0].teacher_id;
    } else {
      alert(`Teacher '${teacherName}' not found. Please check the name.`);
      return;
    }
  } catch (error) {
    console.error("Error fetching teacher ID:", error);
    alert("Error fetching teacher information. Cannot create class.");
    return;
  }

  // --- 2. Insert new class ---
  const formData = {
    class_name: className,
    section: section, // Renamed from 'Section' to lowercase 'section' for consistency
    teacher_id: teacherId,
    // students_count: studentsCount, // Added student count
    // icon: classIcon // Added class icon
    // Add other fields like 'title' if your 'Classes' table requires them.
  };

  try {
    const { error } = await supabase
      .from("Classes")
      .insert([formData]);

    if (error) throw error;

    alert("Class created successfully!");
    closeModal();
    await renderClasses();
  } catch (error) {
    console.error("Error creating class:", error);
    alert("Error creating class. Check console for details.");
    closeModal();
    await renderClasses();
  }
}

// --- ⚙️ Initialization and Event Listeners ---

function initializeEventListeners() {
  // Elements
  const createClassBtn = document.getElementById("createClassBtn");
  const closeModalBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const overlay = document.getElementById("overlay");
  const createClassForm = document.getElementById("createClassForm");
  const createNewClass = document.querySelector("[data-create-class]")
  const filterSelect = document.getElementById("filterSelect");
  const mobileMenuBtn = document.getElementById("mobileMenuBtn");
  const menuToggle = document.getElementById("menuToggle");
  const sidebar = document.getElementById("sidebar");

  // Modal Control
  createClassBtn.addEventListener("click", async () => {
    // Load necessary data and open the modal
    await initializeModalData();
    openModal();
  });
  closeModalBtn.addEventListener("click", closeModal);
  cancelBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);
  createNewClass.addEventListener("click", handleCreateClass);

  // Filter
  filterSelect.addEventListener("change", (e) => {
    currentFilter = e.target.value;
    renderClasses();
  });

  // Mobile Menu
  mobileMenuBtn.addEventListener("click", () => {
    sidebar.classList.add("active");
    overlay.classList.add("active");
  });

  menuToggle.addEventListener("click", () => {
    sidebar.classList.remove("active");
    overlay.classList.remove("active");
  });

  // Close sidebar/modal on overlay click
  overlay.addEventListener("click", () => {
    // Only close sidebar if modal is not active
    if (!document.getElementById("createClassModal").classList.contains("active")) {
      sidebar.classList.remove("active");
    }
  });
}

/**
 * Application entry point.
 */
async function init() {
  // await renderClasses(); // Start by displaying existing classes
  initializeEventListeners(); // Set up all interactions
}

init();