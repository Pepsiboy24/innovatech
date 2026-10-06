/**
 * students_upload_modal.js
 * Bulk Excel upload for the Students page.
 *
 * Required column : Full Name   (or First Name + Surname)
 * Optional        : Gender, Date of Birth, Admission Date, Admission Number, Classes,
 *                   Parent Name, Parent Phone, Parent Email, Relationship
 *
 * Students do NOT need an email. Each one gets a username (amina.bello) and a
 * random one-time password, and signs in as  username@schoolcode.
 */
import { openUploadModal } from '../../../assets/js-shared/upload_modal_ui.js';
import { excelRowToStudent, previewStudents, createStudents, downloadCredentials } from './multipleStudentReg.js';
import { lazyScript } from '/core/perf.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const HINT_HTML = `
<strong style="color:#93c5fd;">Required:</strong>
<code style="color:#a5f3fc;">Full Name</code>
&nbsp;·&nbsp;
<strong style="color:#93c5fd;">Optional:</strong>
<code style="color:#a5f3fc;">Gender</code>,
<code style="color:#a5f3fc;">Date of Birth</code>,
<code style="color:#a5f3fc;">Admission Date</code>,
<code style="color:#a5f3fc;">Admission Number</code>,
<code style="color:#a5f3fc;">Classes</code>,
<code style="color:#a5f3fc;">Parent Name</code>,
<code style="color:#a5f3fc;">Parent Phone</code>,
<code style="color:#a5f3fc;">Parent Email</code>,
<code style="color:#a5f3fc;">Relationship</code>
<div style="margin-top:8px;">
  <label for="nameOrderSelect" style="color:#93c5fd;">Names in the file are written:</label>
  <select id="nameOrderSelect" onchange="window.__studentNameOrderChanged && window.__studentNameOrderChanged()"
          style="margin-left:6px;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:4px 8px;">
    <option value="first_surname">First name first (Amina Grace Bello)</option>
    <option value="surname_first">Surname first (Bello Amina Grace)</option>
  </select>
</div>
<br>
<span style="color:#64748b;">
  No student email needed. Every student gets a username like <code style="color:#fcd34d;">amina.bello</code>
  and a random one-time password, and signs in as <code style="color:#fcd34d;">amina.bello@schoolcode</code>.
  A parent login is created automatically when Parent Name plus a phone or email is given.
  Check the <b>Username</b> column in the preview, then download the logins sheet when the upload ends
  (passwords are shown only once).
</span>`;

const COLUMNS = [
    { key: 'Full Name', label: 'Full Name', required: true },
    { key: 'Username', label: 'Username (preview)' },
    { key: 'Gender', label: 'Gender' },
    { key: 'Classes', label: 'Class' },
    { key: 'Parent Name', label: 'Parent Name' },
];

const nameOrder = () => document.getElementById('nameOrderSelect')?.value || 'first_surname';

async function downloadTemplate() {
    await lazyScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', 'XLSX');

    // Sheet 1: the data sheet. The upload reads ONLY the first sheet.
    const ws = XLSX.utils.aoa_to_sheet([
        ['Full Name', 'Gender', 'Date of Birth', 'Admission Date', 'Admission Number', 'Classes', 'Parent Name', 'Parent Phone', 'Parent Email', 'Relationship'],
        ['Amina Grace Bello', 'Female', '2010-05-14', '2024-09-01', 'AFM/2024/001', 'JSS 1 A', 'Mary Bello', '08012345678', '', 'Mother'],
    ]);
    ws['!cols'] = [26, 10, 16, 16, 20, 14, 22, 16, 26, 14].map((wch) => ({ wch }));

    // Sheet 2: instructions (ignored by the upload)
    const help = XLSX.utils.aoa_to_sheet([
        ['How to fill in this template'],
        ['1. Delete the example row (row 2), or replace it with a real student, before uploading.'],
        ['2. Only "Full Name" is required. Every other column can be left empty.'],
        ['3. Students do NOT need an email. Each gets a username like amina.bello and a random one-time password.'],
        ['4. Dates: write them as YYYY-MM-DD, for example 2010-05-14.'],
        ['5. Classes: write the class the way it appears on your Classes page, for example JSS 1 A. Classes that do not match are flagged in the preview.'],
        ['6. Parent: give Parent Name plus a Parent Phone or Parent Email and a parent login is created and linked.'],
        ['7. Parent Phone: Nigerian format, for example 08012345678. Siblings with the same parent phone share one parent login.'],
        ['8. Admission Number: optional, but must be unique within your school.'],
        ['9. In the upload screen, choose whether names are written first-name-first or surname-first.'],
    ]);
    help['!cols'] = [{ wch: 120 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    XLSX.utils.book_append_sheet(wb, help, 'Instructions');
    XLSX.writeFile(wb, 'students_template.xlsx');
}

async function processFile(file, helpers) {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded.', 'error'); return; }
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });

    if (!raw.length) { showToast('File is empty.', 'warning'); return; }

    const rows = raw.map((r, i) => {
        const student = excelRowToStudent(r);
        const errors = [];
        if (!student.full_name) errors.push('Missing Full Name');
        if (student.parent && !student.parent.phone && !student.parent.email) errors.push('Parent needs a phone or email');
        return { ...r, 'Full Name': student.full_name, Username: '', Classes: student.class_input, __student: student, __index: i, __errors: errors };
    });

    helpers._rows = rows;
    helpers._file = file;

    // Ask the server which usernames would be created (nothing is saved yet).
    const valid = rows.filter((r) => !r.__errors.length);
    if (valid.length) {
        try {
            const planned = await previewStudents(valid.map((r) => r.__student), nameOrder());
            planned.forEach((p, k) => {
                valid[k].Username = p.ok ? p.login : '';
                if (!p.ok) valid[k].__errors.push(p.error || 'Cannot create username');
                else if (p.class_matched === false) valid[k].Username += '  (class not found)';
            });
        } catch (e) {
            showToast('Could not reach the student service: ' + e.message, 'error', 7000);
            helpers.setUploadEnabled(false);
            helpers.showPreview(rows, COLUMNS);
            return;
        }
    }

    helpers.showPreview(rows, COLUMNS);
    const ok = rows.filter((r) => !r.__errors.length).length;
    helpers.setUploadEnabled(ok > 0);
    if (ok === 0) showToast('No valid rows found.', 'warning');
    else showToast(`${ok} student${ok !== 1 ? 's' : ''} ready. Check the usernames, then upload.`, 'success', 4500);
}

async function doUpload(file, helpers) {
    const toCreate = (helpers._rows || []).filter((r) => !r.__errors.length);
    const confirmed = await window.showConfirm(
        `Create ${toCreate.length} student${toCreate.length !== 1 ? 's' : ''}? Each gets a random one-time password. You will download a sheet with all logins when it finishes.`,
        'Confirm Bulk Upload'
    );
    if (!confirmed) return;

    helpers.startProgress(toCreate.length);

    try {
        const results = await createStudents(toCreate.map((r) => r.__student), {
            nameOrder: nameOrder(),
            onProgress: (done, total) => helpers.tickProgress && helpers.tickProgress(done, total, `Created ${done} of ${total}…`),
        });

        const succeeded = results.filter((r) => r.success);
        const failed = results.filter((r) => !r.success);
        const warned = succeeded.filter((r) => r.warnings && r.warnings.length);

        // Passwords exist only in this result. Save them now.
        window.__lastStudentLogins = results;
        if (succeeded.length) downloadCredentials(results);

        const lines = [];
        if (succeeded.length) {
            lines.push(`<div style="color:#86efac;margin-top:6px;">✓ ${succeeded.length} created. A logins sheet was downloaded: <b>keep it safe, passwords are not shown again.</b>
                <button type="button" onclick="window.__downloadStudentLogins()" style="margin-left:8px;background:#1d4ed8;color:#fff;border:0;border-radius:6px;padding:4px 10px;cursor:pointer;">Download again</button></div>`);
        }
        failed.forEach((r) => lines.push(`<div style="color:#fca5a5;margin-top:4px;">⚠ ${esc(r.full_name || 'Row')}: ${esc(r.error)}</div>`));
        warned.forEach((r) => lines.push(`<div style="color:#fcd34d;margin-top:4px;">ℹ ${esc(r.full_name)}: ${esc(r.warnings.join(' '))}</div>`));

        helpers.finishProgress(lines.join(''));
        helpers.showFooterDone();

        if (succeeded.length > 0 && failed.length === 0)
            showToast(`✅ ${succeeded.length} student${succeeded.length !== 1 ? 's' : ''} created!`, 'success', 6000);
        else if (succeeded.length > 0)
            showToast(`Created ${succeeded.length}, ${failed.length} failed.`, 'warning', 7000);
        else
            showToast('All uploads failed. Check details.', 'error');
    } catch (e) {
        helpers.finishProgress(`<div style="color:#fca5a5;">Upload error: ${esc(e.message)}</div>`);
        helpers.showFooterDone();
        showToast('Upload error: ' + e.message, 'error');
    }
}

window.__downloadStudentLogins = () => {
    if (window.__lastStudentLogins) downloadCredentials(window.__lastStudentLogins);
};

window.openStudentsExcelUpload = function () {
    if (typeof XLSX === 'undefined') { showToast('Excel library not loaded. Refresh and try again.', 'error'); return; }
    openUploadModal({
        title: 'Bulk Upload Students',
        icon: 'fa-user-graduate',
        accept: '.xlsx,.xls',
        hintHtml: HINT_HTML,
        templateFn: downloadTemplate,
        confirmLabel: 'Upload Students',
        onFile: (file, helpers) => {
            // Re-run the preview if the admin flips "surname first" after choosing the file.
            window.__studentNameOrderChanged = () => { if (helpers._file) processFile(helpers._file, helpers); };
            return processFile(file, helpers);
        },
        onConfirm: doUpload,
    });
};
