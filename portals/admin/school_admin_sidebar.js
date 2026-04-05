// school_admin_sidebar.js
// Uses runtime path detection so links are correct from BOTH:
//   html/schoolAdmin/anyPage.html  → prefix = "./"
//   html/shared/anyPage.html       → prefix = "../schoolAdmin/"

import { supabase } from '../config.js';
import { hasFeatureAccess, getCurrentUserTier } from '../tierAccess.js';

(async function () {
    // Compute relative path from current page to schoolAdmin folder
    function adminPrefix() {
        const path = window.location.pathname;
        if (path.includes('/html/shared/')) return '../schoolAdmin/';
        return './';          // default: already in schoolAdmin
    }

    // Compute path to the shared folder from the current page
    function sharedPrefix() {
        const path = window.location.pathname;
        if (path.includes('/html/shared/')) return './';
        return '../shared/';  // from schoolAdmin → go up one, into shared
    }

    // Fetch school branding data with AbortError handling
    async function getSchoolBranding(retries = 3) {
        try {
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw authError;

            if (!user || !user.user_metadata?.school_id) {
                console.warn('No school_id found in user metadata');
                return { school_name: 'EduHubAdmin', school_logo_url: null };
            }
            
            console.log("Current User Tier:", user.user_metadata.tier);
            console.log("Full User Metadata:", user.user_metadata);
            
            const schoolId = user.user_metadata.school_id;
            const { data: school, error } = await supabase
                .from('Schools')
                .select('school_name, school_logo_url')
                .eq('school_id', schoolId)
                .single();

            if (error) throw error;
            return school || { school_name: 'EduHubAdmin', school_logo_url: null };
            
        } catch (error) {
            const isLockError = error.name === 'AbortError' || (error.message && error.message.toLowerCase().includes('lock'));
            
            if (isLockError && retries > 0) {
                console.warn(`Auth lock collision in sidebar, retrying... (${retries} left)`);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 400 + 200));
                return getSchoolBranding(retries - 1);
            }
            
            console.error('Error fetching school branding:', error);
            return { school_name: 'EduHubAdmin', school_logo_url: null };
        }
    }

    function renderSidebar(branding = { school_name: 'EduHubAdmin', school_logo_url: null }) {
        const a = adminPrefix();
        const sh = sharedPrefix();

        return `
            <style>
                .sidebar-nav {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    overflow-y: auto;
                    overflow-x: hidden;
                    max-height: calc(100vh - 120px);
                    scrollbar-width: thin;
                    scrollbar-color: #cbd5e1 #f1f5f9;
                }
                
                .sidebar-nav::-webkit-scrollbar {
                    width: 6px;
                }
                
                .sidebar-nav::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 3px;
                }
                
                .sidebar-nav::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                }
                
                .sidebar-nav::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                }
            </style>
            <div class="logo">
                <div style="display: flex; align-items: center; gap: 10px;">
                    ${branding.school_logo_url ? 
                        `<img src="${branding.school_logo_url}" alt="School Logo" style="width: 32px; height: 32px; border-radius: 8px; object-fit: cover;">` :
                        `<div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>`
                    }
                    <span style="font-weight: 600; color: #1e293b;">${branding.school_name}</span>
                </div>
                <div class="icon mobile-menu-btn" data-sideBarClose><i class="fa fa-times"></i></div>
            </div>
            <nav class="sidebar-nav">
                <a href="${a}schoolAdminDashboard.html" class="nav-item">
                    <i class="fa-solid fa-table-columns nav-icon"></i>
                    Dashboard
                </a>
                <a href="${a}classes.html" class="nav-item">
                    <i class="fa-solid fa-chalkboard-user nav-icon"></i>
                    <span>Classes</span>
                </a>
                <a href="${a}students.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-user-graduate nav-icon"></i>
                    Students
                </a>
                <a href="${a}teachers.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-chalkboard-teacher nav-icon"></i>
                    Teachers
                </a>
                <a href="${a}schooladmins.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-user-tie nav-icon"></i>
                    School Admins
                </a>
                <a href="${a}academic_manager.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-book-open nav-icon"></i>
                    <span>Academic Manager</span>
                </a>
                <a href="${a}schedule.html" class="nav-item" data-tier="1">
                    <i class="fa-regular fa-calendar nav-icon"></i>
                    Schedule
                </a>
                <a href="${a}timeTable.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-clock nav-icon"></i>
                    Time Table
                </a>
                <a href="${a}settings.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-cog nav-icon"></i>
                    School Settings
                </a>
                <a href="${a}payments_config.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-credit-card nav-icon"></i>
                    Payment Config
                </a>
                <a href="${sh}manage_notes.html" class="nav-item" data-tier="1">
                    <i class="fa-solid fa-file-lines nav-icon"></i>
                    Manage Notes
                </a>

                
                
                <a href="${a}parents.html" class="nav-item" data-tier="3">
                    <i class="fa-solid fa-users nav-icon"></i>
                    Parents
                </a>
                
                <a href="#" id="schoolAdminLogoutBtn" class="nav-item" style="margin-top: auto; border-top: 1px solid var(--border); border-radius: 0; padding-top: 16px;">
                    <i class="fa-solid fa-sign-out-alt nav-icon"></i>
                    Logout
                </a>
            </nav>`;
    }

    document.addEventListener('DOMContentLoaded', async () => {
        const sidebarElement = document.querySelector('[data-sideBar]');
        if (!sidebarElement) return;

        // Fetch school branding data
        const branding = await getSchoolBranding();
        
        // Build sidebar with dynamic branding
        sidebarElement.innerHTML = renderSidebar(branding);

        // Apply tier-based filtering to navigation items - FIXED for School Admins
        const userTier = await getCurrentUserTier();
        const safeUserTier = Number(userTier) || 1; // Fallback to tier 1 if undefined
        console.log('User tier:', userTier, 'Safe tier:', safeUserTier); // Debug log
        
        const items = sidebarElement.querySelectorAll('.nav-item[data-tier]');
        console.log("Gated items found:", items.length); // Should say 13
        
        if (userTier) {
            sidebarElement.querySelectorAll('.nav-item[data-tier]').forEach(item => {
                const requiredTier = parseInt(item.getAttribute('data-tier'));
                // Explicit number conversion comparison
                if (Number(userTier) < Number(requiredTier)) {
                    item.style.display = 'none';
                    item.setAttribute('aria-hidden', 'true');
                } else {
                    item.style.display = '';
                    item.removeAttribute('aria-hidden');
                }
            });
        } else {
            console.warn('No user tier found, showing all items');
        }

        // Active link highlighting
        const currentPath = window.location.pathname;
        const parentOverride = document.body.getAttribute('data-parent-link');

        sidebarElement.querySelectorAll('.nav-item').forEach(link => {
            const linkHref = link.getAttribute('href') || '';
            // Match by filename at end of path
            const filename = linkHref.split('/').pop();
            const cleanParent = parentOverride ? parentOverride.split('/').pop() : null;

            const isDirectMatch = filename && filename !== '#' && currentPath.endsWith(filename);
            const isParentMatch = cleanParent && filename === cleanParent;

            if (isDirectMatch || isParentMatch) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });

        // Mobile close button
        const closeBtn = sidebarElement.querySelector('[data-sideBarClose]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebarElement.classList.remove('show', 'open', 'active');
            });
        }

        // Mobile open button (from header)
        const openBtn = document.querySelector('[data-sideBarOpen]');
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                sidebarElement.classList.add('show', 'open', 'active');
            });
        }

        // Logout functionality
        const logoutBtn = sidebarElement.querySelector('#schoolAdminLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    await supabase.auth.signOut();
                } catch (error) {
                    console.error("Logout Error:", error);
                }
                window.location.href = "/public/html/login.html"';
            });
        }
    });

})();
