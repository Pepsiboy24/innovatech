document.addEventListener('DOMContentLoaded', function() {
    const subjectForm = document.getElementById('subjectForm');
    const popup = document.getElementById('registrationPopup');

    if (subjectForm) {
        subjectForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // 1. Get Values
            const subjectNameInput = document.getElementById('subjectName');
            const subjectTypeInput = document.querySelector('input[name="subjectType"]:checked');

            const subjectName = subjectNameInput.value.trim();
            
            // Basic Validation
            if (!subjectName || !subjectTypeInput) {
                alert('Please fill in all required fields.');
                return;
            }

            const isCore = subjectTypeInput.value === 'core';

            try {
                // 2. CHECK FOR DUPLICATES (Case Insensitive)
                // We ask DB: "Do you have any subject that looks like this name?"
                const { data: existingSubjects, error: checkError } = await window.supabase
                    .from('Subjects')
                    .select('subject_name')
                    .ilike('subject_name', subjectName);

                if (checkError) {
                    console.error('Error checking duplicates:', checkError);
                    alert('Network error. Please try again.');
                    return;
                }

                if (existingSubjects && existingSubjects.length > 0) {
                    alert(`Subject "${subjectName}" already exists!`);
                    return; // Stop here, do not insert
                }

                // 3. INSERT NEW SUBJECT
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
                    alert(`Subject "${subjectName}" (${subjectTypeInput.value}) added successfully!`);

                    // Close popup and reset form
                    popup.style.display = 'none';
                    subjectForm.reset();
                }

            } catch (err) {
                console.error('Unexpected error:', err);
                alert('An unexpected error occurred. Please try again.');
            }
        });
    }
});