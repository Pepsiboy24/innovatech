document.addEventListener('DOMContentLoaded', async function() {
    const tbody = document.querySelector('.students-table tbody');

    try {
        // Fetch subjects from Supabase
        const { data: subjects, error } = await window.supabase
            .from('Subjects')
            .select('subject_name, is_core');

        if (error) {
            console.error('Error fetching subjects:', error);
            alert('Failed to load subjects. Please try again.');
            return;
        }

        // Clear existing rows
        tbody.innerHTML = '';

        // Generate rows for each subject
        subjects.forEach((subject, index) => {
            const subjectName = subject.subject_name;
            const isCore = subject.is_core;
            const type = isCore ? 'Core' : 'Elective';
            const avatarText = subjectName.substring(0, 2).toUpperCase();
            const subjectId = `#SUB${String(index + 1).padStart(3, '0')}`;

            const row = document.createElement('tr');
            row.className = 'student-row';
            row.innerHTML = `
                <td>
                    <div class="student-info">
                        <div class="student-avatar">${avatarText}</div>
                        <div class="student-details">
                            <h4>${subjectName}</h4>
                            <p>ID: ${subjectId}</p>
                        </div>
                    </div>
                </td>
                <td>
                    <div class="class-badge">${type}</div>
                </td>
                <td><a href="#" class="action-btn">View</a></td>
                `;
                // <td>N/A</td>
                // <td>N/A</td>

            tbody.appendChild(row);
        });

    } catch (err) {
        console.error('Unexpected error:', err);
        alert('An unexpected error occurred while loading subjects.');
    }
});
