import { supabase } from './config.js';
import { hasFeatureAccess, getCurrentUserTier, TIERS } from './tierAccess.js';

(async function authGuard() {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            // No user, redirect to login
            redirectToLogin();
            return;
        }

        // Verify user has school_id in metadata (multi-tenant requirement)
        if (!user.user_metadata?.school_id) {
            console.warn('User missing school_id in metadata, redirecting to onboarding');
            // User is logged in but hasn't completed school setup
            redirectToOnboarding();
            return;
        }

        // Verify user has user_type in metadata
        if (!user.user_metadata?.user_type) {
            console.warn('User missing user_type in metadata, updating...');
            await supabase.auth.updateUser({
                data: { 
                    school_id: user.user_metadata.school_id,
                    user_type: 'school_admin' // Default to admin for safety
                }
            });
        }

        const userSchoolId = user.user_metadata.school_id;
        const currentPath = window.location.pathname;

        // Get user's tier for access control
        const userTier = await getCurrentUserTier();
        if (!userTier) {
            console.error('Could not determine user tier, redirecting to login');
            await supabase.auth.signOut();
            redirectToLogin();
            return;
        }

        console.log(`User tier: ${userTier}, Path: ${currentPath}`);

        // Check tier-based route restrictions
        if (!(await checkRouteAccess(currentPath, userTier))) {
            console.warn(`Access denied to ${currentPath} for tier ${userTier}`);
            showAccessDeniedModal('Your subscription tier does not allow access to this feature.', '../../landing_page/html/login.html');
            return;
        }

        // 1. Check School_Admin table
        const { data: adminRecord, error: adminError } = await supabase
            .from('School_Admin')
            .select('admin_id, role, school_id')
            .eq('email', user.email) // Using "email" as per schema
            .eq('school_id', userSchoolId) // Verify school_id matches
            .maybeSingle();

        if (adminRecord) {
            console.log('Role: School Admin', adminRecord.role);
            // User is an admin, allow access
            return;
        }

        // 2. Check Teachers table (Exception)
        // Note: Schema says Teachers table has 'email' column
        const { data: teacherRecord, error: teacherError } = await supabase
            .from('Teachers')
            .select('teacher_id, school_id')
            .eq('email', user.email)
            .eq('school_id', userSchoolId) // Verify school_id matches
            .maybeSingle();

        if (teacherRecord) {
            console.log('Role: Teacher');
            // User is a teacher. They are authenticated, but shouldn't be here.
            // Redirect to index (or teacher portal if we knew the URL, but index is safe)
            // DO NOT Sign Out.
            showAccessDeniedModal('You are logged in as a Teacher. Redirecting to Home...', '../../landing_page/html/login.html');
            return;
        }

        const { data: parentRecord, error: parentError } = await supabase
            .from('Parents')
            .select('parent_id, user_id')
            .eq('user_id', user.id) // Using user_id for Parents as per schema
            .maybeSingle();

        if (parentRecord) {
            console.log('Role: Parent');
            // For parents, we need to verify their student belongs to the same school
            // Get the student(s) linked to this parent
            const { data: studentLinks } = await supabase
                .from('Parent_Student_Links')
                .select('student_id')
                .eq('parent_id', parentRecord.parent_id);

            if (studentLinks && studentLinks.length > 0) {
                // Check if any linked student belongs to the same school
                const { data: studentData } = await supabase
                    .from('Students')
                    .select('school_id')
                    .in('student_id', studentLinks.map(link => link.student_id))
                    .eq('school_id', userSchoolId)
                    .maybeSingle();

                if (studentData) {
                    // Parent has a student in the same school, allow access to parent portal
                    if (!window.location.pathname.includes('parentsPortal')) {
                        showAccessDeniedModal('You are logged in as a Parent. Redirecting to your portal...', '../../landing_page/html/login.html');
                        return;
                    }
                    return; // Allow access to Parent Portal
                }
            }
            
            // Parent exists but no students in the same school
            console.warn('Parent has no students in the same school');
            showAccessDeniedModal('Access denied. No students found in your school.', '../../landing_page/html/login.html');
            return;
        }

        // 3. Neither Admin nor Teacher
        console.warn('Role: Unknown. User is authenticated but not found in Admin or Teacher tables.');
        console.log('User Email:', user.email);

        // Sign out and redirect
        await supabase.auth.signOut();
        redirectToLogin();

    } catch (err) {
        console.error('Unexpected Auth Guard Error:', err);
        // Better safe than sorry? Or maybe just redirect to login without signout if it's a network error?
        // Let's redirect to login.
        redirectToLogin();
    }
})();

function redirectToLogin() {
    console.warn('Strict Guard: Redirecting to login...');
    if (document.body) document.body.style.display = 'none';
    window.location.href = '../../landing_page/html/login.html';
    if (window.stop) window.stop();
}

function redirectToOnboarding() {
    console.warn('Strict Guard: Redirecting to onboarding...');
    if (document.body) document.body.style.display = 'none';
    window.location.href = '../../landing_page/html/onboarding.html';
    if (window.stop) window.stop();
}

function showAccessDeniedModal(message, redirectUrl) {
    const render = () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); z-index: 999999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;';

        const modal = document.createElement('div');
        modal.style.cssText = 'background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); transform: translateY(20px); transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1); color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;';

        modal.innerHTML = `
            <div style="width: 64px; height: 64px; background: rgba(239, 68, 68, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; color: #ef4444;">
                <svg style="width: 32px; height: 32px;" stroke="currentColor" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h2 style="margin: 0 0 12px; font-size: 20px; font-weight: 600;">Access Denied</h2>
            <p style="margin: 0 0 24px; color: #94a3b8; font-size: 15px; line-height: 1.5;">${message}</p>
            <div style="display: flex; justify-content: center;">
                <div style="width: 24px; height: 24px; border: 3px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: authModalSpin 1s linear infinite;"></div>
            </div>
            <style>@keyframes authModalSpin { to { transform: rotate(360deg); } }</style>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        requestAnimationFrame(() => {
            overlay.style.opacity = '1';
            modal.style.transform = 'translateY(0)';
        });

        setTimeout(() => {
            window.location.href = redirectUrl;
        }, 2500);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', render);
    } else {
        render();
    }
}

// Route access checking based on tier
async function checkRouteAccess(path, userTier) {
    // Define route-tier mappings
    const routeTierMap = {
        // Student Dashboard
        '/studentsPortal': TIERS.STUDENT_ENGAGEMENT,
        '/studentsPortal.html': TIERS.STUDENT_ENGAGEMENT,
        
        // CBT Exams
        '/cbt': TIERS.STUDENT_ENGAGEMENT,
        '/cbt/': TIERS.STUDENT_ENGAGEMENT,
        '/exams': TIERS.STUDENT_ENGAGEMENT,
        
        // Parent Portal
        '/parentsPortal': TIERS.FULL_CONNECT,
        '/parentsPortal.html': TIERS.FULL_CONNECT,
        '/parentsPortal/': TIERS.FULL_CONNECT,
        
        // AI Assistants
        '/ai': TIERS.FULL_CONNECT,
        '/ai/': TIERS.FULL_CONNECT,
        '/assistant': TIERS.FULL_CONNECT,
        
        // Admin routes - always accessible for tier 1+
        '/schoolAdmin': TIERS.ADMIN_CORE,
        '/schoolAdmin/': TIERS.ADMIN_CORE,
        
        // Teacher routes - always accessible for tier 1+
        '/teachersPortal': TIERS.ADMIN_CORE,
        '/teachersPortal.html': TIERS.ADMIN_CORE,
        '/teachersPortal/': TIERS.ADMIN_CORE,
    };

    // Find matching route
    for (const [route, requiredTier] of Object.entries(routeTierMap)) {
        if (path.startsWith(route)) {
            return userTier >= requiredTier;
        }
    }

    // Default: allow access
    return true;
}
