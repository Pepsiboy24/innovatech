document.addEventListener('DOMContentLoaded', function() {
    const subjectForm = document.getElementById('subjectForm');
    const popup = document.getElementById('registrationPopup');

    if (subjectForm) {
        subjectForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const subjectName = document.getElementById('subjectName').value.trim();
            const subjectType = document.querySelector('input[name="subjectType"]:checked');

            if (!subjectName || !subjectType) {
                alert('Please fill in all required fields.');
                return;
            }

            const isCore = subjectType.value === 'core';

            try {
                const { data, error } = await window.supabase
                    .from('Subjects')
                    .insert([
                        {
                            subject_name: subjectName,
                            is_core: isCore
                        }
                    ]);

                if (error) {
                    console.error('Error inserting subject:', error);
                    alert('Failed to add subject. Please try again.');
                } else {
                    console.log('Subject added successfully:', data);
                    alert(`Subject "${subjectName}" (${subjectType.value}) added successfully!`);

                    // Close the popup and reset the form
                    popup.style.display = 'none';
                    subjectForm.reset();

                    // Optionally, refresh the subjects table here if display_subects.js is implemented
                    // For now, the table has sample data
                }
            } catch (err) {
                console.error('Unexpected error:', err);
                alert('An unexpected error occurred. Please try again.');
            }
        });
    }
});
