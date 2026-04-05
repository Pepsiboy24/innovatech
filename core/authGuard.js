import { supabase } from './config.js';
import { hasFeatureAccess, getCurrentUserTier, TIERS } from './tierAccess.js';

(async function authGuard() {
    try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            redirectToLogin();
            return;
        }

        // 1. Multi-tenant requirement
        if (!user.user_metadata?.school_id) {
            console.warn('User missing school_id, redirecting to onboarding');
            redirectToOnboarding();
            return;
        }

        const userSchoolId = user.user_metadata.school_id;
        const currentPath = window.location.pathname;
        const userType = user.user_metadata?.user_type;

        // 2. Tier Access Control
        const userTier = await getCurrentUserTier();
        if (!userTier) {
            console.error('Tier resolution failed');
            await supabase.auth.signOut();
            redirectToLogin();
            return;
        }

        if (!(await checkRouteAccess(currentPath, userTier))) {
            showAccessDeniedModal('Your subscription tier does not allow access to this feature.', '/public/html/login.html');
            return;
        }

        // 3. SHARED PAGE BYPASS (The Critical Fix)
        // If the path contains '/shared/', allow both Teachers and Admins to stay
        if (currentPath.includes('/shared/')) {
            if (userType === 'teacher' || userType === 'school_admin' || userType === 'admin') {
                console.log('Shared Resource Access Granted');
                return; // Exit guard, let manage_notes.js handle the specific data filtering
            }
        }

        // 4. Specific Portal Guards

        // If in Admin Portal, reject Teachers/Parents
        if (currentPath.includes('/schoolAdmin/')) {
            if (userType !== 'school_admin' && userType !== 'admin') {
                showAccessDeniedModal('Unauthorized. Redirecting to Login...', '../../landing_page/html/login.html');
                return;
            }
        }

        // If in Teacher Portal, reject Admins/Parents
        if (currentPath.includes('/teachersPortal/')) {
            if (userType !== 'teacher') {
                showAccessDeniedModal('Access Denied: Teachers only.', '../../landing_page/html/login.html');
                return;
            }
        }

        // 5. Database Verification (Safety Check)
        // We only do this if metadata is ambiguous or for sensitive admin operations
        if (currentPath.includes('/schoolAdmin/')) {
            const { data: adminRecord } = await supabase
                .from('School_Admin')
                .select('admin_id')
                .eq('email', user.email)
                .eq('school_id', userSchoolId)
                .maybeSingle();

            if (!adminRecord) {
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
        overlay.style.cssText = 'position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(8px); z-index: 999999; display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s ease;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background: #1e293b; border: 1px solid #334155; border-radius: 16px; padding: 32px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); color: #f8fafc; font-family: sans-serif;';

        modal.innerHTML = `
            <h2 style="margin: 0 0 12px; font-size: 20px; color: #ef4444;">Access Denied</h2>
            <p style="margin: 0 0 24px; color: #94a3b8; font-size: 15px;">${message}</p>
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
        '/studentsPortal': TIERS.STUDENT_ENGAGEMENT,
        '/parentsPortal': TIERS.FULL_CONNECT,
        '/ai': TIERS.FULL_CONNECT,
        '/schoolAdmin': TIERS.ADMIN_CORE,
        '/teachersPortal': TIERS.ADMIN_CORE,
    };

    for (const [route, requiredTier] of Object.entries(routeTierMap)) {
        if (path.startsWith(route)) return userTier >= requiredTier;
    }
    return true;
}