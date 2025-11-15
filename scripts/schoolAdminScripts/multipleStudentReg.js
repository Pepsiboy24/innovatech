const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Function to handle Excel file upload and process students
export async function uploadAndProcessExcel(file) {
  try {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet);

    console.log('Parsed Excel data:', jsonData);

    // Process each row and add to Supabase
    const results = [];
    for (const row of jsonData) {
      const studentData = {
        full_name: row['Full Name'] || row['full_name'] || row['Name'],
        email: row['Email'] || row['email'],
        date_of_birth: row['Date of Birth'] || row['date_of_birth'] || row['DOB'],
        gender: row['Gender'] || row['gender'],
        admission_date: row['Admission Date'] || row['admission_date'] || new Date().toISOString().split('T')[0],
        profile_picture: "https://placehold.co/150x150/e8e8e8/363636?text=Profile"
      };

      // Validate required fields
      if (!studentData.full_name || !studentData.email) {
        console.error('Missing required fields for student:', studentData);
        results.push({ success: false, error: 'Missing required fields', data: studentData });
        continue;
      }

      // Generate a password (you might want to customize this)
      const password = generatePassword();

      try {
        // Sign up the user
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
          email: studentData.email,
          password: password,
        });

        if (authError) {
          console.error("Error signing up user:", authError.message);
          results.push({ success: false, error: authError.message, data: studentData });
          continue;
        }

        // Insert student profile
        const { error: insertError } = await supabaseClient
          .from("Students")
          .insert([
            {
              student_id: authData.user.id,
              full_name: studentData.full_name,
              date_of_birth: studentData.date_of_birth,
              gender: studentData.gender,
              admission_date: studentData.admission_date,
              profile_picture: studentData.profile_picture,
            },
          ]);

        if (insertError) {
          console.error("Error inserting student profile:", insertError.message);
          results.push({ success: false, error: insertError.message, data: studentData });
        } else {
          results.push({ success: true, data: studentData });
        }
      } catch (err) {
        console.error("An unexpected error occurred:", err.message);
        results.push({ success: false, error: err.message, data: studentData });
      }
    }

    return results;
  } catch (error) {
    console.error('Error processing Excel file:', error);
    throw error;
  }
}

// Function to generate a random password
function generatePassword() {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
}

// Function to create drag and drop area
export function createDragDropArea() {
  const dragDropArea = document.createElement('div');
  dragDropArea.id = 'dragDropArea';
  dragDropArea.innerHTML = `
    <div class="drag-drop-content">
      <div class="drag-drop-icon">
        <svg width="48" height="48" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>
      <h3>Drag & Drop Excel File</h3>
      <p>or <span class="file-link">browse files</span></p>
      <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="display: none;">
    </div>
  `;

  // Add drag and drop event listeners
  dragDropArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    dragDropArea.classList.add('drag-over');
  });

  dragDropArea.addEventListener('dragleave', () => {
    dragDropArea.classList.remove('drag-over');
  });

  dragDropArea.addEventListener('drop', (e) => {
    e.preventDefault();
    dragDropArea.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files[0]);
    }
  });

  // Add click to browse
  const fileLink = dragDropArea.querySelector('.file-link');
  const fileInput = dragDropArea.querySelector('#excelFileInput');

  fileLink.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      handleFileUpload(e.target.files[0]);
    }
  });

  return dragDropArea;
}

// Function to handle file upload
async function handleFileUpload(file) {
  if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
    alert('Please select a valid Excel file (.xlsx or .xls)');
    return;
  }

  try {
    const results = await uploadAndProcessExcel(file);
    displayResults(results);
  } catch (error) {
    alert('Error processing file: ' + error.message);
  }
}

// Function to display results
function displayResults(results) {
  const successCount = results.filter(r => r.success).length;
  const failureCount = results.filter(r => !r.success).length;

  let message = `Upload completed!\n\nSuccessful: ${successCount}\nFailed: ${failureCount}`;

  if (failureCount > 0) {
    message += '\n\nFailed entries:';
    results.filter(r => !r.success).forEach((result, index) => {
      message += `\n${index + 1}. ${result.data.full_name || 'Unknown'}: ${result.error}`;
    });
  }

  alert(message);
}
