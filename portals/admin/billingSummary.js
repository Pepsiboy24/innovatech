import { supabase } from '../../core/config.js';
import { showSkeleton, hideSkeleton } from '../../assets/js-shared/ui-engine.js';

class BillingSummary {
    constructor() {
        this.currentTerm = '';
        this.ratePerStudent = 2500;
        this.metrics = null;
        this.billingGrid = document.querySelector('.billing-grid');
        this.originalGridHTML = this.billingGrid ? this.billingGrid.innerHTML : '';
        this.init();
    }

    async init() {
        if (window.currentUser) {
            await this.loadBillingData(window.currentUser);
        } else {
            window.addEventListener('auth-ready', async (e) => {
                await this.loadBillingData(e.detail);
            }, { once: true });
        }
    }

    restoreGrid() {
        if (this.billingGrid && this.originalGridHTML) this.billingGrid.innerHTML = this.originalGridHTML;
        if (this.billingGrid) hideSkeleton(this.billingGrid);
    }

    async loadBillingData(user) {
        // Replace the billing cards with skeleton placeholders while data loads
        if (this.billingGrid) { showSkeleton(this.billingGrid, 2, 'stat'); }
        try {
            const schoolId = user?.user_metadata?.school_id;
            if (!schoolId) return;

            this.currentTerm = 'Current Term';

            const [{ data: students, error }, { data: schoolData }] = await Promise.all([
                supabase
                    .from('Students')
                    .select('student_id')
                    .eq('school_id', schoolId)
                    .eq('enrollment_status', 'active'),
                supabase
                    .from('Schools')
                    .select('current_term, current_session')
                    .eq('school_id', schoolId)
                    .single()
            ]);

            if (error) throw error;

            if (schoolData) {
                this.currentTerm = schoolData.current_term || schoolData.current_session || this.currentTerm;
            }

            this.calculateBillingMetrics(students || [], schoolId);
            this.restoreGrid();
            this.updateBillingDisplay();
        } catch (error) {
            console.error('Billing error:', error);
            this.restoreGrid();
        }
    }

    calculateBillingMetrics(students, schoolId) {
        const count = students.length;
        this.metrics = {
            activeStudents: count,
            totalOwed: count * this.ratePerStudent,
            paidStudents: 0,
            unpaidStudents: count,
            collectionRate: 0,
            nextDueDate: 'N/A'
        };
    }

    updateBillingDisplay() {
        if (!this.metrics) return;

        const termEl = document.getElementById('current-term');
        if (termEl && this.currentTerm) termEl.textContent = this.currentTerm;

        const map = {
            'active-students-count': this.metrics.activeStudents,
            'total-owed': `₦${this.metrics.totalOwed.toLocaleString()}`,
            'paid-students-count': this.metrics.paidStudents,
            'unpaid-students-count': this.metrics.unpaidStudents,
            'collection-rate': `${this.metrics.collectionRate}%`,
            'next-due-date': this.metrics.nextDueDate
        };

        for (const [id, val] of Object.entries(map)) {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => { new BillingSummary(); });