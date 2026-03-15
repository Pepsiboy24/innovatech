// Simple sidebar test without dependencies
console.log('Simple sidebar script loading...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, looking for sidebar...');
    
    const sidebarElement = document.querySelector('[data-sideBar]');
    if (!sidebarElement) {
        console.error('Sidebar element not found!');
        return;
    }
    
    console.log('Sidebar element found, inserting content...');
    
    // Simple sidebar content without dynamic branding
    const sidebarContent = `
        <div class="logo">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                <span style="font-weight: 600; color: #1e293b;">EduHub Admin</span>
            </div>
            <div class="icon mobile-menu-btn" data-sideBarClose><i class="fa fa-times"></i></div>
        </div>
        <nav style="display: flex; flex-direction: column; flex: 1;">
            <a href="./schoolAdminDashboard.html" class="nav-item">
                <i class="fa-solid fa-table-columns nav-icon"></i>
                Dashboard
            </a>
            <a href="./classes.html" class="nav-item">
                <i class="fa-solid fa-chalkboard-user nav-icon"></i>
                Classes
            </a>
            <a href="./students.html" class="nav-item">
                <i class="fa-solid fa-user-graduate nav-icon"></i>
                Students
            </a>
            <a href="./teachers.html" class="nav-item">
                <i class="fa-solid fa-chalkboard-teacher nav-icon"></i>
                Teachers
            </a>
            <a href="./settings.html" class="nav-item">
                <i class="fa-solid fa-cog nav-icon"></i>
                Settings
            </a>
            <a href="#" id="schoolAdminLogoutBtn" class="nav-item" style="margin-top: auto; border-top: 1px solid var(--border);">
                <i class="fa-solid fa-sign-out-alt nav-icon"></i>
                Logout
            </a>
        </nav>
    `;
    
    sidebarElement.innerHTML = sidebarContent;
    console.log('Sidebar content inserted successfully!');
    
    // Add mobile menu functionality
    const closeBtn = sidebarElement.querySelector('[data-sideBarClose]');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            sidebarElement.classList.remove('show', 'open', 'active');
            console.log('Sidebar closed');
        });
    }
    
    const openBtn = document.querySelector('[data-sideBarOpen]');
    if (openBtn) {
        openBtn.addEventListener('click', () => {
            sidebarElement.classList.add('show', 'open', 'active');
            console.log('Sidebar opened');
        });
    }
    
    // Logout functionality
    const logoutBtn = sidebarElement.querySelector('#schoolAdminLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            console.log('Logout clicked');
            window.location.href = '../../index.html';
        });
    }
    
    // Active link highlighting
    const currentPath = window.location.pathname;
    sidebarElement.querySelectorAll('.nav-item').forEach(link => {
        const linkHref = link.getAttribute('href') || '';
        const filename = linkHref.split('/').pop();
        if (filename && currentPath.endsWith(filename)) {
            link.classList.add('active');
        }
    });
    
    console.log('Simple sidebar setup complete!');
});
