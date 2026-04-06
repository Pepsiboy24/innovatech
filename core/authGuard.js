import { supabase } from './config.js';
import { hasFeatureAccess, getCurrentUserTier, TIERS } from './tierAccess.js';

/**
 * iSchool Universal Auth Guard
 * Final SaaS Modular Version
 */
(async function authGuard() {
    try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) {
            redirectToLogin();
            return;
        }

        // 1. Extract User Metadata
        const userMetadata = user.user_metadata || {};
        const schoolId = userMetadata.school_id;
        const userType = userMetadata.user_type; // 'admin', 'teacher', 'student', 'parent'
        const currentPath = window.location.pathname;

        // 2. Multi-tenant requirement: Every private user must have a school_id
        if (!schoolId) {
            console.warn('User missing school_id, redirecting to onboarding');
            redirectToOnboarding();
            return;
        }

        // 3. Tier Access Control
        const userTier = await getCurrentUserTier();
        if (userTier === null || userTier === undefined) {
            console.error('Tier resolution failed');
            await supabase.auth.signOut();
            redirectToLogin();
            return;
        }

        if (!(await checkRouteAccess(currentPath, userTier))) {
            showAccessDeniedModal('Your subscription tier does not allow access to this feature.', '/public/html/login.html');
            return;
        }

        // 4. SHARED PORTAL BYPASS (The Fix for Manage Notes)
        // If the path is in the /shared/ folder, allow access if they are logged in
        if (currentPath.includes('/portals/shared/')) {
            console.log('✅ Accessing Shared Portal Resource');
            return; // Exit guard, access granted
        }

        // 5. ROLE-BASED ACCESS CONTROL (RBAC)

        // Guard Admin Portal
        if (currentPath.includes('/portals/admin/')) {
            if (userType !== 'admin' && userType !== 'school_admin') {
                showAccessDeniedModal('Unauthorized: Admin access required.', '/public/html/login.html');
                return;
            }
        }

        // Guard Teacher Portal
        if (currentPath.includes('/portals/teacher/')) {
            if (userType !== 'teacher') {
                showAccessDeniedModal('Access Denied: Teachers only.', '/public/html/login.html');
                return;
            }
        }

        // Guard Parent Portal
        if (currentPath.includes('/portals/parent/')) {
            if (userType !== 'parent') {
                showAccessDeniedModal('Access Denied: Parents only.', '/public/html/login.html');
                return;
            }
        }

        // Guard Student Portal
        if (currentPath.includes('/portals/student/')) {
            // Note: Since manage_notes used to be here, we ensure we aren't blocking it 
            // if it hasn't been moved to /shared/ yet.
            if (userType !== 'student' && !currentPath.includes('manage_notes.html')) {
                showAccessDeniedModal('Access Denied: Students only.', '/public/html/login.html');
                return;
            }
        }

        // 6. Deep Security Check (Optional: For Admin pages only)
        if (currentPath.includes('/portals/admin/')) {
            const { data: adminRecord } = await supabase
                .from('School_Admin')
                .select('admin_id')
                .eq('school_id', schoolId)
                .eq('email', user.email)
                .maybeSingle();

            if (!adminRecord) {
                console.error('Admin verification failed against database record.');
                await supabase.auth.signOut();
                redirectToLogin();
            }
        }

    } catch (err) {
        console.error('Unexpected Auth Guard Error:', err);
        redirectToLogin();
    }
})();

function redirectToLogin() {
    if (document.body) document.body.style.display = 'none';
    window.location.href = '/public/html/login.html';
}

function redirectToOnboarding() {
    if (document.body) document.body.style.display = 'none';
    window.location.href = '/public/html/onboarding.html';
}

function showAccessDeniedModal(message, redirectUrl) {
    const render = () => {
        const overlay = document.createElement('div');
        overlay.id = 'auth-deny-overlay';
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); z-index: 999999; display: flex; align-items: center; justify-content: center; transition: opacity 0.3s ease;';
        
        const modal = document.createElement('div');
        modal.style.cssText = 'background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); color: #f8fafc; font-family: sans-serif;';

        modal.innerHTML = `
            <div style="color: #ef4444; font-size: 48px; margin-bottom: 16px;"><i class="fas fa-exclamation-circle"></i></div>
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #ef4444;">Access Denied</h2>
            <p style="margin: 0 0 24px; color: #94a3b8; font-size: 15px; line-height: 1.5;">${message}</p>
            <div style="width: 24px; height: 24px; border: 3px solid #334155; border-top-color: #3b82f6; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
            <style>@keyframes spin { to { transform: rotate(360deg); } }</style>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
        setTimeout(() => window.location.href = redirectUrl, 2500);
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
    else render();
}

async function checkRouteAccess(path, userTier) {
    const routeTierMap = {
        '/portals/student': TIERS.STUDENT_ENGAGEMENT,
        '/portals/parent': TIERS.FULL_CONNECT,
        '/portals/admin': TIERS.ADMIN_CORE,
        '/portals/teacher': TIERS.ADMIN_CORE,
        '/ai': TIERS.FULL_CONNECT,
    };

    for (const [route, requiredTier] of Object.entries(routeTierMap)) {
        if (path.startsWith(route)) {
            // Shared folder is always accessible if route check is the only barrier
            if (path.includes('/shared/')) return true;
            return userTier >= requiredTier;
        }
    }
    return true;
}