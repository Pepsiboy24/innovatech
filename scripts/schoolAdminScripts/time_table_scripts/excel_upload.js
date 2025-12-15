// Import Supabase client (ensure this path matches your project)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = "https://dzotwozhcxzkxtunmqth.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6b3R3b3poY3h6a3h0dW5tcXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUwODk5NzAsImV4cCI6MjA3MDY2NTk3MH0.KJfkrRq46c_Fo7ujkmvcue4jQAzIaSDfO3bU7YqMZdE";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
import * as XLSX from 'https://cdn.sheetjs.com/xlsx-latest/package/xlsx.mjs';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function initExcelUpload() {
    addExcelUploadButton();
}

function addExcelUploadButton() {
    let container = document.querySelector('.wizard-actions') || document.querySelector('.toolbar');
    let insertBeforeElement = document.getElementById('saveTimetableBtn');
    if (!container) return;
    if (document.getElementById('excelUploadBtn')) return;

    const excelBtn = document.createElement('button');
    excelBtn.type = 'button';
    excelBtn.className = 'btn btn-primary'; 
    excelBtn.id = 'excelUploadBtn';
    excelBtn.innerHTML = '<i class="fa-solid fa-file-excel"></i> Upload Excel';
    excelBtn.style.cssText = 'background-color: #107c41; border-color: #107c41; color: white; margin-right: 10px;';
    
    excelBtn.onclick = openExcelUploadModal;

    if (insertBeforeElement && container.contains(insertBeforeElement)) {
        container.insertBefore(excelBtn, insertBeforeElement);
    } else {
        container.appendChild(excelBtn);
    }
}

function openExcelUploadModal() {
    // ... (Keep your existing modal HTML generation code here) ...
    const modal = document.createElement('div');
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;`;
    modal.innerHTML = `
        <div style="background: white; padding: 32px; border-radius: 12px; width: 500px;">
            <h3>Upload Excel</h3>
            <p style="margin-bottom:15px; font-size:13px; color:#666;">Row 1 = 8:00. Columns = Days.</p>
            <input type="file" id="excelFileInput" accept=".xlsx,.xls" style="width:100%; margin-bottom:15px;">
            <div id="uploadProgress" style="display:none; margin-bottom:15px;">Processing...</div>
            <div style="text-align:right;">
                <button class="btn btn-secondary" onclick="closeExcelModal()">Cancel</button>
                <button class="btn btn-primary" style="background:#107c41;" onclick="processExcelUpload()">Preview</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    window.closeExcelModal = () => document.body.removeChild(modal);
    window.processExcelUpload = () => processExcelUpload();
}

async function processExcelUpload() {
    const fileInput = document.getElementById('excelFileInput');
    const urlParams = new URLSearchParams(window.location.search);
    let classId = urlParams.get('classId');
    if (!classId) classId = prompt("Enter Class ID:");
    
    if (!fileInput.files.length) return alert('Select a file');

    try {
        const file = fileInput.files[0];
        const data = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(data, { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1, defval: '' });

        // Process data to match your requested JSON structure
        const processed = await processExcelData(jsonData, classId);

        if (processed.errors.length > 0) {
            if (!confirm(`Found ${processed.errors.length} errors. Continue?`)) return;
        }

        // --- CRITICAL STEP: PASS DATA TO MAIN SCRIPT ---
        if (window.previewUploadedData) {
            window.previewUploadedData(processed.entries); // <--- Sends the array you pasted
            window.closeExcelModal();
            alert("Data loaded into preview! Review the yellow items and click 'Save Changes'.");
        } else {
            alert("Error: previewUploadedData function missing in main script.");
        }

    } catch (error) {
        console.error(error);
        alert(error.message);
    }
}

async function processExcelData(jsonData, classId) {
    // ... (Keep your existing data processing logic that generates the array) ...
    // This logic produces the array structure you pasted in the prompt.
    // Ensure it returns { entries: [...] }
    
    // (Shortened for brevity - paste your existing logic here)
    if (!jsonData.length) throw new Error('Empty file');
    const headers = jsonData[0];
    const dayColumns = [];
    headers.forEach((h, i) => { if (h && DAYS_OF_WEEK.includes(h.trim())) dayColumns.push({day: h.trim(), index: i}); });
    
    const { data: subjects } = await supabase.from('Subjects').select('*');
    let entries = [];
    let errors = [];
    let currentHour = 8; let currentMinute = 0; const duration = 40;

    for (let r = 1; r < jsonData.length; r++) {
        const row = jsonData[r];
        if (!row || !row.length) continue;
        const firstCell = row[0] ? row[0].toString().toLowerCase() : "";
        if (firstCell.includes("break") || firstCell.includes("lunch")) {
            currentMinute += firstCell.includes("lunch") ? 40 : 20;
            while(currentMinute >= 60) { currentMinute -= 60; currentHour++; }
            continue;
        }
        const timeStr = `${currentHour.toString().padStart(2,'0')}:${currentMinute.toString().padStart(2,'0')}:00`;
        for (const col of dayColumns) {
            const subName = row[col.index];
            if (subName && subName.toString().trim()) {
                const term = subName.toLowerCase().trim();
                let match = subjects.find(s => s.subject_name.toLowerCase() === term || (s.subject_code && s.subject_code.toLowerCase() === term));
                if (match) {
                    entries.push({
                        class_id: parseInt(classId),
                        subject_id: match.subject_id,
                        day_of_week: col.day,
                        start_time: timeStr,
                        duration_minutes: duration,
                        room_number: 'TBD'
                    });
                } else {
                    errors.push(`Row ${r+1}: Subject ${subName} not found`);
                }
            }
        }
        currentMinute += duration;
        while(currentMinute >= 60) { currentMinute -= 60; currentHour++; }
    }
    return { entries, errors };
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

document.addEventListener('DOMContentLoaded', initExcelUpload);