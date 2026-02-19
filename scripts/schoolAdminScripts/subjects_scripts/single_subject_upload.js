document.addEventListener('DOMContentLoaded', function() {
    const subjectForm = document.getElementById('subjectForm');
    const popup = document.getElementById('registrationPopup');
    const classSelect = document.getElementById('classSelect');
    const teacherSelect = document.getElementById('teacherSelect');

    // Populate dropdowns when page loads
    populateDropdowns();

    async function populateDropdowns() {
        try {
            // Fetch classes
            const { data: classes, error: classError } = await window.supabase
                .from('Classes')
                .select('class_id, class_name, section')
                .order('class_name');

            if (classError) throw classError;

            classes.forEach(cls => {
                const option = document.createElement('option');
                option.value = cls.class_id;
                option.textContent = `${cls.class_name} ${cls.section}`;
                classSelect.appendChild(option);
            });

            // Fetch teachers
            const { data: teachers, error: teacherError } = await window.supabase
                .from('Teachers')
                .select('teacher_id, first_name, last_name')
                .order('first_name');

            if (teacherError) throw teacherError;

            teachers.forEach(teacher => {
                const option = document.createElement('option');
                option.value = teacher.teacher_id;
                option.textContent = `${teacher.first_name} ${teacher.last_name}`;
                teacherSelect.appendChild(option);
            });

        } catch (error) {
            console.error('Error populating dropdowns:', error);
        }
    }

    if (subjectForm) {
        subjectForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            // 1. Get Values
            const subjectNameInput = document.getElementById('subjectName');
            const subjectTypeInput = document.querySelector('input[name="subjectType"]:checked');
            const classIdInput = document.getElementById('classSelect');
            const teacherIdInput = document.getElementById('teacherSelect');

            const subjectName = subjectNameInput.value.trim();
            const classId = parseInt(classIdInput.value);
            const teacherId = teacherIdInput.value;
            
            // Basic Validation
            if (!subjectName || !subjectTypeInput || !classId || !teacherId) {
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

                // 3. INSERT NEW SUBJECT (using transaction-like approach)
                const { data: newSubject, error: subjectError } = await window.supabase
                    .from('Subjects')
                    .insert([
                        {
                            subject_name: subjectName,
                            is_core: isCore
                        }
                    ])
                    .select()
                    .single();

                if (subjectError) {
                    console.error('Error inserting subject:', subjectError);
                    alert('Failed to add subject. Please try again.');
                    return;
                }

                // 4. CREATE CLASS-SUBJECT LINK
                const { error: linkError } = await window.supabase
                    .from('Class_Subjects')
                    .insert([
                        {
                            class_id: classId,
                            subject_id: newSubject.subject_id,
                            teacher_id: teacherId
                        }
                    ]);

                if (linkError) {
                    console.error('Error creating class-subject link:', linkError);
                    // Note: Subject was created but link failed - might need cleanup
                    alert('Subject was created but failed to assign to class. Please contact administrator.');
                    return;
                }

                console.log('Subject and assignment created successfully:', newSubject);
                alert(`Subject "${subjectName}" (${subjectTypeInput.value}) assigned to class successfully!`);

                // Close popup and reset form
                popup.style.display = 'none';
                subjectForm.reset();

                // Refresh the subjects table
                if (window.refreshSubjectsTable) {
                    window.refreshSubjectsTable();
                } else {
                    // Force page reload if refresh function not available
                    window.location.reload();
                }

            } catch (err) {
                console.error('Unexpected error:', err);
                alert('An unexpected error occurred. Please try again.');
            }
        });
    }
});