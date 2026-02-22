// multipleStudentReg.js
import { supabaseClient } from './supabase_client.js';


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
        const {
          data: { user },
          error: authError,
        } = await supabaseClient.auth.signUp({
          email: studentData.email,
          password: password,
        });

        if (authError) {
          // Check if email already exists and skip with logging
          if (authError.message.includes('already registered') ||
            authError.message.includes('User already registered') ||
            authError.message.includes('duplicate')) {
            console.log(`Skip: Email already exists - ${studentData.email}`);
            results.push({
              success: false,
              error: 'Skip: Email already exists',
              data: studentData,
              skipped: true
            });
            continue;
          }
          throw new Error("Auth: " + authError.message);
        }

        // 2. Insert Profile into 'Students' Table
        const { error: insertError } = await supabaseClient
          .from("Students")
          .insert([
            {
              student_id: user.id,
              full_name: studentData.full_name,
              date_of_birth: formatExcelDate(studentData.date_of_birth),
              gender: studentData.gender,
              admission_date: formatExcelDate(studentData.admission_date),
              profile_picture: studentData.profile_picture,
              class_id: class_id // Will be null if class not found
            },
          ]);

        if (insertError) throw new Error("DB: " + insertError.message);

        console.log(`✅ Successfully registered: ${studentData.email} (ID: ${user.id})`);
        results.push({ success: true, data: studentData, userId: user.id });

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
  const failureCount = results.filter(r => !r.success && !r.skipped).length;
  const skippedCount = results.filter(r => r.skipped).length;

  let message = `Process Complete!\n✅ Successfully Registered: ${successCount}\n`;
  if (skippedCount > 0) {
    message += `⏭️ Skipped (Email Exists): ${skippedCount}\n`;
  }
  if (failureCount > 0) {
    message += `❌ Failed: ${failureCount}`;
  }

  // Log skipped emails for admin reference
  const skippedStudents = results.filter(r => r.skipped);
  if (skippedStudents.length > 0) {
    console.log('=== SKIPPED STUDENTS (Email Already Exists) ===');
    skippedStudents.forEach(student => {
      console.log(`- ${student.data.email} (${student.data.full_name})`);
    });
  }

  alert(message);
  document.querySelector('.upload-modal')?.remove();

  if (typeof window.refreshStudentList === 'function') {
    console.log("🔄 Refreshing student table...");
    window.refreshStudentList();
  }
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