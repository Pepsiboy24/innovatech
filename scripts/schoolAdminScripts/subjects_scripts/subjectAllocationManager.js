import { supabase } from '../../../config.js';

/**
 * Subject Allocation Manager - Clean Subject Management System
 * Prevents duplicate subjects and manages subject-class-teacher relationships
 */

class SubjectAllocationManager {
    constructor() {
        this.schoolId = null;
        this.subjects = [];
        this.classes = [];
        this.teachers = [];
    }

    /**
     * Initialize the allocation manager
     */
    async initialize() {
        try {
            // Get school ID from auth
            const { data: userData } = await supabase.auth.getUser();
            this.schoolId = userData.user?.user_metadata?.school_id;

            if (!this.schoolId) {
                throw new Error('School ID not found in user metadata');
            }

            // Load master data
            await this.loadMasterData();
            
            console.log('Subject Allocation Manager initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize Subject Allocation Manager:', error);
            return false;
        }
    }

    /**
     * Load master data (subjects, classes, teachers)
     */
    async loadMasterData() {
        try {
            // Load unique subjects
            const { data: subjects, error: subjectsError } = await supabase
                .from('Subjects')
                .select('*')
                .eq('school_id', this.schoolId)
                .order('subject_name');

            if (subjectsError) throw subjectsError;
            this.subjects = subjects || [];

            // Load classes
            const { data: classes, error: classesError } = await supabase
                .from('Classes')
                .select('class_id, class_name, section')
                .eq('school_id', this.schoolId)
                .order('class_name');

            if (classesError) throw classesError;
            this.classes = classes || [];

            // Load teachers
            const { data: teachers, error: teachersError } = await supabase
                .from('Teachers')
                .select('teacher_id, first_name, last_name')
                .eq('school_id', this.schoolId)
                .order('first_name');

            if (teachersError) throw teachersError;
            this.teachers = teachers || [];

            console.log(`Loaded ${this.subjects.length} subjects, ${this.classes.length} classes, ${this.teachers.length} teachers`);
        } catch (error) {
            console.error('Error loading master data:', error);
            throw error;
        }
    }

    /**
     * Add new subject (unique subjects table)
     */
    async addSubject(subjectData) {
        try {
            // Check for duplicate subject
            const existingSubject = this.subjects.find(
                s => s.subject_name.toLowerCase() === subjectData.subjectName.toLowerCase()
            );

            if (existingSubject) {
                throw new Error(`Subject "${subjectData.subjectName}" already exists`);
            }

            // Insert into Subjects table
            const { data, error } = await supabase
                .from('Subjects')
                .insert([{
                    subject_name: subjectData.subjectName,
                    subject_code: subjectData.subjectCode || this.generateSubjectCode(subjectData.subjectName),
                    is_core: subjectData.subjectType === 'core',
                    school_id: this.schoolId,
                    created_at: new Date().toISOString(),
                    created_by: (await supabase.auth.getUser()).data?.user?.email || 'system'
                }])
                .select()
                .single();

            if (error) throw error;

            // Update local cache
            this.subjects.push(data);

            return {
                success: true,
                subject: data,
                message: `Subject "${subjectData.subjectName}" added successfully`
            };
        } catch (error) {
            console.error('Error adding subject:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Allocate subject to class and teacher
     */
    async allocateSubject(allocationData) {
        try {
            const { subjectId, classId, teacherId } = allocationData;

            // Validate inputs
            if (!subjectId || !classId || !teacherId) {
                throw new Error('Subject, Class, and Teacher are all required');
            }

            // Check for existing allocation
            const { data: existingAllocation, error: checkError } = await supabase
                .from('Subject_Allocations')
                .select('*')
                .eq('subject_id', subjectId)
                .eq('class_id', classId)
                .eq('teacher_id', teacherId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingAllocation) {
                throw new Error('This subject is already allocated to this class and teacher');
            }

            // Create allocation
            const { data, error } = await supabase
                .from('Subject_Allocations')
                .insert([{
                    subject_id: subjectId,
                    class_id: classId,
                    teacher_id: teacherId,
                    school_id: this.schoolId,
                    academic_year: new Date().getFullYear().toString(),
                    term: 'First Term',
                    created_at: new Date().toISOString(),
                    created_by: (await supabase.auth.getUser()).data?.user?.email || 'system'
                }])
                .select()
                .single();

            if (error) throw error;

            return {
                success: true,
                allocation: data,
                message: 'Subject allocated successfully'
            };
        } catch (error) {
            console.error('Error allocating subject:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get all allocations
     */
    async getAllocations() {
        try {
            const { data, error } = await supabase
                .from('Subject_Allocations')
                .select(`
                    *,
                    Subjects(subject_name, subject_code, is_core),
                    Classes(class_name, section),
                    Teachers(first_name, last_name)
                `)
                .eq('school_id', this.schoolId)
                .order('Classes(class_name)');

            if (error) throw error;

            return {
                success: true,
                allocations: data || []
            };
        } catch (error) {
            console.error('Error fetching allocations:', error);
            return {
                success: false,
                error: error.message,
                allocations: []
            };
        }
    }

    /**
     * Remove allocation
     */
    async removeAllocation(allocationId) {
        try {
            const { error } = await supabase
                .from('Subject_Allocations')
                .delete()
                .eq('allocation_id', allocationId);

            if (error) throw error;

            return {
                success: true,
                message: 'Allocation removed successfully'
            };
        } catch (error) {
            console.error('Error removing allocation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate subject code
     */
    generateSubjectCode(subjectName) {
        return subjectName
            .toUpperCase()
            .replace(/\s+/g, '_')
            .substring(0, 8);
    }

    /**
     * Populate dropdowns
     */
    populateDropdowns(subjectSelect, classSelect, teacherSelect) {
        // Clear existing options
        subjectSelect.innerHTML = '<option value="">Select Subject</option>';
        classSelect.innerHTML = '<option value="">Select Class</option>';
        teacherSelect.innerHTML = '<option value="">Select Teacher</option>';

        // Populate subjects
        this.subjects.forEach(subject => {
            const option = document.createElement('option');
            option.value = subject.subject_id;
            option.textContent = `${subject.subject_name} (${subject.is_core ? 'Core' : 'Elective'})`;
            subjectSelect.appendChild(option);
        });

        // Populate classes
        this.classes.forEach(cls => {
            const option = document.createElement('option');
            option.value = cls.class_id;
            option.textContent = `${cls.class_name} ${cls.section}`;
            classSelect.appendChild(option);
        });

        // Populate teachers
        this.teachers.forEach(teacher => {
            const option = document.createElement('option');
            option.value = teacher.teacher_id;
            option.textContent = `${teacher.first_name} ${teacher.last_name}`;
            teacherSelect.appendChild(option);
        });
    }
}

// Export for global use
window.SubjectAllocationManager = SubjectAllocationManager;
