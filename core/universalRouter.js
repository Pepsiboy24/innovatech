import { supabase } from './config.js';

class UniversalRouter {
    constructor() {
        this.cache = {};
        this.init();
    }

    async init() {
        try {
            // After restructuring, these are the most reliable absolute paths.
            // Using an array allows us to handle different deployment environments.
            const possiblePaths = [
                '/portals/student/details_modal.html', // Student portal location
                '/portals/parent/details_modal.html',  // Parent portal location  
                '/portals/teacher/details_modal.html', // Teacher portal location
                '/portals/shared/details_modal.html'   // Best practice for a "Universal" component
            ];

            let modalLoaded = false;
            
            for (const path of possiblePaths) {
                try {
                    const response = await fetch(path);
                    if (response.ok) {
                        const html = await response.text();
                        
                        // Check if a container already exists to prevent duplicate modals
                        let container = document.getElementById('universal-modal-container');
                        if (!container) {
                            container = document.createElement('div');
                            container.id = 'universal-modal-container';
                            document.body.appendChild(container);
                        }
                        
                        container.innerHTML = html;
                        this.setupModalListeners();
                        modalLoaded = true;
                        console.log(`✅ Modal loaded successfully from: ${path}`);
                        break;
                    }
                } catch (e) { 
                    // Silently fail to try the next path in the loop
                    continue; 
                }
            }

            if (!modalLoaded) {
                console.error('❌ Critical: universalRouter could not load details_modal.html from any known path.');
            }
        } catch (error) { 
            console.error('❌ Modal Load Error:', error); 
        }

        // Global Event Delegation for ".view-btn"
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.view-btn');
            if (btn) {
                const type = btn.getAttribute('data-type');
                const id = btn.getAttribute('data-id');
                if (type && id) {
                    console.log(`🔍 Opening modal for ${type} (ID: ${id})`);
                    this.handleView(type, id);
                }
            }
        });
    }

    setupModalListeners() {
        const closeBtn = document.getElementById('universalModalClose');
        const overlay = document.getElementById('universalModalOverlay');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeModal());
        if (overlay) overlay.addEventListener('click', (e) => { if (e.target === overlay) this.closeModal(); });

        document.querySelectorAll('.universal-modal-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                document.querySelectorAll('.universal-modal-tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.universal-modal-content-area').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                const target = document.getElementById(e.target.getAttribute('data-target'));
                if (target) target.classList.add('active');
            });
        });
    }

    openModal() {
        const overlay = document.getElementById('universalModalOverlay');
        if (overlay) overlay.classList.add('active');
    }

    closeModal() {
        const overlay = document.getElementById('universalModalOverlay');
        if (overlay) overlay.classList.remove('active');
    }

    async handleView(type, id) {
        this.openModal();
        const loader = document.getElementById('umLoader');
        if (loader) loader.classList.add('active');

        try {
            const { data: auth } = await supabase.auth.getUser();
            const school_id = auth?.user?.user_metadata?.school_id;

            const tabs = document.querySelectorAll('.universal-modal-tab');
            tabs.forEach(tab => {
                const target = tab.getAttribute('data-target');
                if (type === 'parent' && target !== 'um-overview') {
                    tab.style.display = 'none';
                } else {
                    tab.style.display = '';
                }
            });

            // Ensure overview matches initial state securely
            document.querySelectorAll('.universal-modal-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.universal-modal-content-area').forEach(c => c.classList.remove('active'));
            const defaultTab = document.querySelector('.universal-modal-tab[data-target="um-overview"]');
            if (defaultTab) defaultTab.classList.add('active');
            const defaultContent = document.getElementById('um-overview');
            if (defaultContent) defaultContent.classList.add('active');

            let data;
            if (type === 'student') {
                data = await this.fetchStudentData(id, school_id);
                this.renderStudent(data);
            } else if (type === 'teacher') {
                data = await this.fetchTeacherData(id, school_id);
                this.renderTeacher(data);
            } else if (type === 'parent') {
                data = await this.fetchParentData(id, school_id);
                this.renderParent(data);
            }
        } catch (error) {
            console.error('Fetch Error:', error);
        } finally {
            if (loader) loader.classList.remove('active');
        }
    }

    async fetchStudentData(id, school_id) {
        let query = supabase
            .from('student_profiles') // <--- CHANGE THIS from 'Students'
            .select(`
            *,
            Classes (class_name),
            Parent_Student_Links (
                Parents (*)
            )
        `)
            .eq('student_id', id);

        if (school_id) query = query.eq('school_id', school_id);

        const { data: student, error } = await query.single();
        if (error) throw error;

        // Flatten parents logic remains the same
        if (student && student.Parent_Student_Links) {
            student.Parents = student.Parent_Student_Links.map(l => l.Parents).filter(p => p);
        }

        return student;
    }

    renderStudent(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');

        // Capture email from the fetched record
        const studentEmail = data.email || 'No student email found';

        if (nameEl) nameEl.textContent = data.full_name || 'Student';

        // Update Header
        if (roleEl) {
            roleEl.innerHTML = `Student <span style="margin-left: 10px; opacity: 0.85; font-size: 0.85em;"><i class="fa fa-envelope"></i> ${studentEmail}</span>`;
        }

        const guardian = (data.Parents && data.Parents.length > 0) ? data.Parents[0] : null;

        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Full Name</div>
                        <div class="um-value">${data.full_name}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Student Email</div>
                        <div class="um-value" style="word-break:break-all">${studentEmail}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Guardian Name</div>
                        <div class="um-value">${guardian ? guardian.full_name : 'Not Assigned'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Guardian Phone</div>
                        <div class="um-value">${guardian ? guardian.phone_number : 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Class</div>
                        <div class="um-value">${data.Classes?.class_name || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Student ID</div>
                        <div class="um-value" style="font-size:10px">${data.student_id}</div>
                    </div>
                </div>
            `;
        }
    }

    async fetchTeacherData(id, sid) {
        const { data } = await supabase.from('Teachers').select('*').eq('teacher_id', id).single();
        return data;
    }

    renderTeacher(data) {
        const nameEl = document.getElementById('umName');
        if (nameEl) nameEl.textContent = data.full_name;
    }

    async fetchParentData(id, school_id) {
        let query = supabase
            .from('Parents')
            .select(`
            *,
            Parent_Student_Links (
                Students (full_name, student_id)
            )
        `)
            .eq('parent_id', id);

        if (school_id) query = query.eq('school_id', school_id);

        const { data: parent, error } = await query.single();
        if (error) throw error;
        return parent;
    }

    renderParent(data) {
        const nameEl = document.getElementById('umName');
        const roleEl = document.getElementById('umRole');
        const overviewEl = document.getElementById('um-overview');

        const parentEmail = data.email || 'No email found';

        if (nameEl) nameEl.textContent = data.full_name || 'Parent';

        if (roleEl) {
            roleEl.innerHTML = `Parent/Guardian <span style="margin-left: 10px; opacity: 0.85; font-size: 0.85em;"><i class="fa fa-envelope"></i> ${parentEmail}</span>`;
        }

        const linkedStudents = (data.Parent_Student_Links || []).map(l => l.Students?.full_name).filter(Boolean).join(', ');

        if (overviewEl) {
            overviewEl.innerHTML = `
                <div class="um-grid">
                    <div class="um-data-card">
                        <div class="um-label">Full Name</div>
                        <div class="um-value">${data.full_name || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Email</div>
                        <div class="um-value" style="word-break:break-all">${parentEmail}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Phone Number</div>
                        <div class="um-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Occupation</div>
                        <div class="um-value">${data.occupation || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Address</div>
                        <div class="um-value">${data.address || 'N/A'}</div>
                    </div>
                    <div class="um-data-card">
                        <div class="um-label">Linked Students</div>
                        <div class="um-value" style="font-size:12px">${linkedStudents || 'None'}</div>
                    </div>
                </div>
            `;
        }
    }
}

const router = new UniversalRouter();