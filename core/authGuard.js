import { supabase } from './config.js';
import { hasFeatureAccess, getCurrentUserTier, TIERS } from './tierAccess.js';

// Which part of the app is this URL? Works for clean URLs (/admin/students)
// AND the real file paths (/portals/admin/students.html).
function areaOf(path) {
    const m = path.match(/^\/(?:portals\/)?(admin|teacher|student|parent|shared)(?:\/|$)/);
    return m ? m[1] : null;
}

(async function authGuard() {
    try {
        const { data: { user }, error: authErr } = await supabase.auth.getUser();

        if (authErr || !user) {
            redirectToLogin();
            return;
        }

        // --- SHARED STATE FIX ---
        window.currentUser = user; 
        window.dispatchEvent(new CustomEvent('auth-ready', { detail: user }));
        // ------------------------

        const userMetadata = user.user_metadata || {};
        const schoolId = userMetadata.school_id;
        const userType = userMetadata.user_type; 
        const currentPath = window.location.pathname;

        if (!schoolId) {
            redirectToOnboarding();
            return;
        }

        const userTier = await getCurrentUserTier();
        if (userTier === null) {
            await supabase.auth.signOut();
            redirectToLogin();
            return;
        }

        // Temporary password still in use -> must choose their own first
        if (userMetadata.must_change_password) {
            window.location.replace('/change-password');
            return;
        }

        const area = areaOf(currentPath);

        const hasAccess = await checkRouteAccess(area, userTier);
        if (!hasAccess) {
            showAccessDeniedModal(
                'Your current plan does not include access to this feature. Please upgrade your subscription.',
                '/login'
            );
            return;
        }

        // Shared folder bypass
        if (area === 'shared') return;

        // Role-based access (this is only a UI guard; real protection is the database rules)
        if (area === 'admin' && userType !== 'admin' && userType !== 'school_admin') {
            showAccessDeniedModal('Unauthorized: Admin access required.', '/login');
            return;
        }

        if (area === 'teacher' && userType !== 'teacher') {
            showAccessDeniedModal('Access Denied: Teachers only.', '/login');
            return;
        }

        if (area === 'student' && userType !== 'student' && userType !== 'teacher' && userType !== 'admin' && userType !== 'school_admin') {
            // Teachers/admins may open student pages (e.g. Manage Notes lives under /student)
            showAccessDeniedModal('Access Denied: Students only.', '/login');
            return;
        }

        if (area === 'parent' && userType !== 'parent') {
            showAccessDeniedModal('Access Denied: Parents only.', '/login');
            return;
        }

    } catch (err) {
        console.error('Unexpected Auth Guard Error:', err);
        redirectToLogin();
    }
})();

function redirectToLogin() {
    if (document.body) document.body.style.display = 'none';
    window.location.replace('/login');
}

function redirectToOnboarding() {
    if (document.body) document.body.style.display = 'none';
    window.location.href = '/public/html/onboarding.html';
}

function showAccessDeniedModal(message, redirectUrl) {
    const render = () => {
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px); z-index: 999999; display: flex; align-items: center; justify-content: center;';
        overlay.innerHTML = `<div style="background: #1e293b; padding: 32px; border-radius: 16px; text-align: center; color: white;">
            <h2 style="color: #ef4444;">Access Denied</h2>
            <p>${message}</p>
        </div>`;
        document.body.appendChild(overlay);
        setTimeout(() => window.location.replace(redirectUrl), 2500);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', render);
    else render();
}

async function checkRouteAccess(area, userTier) {
    const areaTierMap = {
        student: TIERS.STUDENT_ENGAGEMENT,
        admin: TIERS.ADMIN_CORE,
        teacher: TIERS.ADMIN_CORE,
    };
    if (area && areaTierMap[area] !== undefined) return userTier >= areaTierMap[area];
    return true;
}