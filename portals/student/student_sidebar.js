/**
 * student_sidebar.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Behavior:
 * 1. Injects the student portal sidebar into #sidebarAnchor.
 * 2. Automatically detects the active page and highlights the nav item.
 * 3. Handles logout logic via Supabase.
 * 4. Loads dynamic school branding from Schools table.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../../core/config.js';
// Dynamic school branding
let schoolBranding = { school_name: 'EduHub', logo_url: null };
let studentProfile = { full_name: null };

// Resolve the current student id: prefer the authenticated user.id (like the dashboard),
// fall back to the cached id used by the sidebar.
function getCachedStudentId() {
    return localStorage.getItem('student_id') ||
        sessionStorage.getItem('student_id') ||
        window.currentStudentId;
}

async function resolveStudentId() {
    try {
        const { data } = await supabase.auth.getUser();
        if (data?.user?.id) return data.user.id;
    } catch (err) {
        console.error('[Sidebar] Auth session error:', err.message);
    }
    return getCachedStudentId();
}

async function loadSchoolBranding() {
    try {
        const studentId = await resolveStudentId();

        if (!studentId) return;

        // 1. Get student's class_id and full_name
        const { data: studentData } = await supabase
            .from('Students')
            .select('class_id, full_name')
            .eq('student_id', studentId)
            .single();

        if (!studentData) return;

        // 2. Get school_id from Classes table
        const { data: classData } = await supabase
            .from('Classes')
            .select('school_id')
            .eq('class_id', studentData.class_id)
            .single();

        if (!classData) return;

        // 3. FETCH: Ensure these column names match your Supabase Table Editor exactly!
        // Based on your previous errors, use 'school_name' and 'logo' (or 'school_logo_url')
        const { data: schoolData, error } = await supabase
            .from('Schools')
            .select('school_name, school_logo_url') 
            .eq('school_id', classData.school_id)
            .single();

        if (error) {
            console.error('Branding fetch error:', error.message);
            return;
        }

        if (schoolData) {
            // CRITICAL FIX: Mapping the result to your global variable
            schoolBranding = {
                school_name: schoolData.school_name, // Must match what you put in .select()
                logo_url: schoolData.logo            // Must match what you put in .select()
            };
            console.log('Branding loaded:', schoolBranding);
        }
        studentProfile = { full_name: studentData.full_name || null };

    } catch (error) {
        console.error('Error loading school branding:', error);
    }
}

function getSidebarHTML() {
    const displayName = schoolBranding?.school_name || 'EduHub';
    
    const logoHtml = schoolBranding?.logo_url
        ? `<img src="${schoolBranding.logo_url}" alt="${displayName}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 0.5rem;">`
        : displayName.substring(0, 2).toUpperCase();

    return `
    <aside class="sidebar" data-nav>
        <div class="sidebar-header">
            <div class="school-logo">${logoHtml}</div>
            <h2 data-school-name="${displayName}">${displayName}</h2>
        </div>
        <nav class="sidebar-nav">
            <a href="/student" class="nav-item" data-path="student">
                <i class="fas fa-home"></i>
                Dashboard
            </a>
            <a href="/student/studentClasses" class="nav-item" data-path="studentClasses">
                <i class="fas fa-calendar-alt"></i>
                Classes
            </a>
            <a href="/student/studyMaterials" class="nav-item" data-path="studyMaterials">
                <i class="fas fa-book"></i>
                Study Materials
            </a>
            <a href="/student/schedule" class="nav-item" data-path="schedule">
                <i class="fas fa-clock"></i>
                Schedule
            </a>
            <a href="/student/cbtEngine" class="nav-item" data-path="cbtEngine">
                <i class="fas fa-pencil-alt"></i>
                CBT Practice
            </a>
        </nav>
        
        <div class="sidebar-footer" style="margin-top: auto; padding: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <div class="user-info">
                <div class="user-avatar" id="sidebarAvatar">S</div>
                <span class="user-name" id="sidebarUserName">Student</span>
            </div>
            <button id="logoutBtn" class="nav-item" style="background: none; border: none; width: 100%; text-align: left; cursor: pointer; color: #ef4444; font-weight: 700;" onmouseover="this.style.color='#b91c1c'" onmouseout="this.style.color='#ef4444';">
                <i class="fas fa-sign-out-alt"></i>
                Logout
            </button>
        </div>
    </aside>
`;
}

async function injectSidebar() {
    // Load school branding first
    await loadSchoolBranding();

    const anchor = document.getElementById('sidebarAnchor');
    if (!anchor) {
        console.warn('[Sidebar] No #sidebarAnchor found in HTML.');
        return;
    }

    anchor.innerHTML = getSidebarHTML();

    // ── ACTIVE LINK DETECTION ───────────────────────────────────────────────
    const currentPath = window.location.pathname.split('/').pop() || 'student';
    const navItems = anchor.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        const itemPath = item.getAttribute('data-path');
        if (itemPath && currentPath.includes(itemPath)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // ── STUDENT PROFILE (AVATAR INITIAL + NAME) ─────────────────────────────
    setProfileInitial();

    // ── LOGOUT LOGIC ────────────────────────────────────────────────────────
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('[Sidebar] Logout Error:', error.message);
            }
            window.location.replace('/login');
        });
    }

    // ── MOBILE TOGGLE LOGIC ──────────────────────────────────────────────────
    // Note: The toggle button is usually in the header, so we just control the 'show' class here
    const navOpen = document.querySelector("[data-nav-display]");
    const nav = anchor.querySelector("[data-nav]");
    const icon = document.querySelector("[data-ie]");

    if (navOpen && nav && icon) {
        navOpen.addEventListener("click", (e) => {
            e.stopPropagation(); // Prevent immediate closure from the document listener
            icon.classList.toggle("fa-bars");
            icon.classList.toggle("fa-times");
            nav.classList.toggle("show");
        });
    }

    // ── CLICK-OUTSIDE TO CLOSE ──────────────────────────────────────────────
    document.addEventListener('click', (e) => {
        const sidebar = anchor.querySelector('.sidebar');
        if (!sidebar || !sidebar.classList.contains('show')) return;

        // If click is NOT inside the sidebar and NOT on the toggle button
        if (!sidebar.contains(e.target) && !navOpen?.contains(e.target)) {
            sidebar.classList.remove('show');
            if (icon) {
                icon.classList.add('fa-bars');
                icon.classList.remove('fa-times');
            }
        }
    });
}

// ── STUDENT PROFILE (AVATAR INITIAL + NAME) ─────────────────────────────
async function setProfileInitial() {
    try {
        if (!studentProfile.full_name) {
            const studentId = await resolveStudentId();
            if (!studentId) return;

            const { data, error } = await supabase
                .from('Students')
                .select('full_name')
                .eq('student_id', studentId)
                .single();

            if (error || !data?.full_name) return;
            studentProfile.full_name = data.full_name;
        }

        const fullName = studentProfile.full_name.trim();
        const initial = fullName.charAt(0).toUpperCase() || 'S';
        const firstName = fullName.split(' ')[0];

        // Update every avatar button on the page header (S / A / blank placeholders)
        document.querySelectorAll('#profileInitial, .profile-btn').forEach(el => {
            if (!el.querySelector('i, svg, img')) el.textContent = initial;
        });

        // Update the sidebar avatar + name
        const sidebarAvatar = document.getElementById('sidebarAvatar');
        const sidebarUserName = document.getElementById('sidebarUserName');
        if (sidebarAvatar) sidebarAvatar.textContent = initial;
        if (sidebarUserName) sidebarUserName.textContent = firstName;
    } catch (error) {
        console.error('[Sidebar] Error setting profile initial:', error);
    }
}

// Run on load
document.addEventListener('DOMContentLoaded', injectSidebar);
// Also run immediately in case DOM is already ready
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    injectSidebar();
}
