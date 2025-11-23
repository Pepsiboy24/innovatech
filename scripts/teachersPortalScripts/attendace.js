import { fetchStudents } from '../../scripts/schoolAdminScripts/students_scripts/viewAllStudents.js';

const HARDCODED_TEACHER_ID = 1; // Hardcoded teacher ID for now

// Utility function to get attendance status value for a student row
function getAttendanceStatus(row) {
    const radios = row.querySelectorAll('input[type="radio"]');
    for (const radio of radios) {
        if (radio.checked) {
            return radio.value;
        }
    }
    return null; // No status selected
}

// Utility function to get remarks for a student row
function getRemarks(row) {
    const remarksInput = row.querySelector('.remarks-input');
    return remarksInput ? remarksInput.value.trim() : '';
}

// Function to gather attendance data from the page
async function gatherAttendanceData() {
    const students = await fetchStudents();

    // Build a map from student full name to student id
    const studentMap = new Map();
    for (const student of students) {
        studentMap.set(student.full_name, student.id);
    }

    const attendanceTableBody = document.querySelector('.attendance-table tbody');
    if (!attendanceTableBody) {
        console.error('Attendance table body not found');
        return [];
    }

    const dateInput = document.querySelector('.date-input');
    const attendanceDate = dateInput ? dateInput.value : '';

    const attendanceData = [];

    const rows = attendanceTableBody.querySelectorAll('tr');
    for (const row of rows) {
        const nameDiv = row.querySelector('.student-info > p') || row.querySelector('.student-info h4');
        let studentName = '';
        if (nameDiv) {
            studentName = nameDiv.textContent.trim();
        } else {
            // Alternative approach: get from student-avatar initials and guess
            console.warn('Student name element not found in row');
            continue;
        }

        const studentId = studentMap.get(studentName);
        if (!studentId) {
            console.warn(`Student ID not found for name: ${studentName}`);
            continue;
        }

        const status = getAttendanceStatus(row);
        if (!status) {
            console.warn(`Attendance status not set for student: ${studentName}`);
            continue;
        }

        const notes = getRemarks(row);

        attendanceData.push({
            student_id: studentId,
            date: attendanceDate,
            status: status,
            notes: notes,
            recorded_by_user_id: HARDCODED_TEACHER_ID,
            recorded_at: new Date().toISOString(),
        });
    }

    return attendanceData;
}

// Function to handle Save Attendance button click
async function handleSaveAttendance() {
    const attendanceData = await gatherAttendanceData();

    if (attendanceData.length === 0) {
        alert('No attendance data to save.');
        return;
    }

    // Here should be the logic to send attendanceData to backend API
    // For now, just logging the data
    console.log('Submitting attendance data:', attendanceData);

    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ attendance: attendanceData }),
        });

        if (response.ok) {
            alert('Attendance saved successfully!');
        } else {
            const errorData = await response.json();
            alert('Failed to save attendance: ' + errorData.message);
        }
    } catch (error) {
        console.error('Error submitting attendance:', error);
        alert('Error submitting attendance. See console for details.');
    }
}

// Attach event listener to Save Attendance button
function setupSaveButton() {
    const saveBtn = document.querySelector('.save-btn');
    if (!saveBtn) {
        console.error('Save Attendance button not found');
        return;
    }

    saveBtn.addEventListener('click', (e) => {
        e.preventDefault();
        handleSaveAttendance();
    });
}

// Initialize module
function initializeAttendanceModule() {
    setupSaveButton();
}

document.addEventListener('DOMContentLoaded', () => {
    initializeAttendanceModule();
});
