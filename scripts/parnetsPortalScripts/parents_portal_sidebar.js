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

    function buildSidebar() {
        const p = parentPrefix();

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

            <div style="margin-top: auto; padding: 20px; border-top: 1px solid #e2e8f0;">
                <a href="#" id="parentLogoutBtn" class="nav-link" style="color: #ef4444; margin: 0; display: flex; align-items: center; gap: 0.75rem;">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </a>
            </div>
        `;
    }

    function initSidebar() {
        // Target any element with class 'sidebar' to ensure it finds the container regardless of HTML tags
        const sidebarElement = document.querySelector('.sidebar');
        if (!sidebarElement) return;

        sidebarElement.innerHTML = buildSidebar();

        // Active link highlighting
        const currentPath = window.location.pathname;
        const parentOverride = document.body.getAttribute('data-parent-link');

        sidebarElement.querySelectorAll('.nav-link').forEach(link => {
            const linkHref = link.getAttribute('href') || '';
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

        // Logout functionality
        const logoutBtn = sidebarElement.querySelector('#parentLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                try {
                    const { supabase } = await import('../../scripts/config.js');
                    await supabase.auth.signOut();
                } catch (error) {
                    console.error("Logout Error:", error);
                }
                window.location.href = '../../index.html';
            });
        }

        // --- Standardized Mobile Toggle Handling ---
        let overlay = document.getElementById('parentOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'parentOverlay';
            overlay.className = 'sidebar-overlay';
            overlay.style.cssText = 'display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 1999;';
            document.body.appendChild(overlay);
        }
        
        // Define toggle function
        function toggleSidebar() {
            sidebarElement.classList.toggle('active');
            if (overlay) {
                overlay.style.display = sidebarElement.classList.contains('active') ? 'block' : 'none';
            }
        }

        // Attach to overlay click (click outside to close)
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebarElement.classList.remove('active');
                overlay.style.display = 'none';
            });
        }

        // We export it globally because some HTML buttons use inline onclick="toggleSidebar()"
        window.toggleSidebar = toggleSidebar;

        // Also attach via Event Listeners for buttons without inline handlers (like payments.html #menuToggle)
        const paymentMenuToggle = document.getElementById('menuToggle');
        if (paymentMenuToggle) {
            paymentMenuToggle.addEventListener('click', toggleSidebar);
        }
        
        // Attach to `.mobile-menu-btn` if it exists and doesn't have inline onclick
        document.querySelectorAll('.mobile-menu-btn:not([onclick])').forEach(btn => {
            btn.addEventListener('click', toggleSidebar);
        });

        // Hide overlay and reset sidebar state when resizing back to desktop
        window.addEventListener('resize', () => {
            if (window.innerWidth > 768) {
                sidebarElement.classList.remove('active');
                if (overlay) overlay.style.display = 'none';
            }
        });
    }

    // Execute immediately if DOM is already parsed (common for module scripts), else wait.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();
