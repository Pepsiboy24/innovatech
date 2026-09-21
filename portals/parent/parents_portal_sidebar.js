// parents_portal_sidebar.js
// Uses runtime path detection so links are correct from BOTH:
//   portals/parent/anyPage.html       → prefix = "./"
//   portals/shared/anyPage.html       → prefix = "../parent/"

(function () {
    // Compute the relative path from the current page to the parentsPortal folder
    function parentPrefix() {
        const path = window.location.pathname;
        if (path.includes('/portals/shared/')) return '../parent/';
        return './';          // default: already in parent portal
    }

    async function loadParentIdentity() {
        try {
            const { supabase } = await import('../../core/config.js');
            const { waitForUser } = await import('../../core/perf.js');
            const user = await waitForUser();
            if (!user) return 'Parent';

            const { data: parentData } = await supabase
                .from('Parents')
                .select('full_name')
                .eq('user_id', user.id)
                .single();

            if (parentData?.full_name) return parentData.full_name;
            return 'Parent';

        } catch (error) {
            console.error('Error loading parent name:', error);
            return 'Parent';
        }
    }

    async function buildSidebar() {
        const p = parentPrefix();
        const parentName = await loadParentIdentity();

        return `
            <div class="sidebar-header">
                <div class="parent-icon">
                    <i class="fas fa-person"></i>
                </div>
                <div class="sidebar-header-text">
                    <p class="sidebar-role">PARENT PORTAL</p>
                    <p class="sidebar-name">${parentName}</p>
                </div>
            </div>

            <!-- GLOBAL CHILD SWITCHER CONTAINER -->
            <div id="globalChildSwitcherContainer"></div>

            <ul class="nav-menu">
                <li class="nav-item">
                    <a href="${p}parentsPortal.html" class="nav-link parent-nav-item">
                        <i class="fas fa-house"></i>
                        <span>Dashboard</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="${p}childsResult.html" class="nav-link parent-nav-item">
                        <i class="fas fa-chart-bar"></i>
                        <span>My Child's Results</span>
                    </a>
                </li>
                <li class="nav-item">
                    <a href="${p}payments.html" class="nav-link parent-nav-item">
                        <i class="fas fa-credit-card"></i>
                        <span>Payments</span>
                    </a>
                </li>
            </ul>

            <div class="sidebar-footer">
                <a href="#" id="parentLogoutBtn" class="nav-link parent-nav-item sidebar-logout">
                    <i class="fas fa-sign-out-alt"></i>
                    <span>Logout</span>
                </a>
            </div>
        `;
    }

    async function initSidebar() {
        // Target any element with class 'sidebar' to ensure it finds the container regardless of HTML tags
        const sidebarElement = document.querySelector('.sidebar');
        if (!sidebarElement) return;

        // Build sidebar with dynamic content
        sidebarElement.innerHTML = await buildSidebar();

        // Inject the child switcher logic
        await initGlobalChildSwitcher(sidebarElement);

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
                    const { supabase } = await import('../../core/config.js');
                    await supabase.auth.signOut();
                } catch (error) {
                    console.error("Logout Error:", error);
                }
                window.location.replace('/public/html/login.html');
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
                overlay.classList.toggle('active');
            }
        }

        // Attach to overlay click (click outside to close)
        if (overlay) {
            overlay.addEventListener('click', () => {
                sidebarElement.classList.remove('active');
                overlay.classList.remove('active');
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

    async function initGlobalChildSwitcher(sidebarElement) {
        const container = sidebarElement.querySelector('#globalChildSwitcherContainer');
        if (!container) return;

        try {
            const { supabase } = await import('../../core/config.js');
            const { waitForUser } = await import('../../core/perf.js');
            const user = await waitForUser();
            if (!user) return;

            const { data: parentRecord } = await supabase
                .from('Parents')
                .select('parent_id')
                .eq('user_id', user.id)
                .single();
            
            if (!parentRecord) return;

            const { data: links } = await supabase
                .from('Parent_Student_Links')
                .select(`
                    relationship,
                    Students (student_id, full_name, class_id, Classes (class_name, section))
                `)
                .eq('parent_id', parentRecord.parent_id);

            if (!links || links.length === 0) return;

            // Priority: active_child_id -> student_id
            let activeId = localStorage.getItem('active_child_id') || localStorage.getItem('student_id');
            if (!activeId) {
                activeId = links[0].Students.student_id;
                localStorage.setItem('active_child_id', activeId);
                localStorage.setItem('student_id', activeId);
            }

            const classLabel = (s) => {
                const cls = s.Classes;
                if (!cls) return '';
                const className = (cls.class_name || '').toString().trim();
                let section = (cls.section || '').toString().trim();
                if (section && className.toUpperCase().endsWith(section.toUpperCase())) {
                    section = '';
                }
                return section ? `${className} ${section}` : className;
            };

            let optionsHtml = links.map(l => {
                const s = l.Students;
                const classStr = classLabel(s);
                const label = classStr ? `${s.full_name} — ${classStr}` : s.full_name;
                return `<option value="${s.student_id}" ${s.student_id === activeId ? 'selected' : ''}>${label}</option>`;
            }).join('');

            container.innerHTML = `
                <div class="parent-identity">
                    <p class="parent-label">Parent of</p>
                    <select id="globalChildSwitcher" class="child-switcher-select">
                        ${optionsHtml}
                    </select>
                </div>
            `;

            const selectEl = container.querySelector('#globalChildSwitcher');
            selectEl.addEventListener('change', (e) => {
                const newId = e.target.value;
                if (newId === activeId) return;

                localStorage.setItem('active_child_id', newId);
                localStorage.setItem('student_id', newId);
                
                // Immediately reload the page to apply context
                location.reload();
            });

        } catch (err) {
            console.error('Error loading global child switcher:', err);
        }
    }

    // Execute immediately if DOM is already parsed (common for module scripts), else wait.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSidebar);
    } else {
        initSidebar();
    }
})();
