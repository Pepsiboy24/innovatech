const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
window.openViewClassModal = (classId) => {
    const classData = window.allClassesData.find(c => c.class_id == classId);
    if (!classData) return;

    document.getElementById('viewClassNameDisplay').textContent = classData.class_name;
    document.getElementById('viewTeacherName').textContent = classData.Teachers ? 
        `${classData.Teachers.first_name} ${classData.Teachers.last_name}` : "Unassigned";
    document.getElementById('viewStudentCount').textContent = classData.no_of_students || "0";

    const viewModal = document.getElementById('viewClassModal');
    const overlay = document.getElementById("overlay");
    
    viewModal.style.display = 'flex';
    overlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
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
    alert("Please select a teacher.");
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
      alert(`Teacher '${teacherName}' not found.`);
      return;
    }
  } catch (error) {
    console.error("Error fetching teacher:", error);
    return;
  }

  const formData = {
    class_name: className,
    section: section,
    teacher_id: teacherId,
    no_of_students: parseInt(studentsCount)
  };

  try {
    if (editId) {
      const { error } = await supabaseClient.from("Classes").update(formData).eq('class_id', editId);
      if (error) throw error;
      alert("Class updated!");
    } else {
      const { error } = await supabaseClient.from("Classes").insert([formData]);
      if (error) throw error;
      alert("Class created!");
    }

    closeModal();
    location.reload(); 
  } catch (error) {
    console.error("Save error:", error);
    alert("Error saving class: " + error.message);
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