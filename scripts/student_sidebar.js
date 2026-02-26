/**
 * student_sidebar.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Behavior:
 * 1. Injects the student portal sidebar into #sidebarAnchor.
 * 2. Automatically detects the active page and highlights the nav item.
 * 3. Handles logout logic via Supabase.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from './config.js';

const sidebarHTML = `
    <aside class="sidebar" data-nav>
        <div class="sidebar-header">
            <h2>EduHub</h2>
        </div>
        <nav class="sidebar-nav">
            <a href="./studentPortal.html" class="nav-item" data-path="studentPortal.html">
                <i class="fas fa-home"></i>
                Dashboard
            </a>
            <a href="./studentClasses.html" class="nav-item" data-path="studentClasses.html">
                <i class="fas fa-calendar-alt"></i>
                Classes
            </a>
            <a href="./studyMaterials.html" class="nav-item" data-path="studyMaterials.html">
                <i class="fas fa-book"></i>
                Study Materials
            </a>
            <a href="./schedule.html" class="nav-item" data-path="schedule.html">
                <i class="fas fa-clock"></i>
                Schedule
            </a>
        </nav>
        
        <div class="sidebar-footer" style="margin-top: auto; padding: 20px; border-top: 1px solid rgba(255,255,255,0.1);">
            <button id="logoutBtn" class="nav-item" style="background: none; border: none; width: 100%; text-align: left; cursor: pointer; color: inherit;">
                <i class="fas fa-sign-out-alt"></i>
                Logout
            </button>
        </div>
    </aside>
`;

function injectSidebar() {
    const anchor = document.getElementById('sidebarAnchor');
    if (!anchor) {
        console.warn('[Sidebar] No #sidebarAnchor found in HTML.');
        return;
    }

    anchor.innerHTML = sidebarHTML;

    // ── ACTIVE LINK DETECTION ───────────────────────────────────────────────
    const currentPath = window.location.pathname.split('/').pop() || 'studentPortal.html';
    const navItems = anchor.querySelectorAll('.nav-item');

    navItems.forEach(item => {
        const itemPath = item.getAttribute('data-path');
        if (itemPath && currentPath.includes(itemPath)) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // ── LOGOUT LOGIC ────────────────────────────────────────────────────────
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (error) {
                console.error('[Sidebar] Logout Error:', error.message);
            }
            window.location.replace('../../index.html');
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

// Run on load
document.addEventListener('DOMContentLoaded', injectSidebar);
// Also run immediately in case DOM is already ready
if (document.readyState === 'interactive' || document.readyState === 'complete') {
    injectSidebar();
}
