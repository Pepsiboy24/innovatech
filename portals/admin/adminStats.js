import { supabase } from '../../core/config.js';
import { showSkeleton, hideSkeleton } from '../../assets/js-shared/ui-engine.js';

const statsGrid = document.querySelector('.stats-grid');
const originalGridHTML = statsGrid ? statsGrid.innerHTML : '';

document.addEventListener('DOMContentLoaded', async () => {
    // Replace the stat tiles with skeleton placeholders while counts load
    if (statsGrid) { showSkeleton(statsGrid, 4, 'stat'); }

    // Wait for authGuard to provide the user
    if (window.currentUser) {
        fetchAdminStats(window.currentUser);
    } else {
        window.addEventListener('auth-ready', (e) => fetchAdminStats(e.detail), { once: true });
    }
});

function restoreStatsGrid() {
    if (!statsGrid) return;
    if (originalGridHTML) statsGrid.innerHTML = originalGridHTML;
    hideSkeleton(statsGrid);
}

async function fetchAdminStats(user) {
    try {
        if (!user || !user.user_metadata?.school_id) return;
        const schoolId = user.user_metadata.school_id;

        const [{ count: studentCount }, { count: teacherCount }] = await Promise.all([
            supabase.from('Students').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('enrollment_status', 'active'),
            supabase.from('Teachers').select('*', { count: 'exact', head: true }).eq('school_id', schoolId).eq('employment_status', 'active')
        ]);

        // Restore the static tile markup before writing the fetched values
        restoreStatsGrid();

        updateStat('total-students-count', studentCount || 0);
        updateStat('total-teachers-count', teacherCount || 0);

        if (studentCount === 0 && teacherCount === 0) showSetupWizard();

    } catch (err) {
        console.error('Stats error:', err);
        restoreStatsGrid();
    }
}

function showSetupWizard() {
    const setup = document.getElementById('setupChecklist');
    const dash = document.getElementById('standardDashboard');
    if (setup && dash) {
        setup.style.display = 'block';
        dash.style.display = 'none';
    }
}

function updateStat(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val.toLocaleString();
}