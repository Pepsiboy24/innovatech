// parents_portal_sidebar.js
// Uses runtime path detection so links are correct from BOTH:
//   html/parentsPortal/anyPage.html    → prefix = "./"
//   html/shared/anyPage.html           → prefix = "../parentsPortal/"

(function () {
    // Compute the relative path from the current page to the parentsPortal folder
    function parentPrefix() {
        const path = window.location.pathname;
        if (path.includes('/html/shared/')) return '../parentsPortal/';
        return './';          // default: already in parentsPortal
    }

    // Compute path to the shared folder from the current page
    function sharedPrefix() {
        const path = window.location.pathname;
        if (path.includes('/html/shared/')) return './';
        return '../shared/';  // from parentsPortal → go up one, into shared
    }

    function buildSidebar() {
        const p = parentPrefix();
        const sh = sharedPrefix();

        return `
            <div class="sidebar-header">
                <div class="logo">EdTech</div>
                <div class="user-info">
                    <div class="user-avatar">JS</div>
                    <div class="user-details">
                        <h4>John Smith</h4>
                        <p>Parent of Alex Smith</p>
                    </div>
                </div>
            </div>

            <ul class="nav-menu">
                <li class="nav-item">
                    <a href="${p}parentsPortal.html" class="nav-link">
                        <i class="fas fa-chart-line"></i>
                        <span>Home</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="${p}childsResult.html" class="nav-link">
                        <i class="fas fa-file-alt"></i>
                        <span>Report Cards</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="${p}payments.html" class="nav-link">
                        <i class="fas fa-credit-card"></i>
                        <span>Payments</span>
                    </a>
                </li>
            </ul>

            <div style="margin-top: auto; padding: 20px; border-top: 1px solid var(--border-color);">
                <a href="#" id="parentLogoutBtn" class="nav-link" style="color: #ef4444; margin: 0;">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </a>
            </div>
        `;
    }

    document.addEventListener('DOMContentLoaded', () => {
        const sidebarElement = document.querySelector('[data-sideBar]');
        if (!sidebarElement) return;

        sidebarElement.innerHTML = buildSidebar();

        // Active link highlighting
        const currentPath = window.location.pathname;
        const parentOverride = document.body.getAttribute('data-parent-link');

        sidebarElement.querySelectorAll('.nav-link').forEach(link => {
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

        // Mobile close button (if there was one in this design. Using the toggle logic usually handled globally, but here is a hook if needed)
        const closeBtn = sidebarElement.querySelector('[data-sideBarClose]');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                sidebarElement.classList.remove('active', 'show'); // Adjust classes based on parents portal css
            });
        }

        // Logout functionality
        const logoutBtn = sidebarElement.querySelector('#parentLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    // Dynamically import config.js to get the initialized supabase client 
                    // (paths are relative to the HTML file: html/parentsPortal/page.html -> ../../scripts/config.js)
                    const { supabase } = await import('../../scripts/config.js');
                    await supabase.auth.signOut();
                } catch (error) {
                    console.error("Logout Error:", error);
                }
                window.location.href = '../../index.html';
            });
        }
    });
})();
