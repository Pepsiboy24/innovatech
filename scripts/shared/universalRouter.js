import { supabase } from '../config.js';

class UniversalRouter {
    constructor() {
        this.cache = {};
        this.init();
    }

    async init() {
        // Inject the modal HTML
        try {
            // Try multiple possible paths to ensure modal loads regardless of script location
            const possiblePaths = [
                '../html/shared/details_modal.html',
                '../../html/shared/details_modal.html', 
                '../../../html/shared/details_modal.html',
                '/html/shared/details_modal.html'
            ];
            
            let modalLoaded = false;
            
            for (const path of possiblePaths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        const html = await response.text();
                        const container = document.createElement('div');
                        container.innerHTML = html;
                        document.body.appendChild(container);
                        this.setupModalListeners();
                        modalLoaded = true;
                        console.log(`Modal loaded successfully from: ${path}`);
                        break;
                    }
                } catch (pathError) {
                    // Try next path
                    continue;
                }
            }
            
            if (!modalLoaded) {
                console.error('Failed to load details modal from all attempted paths');
            }
        } catch (error) {
            console.error('Failed to load details modal:', error);
        }

        // Intercept global clicks for .view-btn
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            if (btn) {
                const type = btn.getAttribute('data-type');
                const id = btn.getAttribute('data-id');
                if (type && id) {
                    // Check if modal exists, if not try to load it
                    if (!document.getElementById('universalModalOverlay')) {
                        console.log('Modal not found, attempting to load...');
                        this.init().then(() => {
                            // Retry after loading
                            setTimeout(() => this.handleView(type, id), 100);
                        });
                    } else {
                        this.handleView(type, id);
                    }
                }
            }
        });
    }

    setupModalListeners() {
        const closeBtn = document.getElementById('universalModalClose');
        const overlay = document.getElementById('universalModalOverlay');
        const tabs = document.querySelectorAll('.universal-modal-tab');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) this.closeModal();
            });
        }

        tabs.forEach(tab => {
            tab.addEventListener('click', (e) => {
                // Remove active from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Remove active from all contents
                document.querySelectorAll('.universal-modal-content-area').forEach(c => c.classList.remove('active'));
                
                // Add active to clicked
                e.target.classList.add('active');
                const targetId = e.target.getAttribute('data-target');
                document.getElementById(targetId).classList.add('active');
            });
        });
    }

    openModal() {
        const overlay = document.getElementById('universalModalOverlay');
        if (overlay) {
            overlay.classList.add('active');
            const loader = document.getElementById('umLoader');
            if (loader) loader.classList.add('active');
        } else {
            console.error('Modal overlay not found - ensure details_modal.html is loaded');
        }
    }

    closeModal() {
        const overlay = document.getElementById('universalModalOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    async handleView(type, id) {
        // Check if modal exists before proceeding
        if (!document.getElementById('universalModalOverlay')) {
            console.error('Modal not loaded - cannot show details');
            return;
        }
        
        this.openModal();
        
        try {
            const { data: authData } = await supabase.auth.getUser();
            const school_id = authData?.user?.user_metadata?.school_id;

            if (!school_id) {
                console.warn("No school_id found in user metadata. RLS might block queries.");
            }

            let data;
            
            switch (type) {
                case 'student':
                    data = await this.fetchStudentData(id, school_id);
                    this.renderStudent(data);
                    break;
                case 'teacher':
                    data = await this.fetchTeacherData(id, school_id);
                    this.renderTeacher(data);
                    break;
                case 'class':
                    data = await this.fetchClassData(id, school_id);
                    this.renderClass(data);
                    break;
                case 'subject':
                    data = await this.fetchSubjectData(id, school_id);
                    this.renderSubject(data);
                    break;
            }

        } catch (error) {
            console.error('UniversalRouter Fetch Error:', error);
            this.showError('Error loading data', error.message);
        } finally {
            const loader = document.getElementById('umLoader');
            if (loader) loader.classList.remove('active');
        }
    }

    // Manual method to check if modal is loaded
    isModalLoaded() {
        return !!document.getElementById('universalModalOverlay');
    }

    // Manual method to force reload modal
    async reloadModal() {
        // Remove existing modal if present
        const existingModal = document.getElementById('universalModalOverlay');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Re-initialize to load modal
        await this.init();
        return this.isModalLoaded();
    }

    showError(title, message) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');
        
        if (nameEl) nameEl.textContent = title;
        if (roleEl) roleEl.textContent = 'Error';
        if (overviewEl) {
            overviewEl.innerHTML = `<p style="color:red">Failed to fetch details: ${message}</p>`;
        }
    }

    async fetchStudentData(id, school_id) {
        // Students JOIN Parents, last 5 Grades
        let query = supabase
            .from('Students')
            .select(`
                *,
                Parent_Student_Links (
                    Parents (*)
                ),
                Grades (
                    *
                )
            `)
            .eq('student_id', id);
            
        if (school_id) query = query.eq('school_id', school_id);
        
        // Add limit and ordering to Grades via foreign table notation, although JS client handles it best when separated sometimes.
        // Doing simple query first, if Grades fails ordering we can adjust
        const { data: student, error } = await query.single();
            
        if (error) throw error;
        
        // Sorting grades locally since Supabase deeply nested limits/orders can be tricky
        if (student && student.Grades) {
            student.Grades.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            student.Grades = student.Grades.slice(0, 5);
        }
        
        return student;
    }

    async fetchTeacherData(id, school_id) {
        // Teachers JOIN Subjects and operational records
        let query = supabase
            .from('Teachers')
            .select(`
                *,
                Subjects (*),
                school_employment (*),
                qualifications (*),
                work_experience (*),
                emergency_contact (*)
            `)
            .eq('teacher_id', id);
            
        if (school_id) query = query.eq('school_id', school_id);    
        const { data: teacher, error } = await query.single();
            
        if (error) throw error;
        return teacher;
    }

    async fetchClassData(id, school_id) {
        // Classes JOIN Students
        let query = supabase
            .from('Classes')
            .select(`
                *,
                Students (*)
            `)
            .eq('class_id', id);
        
        if (school_id) query = query.eq('school_id', school_id);
        const { data: classData, error } = await query.single();
            
        if (error) throw error;
        return classData;
    }

    async fetchSubjectData(id, school_id) {
        // Subjects JOIN Lesson_Notes and assigned Teachers
        let query = supabase
            .from('Subjects')
            .select(`
                *,
                Lesson_Notes (*),
                Teachers (*)
            `)
            .eq('subject_id', id);
            
        if (school_id) query = query.eq('school_id', school_id);
        const { data: subject, error } = await query.single();
            
        if (error) throw error;
        return subject;
    }

    renderStudent(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');
        const contactsEl = document.getElementById('um-contacts');
        const academicEl = document.getElementById('um-academic');
        const adminEl = document.getElementById('um-administrative');
        
        if (nameEl) nameEl.textContent = data.full_name || 'Student';
        if (roleEl) roleEl.textContent = 'Student';
        
        let parentsHTML = '';
        if (data.Parent_Student_Links && data.Parent_Student_Links.length > 0) {
            parentsHTML = data.Parent_Student_Links.map(link => {
                const p = link.Parents;
                return p ? `<div class="um-data-card">
                    <div class="um-label">${p.relationship || 'Parent'}</div>
                    <div class="um-value">${p.full_name || 'N/A'}</div>
                    <div class="um-value" style="font-size:0.9em; margin-top:5px;"><i class="fa fa-phone"></i> ${p.phone_number || 'N/A'}</div>
                </div>` : '';
            }).join('');
        }

        let gradesHTML = '';
        if (data.Grades && data.Grades.length > 0) {
            gradesHTML = `<table class="um-table">
                <tr><th>Subject</th><th>Score</th><th>Term</th></tr>
                ${data.Grades.map(g => `<tr><td>${g.subject_name || 'N/A'}</td><td>${g.score}</td><td>${g.term || 'N/A'}</td></tr>`).join('')}
            </table>`;
        }

        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card"><div class="um-label">Admission No</div><div class="um-value">${data.admission_number || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Gender</div><div class="um-value">${data.gender || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Date of Birth</div><div class="um-value">${data.date_of_birth || 'N/A'}</div></div>
                </div>
            `;
        }
        if (contactsEl) {
            contactsEl.innerHTML = `
                <h3>Parents / Guardians</h3>
                <div class="um-grid">${parentsHTML || '<p>No linked parents.</p>'}</div>
            `;
        }
        if (academicEl) {
            academicEl.innerHTML = `
                <h3>Recent Grades</h3>
                ${gradesHTML || '<p>No recent grades found.</p>'}
            `;
        }
        if (adminEl) {
            adminEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card"><div class="um-label">Created At</div><div class="um-value">${data.created_at ? new Date(data.created_at).toLocaleDateString() : 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Status</div><div class="um-value">${data.status || 'Active'}</div></div>
                </div>
            `;
        }
    }

    renderTeacher(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');
        const academicEl = document.getElementById('um-academic');
        const contactsEl = document.getElementById('um-contacts');
        const adminEl = document.getElementById('um-administrative');
        
        const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ') || 'Teacher';
        if (nameEl) nameEl.textContent = fullName;
        
        // Display email immediately alongside the Role in the Header so it is never "missing"
        const teacherEmail = data.email || 'No email provided';
        if (roleEl) roleEl.innerHTML = `Teacher <span style="margin-left: 10px; opacity: 0.85; font-size: 0.9em;"><i class="fa fa-envelope"></i> ${teacherEmail}</span>`;
        
        // Safely extract relationships arrays/objects
        const emp = Array.isArray(data.school_employment) ? data.school_employment[0] : (data.school_employment || {});
        const qual = Array.isArray(data.qualifications) ? data.qualifications[0] : (data.qualifications || {});
        const exp = Array.isArray(data.work_experience) ? data.work_experience[0] : (data.work_experience || {});
        const ec = Array.isArray(data.emergency_contact) ? data.emergency_contact[0] : (data.emergency_contact || {});

        let subjectsHTML = '';
        if (data.Subjects && data.Subjects.length > 0) {
            subjectsHTML = data.Subjects.map(s => `<span class="universal-modal-role" style="background:#e0e7ff; color:#4f46e5; margin:3px;">${s.subject_name}</span>`).join('');
        }

        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card"><div class="um-label">Email Address</div><div class="um-value" style="word-break: break-all;">${teacherEmail}</div></div>
                    <div class="um-data-card"><div class="um-label">TRCN Number</div><div class="um-value">${data.trcn_reg_number || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Date of Birth</div><div class="um-value">${data.date_of_birth || 'Not Provided'}</div></div>
                    <div class="um-data-card"><div class="um-label">Gender</div><div class="um-value">${data.gender || 'Not Provided'}</div></div>
                    <div class="um-data-card"><div class="um-label">Marital Status</div><div class="um-value">${data.marital_status || 'Not Provided'}</div></div>
                </div>
            `;
        }
        if (academicEl) {
            academicEl.innerHTML = `
                <h3>Qualifications</h3>
                <div class="um-grid" style="margin-bottom: 20px;">
                    <div class="um-data-card"><div class="um-label">Highest Degree</div><div class="um-value">${qual?.certificate_name || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Field of Study</div><div class="um-value">${qual?.feild_of_study || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Institution</div><div class="um-value">${qual?.school_name || 'N/A'} (${qual?.graduation_year || ''})</div></div>
                </div>

                <h3>Employment Details</h3>
                <div class="um-grid" style="margin-bottom: 20px;">
                    <div class="um-data-card"><div class="um-label">Job Title</div><div class="um-value">${emp?.job_title || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Contract Type</div><div class="um-value">${emp?.contract_type ? emp.contract_type.replace(/_/g, ' ') : 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Start Date</div><div class="um-value">${emp?.start_date || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Salary</div><div class="um-value">${emp?.salary ? '$' + emp.salary.toLocaleString() : 'N/A'}</div></div>
                </div>
                
                <h3>Experience</h3>
                <div class="um-grid" style="margin-bottom: 20px;">
                    <div class="um-data-card"><div class="um-label">Total Experience</div><div class="um-value">${exp?.total_experience || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Previous School</div><div class="um-value">${exp?.school_name || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Previous Position</div><div class="um-value">${exp?.position_held || 'N/A'} (${exp?.duration || ''})</div></div>
                </div>

                <h3>Assigned Workload (Subjects)</h3>
                <div style="margin-top:10px;">${subjectsHTML || '<p>No subjects assigned.</p>'}</div>
            `;
        }
        if (contactsEl) {
            contactsEl.innerHTML = `
                <div class="um-grid" style="margin-bottom: 20px;">
                    <div class="um-data-card"><div class="um-label">Phone</div><div class="um-value">${data.phone_number || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Email</div><div class="um-value">${data.email || 'N/A'}</div></div>
                </div>
                
                <h3>Address</h3>
                <p style="margin-bottom: 20px; font-size: 0.95rem; color: #4b5563;">${data.address || 'Not Provided'}</p>

                <h3>Emergency Contact</h3>
                <div class="um-grid">
                    <div class="um-data-card"><div class="um-label">Name</div><div class="um-value">${ec?.name || 'N/A'} (${ec?.relationship || 'N/A'})</div></div>
                    <div class="um-data-card"><div class="um-label">Phone</div><div class="um-value">${ec?.phone_number || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Address</div><div class="um-value">${ec?.address || 'N/A'}</div></div>
                </div>
            `;
        }
        if (adminEl) {
            adminEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card"><div class="um-label">Date Hired</div><div class="um-value">${data.date_hired || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Profile Created</div><div class="um-value">${data.created_at ? new Date(data.created_at).toLocaleString() : 'N/A'}</div></div>
                </div>
            `;
        }
    }

    renderClass(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');
        const academicEl = document.getElementById('um-academic');
        const contactsEl = document.getElementById('um-contacts');
        const adminEl = document.getElementById('um-administrative');
        
        if (nameEl) nameEl.textContent = `${data.class_name || 'Class Details'}`;
        if (roleEl) roleEl.textContent = 'Class';

        let studentsHTML = '';
        if (data.Students && data.Students.length > 0) {
            studentsHTML = `<table class="um-table">
                <tr><th>Name</th><th>Admission No</th></tr>
                ${data.Students.map(s => `<tr><td>${s.full_name || 'Student'}</td><td>${s.student_id || ''}</td></tr>`).join('')}
            </table>`;
        }

        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card"><div class="um-label">Section</div><div class="um-value">${data.section || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Students Count</div><div class="um-value">${data.students_count || data.Students?.length || 0}</div></div>
                </div>
            `;
        }
        if (academicEl) {
            academicEl.innerHTML = `
                <h3>Roster (${data.Students ? data.Students.length : 0} Students)</h3>
                ${studentsHTML || '<p>No students enrolled.</p>'}
            `;
        }
        if (contactsEl) contactsEl.innerHTML = `<p>Not applicable for classes.</p>`;
        if (adminEl) adminEl.innerHTML = `<p>Not applicable for classes.</p>`;
    }

    renderSubject(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');
        const academicEl = document.getElementById('um-academic');
        const contactsEl = document.getElementById('um-contacts');
        const adminEl = document.getElementById('um-administrative');
        
        if (nameEl) nameEl.textContent = `${data.subject_name || 'Subject'}`;
        if (roleEl) roleEl.textContent = 'Subject';

        let notesHTML = '';
        if (data.Lesson_Notes && data.Lesson_Notes.length > 0) {
            notesHTML = data.Lesson_Notes.map(n => `<li>${n.topic} (${new Date(n.created_at).toLocaleDateString()})</li>`).join('');
        }

        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card"><div class="um-label">Code</div><div class="um-value">${data.subject_code || 'N/A'}</div></div>
                    <div class="um-data-card"><div class="um-label">Core Subject</div><div class="um-value">${data.is_core ? 'Yes' : 'No'}</div></div>
                </div>
            `;
        }
        if (academicEl) {
            academicEl.innerHTML = `
                <h3>Lesson Notes</h3>
                <ul>${notesHTML || '<p>No lesson notes attached.</p>'}</ul>
            `;
        }
        if (contactsEl) contactsEl.innerHTML = `<p>Not applicable for subjects.</p>`;
        if (adminEl) adminEl.innerHTML = `<p>Not applicable for subjects.</p>`;
    }
}

// Instantiate and expose globally if needed
const router = new UniversalRouter();
window.UniversalRouter = router;

// Expose debugging methods
window.checkModalStatus = () => router.isModalLoaded();
window.reloadModal = () => router.reloadModal();

// Log status on load
console.log('UniversalRouter initialized. Modal status:', router.isModalLoaded());
