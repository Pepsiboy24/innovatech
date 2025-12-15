
// Excel Upload Module for Timetable Entries
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Supabase configuration
const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Days of the week mapping
const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];


// Initialize the Excel upload functionality
export function initExcelUpload() {
    console.log('Initializing Excel upload functionality...');
        
    // Add Excel upload button to the page
    addExcelUploadButton();
}

// Handle file selection
function handleFileSelection(event) {
    const file = event.target.files[0];
    const previewBtn = document.getElementById('previewExcelBtn');
    const processBtn = document.getElementById('processExcelBtn');
    
    if (file) {
        // Validate file type
        if (!file.name.match(/\.(xlsx|xls)$/)) {
            alert('Please select a valid Excel file (.xlsx or .xls)');
            event.target.value = '';
            previewBtn.style.display = 'none';
            return;
        }
        
        // Show preview button
        previewBtn.style.display = 'inline-flex';
    } else {
        previewBtn.style.display = 'none';
    }
}

// Preview Excel file data
async function previewExcelFileData() {
    const fileInput = document.getElementById('excelFileInput');
    const previewSection = document.getElementById('previewSection');
    const previewContent = document.getElementById('previewContent');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select an Excel file');
        return;
    }
    
    const file = fileInput.files[0];
    
    try {
        previewContent.innerHTML = '<div style="text-align: center; color: var(--text-gray);">Loading preview...</div>';
        previewSection.style.display = 'block';
        
        // Read the file as binary string
        const fileData = await readFileAsArrayBuffer(file);
        
        // Parse Excel data
        const workbook = XLSX.read(fileData, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        // Generate preview HTML
        let previewHTML = '<div style="font-size: 12px;"><strong>Data Preview:</strong></div>';
        previewHTML += '<table style="width: 100%; margin-top: 8px; font-size: 11px; border-collapse: collapse;">';
        
        // Show first 10 rows
        const maxRows = Math.min(10, jsonData.length);
        for (let i = 0; i < maxRows; i++) {
            const row = jsonData[i];
            if (row && row.some(cell => cell && cell.toString().trim() !== '')) {
                previewHTML += '<tr>';
                row.forEach(cell => {
                    const cellValue = cell ? cell.toString() : '';
                    previewHTML += `<td style="padding: 4px; border: 1px solid var(--border); max-width: 100px; overflow: hidden; text-overflow: ellipsis;">${cellValue}</td>`;
                });
                previewHTML += '</tr>';
            }
        }
        
        if (jsonData.length > maxRows) {
            previewHTML += `<tr><td colspan="100%" style="padding: 4px; text-align: center; color: var(--text-gray); font-style: italic;">... and ${jsonData.length - maxRows} more rows</td></tr>`;
        }
        
        previewHTML += '</table>';
        
        // Add validation info
        const headers = jsonData[0] || [];
        const dayColumns = headers.filter(header => header && DAYS_OF_WEEK.includes(header));
        
        previewHTML += `<div style="margin-top: 12px; font-size: 11px; color: var(--text-gray);">`;
        previewHTML += `<strong>Found ${dayColumns.length} day columns:</strong> ${dayColumns.join(', ')}<br>`;
        previewHTML += `<strong>Data rows:</strong> ${jsonData.length - 1} (excluding header)`;
        previewHTML += `</div>`;
        
        previewContent.innerHTML = previewHTML;
        
    } catch (error) {
        console.error('Error previewing Excel file:', error);
        previewContent.innerHTML = `<div style="color: var(--danger);">Error loading preview: ${error.message}</div>`;
    }
}

// Add Excel upload button to the wizard actions
function addExcelUploadButton() {
    const wizardActions = document.querySelector('.wizard-actions');
    if (!wizardActions) return;

    // Create Excel upload button
    const excelBtn = document.createElement('button');
    excelBtn.type = 'button';
    excelBtn.className = 'btn btn-primary';
    excelBtn.id = 'excelUploadBtn';
    excelBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Upload Excel';
    
    // Add click handler
    excelBtn.addEventListener('click', openExcelUploadModal);

    // Insert before the Save Timetable button
    const saveBtn = document.getElementById('saveTimetableBtn');
    if (saveBtn) {
        wizardActions.insertBefore(excelBtn, saveBtn);
    }
}


// Open Excel upload modal
function openExcelUploadModal() {
    const modal = document.createElement('div');
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    
    modal.innerHTML = `
        <div style="background: white; padding: 32px; border-radius: 12px; width: 600px; max-width: 90%; max-height: 90vh; overflow-y: auto;">
            <h3 style="margin-bottom: 20px; color: var(--text-dark);">
                <i class="fa-solid fa-file-excel" style="color: var(--primary);"></i>
                Upload Excel Timetable
            </h3>
            
            <div style="margin-bottom: 20px;">
                <p style="color: var(--text-gray); font-size: 14px; margin-bottom: 16px;">
                    Upload an Excel file (.xlsx) with the following format:
                </p>
                <ul style="color: var(--text-gray); font-size: 13px; margin-left: 20px; margin-bottom: 16px;">
                    <li>First column should contain time slots (e.g., 8:00, 9:00, etc.)</li>
                    <li>Other columns should be day names (Monday, Tuesday, etc.)</li>
                    <li>Cells contain subject names</li>
                </ul>
                <div style="background: var(--bg-light); padding: 12px; border-radius: 6px; margin-bottom: 16px;">
                    <strong>Example:</strong>
                    <table style="width: 100%; margin-top: 8px; font-size: 12px;">
                        <tr style="background: white;">
                            <th style="padding: 4px; border: 1px solid var(--border);">Time</th>
                            <th style="padding: 4px; border: 1px solid var(--border);">Monday</th>
                            <th style="padding: 4px; border: 1px solid var(--border);">Tuesday</th>
                        </tr>
                        <tr>
                            <td style="padding: 4px; border: 1px solid var(--border);">8:00</td>
                            <td style="padding: 4px; border: 1px solid var(--border);">Math</td>
                            <td style="padding: 4px; border: 1px solid var(--border);">Science</td>
                        </tr>
                        <tr>
                            <td style="padding: 4px; border: 1px solid var(--border);">9:00</td>
                            <td style="padding: 4px; border: 1px solid var(--border);">English</td>
                            <td style="padding: 4px; border: 1px solid var(--border);">History</td>
                        </tr>
                    </table>
                </div>
            </div>
            

            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Select Excel File:</label>
                <input type="file" id="excelFileInput" accept=".xlsx,.xls" 
                       style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px;">
                <div style="margin-top: 8px;">
                    <button type="button" class="btn btn-secondary" onclick="downloadSampleTemplate()" style="font-size: 12px; padding: 6px 12px;">
                        <i class="fa-solid fa-download"></i> Download Sample Template
                    </button>
                </div>
            </div>
            
            <div style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Default Duration (minutes):</label>
                <input type="number" id="defaultDuration" value="40" min="1" 
                       style="width: 100%; padding: 8px; border: 1px solid var(--border); border-radius: 6px;">
            </div>
            


            
            <div id="previewSection" style="display: none; margin-bottom: 20px;">
                <h4 style="margin-bottom: 12px; color: var(--text-dark);">Preview</h4>
                <div id="previewContent" style="background: var(--bg-light); padding: 16px; border-radius: 6px; max-height: 200px; overflow-y: auto;"></div>
            </div>
            
            <div id="uploadProgress" style="display: none; margin-bottom: 20px;">
                <div style="background: var(--bg-light); padding: 16px; border-radius: 6px;">
                    <div style="margin-bottom: 8px; font-size: 14px;">Processing file...</div>
                    <div style="background: var(--border); height: 6px; border-radius: 3px; overflow: hidden;">
                        <div id="progressBar" style="background: var(--primary); height: 100%; width: 0%; transition: width 0.3s;"></div>
                    </div>
                    <div id="progressText" style="margin-top: 4px; font-size: 12px; color: var(--text-gray);"></div>
                </div>
            </div>
            
            <div style="display: flex; gap: 12px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="closeExcelModal()">Cancel</button>
                <button type="button" class="btn btn-primary" id="previewExcelBtn" onclick="previewExcelFile()" style="display: none;">
                    <i class="fa-solid fa-eye"></i> Preview
                </button>
                <button type="button" class="btn btn-success" id="processExcelBtn" onclick="processExcelFile()">
                    <i class="fa-solid fa-upload"></i> Upload
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Add file input change handler
    const fileInput = document.getElementById('excelFileInput');
    fileInput.addEventListener('change', handleFileSelection);
    
    // Make functions global for onclick handlers
    window.closeExcelModal = () => {
        document.body.removeChild(modal);
        delete window.closeExcelModal;
        delete window.processExcelFile;
        delete window.previewExcelFile;
    };
    

    window.processExcelFile = () => processExcelFileData();
    window.previewExcelFile = () => previewExcelFileData();
    window.downloadSampleTemplate = () => downloadSampleTemplate();
}

// Download sample template
function downloadSampleTemplate() {
    try {
        // Create sample data
        const sampleData = [
            ['Time', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
            ['8:00', 'Mathematics', 'Science', 'English', 'History', 'Mathematics'],
            ['9:00', 'English', 'Mathematics', 'Science', 'Mathematics', 'English'],
            ['10:00', 'Science', 'English', 'Mathematics', 'Science', 'History'],
            ['11:00', 'History', 'History', 'English', 'Mathematics', 'Science'],
            ['12:00', 'Lunch', 'Lunch', 'Lunch', 'Lunch', 'Lunch'],
            ['13:00', 'Mathematics', 'Science', 'History', 'English', 'Mathematics'],
            ['14:00', 'English', 'Mathematics', 'Science', 'History', 'English']
        ];

        // Create worksheet
        const worksheet = XLSX.utils.aoa_to_sheet(sampleData);
        
        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Timetable');
        
        // Download file
        XLSX.writeFile(workbook, 'timetable_template.xlsx');
        
    } catch (error) {
        console.error('Error creating sample template:', error);
        alert('Error creating sample template: ' + error.message);
    }
}


// Process the Excel file

async function processExcelFileData() {
    const fileInput = document.getElementById('excelFileInput');
    const defaultDuration = parseInt(document.getElementById('defaultDuration').value) || 40;
    const progressDiv = document.getElementById('uploadProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select an Excel file');
        return;
    }
    
    const file = fileInput.files[0];
    
    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        alert('Please select a valid Excel file (.xlsx or .xls)');
        return;
    }
    
    // Show progress
    progressDiv.style.display = 'block';
    updateProgress(0, 'Reading Excel file...');
    
    try {
        // Read the file as binary string
        const fileData = await readFileAsArrayBuffer(file);
        updateProgress(20, 'Parsing Excel data...');
        
        // Parse Excel data
        const workbook = XLSX.read(fileData, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        
        updateProgress(40, 'Validating data format...');
        

        // Process the data
        const processedData = await processExcelData(jsonData, defaultDuration);
        
        updateProgress(80, 'Saving to database...');
        
        // Save to Supabase
        const result = await saveTimetableEntries(processedData);
        
        updateProgress(100, 'Complete!');
        
        setTimeout(() => {
            let message = `Successfully processed ${result.successCount} timetable entries!`;
            
            if (result.errors.length > 0) {
                message += `\n\n${result.errors.length} entries had errors and were skipped.`;
                console.warn('Errors:', result.errors);
            }
            
            if (result.warnings && result.warnings.length > 0) {
                console.warn('Warnings:', result.warnings);
            }
            
            alert(message);
            window.closeExcelModal();
            // Refresh the page to show new entries
            location.reload();
        }, 1000);
        
    } catch (error) {
        console.error('Error processing Excel file:', error);
        alert('Error processing file: ' + error.message);
        progressDiv.style.display = 'none';
    }
}

// Read file as ArrayBuffer
function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}



// Process Excel data and map to timetable entries
async function processExcelData(jsonData, defaultDuration) {
    if (!jsonData || jsonData.length === 0) {
        throw new Error('No data found in Excel file');
    }
    
    const urlParams = new URLSearchParams(window.location.search);
    const classId = urlParams.get('classId');
    
    if (!classId) {
        throw new Error('Class ID not found in URL');
    }
    
    // First row should contain headers (days of week)
    const headers = jsonData[0];
    const dayColumns = [];
    
    // Find day columns (Monday, Tuesday, etc.)
    headers.forEach((header, index) => {
        if (header && DAYS_OF_WEEK.includes(header)) {
            dayColumns.push({ day: header, index: index });
        }
    });
    
    if (dayColumns.length === 0) {
        throw new Error('No valid day columns found (Monday, Tuesday, etc.)');
    }
    

    // Load subjects from database
    updateProgress(50, 'Loading subjects...');
    
    const subjectsRes = await supabase.from('Subjects').select('*');
    
    if (subjectsRes.error) throw new Error('Failed to load subjects: ' + subjectsRes.error.message);
    
    const subjects = subjectsRes.data || [];
    
    updateProgress(60, 'Processing timetable entries...');
    
    const timetableEntries = [];
    const errors = [];
    const warnings = [];
    
    // Process each row (starting from row 1, skipping headers)
    for (let rowIndex = 1; rowIndex < jsonData.length; rowIndex++) {
        const row = jsonData[rowIndex];
        
        // Skip empty rows
        if (!row || row.every(cell => !cell || cell.toString().trim() === '')) {
            continue;
        }
        
        const timeSlot = row[0]; // First column should be time
        
        if (!timeSlot || timeSlot.toString().trim() === '') {
            warnings.push(`Row ${rowIndex + 1}: No time slot specified, skipping row`);
            continue;
        }
        
        // Process each day column
        for (const dayColumn of dayColumns) {
            const subjectName = row[dayColumn.index];
            

            if (subjectName && subjectName.toString().trim() !== '') {
                // Try to find matching subject
                const subject = findBestMatch(subjects, subjectName.toString().trim());
                
                if (!subject) {
                    errors.push(`Row ${rowIndex + 1}, ${dayColumn.day}: Subject "${subjectName}" not found in database`);
                    continue;
                }
                
                // Create timetable entry
                const entry = {
                    class_id: parseInt(classId),
                    subject_id: subject.subject_id,
                    day_of_week: dayColumn.day,
                    start_time: formatTime(timeSlot.toString().trim()),
                    duration_minutes: defaultDuration
                };
                
                timetableEntries.push(entry);
            }
        }
    }
    
    if (errors.length > 0) {
        console.warn('Some entries had errors:', errors);
    }
    
    if (warnings.length > 0) {
        console.warn('Some warnings:', warnings);
    }
    
    return {
        entries: timetableEntries,
        errors: errors,
        warnings: warnings
    };
}


// Find best matching subject by name or code
function findBestMatch(subjects, searchTerm) {
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // First try exact match on subject_name
    let match = subjects.find(s => 
        s.subject_name && s.subject_name.toLowerCase().trim() === normalizedSearch
    );
    
    if (match) return match;
    
    // Then try exact match on subject_code
    match = subjects.find(s => 
        s.subject_code && s.subject_code.toLowerCase().trim() === normalizedSearch
    );
    
    if (match) return match;
    
    // Then try partial match on subject_name
    match = subjects.find(s => 
        s.subject_name && s.subject_name.toLowerCase().includes(normalizedSearch)
    );
    
    if (match) return match;
    
    // Finally try partial match on subject_code
    return subjects.find(s => 
        s.subject_code && s.subject_code.toLowerCase().includes(normalizedSearch)
    );
}




// Format time string to HH:MM:SS
function formatTime(timeStr) {
    // Handle various time formats
    const time = timeStr.trim();
    
    // If already in HH:MM format
    if (time.match(/^\d{1,2}:\d{2}$/)) {
        return time + ':00';
    }
    
    // If in HH:MM:SS format
    if (time.match(/^\d{1,2}:\d{2}:\d{2}$/)) {
        return time;
    }
    
    // Try to parse other formats
    const parsed = new Date('2000-01-01 ' + time);
    if (!isNaN(parsed.getTime())) {
        const hours = parsed.getHours().toString().padStart(2, '0');
        const minutes = parsed.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}:00`;
    }
    
    // Default fallback
    return '08:00:00';
}

// Update progress bar
function updateProgress(percentage, text) {
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    if (progressBar) progressBar.style.width = percentage + '%';
    if (progressText) progressText.textContent = text;
}

// Save timetable entries to Supabase
async function saveTimetableEntries(data) {
    const entries = data.entries;
    const errors = data.errors;
    
    if (entries.length === 0) {
        throw new Error('No valid timetable entries found to save');
    }
    
    // Insert entries in batches
    const batchSize = 50;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        
        try {
            const { error } = await supabase
                .from('timetable_entries')
                .insert(batch);
            
            if (error) {
                console.error('Batch insert error:', error);
                errorCount += batch.length;
            } else {
                successCount += batch.length;
            }
        } catch (error) {
            console.error('Batch insert failed:', error);
            errorCount += batch.length;
        }
        
        updateProgress(80 + Math.floor((i / entries.length) * 20), `Saving entries ${i + 1}-${Math.min(i + batchSize, entries.length)} of ${entries.length}...`);
    }
    
    return {
        successCount: successCount,
        errorCount: errorCount,
        errors: errors
    };
}


// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        initExcelUpload();
    } catch (error) {
        console.error('Failed to initialize Excel upload:', error);
    }
});



