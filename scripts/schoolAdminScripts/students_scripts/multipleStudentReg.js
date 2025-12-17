// multipleStudentReg.js

// --- Configuration ---
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

if (!supabaseClient) console.error("Supabase client not loaded.");

// --- Global Cache for Classes (Prevents constant DB lookups) ---
let _allClassesCache = null;

// --- Helper: Delay to prevent Rate Limiting ---
const delay = (ms) => new Promise(res => setTimeout(res, ms));

// --- 1. Excel Processing Logic ---

export async function uploadAndProcessExcel(file) {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    const results = [];
    
    // Loop through rows
    for (const row of jsonData) {
      // Add Delay to stop 429 Errors
      await delay(1500); 

      const studentData = {
        full_name: row['Full Name'] || row['full_name'] || row['Name'],
        email: row['Email'] || row['email'],
        date_of_birth: row['Date of Birth'] || row['date_of_birth'] || row['DOB'],
        gender: row['Gender'] || row['gender'],
        admission_date: row['Admission Date'] || row['admission_date'] || new Date().toISOString().split('T')[0],
        profile_picture: "https://placehold.co/150x150/e8e8e8/363636?text=Profile",
        class_input: row['Classes'] || row['classes'] || row['Class'], 
      };

      if (!studentData.full_name || !studentData.email) {
        results.push({ success: false, error: 'Missing Name or Email', data: studentData });
        continue;
      }

      const password = generatePassword();
      let class_id = null;

      try {
        // Handle Class/Section lookup using the NEW Robust Function
        if (studentData.class_input) {
            class_id = await getExistingClassId(studentData.class_input);
        }

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email: studentData.email,
          password: password,
        });

        if (authError) throw new Error("Auth: " + authError.message);

        // 2. Insert Profile into 'Students' Table
        const { error: insertError } = await supabaseClient
          .from("Students")
          .insert([
            {
              student_id: authData.user.id,
              full_name: studentData.full_name,
              date_of_birth: formatExcelDate(studentData.date_of_birth),
              gender: studentData.gender,
              admission_date: formatExcelDate(studentData.admission_date),
              profile_picture: studentData.profile_picture,
              class_id: class_id // Will be null if class not found
            },
          ]);

        if (insertError) throw new Error("DB: " + insertError.message);
        results.push({ success: true, data: studentData });

      } catch (err) {
        console.error("Row Error:", err.message);
        results.push({ success: false, error: err.message, data: studentData });
      }
    }
    return results;
  } catch (error) {
    console.error('File Error:', error);
    throw error;
  }
}

// --- 2. Helper Functions ---

/**
 * THE ULTIMATE FIX: Fetch & Match
 * Fetches all classes once, strips spaces, and finds the matching ID.
 */
async function getExistingClassId(rawString) {
    if (!rawString) return null;

    // 1. Load Cache if empty (Only happens once per file upload)
    if (!_allClassesCache) {
        console.log("🔄 Fetching all classes from DB...");
        const { data, error } = await supabaseClient
            .from('Classes')
            .select('class_id, class_name, section');
        
        if (error) {
            console.error("DB Error fetching classes:", error.message);
            return null;
        }
        _allClassesCache = data;
    }

    // 2. Normalize Input: "JSS 1 - A" -> "JSS1A"
    // Removes all spaces, hyphens, and makes uppercase
    const inputClean = rawString.toUpperCase().replace(/[^A-Z0-9]/g, '');

    console.log(`🔎 Searching match for: "${rawString}" (Normalized: ${inputClean})`);

    // 3. Find Match in Cache
    const match = _allClassesCache.find(dbClass => {
        // Normalize DB Data: "JSS 1" + "A" -> "JSS1A"
        const dbName = (dbClass.class_name || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const dbSection = (dbClass.section || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        // Compare
        return (dbName + dbSection) === inputClean;
    });

    if (match) {
        console.log(`✅ MATCH FOUND! Class: "${match.class_name} ${match.section}" (ID: ${match.class_id})`);
        return match.class_id;
    } else {
        console.warn(`❌ No match found for "${rawString}". Check your spellings.`);
        return null;
    }
}

function generatePassword() {
  return Math.random().toString(36).slice(-10) + "!";
}

function formatExcelDate(dateVal) {
    if (!dateVal) return null;
    if (typeof dateVal === 'string' && dateVal.includes('-')) return dateVal;
    if (!isNaN(dateVal)) {
        const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
        return date.toISOString().split('T')[0];
    }
    return dateVal;
}

function displayResults(results) {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;
  alert(`Process Complete!\n✅ Success: ${successCount}\n❌ Failed: ${failureCount}`);
  document.querySelector('.upload-modal')?.remove();
}

// --- 3. UI Generation ---

export function createDragDropArea() {
  const container = document.createElement('div');
  container.className = 'drag-drop-container';
  container.innerHTML = `
    <div class="drag-drop-box" id="dropZone" style="border: 2px dashed #ccc; padding: 20px; text-align: center; cursor: pointer;">
      <i class="fa-solid fa-cloud-arrow-up"></i>
      <h3>Drag & Drop Excel File</h3>
      <p>Supported: .xlsx, .xls, .csv</p>
      <button type="button" class="btn-browse">Browse Files</button>
      <input type="file" id="excelFileInput" accept=".xlsx,.xls,.csv" style="display: none;">
      <div id="uploadStatus"></div>
    </div>
  `;

  const dropZone = container.querySelector('#dropZone');
  const fileInput = container.querySelector('#excelFileInput');
  const statusDiv = container.querySelector('#uploadStatus');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFile(e.target.files[0], statusDiv));
  
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.background = '#f0f0f0'; });
  dropZone.addEventListener('dragleave', () => { dropZone.style.background = 'transparent'; });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    handleFile(e.dataTransfer.files[0], statusDiv);
  });

  return container;
}

async function handleFile(file, statusDiv) {
  statusDiv.innerHTML = "Processing... (This may take a moment per student)";
  try {
    const results = await uploadAndProcessExcel(file);
    displayResults(results);
  } catch (error) {
    statusDiv.innerHTML = `<span style="color:red;">Error: ${error.message}</span>`;
  }
}