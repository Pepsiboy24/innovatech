/**
 * Global Details Modal System
 * Provides unified view functionality for all management tables
 */

class DetailsModal {
    constructor() {
        this.modal = null;
        this.currentType = null;
        this.currentId = null;
        this.init();
    }

    init() {
        this.createModalStructure();
        this.bindEvents();
    }

    createModalStructure() {
        const modalHTML = `
            <div id="detailsModal" class="details-modal" style="display: none;">
                <div class="modal-overlay" onclick="detailsModal.close()"></div>
                <div class="modal-content">
                    <div class="modal-header">
                        <h2 class="modal-title" id="modalTitle">Details</h2>
                        <button class="modal-close" onclick="detailsModal.close()">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    
                    <div class="modal-tabs">
                        <button class="tab-btn active" data-tab="overview" onclick="detailsModal.switchTab('overview')">
                            <i class="fas fa-info-circle"></i>
                            Overview
                        </button>
                        <button class="tab-btn" data-tab="academic" onclick="detailsModal.switchTab('academic')">
                            <i class="fas fa-graduation-cap"></i>
                            <span id="academicTabLabel">Academic</span>
                        </button>
                        <button class="tab-btn" data-tab="related" onclick="detailsModal.switchTab('related')">
                            <i class="fas fa-link"></i>
                            Related
                        </button>
                    </div>
                    
                    <div class="modal-body">
                        <div class="tab-content active" id="overviewTab">
                            <div class="overview-grid" id="overviewContent">
                                <!-- Dynamic overview content -->
                            </div>
                        </div>
                        
                        <div class="tab-content" id="academicTab">
                            <div class="academic-content" id="academicContent">
                                <!-- Dynamic academic content -->
                            </div>
                        </div>
                        
                        <div class="tab-content" id="relatedTab">
                            <div class="related-content" id="relatedContent">
                                <!-- Dynamic related content -->
                            </div>
                        </div>
                    </div>
                    
                    <div class="modal-footer">
                        <button class="btn btn-secondary" onclick="detailsModal.close()">Close</button>
                        <div class="modal-actions" id="modalActions">
                            <!-- Dynamic action buttons -->
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Inject modal into body
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = document.getElementById('detailsModal');
        
        // Inject modal styles
        this.injectStyles();
    }

    injectStyles() {
        const styles = `
            <style id="detailsModalStyles">
                .details-modal {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    z-index: 9999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .modal-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: rgba(0, 0, 0, 0.5);
                    backdrop-filter: blur(4px);
                }

                .modal-content {
                    position: relative;
                    background: white;
                    border-radius: 16px;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                    max-width: 800px;
                    width: 90%;
                    max-height: 90vh;
                    overflow: hidden;
                    animation: modalSlideIn 0.3s ease-out;
                }

                @keyframes modalSlideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px) scale(0.95);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0) scale(1);
                    }
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px 32px;
                    border-bottom: 1px solid #e5e7eb;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                }

                .modal-title {
                    margin: 0;
                    font-size: 24px;
                    font-weight: 600;
                }

                .modal-close {
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 8px;
                    width: 40px;
                    height: 40px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .modal-close:hover {
                    background: rgba(255, 255, 255, 0.3);
                    transform: scale(1.1);
                }

                .modal-tabs {
                    display: flex;
                    background: #f8fafc;
                    border-bottom: 1px solid #e5e7eb;
                }

                .tab-btn {
                    flex: 1;
                    padding: 16px 24px;
                    border: none;
                    background: transparent;
                    color: #6b7280;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    font-weight: 500;
                }

                .tab-btn:hover {
                    background: #e5e7eb;
                    color: #374151;
                }

                .tab-btn.active {
                    background: white;
                    color: #667eea;
                    border-bottom: 2px solid #667eea;
                }

                .modal-body {
                    padding: 32px;
                    max-height: 60vh;
                    overflow-y: auto;
                }

                .tab-content {
                    display: none;
                }

                .tab-content.active {
                    display: block;
                    animation: tabFadeIn 0.3s ease-out;
                }

                @keyframes tabFadeIn {
                    from {
                        opacity: 0;
                        transform: translateX(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }

                .overview-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    gap: 24px;
                }

                .detail-card {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid #e5e7eb;
                }

                .detail-card h4 {
                    margin: 0 0 12px 0;
                    color: #374151;
                    font-size: 14px;
                    font-weight: 600;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                .detail-value {
                    color: #1f2937;
                    font-size: 16px;
                    font-weight: 500;
                    word-break: break-word;
                }

                .academic-content {
                    display: grid;
                    gap: 24px;
                }

                .academic-section {
                    background: #f8fafc;
                    border-radius: 12px;
                    padding: 20px;
                    border: 1px solid #e5e7eb;
                }

                .academic-section h4 {
                    margin: 0 0 16px 0;
                    color: #374151;
                    font-size: 16px;
                    font-weight: 600;
                }

                .related-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 16px;
                }

                .related-item {
                    background: #f8fafc;
                    border-radius: 8px;
                    padding: 16px;
                    border: 1px solid #e5e7eb;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .related-item:hover {
                    background: #e5e7eb;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
                }

                .modal-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 24px 32px;
                    border-top: 1px solid #e5e7eb;
                    background: #f8fafc;
                }

                .btn {
                    padding: 10px 20px;
                    border-radius: 8px;
                    border: none;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .btn-secondary {
                    background: #6b7280;
                    color: white;
                }

                .btn-secondary:hover {
                    background: #4b5563;
                }

                .btn-primary {
                    background: #667eea;
                    color: white;
                }

                .btn-primary:hover {
                    background: #5a67d8;
                }

                .modal-actions {
                    display: flex;
                    gap: 12px;
                }

                .loading-spinner {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                }

                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #e5e7eb;
                    border-top: 4px solid #667eea;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }

                .empty-state {
                    text-align: center;
                    padding: 40px;
                    color: #6b7280;
                }

                .empty-state i {
                    font-size: 48px;
                    margin-bottom: 16px;
                    opacity: 0.5;
                }
            </style>
        `;
        document.head.insertAdjacentHTML('beforeend', styles);
    }

    bindEvents() {
        // Global click delegation for view buttons
        document.addEventListener('click', (e) => {
            const viewBtn = e.target.closest('.view-btn');
            if (viewBtn) {
                e.preventDefault();
                const type = viewBtn.dataset.type;
                const id = viewBtn.dataset.id;
                if (type && id) {
                    this.showDetails(type, id);
                }
            }
        });

        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.style.display === 'flex') {
                this.close();
            }
        });
    }

    async showDetails(type, id) {
        this.currentType = type;
        this.currentId = id;
        
        // Show modal with loading state
        this.showLoading();
        this.modal.style.display = 'flex';

        try {
            await this.fetchAndDisplayData(type, id);
        } catch (error) {
            console.error('Error fetching details:', error);
            this.showError('Failed to load details. Please try again.');
        }
    }

    async fetchAndDisplayData(type, id) {
        // Get current user's school_id for RLS compliance
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user?.user_metadata?.school_id) {
            throw new Error('User not authenticated or missing school_id');
        }
        const schoolId = user.user_metadata.school_id;

        let data;
        switch (type) {
            case 'student':
                data = await this.fetchStudentDetails(id, schoolId);
                break;
            case 'teacher':
                data = await this.fetchTeacherDetails(id, schoolId);
                break;
            case 'class':
                data = await this.fetchClassDetails(id, schoolId);
                break;
            case 'subject':
                data = await this.fetchSubjectDetails(id, schoolId);
                break;
            case 'parent':
                data = await this.fetchParentDetails(id, schoolId);
                break;
            default:
                throw new Error(`Unsupported type: ${type}`);
        }

        this.displayData(data, type);
    }

    async fetchStudentDetails(studentId, schoolId) {
        const { data, error } = await supabase
            .from('Students')
            .select(`
                *,
                Parents(*),
                Classes(class_name, grade_level),
                Grades(*),
                Attendance(*)
            `)
            .eq('student_id', studentId)
            .eq('school_id', schoolId)
            .single();

        if (error) throw error;
        return data;
    }

    async fetchTeacherDetails(teacherId, schoolId) {
        const { data, error } = await supabase
            .from('Teachers')
            .select(`
                *,
                Classes:class_id(*),
                Subjects:subject_id(*),
                Attendance(*)
            `)
            .eq('teacher_id', teacherId)
            .eq('school_id', schoolId)
            .single();

        if (error) throw error;
        return data;
    }

    async fetchClassDetails(classId, schoolId) {
        const { data, error } = await supabase
            .from('Classes')
            .select(`
                *,
                Students(*),
                Teachers(*),
                Subjects(*)
            `)
            .eq('class_id', classId)
            .eq('school_id', schoolId)
            .single();

        if (error) throw error;
        return data;
    }

    async fetchSubjectDetails(subjectId, schoolId) {
        const { data, error } = await supabase
            .from('Subjects')
            .select(`
                *,
                Classes(*),
                Teachers(*)
            `)
            .eq('subject_id', subjectId)
            .eq('school_id', schoolId)
            .single();

        if (error) throw error;
        return data;
    }

    async fetchParentDetails(parentId, schoolId) {
        const { data, error } = await supabase
            .from('Parents')
            .select(`
                *,
                Students(*)
            `)
            .eq('parent_id', parentId)
            .eq('school_id', schoolId)
            .single();

        if (error) throw error;
        return data;
    }

    displayData(data, type) {
        // Update modal title
        const title = this.getDisplayTitle(data, type);
        document.getElementById('modalTitle').textContent = title;

        // Update tab labels based on type
        this.updateTabLabels(type);

        // Populate overview tab
        this.populateOverview(data, type);

        // Populate academic tab
        this.populateAcademic(data, type);

        // Populate related tab
        this.populateRelated(data, type);

        // Update modal actions
        this.updateActions(data, type);
    }

    getDisplayTitle(data, type) {
        switch (type) {
            case 'student':
                return data.full_name || 'Student Details';
            case 'teacher':
                return data.full_name || 'Teacher Details';
            case 'class':
                return data.class_name || 'Class Details';
            case 'subject':
                return data.subject_name || 'Subject Details';
            case 'parent':
                return data.full_name || 'Parent Details';
            default:
                return 'Details';
        }
    }

    updateTabLabels(type) {
        const academicLabel = document.getElementById('academicTabLabel');
        switch (type) {
            case 'student':
                academicLabel.textContent = 'Academic Records';
                break;
            case 'teacher':
                academicLabel.textContent = 'Teaching Records';
                break;
            case 'class':
                academicLabel.textContent = 'Class Records';
                break;
            case 'subject':
                academicLabel.textContent = 'Subject Info';
                break;
            case 'parent':
                academicLabel.textContent = 'Children';
                break;
        }
    }

    populateOverview(data, type) {
        const overviewContent = document.getElementById('overviewContent');
        let html = '<div class="overview-grid">';

        switch (type) {
            case 'student':
                html += `
                    <div class="detail-card">
                        <h4>Student ID</h4>
                        <div class="detail-value">${data.student_id || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Full Name</h4>
                        <div class="detail-value">${data.full_name || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Email</h4>
                        <div class="detail-value">${data.email || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Phone</h4>
                        <div class="detail-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Class</h4>
                        <div class="detail-value">${data.Classes?.class_name || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Grade Level</h4>
                        <div class="detail-value">${data.Classes?.grade_level || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Date of Birth</h4>
                        <div class="detail-value">${data.date_of_birth ? new Date(data.date_of_birth).toLocaleDateString() : 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Gender</h4>
                        <div class="detail-value">${data.gender || 'N/A'}</div>
                    </div>
                `;
                break;
            case 'teacher':
                html += `
                    <div class="detail-card">
                        <h4>Teacher ID</h4>
                        <div class="detail-value">${data.teacher_id || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Full Name</h4>
                        <div class="detail-value">${data.full_name || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Email</h4>
                        <div class="detail-value">${data.email || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Phone</h4>
                        <div class="detail-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Department</h4>
                        <div class="detail-value">${data.department || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Specialization</h4>
                        <div class="detail-value">${data.specialization || 'N/A'}</div>
                    </div>
                `;
                break;
            case 'class':
                html += `
                    <div class="detail-card">
                        <h4>Class ID</h4>
                        <div class="detail-value">${data.class_id || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Class Name</h4>
                        <div class="detail-value">${data.class_name || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Grade Level</h4>
                        <div class="detail-value">${data.grade_level || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Max Students</h4>
                        <div class="detail-value">${data.max_students || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Current Students</h4>
                        <div class="detail-value">${data.Students?.length || 0}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Class Teacher</h4>
                        <div class="detail-value">${data.Teachers?.full_name || 'N/A'}</div>
                    </div>
                `;
                break;
            case 'subject':
                html += `
                    <div class="detail-card">
                        <h4>Subject ID</h4>
                        <div class="detail-value">${data.subject_id || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Subject Name</h4>
                        <div class="detail-value">${data.subject_name || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Subject Code</h4>
                        <div class="detail-value">${data.subject_code || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Credits</h4>
                        <div class="detail-value">${data.credits || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Department</h4>
                        <div class="detail-value">${data.department || 'N/A'}</div>
                    </div>
                `;
                break;
            case 'parent':
                html += `
                    <div class="detail-card">
                        <h4>Parent ID</h4>
                        <div class="detail-value">${data.parent_id || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Full Name</h4>
                        <div class="detail-value">${data.full_name || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Email</h4>
                        <div class="detail-value">${data.email || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Phone</h4>
                        <div class="detail-value">${data.phone_number || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Relationship</h4>
                        <div class="detail-value">${data.relationship || 'N/A'}</div>
                    </div>
                    <div class="detail-card">
                        <h4>Children Count</h4>
                        <div class="detail-value">${data.Students?.length || 0}</div>
                    </div>
                `;
                break;
        }

        html += '</div>';
        overviewContent.innerHTML = html;
    }

    populateAcademic(data, type) {
        const academicContent = document.getElementById('academicContent');
        let html = '<div class="academic-content">';

        switch (type) {
            case 'student':
                html += this.generateStudentAcademicSection(data);
                break;
            case 'teacher':
                html += this.generateTeacherAcademicSection(data);
                break;
            case 'class':
                html += this.generateClassAcademicSection(data);
                break;
            case 'subject':
                html += this.generateSubjectAcademicSection(data);
                break;
            case 'parent':
                html += this.generateParentAcademicSection(data);
                break;
        }

        html += '</div>';
        academicContent.innerHTML = html;
    }

    generateStudentAcademicSection(data) {
        let html = `
            <div class="academic-section">
                <h4>Recent Grades</h4>
                ${data.Grades && data.Grades.length > 0 ? 
                    `<div class="grades-list">
                        ${data.Grades.map(grade => `
                            <div class="grade-item">
                                <span>${grade.subject || 'N/A'}</span>
                                <span class="grade-score">${grade.score || 'N/A'}</span>
                            </div>
                        `).join('')}
                    </div>` : 
                    '<div class="empty-state"><i class="fas fa-chart-line"></i><p>No grades available</p></div>'
                }
            </div>
            <div class="academic-section">
                <h4>Attendance Summary</h4>
                ${data.Attendance && data.Attendance.length > 0 ? 
                    `<div class="attendance-summary">
                        <div class="attendance-stat">
                            <span>Present</span>
                            <span>${data.Attendance.filter(a => a.status === 'present').length}</span>
                        </div>
                        <div class="attendance-stat">
                            <span>Absent</span>
                            <span>${data.Attendance.filter(a => a.status === 'absent').length}</span>
                        </div>
                        <div class="attendance-stat">
                            <span>Late</span>
                            <span>${data.Attendance.filter(a => a.status === 'late').length}</span>
                        </div>
                    </div>` : 
                    '<div class="empty-state"><i class="fas fa-calendar-check"></i><p>No attendance records</p></div>'
                }
            </div>
        `;
        return html;
    }

    generateTeacherAcademicSection(data) {
        let html = `
            <div class="academic-section">
                <h4>Assigned Classes</h4>
                ${data.Classes && data.Classes.length > 0 ? 
                    `<div class="classes-list">
                        ${data.Classes.map(cls => `
                            <div class="class-item">
                                <span>${cls.class_name}</span>
                                <span>Grade ${cls.grade_level}</span>
                            </div>
                        `).join('')}
                    </div>` : 
                    '<div class="empty-state"><i class="fas fa-chalkboard"></i><p>No classes assigned</p></div>'
                }
            </div>
            <div class="academic-section">
                <h4>Subjects Taught</h4>
                ${data.Subjects && data.Subjects.length > 0 ? 
                    `<div class="subjects-list">
                        ${data.Subjects.map(subject => `
                            <div class="subject-item">
                                <span>${subject.subject_name}</span>
                                <span>${subject.subject_code}</span>
                            </div>
                        `).join('')}
                    </div>` : 
                    '<div class="empty-state"><i class="fas fa-book"></i><p>No subjects assigned</p></div>'
                }
            </div>
        `;
        return html;
    }

    generateClassAcademicSection(data) {
        let html = `
            <div class="academic-section">
                <h4>Student Roster</h4>
                ${data.Students && data.Students.length > 0 ? 
                    `<div class="students-list">
                        ${data.Students.slice(0, 10).map(student => `
                            <div class="student-item">
                                <span>${student.full_name}</span>
                                <span>${student.student_id}</span>
                            </div>
                        `).join('')}
                        ${data.Students.length > 10 ? `<div class="more-students">... and ${data.Students.length - 10} more</div>` : ''}
                    </div>` : 
                    '<div class="empty-state"><i class="fas fa-users"></i><p>No students enrolled</p></div>'
                }
            </div>
            <div class="academic-section">
                <h4>Class Schedule</h4>
                <div class="empty-state"><i class="fas fa-clock"></i><p>Schedule information not available</p></div>
            </div>
        `;
        return html;
    }

    generateSubjectAcademicSection(data) {
        let html = `
            <div class="academic-section">
                <h4>Subject Description</h4>
                <p>${data.description || 'No description available'}</p>
            </div>
            <div class="academic-section">
                <h4>Assigned Classes</h4>
                ${data.Classes && data.Classes.length > 0 ? 
                    `<div class="classes-list">
                        ${data.Classes.map(cls => `
                            <div class="class-item">
                                <span>${cls.class_name}</span>
                                <span>Grade ${cls.grade_level}</span>
                            </div>
                        `).join('')}
                    </div>` : 
                    '<div class="empty-state"><i class="fas fa-chalkboard"></i><p>No classes assigned</p></div>'
                }
            </div>
        `;
        return html;
    }

    generateParentAcademicSection(data) {
        let html = `
            <div class="academic-section">
                <h4>Children</h4>
                ${data.Students && data.Students.length > 0 ? 
                    `<div class="children-list">
                        ${data.Students.map(student => `
                            <div class="child-item">
                                <div class="child-info">
                                    <span class="child-name">${student.full_name}</span>
                                    <span class="child-class">${student.Classes?.class_name || 'No class'}</span>
                                </div>
                                <span class="child-id">${student.student_id}</span>
                            </div>
                        `).join('')}
                    </div>` : 
                    '<div class="empty-state"><i class="fas fa-child"></i><p>No children linked</p></div>'
                }
            </div>
        `;
        return html;
    }

    populateRelated(data, type) {
        const relatedContent = document.getElementById('relatedContent');
        let html = '<div class="related-grid">';

        switch (type) {
            case 'student':
                if (data.Parents) {
                    data.Parents.forEach(parent => {
                        html += `
                            <div class="related-item" onclick="detailsModal.showDetails('parent', '${parent.parent_id}')">
                                <i class="fas fa-user"></i>
                                <div>${parent.full_name}</div>
                                <small>Parent</small>
                            </div>
                        `;
                    });
                }
                if (data.Classes) {
                    html += `
                        <div class="related-item" onclick="detailsModal.showDetails('class', '${data.Classes.class_id}')">
                            <i class="fas fa-chalkboard"></i>
                            <div>${data.Classes.class_name}</div>
                            <small>Class</small>
                        </div>
                    `;
                }
                break;
            case 'teacher':
                if (data.Classes) {
                    data.Classes.forEach(cls => {
                        html += `
                            <div class="related-item" onclick="detailsModal.showDetails('class', '${cls.class_id}')">
                                <i class="fas fa-chalkboard"></i>
                                <div>${cls.class_name}</div>
                                <small>Class</small>
                            </div>
                        `;
                    });
                }
                if (data.Subjects) {
                    data.Subjects.forEach(subject => {
                        html += `
                            <div class="related-item" onclick="detailsModal.showDetails('subject', '${subject.subject_id}')">
                                <i class="fas fa-book"></i>
                                <div>${subject.subject_name}</div>
                                <small>Subject</small>
                            </div>
                        `;
                    });
                }
                break;
            case 'class':
                if (data.Teachers) {
                    html += `
                        <div class="related-item" onclick="detailsModal.showDetails('teacher', '${data.Teachers.teacher_id}')">
                            <i class="fas fa-chalkboard-teacher"></i>
                            <div>${data.Teachers.full_name}</div>
                            <small>Class Teacher</small>
                        </div>
                    `;
                }
                if (data.Students) {
                    data.Students.slice(0, 6).forEach(student => {
                        html += `
                            <div class="related-item" onclick="detailsModal.showDetails('student', '${student.student_id}')">
                                <i class="fas fa-user-graduate"></i>
                                <div>${student.full_name}</div>
                                <small>Student</small>
                            </div>
                        `;
                    });
                }
                break;
        }

        if (html === '<div class="related-grid">') {
            html += '<div class="empty-state"><i class="fas fa-link"></i><p>No related items</p></div>';
        } else {
            html += '</div>';
        }

        relatedContent.innerHTML = html;
    }

    updateActions(data, type) {
        const actionsContainer = document.getElementById('modalActions');
        let html = '';

        switch (type) {
            case 'student':
                html = `
                    <button class="btn btn-primary" onclick="detailsModal.editStudent('${data.student_id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-primary" onclick="detailsModal.viewGrades('${data.student_id}')">
                        <i class="fas fa-chart-line"></i> Grades
                    </button>
                `;
                break;
            case 'teacher':
                html = `
                    <button class="btn btn-primary" onclick="detailsModal.editTeacher('${data.teacher_id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-primary" onclick="detailsModal.viewSchedule('${data.teacher_id}')">
                        <i class="fas fa-calendar"></i> Schedule
                    </button>
                `;
                break;
            case 'class':
                html = `
                    <button class="btn btn-primary" onclick="detailsModal.editClass('${data.class_id}')">
                        <i class="fas fa-edit"></i> Edit
                    </button>
                    <button class="btn btn-primary" onclick="detailsModal.viewRoster('${data.class_id}')">
                        <i class="fas fa-users"></i> Roster
                    </button>
                `;
                break;
        }

        actionsContainer.innerHTML = html;
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    showLoading() {
        const overviewContent = document.getElementById('overviewContent');
        overviewContent.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner"></div>
            </div>
        `;
    }

    showError(message) {
        const overviewContent = document.getElementById('overviewContent');
        overviewContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>${message}</p>
            </div>
        `;
    }

    close() {
        this.modal.style.display = 'none';
        this.currentType = null;
        this.currentId = null;
    }

    // Action methods (to be implemented as needed)
    editStudent(studentId) {
        console.log('Edit student:', studentId);
        // Navigate to edit page or open edit modal
    }

    viewGrades(studentId) {
        console.log('View grades:', studentId);
        // Navigate to grades page
    }

    editTeacher(teacherId) {
        console.log('Edit teacher:', teacherId);
        // Navigate to edit page
    }

    viewSchedule(teacherId) {
        console.log('View schedule:', teacherId);
        // Navigate to schedule page
    }

    editClass(classId) {
        console.log('Edit class:', classId);
        // Navigate to edit page
    }

    viewRoster(classId) {
        console.log('View roster:', classId);
        // Navigate to roster page
    }
}

// Initialize the modal system
const detailsModal = new DetailsModal();

// Global function for external access
window.showDetails = (type, id) => {
    detailsModal.showDetails(type, id);
};
