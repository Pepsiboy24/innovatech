// sidebar.js
const sidebarContent = `
    <div class="logo">
            <div style="display: flex; align-items: center; gap: 10px;">
                <div class="logo-icon"><i class="fa-solid fa-graduation-cap"></i></div>
                <span>EduHubAdmin</span>
            </div>
            <div class="icon mobile-menu-btn" data-sideBarClose><i class="fa fa-times"></i></div>
        </div>
        <nav>
            <a href="./schoolAdminDashboard.html" class="nav-item">
                <i class="fa-solid fa-table-columns nav-icon"></i>
                Dashboard
            </a>
            <a href="./classes.html" class="nav-item active">
                <i class="fa-solid fa-chalkboard-user nav-icon"></i>
                <span>Classes</span>
            </a>
            <a href="./students.html" class="nav-item">
                <i class="fa-solid fa-user-graduate nav-icon"></i>
                Students
            </a>
            <a href="./teachers.html" class="nav-item">
                <i class="fa-solid fa-chalkboard-teacher nav-icon"></i>
                Teachers
            </a>
            <a href="./schooladmins.html" class="nav-item active">
                <i class="fa-solid fa-user-tie nav-icon"></i>
                School Admins
            </a>
            <a href="./subjects.html" class="nav-item">
                <svg class="nav-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                <span>Subjects</span>
            </a>
            <a href="./curriculum_tracker.html" class="nav-item">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M4 19.5V4.5C4 3.67157 4.67157 3 5.5 3H18.5C19.3284 3 20 3.67157 20 4.5V19.5C20 20.3284 19.3284 21 18.5 21H5.5C4.67157 21 4 20.3284 4 19.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M7 3V21" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 7H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 11H16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M11 15H14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
                Curriculum
            </a>
            <a href="./schedule.html" class="nav-item">
                <i class="fa-regular fa-calendar nav-icon"></i>
                Schedule
            </a>
            <a href="./timeTable.html" class="nav-item">
                <i class="fa-solid fa-clock nav-icon"></i>
                Time Table
            </a>
            <!-- <a href="#" class="nav-item">
                <i class="fa-solid fa-clipboard-user nav-icon"></i>
                Attendance
            </a>
            <a href="#" class="nav-item">
                <i class="fa-solid fa-money-bill-wave nav-icon"></i>
                Fees
            </a> -->
        </nav>
`;

document.addEventListener("DOMContentLoaded", () => {
    const sidebarElement = document.querySelector('[data-sideBar]');
    if (sidebarElement) {
        sidebarElement.innerHTML = sidebarContent;

        const currentPath = window.location.pathname;
        // Check if the body has a designated parent link
        const parentOverride = document.body.getAttribute('data-parent-link');

        const navLinks = sidebarElement.querySelectorAll('.nav-item');

        navLinks.forEach(link => {
            // Get the clean filename from the link (e.g., "timeTable.html")
            const linkHref = link.getAttribute('href').replace('./', '');

            // Get the clean filename from the parent override if it exists
            const cleanParent = parentOverride ? parentOverride.replace('./', '') : null;

            // 1. Check if the current URL ends with this link
            const isDirectMatch = linkHref !== "#" && currentPath.endsWith(linkHref);

            // 2. Check if the parent override matches this link
            const isParentMatch = cleanParent && linkHref.includes(cleanParent);

            if (isDirectMatch || isParentMatch) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
});



