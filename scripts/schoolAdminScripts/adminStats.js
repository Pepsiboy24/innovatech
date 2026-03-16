
import { supabase } from '../config.js';

document.addEventListener('DOMContentLoaded', async () => {
    await fetchAdminStats();
});

async function fetchAdminStats() {
    try {
        // Get current user's school_id for RLS compliance
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user || !user.user_metadata?.school_id) {
            console.error('User authentication error:', userError);
            return;
        }

        const schoolId = user.user_metadata.school_id;

        // Fetch Students count
        const { count: studentCount, error: studentError } = await supabase
            .from('Students')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId); // RLS: Only count students from this school

        if (studentError) {
            console.error('Error fetching students count:', studentError);
        } else {
            updateStat('total-students-count', studentCount);
        }

        // Fetch Teachers count
        const { count: teacherCount, error: teacherError } = await supabase
            .from('Teachers')
            .select('*', { count: 'exact', head: true })
            .eq('school_id', schoolId); // RLS: Only count teachers from this school

        if (teacherError) {
            console.error('Error fetching teachers count:', teacherError);
        } else {
            updateStat('total-teachers-count', teacherCount);
        }

        // Check if this is a new school (no data yet)
        if (studentCount === 0 && teacherCount === 0) {
            console.log('New school detected - showing setup wizard');
            showSetupWizard();
        }

    } catch (err) {
        console.error('Unexpected error fetching stats:', err);
    }
}

function showSetupWizard() {
    // Hide standard dashboard and show setup checklist
    const setupChecklist = document.getElementById('setupChecklist');
    const standardDashboard = document.getElementById('standardDashboard');
    
    if (setupChecklist && standardDashboard) {
        setupChecklist.style.display = 'block';
        standardDashboard.style.display = 'none';
        console.log('Setup wizard activated for new school');
    }
}

function updateStat(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value.toLocaleString();
    }
}
