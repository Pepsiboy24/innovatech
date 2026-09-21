import { supabase as supabaseClient } from '../../../core/config.js';
import { waitForUser } from '/core/perf.js';

// --- 🗄️ Unified Modal Control ---

// Handles the Create/Edit Modal
function closeModal() {
  const modal = document.getElementById("createClassModal");
  const overlay = document.getElementById("overlay");

  // Use consistent display logic
  modal.style.display = 'none';
  overlay.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore scrolling

  // Reset Form UI
  document.getElementById("createClassForm").reset();
  document.getElementById('editClassId').value = "";
  document.querySelector('#createClassModal h2').textContent = "Create New Class";
  document.querySelector('[data-create-class]').textContent = "Create Class";
}

// Handles the View Modal
window.closeViewModal = () => {
  const viewModal = document.getElementById('viewClassModal');
  const overlay = document.getElementById("overlay"); // Use same overlay if needed, or none if View has its own

  viewModal.style.display = 'none';
  overlay.style.display = 'none';
  document.body.style.overflow = 'auto';
};

// --- ✏️ Edit Class Function ---
window.openEditClassModal = async (classId) => {
  const classData = window.allClassesData.find(c => c.class_id == classId);
  if (!classData) return;

  // UI Updates
  document.querySelector('#createClassModal h2').textContent = "Edit Class Information";
  document.querySelector('[data-create-class]').textContent = "Update Class";

  // Populate Fields
  document.getElementById('editClassId').value = classId;
  document.getElementById('className').value = classData.class_name;
  document.getElementById('section').value = classData.section || "";
  document.getElementById('studentsCount').value = classData.no_of_students || 0;

  const teacherName = classData.Teachers ?
    `${classData.Teachers.first_name} ${classData.Teachers.last_name}` : "";
  document.getElementById('teacherSearchInput').value = teacherName;

  // Show Modal consistently
  const modal = document.getElementById("createClassModal");
  const overlay = document.getElementById("overlay");
  modal.style.display = 'block';
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';
};

// --- 👁️ View Class Function ---
window.openViewClassModal = async (classId) => {
  const viewModal = document.getElementById('viewClassModal');
  const overlay = document.getElementById("overlay");
  if (!viewModal) return;

  // Show the modal immediately with a loading state so the user sees feedback
  // while the class data is fetched from the database.
  viewModal.style.display = 'flex';
  overlay.style.display = 'block';
  document.body.style.overflow = 'hidden';

  const nameEl = document.getElementById('viewClassNameDisplay');
  const teacherEl = document.getElementById('viewTeacherName');
  const countEl = document.getElementById('viewStudentCount');

  nameEl.textContent = 'Loading Class Details...';
  teacherEl.textContent = 'Loading...';
  countEl.textContent = 'Loading...';

  // class_id is a PostgreSQL integer (int4), not a uuid — it MUST be parsed
  // to a number before it can be matched with .eq('class_id', ...).
  let numericId;
  try {
    numericId = parseInt(classId, 10);
  } catch (e) {
    numericId = NaN;
  }

  if (!Number.isInteger(numericId) || numericId <= 0) {
    console.error('Invalid class id:', classId);
    nameEl.textContent = 'Class Details';
    teacherEl.textContent = 'Unavailable';
    countEl.textContent = 'Unavailable';
    return;
  }

  try {
    // Get the user for school_id (RLS) — wrapped so the modal still renders
    // for cached/allowlisted flows if the auth lookup fails.
    let user = null;
    try {
      user = await waitForUser();
    } catch (e) {
      console.warn('Could not resolve user for class view:', e);
    }
    const schoolId = user?.user_metadata?.school_id;

    // Query 1: Class row (with the assigned teacher).
    let classQuery = supabaseClient
      .from('Classes')
      .select('class_id, class_name, section, Teachers(first_name, last_name)')
      .eq('class_id', numericId)
      .single();
    if (schoolId) classQuery = classQuery.eq('school_id', schoolId);
    const { data: classData, error: classError } = await classQuery;

    // Query 2: Students enrolled in this class.
    let studentsQuery = supabaseClient
      .from('Students')
      .select('student_id')
      .eq('class_id', numericId);
    if (schoolId) studentsQuery = studentsQuery.eq('school_id', schoolId);
    const { data: studentsData, error: studentsError } = await studentsQuery;

    if (classError) {
      console.error('Error loading class details:', classError.message);
      showToast('Could not load class details.', 'error');
      nameEl.textContent = 'Class Details';
      teacherEl.textContent = 'Unavailable';
      countEl.textContent = studentsError || !studentsData ? 'Unavailable' : (studentsData.length ?? 0);
      return;
    }

    nameEl.textContent = classData.class_name || 'Class Details';
    teacherEl.textContent = classData.Teachers
      ? `${classData.Teachers.first_name ?? ''} ${classData.Teachers.last_name ?? ''}`.trim() || 'Unassigned'
      : 'Unassigned';

    if (studentsError) {
      console.error('Error loading student count:', studentsError.message);
      countEl.textContent = 'Unavailable';
    } else {
      countEl.textContent = studentsData?.length ?? 0;
    }
  } catch (error) {
    console.error('Unexpected error while viewing class:', error);
    showToast('Could not load class details.', 'error');
    nameEl.textContent = 'Class Details';
    teacherEl.textContent = 'Unavailable';
    countEl.textContent = 'Unavailable';
  }
};

/**
 * Handles both CREATE and UPDATE
 */
async function handleCreateClass(e) {
  e.preventDefault();

  const editId = document.getElementById('editClassId').value;
  const className = document.getElementById("className").value;
  const section = document.getElementById("section").value;
  const teacherName = document.getElementById("teacherSearchInput").value.trim();
  const studentsCount = document.getElementById("studentsCount").value;

  if (!teacherName) {
    showToast("Please select a teacher.", "warning");
    return;
  }

  let teacherId = null;
  try {
    const { data: teachers, error } = await supabaseClient
      .from("Teachers")
      .select("teacher_id")
      .ilike("first_name", teacherName.split(' ')[0])
      .limit(1);

    if (error) throw error;
    if (teachers && teachers.length > 0) {
      teacherId = teachers[0].teacher_id;
    } else {
      showToast(`Teacher '${teacherName}' not found.`, 'warning');
      return;
    }
  } catch (error) {
    console.error("Error fetching teacher:", error);
    return;
  }

  // Get current user's school_id for RLS compliance
  let user;
  try {
    user = await waitForUser();
  } catch (error) {
    console.error('User authentication error:', error);
    showToast('Authentication error. Please log in again.', 'error');
    return;
  }
  
  if (!user || !user.user_metadata?.school_id) {
    console.error('User authentication error: Invalid user data');
    showToast('Authentication error. Please log in again.', 'error');
    return;
  }

  const schoolId = user.user_metadata.school_id;

  const formData = {
    class_name: className,
    section: section,
    teacher_id: teacherId,
    school_id: schoolId // CRITICAL: Add school_id for RLS
  };

  try {
    if (editId) {
      const { error } = await supabaseClient.from("Classes").update(formData).eq('class_id', editId);
      if (error) throw error;
      showToast("Class updated successfully!", "success");
    } else {
      const { error } = await supabaseClient.from("Classes").insert([formData]);
      if (error) throw error;
      showToast("Class created successfully!", "success");
    }

    closeModal();
    location.reload();
  } catch (error) {
    console.error("Save error:", error);
    showToast("Error saving class: " + error.message, "error");
  }
}

// --- Initialization ---
function initializeEventListeners() {
  const createClassBtn = document.getElementById("createClassBtn");
  const closeModalBtn = document.getElementById("closeModal");
  const cancelBtn = document.getElementById("cancelBtn");
  const overlay = document.getElementById("overlay");
  const createNewClassBtn = document.querySelector("[data-create-class]");

  if (createClassBtn) {
    createClassBtn.addEventListener("click", () => {
      // Ensure reset to 'Create' mode
      document.getElementById('editClassId').value = "";
      document.querySelector('#createClassModal h2').textContent = "Create New Class";
      document.querySelector('[data-create-class]').textContent = "Create Class";

      document.getElementById("createClassModal").style.display = 'block';
      document.getElementById("overlay").style.display = 'block';
      document.body.style.overflow = 'hidden';
    });
  }

  if (closeModalBtn) closeModalBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

  if (overlay) {
    overlay.addEventListener("click", () => {
      closeModal();
      closeViewModal();
    });
  }

  if (createNewClassBtn) createNewClassBtn.addEventListener("click", handleCreateClass);

  // Escape key support
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeViewModal();
    }
  });
}

initializeEventListeners();