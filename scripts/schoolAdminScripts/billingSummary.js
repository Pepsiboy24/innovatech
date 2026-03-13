import { supabase } from '../config.js';

class BillingSummary {
    constructor() {
        this.currentTerm = 'First Term 2026';
        this.ratePerStudent = 2500; // Default rate in Naira
        this.init();
    }

    async init() {
        await this.loadBillingData();
        this.updateBillingDisplay();
    }

    async loadBillingData() {
        try {
            // Get current user's school_id from metadata
            const { data: { user } } = await supabase.auth.getUser();
            const userSchoolId = user?.user_metadata?.school_id;
            
            if (!userSchoolId) {
                console.error('User missing school_id in metadata');
                return;
            }

            // Fetch current term enrollment data
            const { data: enrollmentData, error: enrollmentError } = await supabase
                .from('Termly_Enrollment')
                .select('*')
                .eq('school_id', userSchoolId)
                .eq('term_status', 'ACTIVE')
                .order('enrollment_date', { ascending: false });

            if (enrollmentError) {
                console.error('Error fetching enrollment data:', enrollmentError);
                return;
            }

            // Calculate billing metrics
            this.calculateBillingMetrics(enrollmentData || []);

        } catch (error) {
            console.error('Error loading billing data:', error);
        }
    }

    calculateBillingMetrics(enrollments) {
        const activeStudents = enrollments.length;
        const totalOwed = activeStudents * this.ratePerStudent;
        
        // Calculate payment status
        const paidStudents = enrollments.filter(e => e.payment_status === 'PAID').length;
        const unpaidStudents = enrollments.filter(e => e.payment_status === 'PENDING').length;
        const collectionRate = activeStudents > 0 ? Math.round((paidStudents / activeStudents) * 100) : 0;

        // Calculate next due date (30 days from now)
        const nextDueDate = new Date();
        nextDueDate.setDate(nextDueDate.getDate() + 30);
        const dueDateStr = nextDueDate.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric' 
        });

        // Update DOM elements
        this.updateBillingDisplay({
            activeStudents,
            totalOwed,
            paidStudents,
            unpaidStudents,
            collectionRate,
            nextDueDate: dueDateStr
        });
    }

    updateBillingDisplay(metrics) {
        // Update current term
        const currentTermEl = document.getElementById('current-term');
        if (currentTermEl) {
            currentTermEl.textContent = this.currentTerm;
        }

        // Update active students count
        const activeStudentsEl = document.getElementById('active-students-count');
        if (activeStudentsEl) {
            activeStudentsEl.textContent = metrics.activeStudents.toLocaleString();
        }

        // Update total owed
        const totalOwedEl = document.getElementById('total-owed');
        if (totalOwedEl) {
            totalOwedEl.textContent = `₦${metrics.totalOwed.toLocaleString()}`;
        }

        // Update payment status
        const paidStudentsEl = document.getElementById('paid-students-count');
        if (paidStudentsEl) {
            paidStudentsEl.textContent = metrics.paidStudents.toLocaleString();
        }

        const unpaidStudentsEl = document.getElementById('unpaid-students-count');
        if (unpaidStudentsEl) {
            unpaidStudentsEl.textContent = metrics.unpaidStudents.toLocaleString();
        }

        // Update collection rate
        const collectionRateEl = document.getElementById('collection-rate');
        if (collectionRateEl) {
            collectionRateEl.textContent = `${metrics.collectionRate}%`;
        }

        // Update next due date
        const nextDueDateEl = document.getElementById('next-due-date');
        if (nextDueDateEl) {
            nextDueDateEl.textContent = metrics.nextDueDate;
        }

        // Update rate per student
        const rateEl = document.querySelector('.billing-value');
        if (rateEl && rateEl.textContent.includes('₦')) {
            rateEl.textContent = `₦${this.ratePerStudent.toLocaleString()}`;
        }
    }

    // Method to refresh billing data
    async refreshBillingData() {
        await this.loadBillingData();
    }

    // Method to update rate per student
    async updateRatePerStudent(newRate) {
        this.ratePerStudent = newRate;
        await this.loadBillingData(); // Recalculate with new rate
    }
}

// Initialize billing summary when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new BillingSummary();
});

// Export for external use
export { BillingSummary };
