import { openUploadModal } from '../../../scripts/upload_modal_ui.js';
import { supabase } from '../../../config.js'; // Ensure this matches your config export

const HINT_HTML = `
<strong style="color:#93c5fd;">Required columns:</strong>
<code style="color:#a5f3fc;">class_name</code>,
<code style="color:#a5f3fc;">section</code>
&nbsp;·&nbsp;
<strong style="color:#93c5fd;">Optional:</strong>
<code style="color:#a5f3fc;">teacher_name</code>,
<code style="color:#a5f3fc;">students_count</code>
<br>
<span style="color:#64748b;">One row per class. The section value should be a letter or number (e.g. "A", "1"). 
If a Teacher name is provided it must already exist in the Teachers table.</span>`;

const COLUMNS = [
    { key: 'class_name', label: 'Class Name', required: true },
    { key: 'section', label: 'Section', required: true },
    { key: 'teacher_name', label: 'Teacher Name' },
    { key: 'students_count', label: 'Students Count' },
];

// ... (parseCSV, parseXLSX, downloadTemplate, and processFile functions remain the same as your original) ...

async function doUpload(file, helpers) {
    const validRows = (helpers._rows || []).filter(r => !r.__errors.length);
    if (!validRows.length) return;
    
    const confirmed = await window.showConfirm(
        `Upload ${validRows.length} class${validRows.length !== 1 ? 'es' : ''}?`,
        'Confirm Upload'
    );
    if (!confirmed) return;

    // Get current user metadata for RLS
    const { data: { user } } = await supabase.auth.getUser();
    const schoolId = user?.user_metadata?.school_id;

    if (!schoolId) {
        showToast('Error: School ID not found in session.', 'error');
        return;
    }

    helpers.startProgress(validRows.length);
    let succeeded = 0, failed = 0;
    const errors = [];

    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        helpers.tickProgress(i, validRows.length, `Uploading: ${row.class_name} (${row.section})`);
        
        try {
            // FIXED: Changed supabaseClient to supabase
            // FIXED: Added school_id to payload
            const { error } = await supabase.from('Classes').insert([{
                class_name: row.class_name,
                section: row.section,
                school_id: schoolId, 
                created_at: new Date().toISOString()
            }]);

            if (error) throw new Error(error.message);
            
            succeeded++;
        } catch (e) {
            failed++;
            errors.push(`Row ${i + 1}: ${e.message}`);
        }
    }

    helpers.finishProgress(errors.map(e => `<div style="color:#fca5a5;margin-top:4px;">⚠ ${e}</div>`).join(''));
    helpers.showFooterDone();

    if (succeeded > 0 && failed === 0) showToast(`✅ ${succeeded} classes uploaded!`, 'success');
    else if (succeeded > 0) showToast(`Uploaded ${succeeded}, ${failed} failed.`, 'warning');
    
    if (typeof window.reloadClasses === 'function') window.reloadClasses();
}

window.openClassesExcelUpload = function () {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    openUploadModal({
        title: 'Bulk Upload Classes',
        icon: 'fa-file-excel',
        accept: '.xlsx,.xls,.csv',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Upload Classes',
        onFile: processFile,
        onConfirm: doUpload,
    });
};

// NEW: Wire the button click to the window function
document.addEventListener('DOMContentLoaded', () => {
    const bulkBtn = document.getElementById('bulkUploadBtn');
    if (bulkBtn) {
        bulkBtn.addEventListener('click', () => {
            window.openClassesExcelUpload();
        });
    }
});